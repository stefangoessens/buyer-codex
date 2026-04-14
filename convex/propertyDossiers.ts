import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import type { Id } from "./_generated/dataModel";
import { buildNeighborhoodRequests } from "../src/lib/enrichment/jobContext";
import { buildPropertyMarketContext } from "../src/lib/enrichment/marketContext";
import {
  buildPropertyDossier,
  projectBuyerSafeDossier,
  type DossierBrowserRun,
  type DossierLatestEngineOutput,
  type DossierPropertyRecord,
  type DossierSourceListingRecord,
  type LatestOutputsSectionData,
  type PropertyDossier,
} from "../src/lib/dossier";
import type {
  ListingAgentProfile,
  PropertyEnrichmentSnapshot,
  PropertyMarketContext,
  PortalEstimate,
  RecentComparableSale,
} from "../src/lib/enrichment/types";
import {
  filterForBuyer,
  projectBuyerSummary,
  projectInternalSummary,
  type RawFileAnalysis,
} from "../src/lib/dealroom/document-summary";
import type {
  CompsOutput,
  LeverageOutput,
  OfferOutput,
  PricingOutput,
} from "../src/lib/ai/engines/types";
import { parseAnalysisSnapshot } from "./lib/fileAnalysisPipeline";

async function canReadProperty(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<boolean> {
  const user = await requireAuth(ctx);
  if (user.role === "broker" || user.role === "admin") return true;

  const buyerRooms = await ctx.db
    .query("dealRooms")
    .withIndex("by_buyerId", (q: any) => q.eq("buyerId", user._id))
    .collect();
  return buyerRooms.some((room: any) => room.propertyId === propertyId);
}

function safeParseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function loadSourceListings(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<DossierSourceListingRecord[]> {
  const rows = await ctx.db
    .query("sourceListings")
    .withIndex("by_propertyId", (q: any) => q.eq("propertyId", propertyId))
    .collect();
  return rows.map((row: any) => ({
    sourcePlatform: row.sourcePlatform,
    sourceUrl: row.sourceUrl,
    status: row.status,
    extractedAt: row.extractedAt,
  }));
}

async function loadListingAgentsForProperty(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<ListingAgentProfile[]> {
  const links = await ctx.db
    .query("propertyAgentLinks")
    .withIndex("by_propertyId", (q: any) => q.eq("propertyId", propertyId))
    .collect();

  const agents: ListingAgentProfile[] = [];
  for (const link of links) {
    const agent = await ctx.db.get(link.agentId);
    if (!agent) continue;
    agents.push(agent);
  }

  return agents.sort((a, b) => b.lastRefreshedAt.localeCompare(a.lastRefreshedAt));
}

async function loadNeighborhoodContextsForProperty(ctx: any, property: any) {
  const requests = buildNeighborhoodRequests({
    canonicalId: property.canonicalId,
    sourcePlatform: property.sourcePlatform,
    address: {
      city: property.address.city,
      formatted: property.address.formatted,
      zip: property.address.zip,
    },
    buildingName: property.buildingName,
    neighborhood: property.neighborhood,
    subdivision: property.subdivision,
    schoolDistrict: property.schoolDistrict,
  });

  const rows: any[] = [];
  for (const request of requests) {
    const row = await ctx.db
      .query("neighborhoodMarketContext")
      .withIndex("by_geoKind_and_geoKey_and_windowDays", (q: any) =>
        q
          .eq("geoKind", request.geoKind)
          .eq("geoKey", request.geoKey)
          .eq("windowDays", request.windowDays),
      )
      .unique();
    if (row) rows.push(row);
  }

  return rows;
}

async function loadLatestPortalEstimates(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<PortalEstimate[]> {
  const rows = await ctx.db
    .query("portalEstimates")
    .withIndex("by_propertyId_and_capturedAt", (q: any) =>
      q.eq("propertyId", propertyId),
    )
    .order("desc")
    .collect();

  const latestByPortal = new Map<string, PortalEstimate>();
  for (const row of rows) {
    if (!latestByPortal.has(row.portal)) {
      latestByPortal.set(row.portal, row);
    }
  }

  return Array.from(latestByPortal.values());
}

async function loadRecentSales(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<RecentComparableSale[]> {
  return await ctx.db
    .query("recentComparableSales")
    .withIndex("by_propertyId_and_soldDate", (q: any) => q.eq("propertyId", propertyId))
    .order("desc")
    .collect();
}

async function loadSnapshots(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<PropertyEnrichmentSnapshot[]> {
  const rows = await ctx.db
    .query("propertyEnrichmentSnapshots")
    .withIndex("by_propertyId_and_source", (q: any) => q.eq("propertyId", propertyId))
    .collect();

  return rows.map((row: any) => ({
    propertyId: String(row.propertyId),
    source: row.source,
    payload: safeParseJson(row.payloadJson) ?? row.payloadJson,
    provenance: row.provenance,
    lastRefreshedAt: row.lastRefreshedAt,
  }));
}

function loadBrowserUseRuns(jobs: Array<any>): DossierBrowserRun[] {
  return jobs
    .filter((job) => job.source === "browser_use_hosted")
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""))
    .map((job) => {
      const context = safeParseJson<Record<string, any>>(job.contextJson) ?? {};
      const result = safeParseJson<Record<string, any>>(job.resultRef) ?? {};
      const trigger: DossierBrowserRun["trigger"] =
        typeof result.trigger === "string" &&
        [
          "parser_failure",
          "low_confidence_parse",
          "missing_critical_fields",
          "conflicting_portal_data",
          "operator_requested_deep_extract",
        ].includes(result.trigger)
          ? (result.trigger as DossierBrowserRun["trigger"])
          : typeof context.trigger === "string" &&
              [
                "parser_failure",
                "low_confidence_parse",
                "missing_critical_fields",
                "conflicting_portal_data",
                "operator_requested_deep_extract",
              ].includes(context.trigger)
            ? (context.trigger as DossierBrowserRun["trigger"])
            : undefined;
      const reviewState: DossierBrowserRun["reviewState"] =
        typeof result.reviewState === "string" &&
        ["pending", "needs_review", "approved"].includes(result.reviewState)
          ? (result.reviewState as DossierBrowserRun["reviewState"])
          : job.status === "escalated"
            ? "needs_review"
            : "pending";
      return {
        jobId: String(job._id),
        runState: job.status,
        reviewState,
        trigger,
        sourceUrl:
          typeof result.sourceUrl === "string"
            ? result.sourceUrl
            : typeof context.sourceUrl === "string"
              ? context.sourceUrl
              : undefined,
        portal:
          typeof result.portal === "string"
            ? result.portal
            : typeof context.portal === "string"
              ? context.portal
              : undefined,
        note:
          typeof context.note === "string" && context.note.length > 0
            ? context.note
            : undefined,
        parseConfidence:
          typeof context.parseConfidence === "number"
            ? context.parseConfidence
            : undefined,
        minimumParseConfidence:
          typeof context.minimumParseConfidence === "number"
            ? context.minimumParseConfidence
            : undefined,
        missingCriticalFields: Array.isArray(context.missingCriticalFields)
          ? context.missingCriticalFields
          : [],
        conflictingFields: Array.isArray(context.conflictingFields)
          ? context.conflictingFields
          : [],
        confidence:
          typeof result.confidence === "number" ? result.confidence : undefined,
        citations: Array.isArray(result.citations) ? result.citations : [],
        trace:
          result.trace && typeof result.trace === "object"
            ? result.trace
            : { steps: [], artifacts: [] },
        canonicalFields:
          result.canonicalFields && typeof result.canonicalFields === "object"
            ? result.canonicalFields
            : {},
        fieldMetadata:
          result.fieldMetadata && typeof result.fieldMetadata === "object"
            ? result.fieldMetadata
            : {},
        mergeProvenance:
          result.mergeProvenance && typeof result.mergeProvenance === "object"
            ? result.mergeProvenance
            : {},
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
        requestedAt: job.requestedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      };
    });
}

async function loadBrowserUseJobs(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<DossierBrowserRun[]> {
  const jobs = await ctx.db
    .query("enrichmentJobs")
    .withIndex("by_propertyId_and_source", (q: any) => q.eq("propertyId", propertyId))
    .collect();
  return loadBrowserUseRuns(jobs);
}

type EngineOutputMap = {
  pricing: PricingOutput;
  comps: CompsOutput;
  leverage: LeverageOutput;
  offer: OfferOutput;
};

async function loadLatestEngineOutputs(
  ctx: any,
  propertyId: Id<"properties">,
): Promise<LatestOutputsSectionData> {
  const engineTypes = ["pricing", "comps", "leverage", "offer"] as const;
  const entries = await Promise.all(
    engineTypes.map(async (engineType) => {
      const row = await ctx.db
        .query("aiEngineOutputs")
        .withIndex("by_propertyId_and_engineType", (q: any) =>
          q.eq("propertyId", propertyId).eq("engineType", engineType),
        )
        .order("desc")
        .first();
      if (!row) return [engineType, undefined] as const;

      return [
        engineType,
        {
          outputId: String(row._id),
          engineType,
          promptVersion: row.promptVersion,
          reviewState: row.reviewState,
          confidence: row.confidence,
          citations: row.citations ?? [],
          generatedAt: row.generatedAt,
          inputSnapshot: row.inputSnapshot,
          output: safeParseJson<EngineOutputMap[typeof engineType]>(row.output),
        } satisfies DossierLatestEngineOutput<EngineOutputMap[typeof engineType]>,
      ] as const;
    }),
  );

  return Object.fromEntries(entries) as LatestOutputsSectionData;
}

function normalizeDocumentType(docType: string): RawFileAnalysis["documentType"] {
  return docType === "unknown" ? "other" : (docType as RawFileAnalysis["documentType"]);
}

function mapJobStatus(status: string): RawFileAnalysis["status"] {
  switch (status) {
    case "completed":
    case "resolved":
      return "succeeded";
    default:
      return status as RawFileAnalysis["status"];
  }
}

function mapReviewState(status: string): RawFileAnalysis["reviewState"] {
  switch (status) {
    case "completed":
    case "resolved":
      return "approved";
    default:
      return "pending";
  }
}

function toRawAnalysis(job: any, findings: Array<any>): RawFileAnalysis {
  const snapshot = parseAnalysisSnapshot(job.payload);
  const fallbackFactsPayload =
    snapshot?.analysis.buyerFacts.length || snapshot?.analysis.plainEnglishSummary
      ? JSON.stringify({
          buyerFacts: snapshot?.analysis.buyerFacts ?? [],
          plainEnglishSummary: snapshot?.analysis.plainEnglishSummary ?? "",
        })
      : job.payload ??
    JSON.stringify({
      buyerFacts: findings.map((finding) => finding.summary).slice(0, 3),
    });

  return {
    _id: String(job._id),
    documentId: String(job.fileStorageId),
    dealRoomId: String(job.dealRoomId),
    documentType: normalizeDocumentType(job.docType),
    fileName: job.fileName,
    status: mapJobStatus(job.status),
    reviewState: mapReviewState(job.status),
    factsPayload: fallbackFactsPayload,
    reviewNotes: job.reviewNotes,
    confidence: job.overallConfidence ?? 0,
    severity: job.overallSeverity ?? "info",
    uploadedAt: job.createdAt,
    analyzedAt: job.completedAt,
    reviewedAt: job.resolvedAt,
    extractedPageCount: snapshot?.analysis.pageClassifications.length ?? 0,
    totalPageCount: snapshot?.analysis.pageClassifications.length ?? 0,
  };
}

async function loadDocumentSummaries(
  ctx: any,
  propertyId: Id<"properties">,
  dealRoomId?: Id<"dealRooms">,
): Promise<{
  buyerSummaries: ReturnType<typeof projectBuyerSummary>[];
  internalSummaries: ReturnType<typeof projectInternalSummary>[];
}> {
  if (!dealRoomId) {
    return { buyerSummaries: [], internalSummaries: [] };
  }

  const dealRoom = await ctx.db.get(dealRoomId);
  if (!dealRoom || dealRoom.propertyId !== propertyId) {
    return { buyerSummaries: [], internalSummaries: [] };
  }

  const jobs = await ctx.db
    .query("fileAnalysisJobs")
    .withIndex("by_dealRoomId", (q: any) => q.eq("dealRoomId", dealRoomId))
    .collect();
  const raw = await Promise.all(
    jobs.map(async (job: any) => {
      const findings = await ctx.db
        .query("fileAnalysisFindings")
        .withIndex("by_jobId", (q: any) => q.eq("jobId", job._id))
        .collect();
      return toRawAnalysis(job, findings);
    }),
  );

  return {
    buyerSummaries: filterForBuyer(raw).map(projectBuyerSummary),
    internalSummaries: raw.map(projectInternalSummary),
  };
}

function latestTimestamp(values: Array<string | undefined | null>): string | null {
  const normalized = values.filter((value): value is string => Boolean(value));
  if (normalized.length === 0) return null;
  return normalized.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

async function buildLiveDossier(
  ctx: any,
  propertyId: Id<"properties">,
  dealRoomId?: Id<"dealRooms">,
): Promise<PropertyDossier | null> {
  const property = (await ctx.db.get(propertyId)) as DossierPropertyRecord | null;
  if (!property) return null;

  const [
    sourceListings,
    listingAgents,
    neighborhoodContexts,
    portalEstimates,
    recentSales,
    snapshots,
    browserUseRuns,
    latestOutputs,
    documents,
  ] = await Promise.all([
    loadSourceListings(ctx, propertyId),
    loadListingAgentsForProperty(ctx, propertyId),
    loadNeighborhoodContextsForProperty(ctx, property),
    loadLatestPortalEstimates(ctx, propertyId),
    loadRecentSales(ctx, propertyId),
    loadSnapshots(ctx, propertyId),
    loadBrowserUseJobs(ctx, propertyId),
    loadLatestEngineOutputs(ctx, propertyId),
    loadDocumentSummaries(ctx, propertyId, dealRoomId),
  ]);

  const marketContext: PropertyMarketContext | null =
    neighborhoodContexts.length > 0
      ? buildPropertyMarketContext({
          baselines: neighborhoodContexts,
          subject: {
            propertyId: String(propertyId),
            buildingName: property.buildingName,
            subdivision: property.subdivision,
            neighborhood: property.neighborhood,
            schoolDistrict: property.schoolDistrict,
            zip: property.zip ?? property.address?.zip,
            broaderArea: property.address?.city,
          },
          generatedAt:
            latestTimestamp(
              neighborhoodContexts.map((context: any) => context.lastRefreshedAt),
            ) ??
            property.updatedAt,
        })
      : null;

  const generatedAt =
    latestTimestamp([
      property.updatedAt,
      property.extractedAt,
      ...sourceListings.map((row) => row.extractedAt),
      ...portalEstimates.map((row) => row.capturedAt),
      ...recentSales.map((row) => row.capturedAt),
      ...snapshots.map((row) => row.lastRefreshedAt),
      ...listingAgents.map((row) => row.lastRefreshedAt),
      ...browserUseRuns.map((run) => run.completedAt ?? run.requestedAt),
      ...Object.values(latestOutputs)
        .filter(Boolean)
        .map((row) => row!.generatedAt),
      ...documents.buyerSummaries.map((row) => row.uploadedAt),
    ]) ?? property.updatedAt;

  return buildPropertyDossier({
    generatedAt,
    property: {
      ...property,
      _id: String(property._id ?? propertyId),
    },
    sourceListings,
    marketContext,
    portalEstimates,
    recentSales,
    browserUseRuns,
    snapshots,
    listingAgents,
    documentBuyerSummaries: documents.buyerSummaries,
    documentInternalSummaries: documents.internalSummaries,
    latestOutputs,
  });
}

async function upsertStoredDossier(
  ctx: any,
  propertyId: Id<"properties">,
  dossier: PropertyDossier,
) {
  const rows = await ctx.db
    .query("propertyDossiers")
    .withIndex("by_propertyId", (q: any) => q.eq("propertyId", propertyId))
    .collect();

  const payload = JSON.stringify(dossier);
  const newest = [...rows].sort((left, right) =>
    (right.generatedAt ?? "").localeCompare(left.generatedAt ?? ""),
  )[0];

  if (
    newest &&
    newest.fingerprint === dossier.fingerprint &&
    newest.compositionVersion === dossier.compositionVersion &&
    newest.payload === payload
  ) {
    for (const duplicate of rows) {
      if (duplicate._id !== newest._id) {
        await ctx.db.delete(duplicate._id);
      }
    }
    return newest._id;
  }

  if (newest) {
    await ctx.db.patch(newest._id, {
      canonicalId: dossier.canonicalId,
      compositionVersion: dossier.compositionVersion,
      generatedAt: dossier.generatedAt,
      lastSourceUpdatedAt: dossier.lastSourceUpdatedAt ?? undefined,
      fingerprint: dossier.fingerprint,
      replayKey: dossier.replayKey,
      payload,
    });
    for (const duplicate of rows) {
      if (duplicate._id !== newest._id) {
        await ctx.db.delete(duplicate._id);
      }
    }
    return newest._id;
  }

  return await ctx.db.insert("propertyDossiers", {
    propertyId,
    canonicalId: dossier.canonicalId,
    compositionVersion: dossier.compositionVersion,
    generatedAt: dossier.generatedAt,
    lastSourceUpdatedAt: dossier.lastSourceUpdatedAt ?? undefined,
    fingerprint: dossier.fingerprint,
    replayKey: dossier.replayKey,
    payload,
  });
}

export const getForPropertyInternal = internalQuery({
  args: {
    propertyId: v.id("properties"),
    dealRoomId: v.optional(v.id("dealRooms")),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    return await buildLiveDossier(ctx, args.propertyId, args.dealRoomId);
  },
});

export const getForProperty = query({
  args: {
    propertyId: v.id("properties"),
    dealRoomId: v.optional(v.id("dealRooms")),
    includeInternal: v.optional(v.boolean()),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const allowed = await canReadProperty(ctx, args.propertyId);
    if (!allowed) return null;

    if (args.dealRoomId) {
      const dealRoom = await ctx.db.get(args.dealRoomId);
      if (!dealRoom || dealRoom.propertyId !== args.propertyId) return null;
      if (
        dealRoom.buyerId !== user._id &&
        user.role !== "broker" &&
        user.role !== "admin"
      ) {
        return null;
      }
    }

    const dossier = await buildLiveDossier(ctx, args.propertyId, args.dealRoomId);
    if (!dossier) return null;

    if (args.includeInternal && (user.role === "broker" || user.role === "admin")) {
      return dossier;
    }

    return projectBuyerSafeDossier(dossier);
  },
});

export const syncForProperty = internalMutation({
  args: {
    propertyId: v.id("properties"),
    dealRoomId: v.optional(v.id("dealRooms")),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const dossier = await buildLiveDossier(ctx, args.propertyId, args.dealRoomId);
    if (!dossier) return null;
    await upsertStoredDossier(ctx, args.propertyId, dossier);
    return dossier;
  },
});

export const getStoredForPropertyInternal = internalQuery({
  args: {
    propertyId: v.id("properties"),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("propertyDossiers")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", args.propertyId))
      .collect();
    const newest = [...rows].sort((left, right) =>
      (right.generatedAt ?? "").localeCompare(left.generatedAt ?? ""),
    )[0];
    return newest ? safeParseJson<PropertyDossier>(newest.payload) : null;
  },
});
