import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/session";
import {
  composeOverview,
  type OverviewInputs,
  type RawEngineOutput,
} from "./lib/overview";
import type { PropertyCase } from "../src/lib/ai/engines/caseSynthesis";
import {
  buildPropertyCaseOverview,
  type PropertyCaseCitationInput,
  type PropertyCaseCoverageInput,
} from "../src/lib/dealroom/property-case-overview";
import type { PropertyDossier } from "../src/lib/dossier/types";

export const getOverview = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) return null;

    const isOwner = dealRoom.buyerId === user._id;
    const isStaff = user.role === "broker" || user.role === "admin";
    if (!isOwner && !isStaff) return null;

    const property = await ctx.db.get(dealRoom.propertyId);
    if (!property) return null;

    const [engineDocs, offerDocs, caseDocs, dossierDocs] = await Promise.all([
      ctx.db
        .query("aiEngineOutputs")
        .withIndex("by_propertyId_and_engineType", (q) =>
          q.eq("propertyId", dealRoom.propertyId),
        )
        .collect(),
      ctx.db
        .query("offers")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      ctx.db
        .query("propertyCases")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      ctx.db
        .query("propertyDossiers")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", dealRoom.propertyId))
        .collect(),
    ]);

    const adjudicationHistoryEntries = await Promise.all(
      engineDocs.map(
        async (doc): Promise<[string, Array<Doc<"aiOutputAdjudications">>]> => [
          String(doc._id),
          await ctx.db
            .query("aiOutputAdjudications")
            .withIndex("by_engineOutputId_and_actedAt", (q) =>
              q.eq("engineOutputId", doc._id),
            )
            .collect(),
        ],
      ),
    );
    const adjudicationHistoryByOutput = new Map(adjudicationHistoryEntries);
    const actorIds = new Set<string>();
    for (const doc of engineDocs) {
      if (doc.adjudication?.actorUserId) {
        actorIds.add(String(doc.adjudication.actorUserId));
      }
      for (const entry of adjudicationHistoryByOutput.get(String(doc._id)) ?? []) {
        actorIds.add(String(entry.actorUserId));
      }
    }
    const actorNameEntries = await Promise.all(
      Array.from(actorIds).map(
        async (actorId): Promise<[string, string | null]> => [
          actorId,
          (await ctx.db.get(actorId as Id<"users">))?.name ?? null,
        ],
      ),
    );
    const actorNameById = new Map(actorNameEntries);

    const latestByType = new Map<string, Doc<"aiEngineOutputs">>();
    for (const doc of engineDocs) {
      const existing = latestByType.get(doc.engineType);
      if (!existing || doc.generatedAt > existing.generatedAt) {
        latestByType.set(doc.engineType, doc);
      }
    }

    const latestOutputs: RawEngineOutput[] = Array.from(latestByType.values()).map(
      (doc) => ({
        engineType: doc.engineType,
        output: doc.output,
        confidence: doc.confidence,
        reviewState: doc.reviewState,
        generatedAt: doc.generatedAt,
      }),
    );

    const submittedOffer = offerDocs
      .filter(
        (offer) =>
          offer.status === "submitted" ||
          offer.status === "countered" ||
          offer.status === "accepted",
      )
      .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))[0];

    let latestOffer: OverviewInputs["latestOffer"];
    if (submittedOffer) {
      latestOffer = {
        scenarioName: "Submitted offer",
        price: submittedOffer.offerPrice,
        competitivenessScore: 50,
        scenarioCount: 1,
      };
    }

    const composed = composeOverview(
      {
        dealRoomId: dealRoom._id,
        propertyId: dealRoom.propertyId,
        dealStatus: dealRoom.status,
        updatedAt: dealRoom.updatedAt,
        engines: latestOutputs,
        latestOffer,
      },
      {
        forRole:
          user.role === "broker" || user.role === "admin" ? user.role : "buyer",
      },
    );

    const latestCase = caseDocs
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .at(0);
    const latestDossier = dossierDocs
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      .map((doc) => parsePropertyDossier(doc.payload))
      .find((doc): doc is PropertyDossier => Boolean(doc));

    const coverage: PropertyCaseCoverageInput[] = [
      {
        key: "pricing",
        status: composed.pricing.status,
        reason: composed.pricing.reason,
        confidence: composed.pricing.confidence,
      },
      composeCompsCoverage(latestByType.get("comps")),
      {
        key: "leverage",
        status: composed.leverage.status,
        reason: composed.leverage.reason,
        confidence: composed.leverage.confidence,
      },
      {
        key: "offer",
        status: composed.offer.status,
        reason: composed.offer.reason,
        confidence: composed.offer.confidence,
      },
    ];

    const citations: PropertyCaseCitationInput[] = engineDocs.map((doc) => ({
      citationId: String(doc._id),
      engineType: doc.engineType,
      confidence: doc.confidence,
      generatedAt: doc.generatedAt,
      reviewState: doc.reviewState,
      adjudication: doc.adjudication
        ? {
            ...doc.adjudication,
            actorUserId: String(doc.adjudication.actorUserId),
            actorName:
              actorNameById.get(String(doc.adjudication.actorUserId)) ?? null,
          }
        : null,
      adjudicationHistory: (
        adjudicationHistoryByOutput.get(String(doc._id)) ?? []
      ).map((entry) => ({
        ...entry,
        actorUserId: String(entry.actorUserId),
        actorName: actorNameById.get(String(entry.actorUserId)) ?? null,
      })),
    }));

    return buildPropertyCaseOverview({
      dealRoomId: dealRoom._id,
      propertyId: dealRoom.propertyId,
      propertyAddress: formatPropertyAddress(property),
      listPrice: property.listPrice ?? null,
      photoUrl: property.photoUrls?.[0] ?? null,
      dealStatus: dealRoom.status,
      caseRecord: latestCase
        ? {
            generatedAt: latestCase.generatedAt,
            hitCount: latestCase.hitCount,
            payload: parsePropertyCase(latestCase.payload),
          }
        : null,
      coverage,
      citations,
      evidenceGraph: latestDossier?.evidenceGraph ?? null,
      viewerRole:
        user.role === "broker" || user.role === "admin" ? user.role : "buyer",
    });
  },
});

function composeCompsCoverage(
  raw: Doc<"aiEngineOutputs"> | undefined,
): PropertyCaseCoverageInput {
  if (!raw) {
    return {
      key: "comps",
      status: "unavailable",
      reason: "Comparable-sales analysis has not produced a buyer-safe result yet.",
    };
  }

  if (raw.reviewState === "pending") {
    return {
      key: "comps",
      status: "pending",
      reason: "Comparable-sales analysis is still under review.",
      confidence: raw.confidence,
    };
  }

  if (raw.reviewState === "rejected") {
    return {
      key: "comps",
      status: "unavailable",
      reason: "Comparable-sales analysis was rejected during review.",
    };
  }

  try {
    const parsed = JSON.parse(raw.output) as { comps?: unknown[] };
    if (!Array.isArray(parsed.comps)) {
      return {
        key: "comps",
        status: "unavailable",
        reason: "Comparable-sales output could not be parsed.",
      };
    }

    if (parsed.comps.length < 3) {
      return {
        key: "comps",
        status: "unavailable",
        reason: "Need at least three verified comparable sales before showing a comps claim.",
      };
    }

    return {
      key: "comps",
      status: "available",
      confidence: raw.confidence,
    };
  } catch {
    return {
      key: "comps",
      status: "unavailable",
      reason: "Comparable-sales output could not be parsed.",
    };
  }
}

function parsePropertyCase(payload: string): PropertyCase | null {
  try {
    const parsed = JSON.parse(payload) as Partial<PropertyCase>;
    if (!Array.isArray(parsed.claims)) return null;

    return {
      claims: parsed.claims,
      recommendedAction: parsed.recommendedAction,
      overallConfidence:
        typeof parsed.overallConfidence === "number" ? parsed.overallConfidence : 0,
      contributingEngines:
        typeof parsed.contributingEngines === "number"
          ? parsed.contributingEngines
          : 0,
      inputHash: typeof parsed.inputHash === "string" ? parsed.inputHash : "",
      synthesisVersion:
        typeof parsed.synthesisVersion === "string"
          ? parsed.synthesisVersion
          : "",
      droppedEngines: Array.isArray(parsed.droppedEngines)
        ? parsed.droppedEngines.filter(
            (engine): engine is string => typeof engine === "string",
          )
        : [],
    };
  } catch {
    return null;
  }
}

function parsePropertyDossier(payload: string): PropertyDossier | null {
  try {
    const parsed = JSON.parse(payload) as PropertyDossier;
    if (!parsed?.evidenceGraph?.sections || !parsed?.evidenceGraph?.fingerprint) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function formatPropertyAddress(property: Doc<"properties">): string {
  return (
    property.address.formatted ??
    `${property.address.street}${property.address.unit ? ` ${property.address.unit}` : ""}, ${property.address.city}, ${property.address.state} ${property.address.zip}`
  );
}
