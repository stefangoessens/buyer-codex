import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { determineReviewState, ENGINE_TYPES } from "./lib/engineResult";
import { trackPosthogEvent } from "./lib/analytics";
import { getCurrentUser, requireRole } from "./lib/session";
import {
  aiOutputAdjudicationAction,
  aiOutputAdjudicationStatus,
  aiOutputAdjudicationVisibility,
  aiReviewState,
  brokerOverrideReasonCategory,
} from "./lib/validators";
import {
  assessEngineOutputGuardrail,
  defaultApprovedGuardrailState,
} from "../src/lib/advisory/guardrails";
import {
  adjudicationReviewStateFromVisibility,
  type AdvisoryAdjudicationAction,
  type AdvisoryAdjudicationSnapshot,
  type AdvisoryAdjudicationStatus,
  type AdvisoryAdjudicationVisibility,
} from "../src/lib/advisory/adjudication";
import type {
  AdjudicationLinkedClaimTopic,
} from "../src/lib/ai/engines/types";
import type { PropertyCase } from "../src/lib/ai/engines/caseSynthesis";
import {
  buildAdjudicationCalibrationRecord,
  recommendationRelevantFromEngineType,
} from "../src/lib/ai/engines/adjudicationCalibration";

const advisorySurfaceValidator = v.union(
  v.literal("deal_room_overview"),
  v.literal("broker_review_queue"),
);

const adjudicationSnapshotValidator = v.object({
  status: aiOutputAdjudicationStatus,
  action: aiOutputAdjudicationAction,
  visibility: aiOutputAdjudicationVisibility,
  rationale: v.string(),
  reasonCategory: v.optional(brokerOverrideReasonCategory),
  reviewedConclusion: v.optional(v.string()),
  buyerExplanation: v.optional(v.string()),
  internalNotes: v.optional(v.string()),
  actorUserId: v.id("users"),
  actedAt: v.string(),
});

type AiOutputDoc = Doc<"aiEngineOutputs">;
type AdjudicationHistoryDoc = Doc<"aiOutputAdjudications">;
type PropertyCaseDoc = Doc<"propertyCases">;

type SubmitAdjudicationArgs = {
  outputId: Id<"aiEngineOutputs">;
  dealRoomId?: Id<"dealRooms">;
  surface?: "deal_room_overview" | "broker_review_queue";
  action: AdvisoryAdjudicationAction;
  visibility: AdvisoryAdjudicationVisibility;
  rationale: string;
  reasonCategory?: Doc<"aiOutputAdjudications">["reasonCategory"];
  reviewedConclusion?: string;
  buyerExplanation?: string;
  internalNotes?: string;
};

// ═══ Queries ═══

/** Get a specific engine output by ID */
export const get = query({
  args: { outputId: v.id("aiEngineOutputs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.outputId);
  },
});

/** Get all outputs for a property + engine type */
export const getByPropertyAndEngine = query({
  args: {
    propertyId: v.id("properties"),
    engineType: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiEngineOutputs")
      .withIndex("by_propertyId_and_engineType", (q) =>
        q.eq("propertyId", args.propertyId).eq("engineType", args.engineType),
      )
      .collect();
  },
});

/** Get the latest output for a property + engine type */
export const getLatest = query({
  args: {
    propertyId: v.id("properties"),
    engineType: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiEngineOutputs")
      .withIndex("by_propertyId_and_engineType", (q) =>
        q.eq("propertyId", args.propertyId).eq("engineType", args.engineType),
      )
      .order("desc")
      .first();
  },
});

/** List all outputs pending review (for ops review queue — broker/admin only) */
export const listPendingReview = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== "broker" && user.role !== "admin")) return [];

    const rows = await ctx.db
      .query("aiEngineOutputs")
      .withIndex("by_reviewState", (q) => q.eq("reviewState", "pending"))
      .take(args.limit ?? 50);

    return Promise.all(
      rows.map(async (row) => {
        const guardrail = assessEngineOutputGuardrail({
          engineType: row.engineType,
          confidence: row.confidence,
          output: row.output,
          reviewState: row.reviewState,
        });
        const adjudication = await expandAdjudicationSnapshot(ctx, row);

        return {
          ...row,
          adjudication,
          queueState:
            adjudication.status === "pending" ? "needs_adjudication" : "reviewed",
          buyerVisibility:
            adjudication.visibility ?? (row.reviewState === "approved"
              ? "buyer_safe"
              : row.reviewState === "rejected"
                ? "internal_only"
                : null),
          guardrail,
        };
      }),
    );
  },
});

// ═══ Mutations ═══

/** Create a new engine output (internal -- called by engine actions) */
export const createOutput = internalMutation({
  args: {
    propertyId: v.id("properties"),
    engineType: v.string(),
    promptKey: v.optional(v.string()),
    promptVersion: v.string(),
    inputSnapshot: v.string(),
    confidence: v.number(),
    citations: v.array(v.string()),
    output: v.string(),
    modelId: v.string(),
  },
  returns: v.id("aiEngineOutputs"),
  handler: async (ctx, args) => {
    if (!ENGINE_TYPES.includes(args.engineType as (typeof ENGINE_TYPES)[number])) {
      throw new Error(
        `Invalid engine type: ${args.engineType}. Valid: ${ENGINE_TYPES.join(", ")}`,
      );
    }
    const reviewState = determineReviewState({
      engineType: args.engineType,
      confidence: args.confidence,
      output: args.output,
    });
    return await ctx.db.insert("aiEngineOutputs", {
      propertyId: args.propertyId,
      engineType: args.engineType,
      promptKey: args.promptKey,
      promptVersion: args.promptVersion,
      inputSnapshot: args.inputSnapshot,
      confidence: args.confidence,
      citations: args.citations,
      reviewState,
      output: args.output,
      modelId: args.modelId,
      generatedAt: new Date().toISOString(),
    });
  },
});

/** Formal broker adjudication path for AI outputs. */
export const submitAdjudication = mutation({
  args: {
    outputId: v.id("aiEngineOutputs"),
    dealRoomId: v.optional(v.id("dealRooms")),
    surface: v.optional(advisorySurfaceValidator),
    action: aiOutputAdjudicationAction,
    visibility: aiOutputAdjudicationVisibility,
    rationale: v.string(),
    reasonCategory: v.optional(brokerOverrideReasonCategory),
    reviewedConclusion: v.optional(v.string()),
    buyerExplanation: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    await submitAiOutputAdjudication(ctx, user, args);
    return null;
  },
});

/** Backward-compatible broker approval wrapper. */
export const approveOutput = mutation({
  args: {
    outputId: v.id("aiEngineOutputs"),
    dealRoomId: v.optional(v.id("dealRooms")),
    surface: v.optional(advisorySurfaceValidator),
    rationale: v.optional(v.string()),
    buyerExplanation: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    await submitAiOutputAdjudication(ctx, user, {
      outputId: args.outputId,
      dealRoomId: args.dealRoomId,
      surface: args.surface,
      action: "approve",
      visibility: "buyer_safe",
      rationale:
        args.rationale?.trim() || "Broker approved the AI conclusion as buyer-safe.",
      buyerExplanation: args.buyerExplanation,
      internalNotes: args.internalNotes,
    });
    return null;
  },
});

/** Backward-compatible broker override wrapper. */
export const rejectOutput = mutation({
  args: {
    outputId: v.id("aiEngineOutputs"),
    dealRoomId: v.optional(v.id("dealRooms")),
    surface: v.optional(advisorySurfaceValidator),
    reasonCategory: brokerOverrideReasonCategory,
    reasonDetail: v.optional(v.string()),
    reviewedConclusion: v.optional(v.string()),
    buyerExplanation: v.optional(v.string()),
    internalNotes: v.optional(v.string()),
    visibility: v.optional(aiOutputAdjudicationVisibility),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    await submitAiOutputAdjudication(ctx, user, {
      outputId: args.outputId,
      dealRoomId: args.dealRoomId,
      surface: args.surface,
      action: "override",
      visibility: args.visibility ?? "internal_only",
      rationale:
        args.reasonDetail?.trim() ||
        "Broker overrode the AI conclusion after manual review.",
      reasonCategory: args.reasonCategory,
      reviewedConclusion: args.reviewedConclusion,
      buyerExplanation: args.buyerExplanation,
      internalNotes: args.internalNotes,
    });
    return null;
  },
});

async function submitAiOutputAdjudication(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: SubmitAdjudicationArgs,
): Promise<void> {
  const existing = await ctx.db.get(args.outputId);
  if (!existing) {
    throw new Error("AI engine output not found");
  }

  const normalized = normalizeAdjudicationInput(args);
  const reviewStateAfter = adjudicationReviewStateFromVisibility(
    normalized.visibility,
  );
  const status = adjudicationStatusFromAction(normalized.action);
  const actedAt = new Date().toISOString();

  if (
    normalized.visibility === "buyer_safe" &&
    !normalized.reviewedConclusion &&
    !normalized.buyerExplanation &&
    normalized.action !== "approve"
  ) {
    throw new Error(
      "Buyer-safe adjustments and overrides require reviewed conclusion or buyer-safe explanation.",
    );
  }

  const snapshot = {
    status,
    action: normalized.action,
    visibility: normalized.visibility,
    rationale: normalized.rationale,
    reasonCategory: normalized.reasonCategory,
    reviewedConclusion: normalized.reviewedConclusion,
    buyerExplanation: normalized.buyerExplanation,
    internalNotes: normalized.internalNotes,
    actorUserId: user._id,
    actedAt,
  } satisfies AdvisoryAdjudicationSnapshot;

  const guardrail = assessEngineOutputGuardrail({
    engineType: existing.engineType,
    confidence: existing.confidence,
    output: existing.output,
    reviewState: existing.reviewState,
  });
  const learningContext =
    normalized.action === "approve"
      ? null
      : await deriveAdjudicationLearningContext(
          ctx,
          args.dealRoomId,
          String(args.outputId),
          existing.engineType,
        );

  await ctx.db.patch(args.outputId, {
    reviewState: reviewStateAfter,
    reviewedBy: user._id,
    reviewedAt: actedAt,
    adjudication: snapshot,
  });

  const adjudicationId = await ctx.db.insert("aiOutputAdjudications", {
    engineOutputId: args.outputId,
    propertyId: existing.propertyId,
    dealRoomId: args.dealRoomId,
    engineType: existing.engineType,
    action: normalized.action,
    status,
    visibility: normalized.visibility,
    rationale: normalized.rationale,
    reasonCategory: normalized.reasonCategory,
    reviewedConclusion: normalized.reviewedConclusion,
    buyerExplanation: normalized.buyerExplanation,
    internalNotes: normalized.internalNotes,
    actorUserId: user._id,
    actedAt,
    reviewStateBefore: existing.reviewState,
    reviewStateAfter,
  });

  if (normalized.action !== "approve" && learningContext) {
    const calibrationRecord = buildAdjudicationCalibrationRecord({
      propertyId: String(existing.propertyId),
      dealRoomId: args.dealRoomId ? String(args.dealRoomId) : null,
      propertyCaseId: learningContext.propertyCaseId,
      engineOutputId: String(args.outputId),
      adjudicationId: String(adjudicationId),
      engineType: existing.engineType,
      action: normalized.action,
      visibility: normalized.visibility,
      reasonCategory: normalized.reasonCategory ?? null,
      outputConfidence: existing.confidence,
      promptVersion: existing.promptVersion ?? "unknown",
      modelId: existing.modelId,
      reviewStateBefore: existing.reviewState,
      reviewStateAfter,
      linkedClaimCount: learningContext.linkedClaimCount,
      linkedClaimTopics: learningContext.linkedClaimTopics,
      recommendationLinkedClaimCount:
        learningContext.recommendationLinkedClaimCount,
      recommendationRelevant: learningContext.recommendationRelevant,
      reviewedConclusionPresent: Boolean(normalized.reviewedConclusion),
      buyerExplanationPresent: Boolean(normalized.buyerExplanation),
      internalNotesPresent: Boolean(normalized.internalNotes),
      generatedAt: existing.generatedAt,
      adjudicatedAt: actedAt,
      reviewLatencyMs: reviewLatencyMs(existing.generatedAt, actedAt),
    });

    await ctx.db.insert("adjudicationCalibrationRecords", {
      ...calibrationRecord,
      propertyId: existing.propertyId,
      dealRoomId: args.dealRoomId ?? null,
      propertyCaseId: learningContext.propertyCaseId
        ? (learningContext.propertyCaseId as Id<"propertyCases">)
        : null,
      engineOutputId: args.outputId,
      adjudicationId: adjudicationId as Id<"aiOutputAdjudications">,
      reasonCategory: normalized.reasonCategory ?? null,
    });
  }

  await ctx.db.insert("auditLog", {
    userId: user._id,
    action: "ai_output_adjudicated",
    entityType: "aiEngineOutputs",
    entityId: String(args.outputId),
    details: JSON.stringify({
      action: normalized.action,
      adjudicationStatus: status,
      visibility: normalized.visibility,
      rationale: normalized.rationale,
      reasonCategory: normalized.reasonCategory ?? null,
      reviewedConclusion: normalized.reviewedConclusion ?? null,
      buyerExplanation: normalized.buyerExplanation ?? null,
      internalNotes: normalized.internalNotes ?? null,
      auditLabel: guardrail.auditLabel,
      classes: guardrail.classes,
      approvalPath: guardrail.approvalPath,
      buyerFacingStateAfter:
        reviewStateAfter === "approved"
          ? defaultApprovedGuardrailState(guardrail.baseState)
          : "blocked",
      guardrailStateBefore: guardrail.state,
    }),
    timestamp: actedAt,
  });

  if (normalized.action !== "approve" && learningContext) {
    await trackPosthogEvent(
      "advisory_broker_override_submitted",
      {
        outputId: String(existing._id),
        propertyId: String(existing.propertyId),
        actorRole: user.role === "admin" ? "admin" : "broker",
        surface: args.surface ?? "deal_room_overview",
        engineType: existing.engineType,
        priorReviewState: existing.reviewState,
        reasonCategory: normalized.reasonCategory ?? "other",
        hasReasonDetail: Boolean(normalized.rationale),
        outputConfidence: existing.confidence,
        linkedClaimCount: learningContext.linkedClaimCount,
        reviewLatencyMs: reviewLatencyMs(existing.generatedAt, actedAt),
        ...(args.dealRoomId ? { dealRoomId: String(args.dealRoomId) } : {}),
        ...(existing.generatedAt ? { generatedAt: existing.generatedAt } : {}),
      },
      String(user._id),
    );
  }
}

function normalizeAdjudicationInput(
  args: SubmitAdjudicationArgs,
): SubmitAdjudicationArgs {
  const rationale = args.rationale.trim();
  if (!rationale) {
    throw new Error("Broker adjudication requires rationale.");
  }

  const reviewedConclusion = args.reviewedConclusion?.trim() || undefined;
  const buyerExplanation = args.buyerExplanation?.trim() || undefined;
  const internalNotes = args.internalNotes?.trim() || undefined;

  return {
    ...args,
    rationale,
    reviewedConclusion,
    buyerExplanation,
    internalNotes,
  };
}

function adjudicationStatusFromAction(
  action: AdvisoryAdjudicationAction,
): AdvisoryAdjudicationStatus {
  switch (action) {
    case "approve":
      return "approved";
    case "adjust":
      return "adjusted";
    case "override":
      return "overridden";
  }
}

async function expandAdjudicationSnapshot(
  ctx: QueryCtx,
  row: AiOutputDoc,
): Promise<Record<string, unknown>> {
  const history = await ctx.db
    .query("aiOutputAdjudications")
    .withIndex("by_engineOutputId_and_actedAt", (q) =>
      q.eq("engineOutputId", row._id),
    )
    .collect();

  if (!row.adjudication) {
    return {
      status: "pending",
      action: null,
      visibility: null,
      actorName: null,
      historyCount: history.length,
    };
  }

  const actor = await ctx.db.get(row.adjudication.actorUserId);
  return {
    ...row.adjudication,
    actorName: actor?.name ?? null,
    historyCount: history.length,
  };
}

function parsePropertyCase(payload: string): PropertyCase | null {
  try {
    return JSON.parse(payload) as PropertyCase;
  } catch {
    return null;
  }
}

async function latestPropertyCaseForDealRoom(
  ctx: MutationCtx,
  dealRoomId: Id<"dealRooms">,
): Promise<PropertyCaseDoc | null> {
  return (
    await ctx.db
      .query("propertyCases")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", dealRoomId))
      .collect()
  )
    .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
    .at(0) ?? null;
}

async function deriveAdjudicationLearningContext(
  ctx: MutationCtx,
  dealRoomId: Id<"dealRooms"> | undefined,
  citationId: string,
  engineType: string,
): Promise<{
  propertyCaseId: string | null;
  linkedClaimCount: number;
  linkedClaimTopics: AdjudicationLinkedClaimTopic[];
  recommendationLinkedClaimCount: number;
  recommendationRelevant: boolean;
}> {
  const baseRecommendationRelevant = recommendationRelevantFromEngineType(engineType);

  if (!dealRoomId) {
    return {
      propertyCaseId: null,
      linkedClaimCount: 0,
      linkedClaimTopics: [],
      recommendationLinkedClaimCount: 0,
      recommendationRelevant: baseRecommendationRelevant,
    };
  }

  const latestCase = await latestPropertyCaseForDealRoom(ctx, dealRoomId);
  if (!latestCase) {
    return {
      propertyCaseId: null,
      linkedClaimCount: 0,
      linkedClaimTopics: [],
      recommendationLinkedClaimCount: 0,
      recommendationRelevant: baseRecommendationRelevant,
    };
  }

  const propertyCase = parsePropertyCase(latestCase.payload);
  if (!propertyCase) {
    return {
      propertyCaseId: String(latestCase._id),
      linkedClaimCount: 0,
      linkedClaimTopics: [],
      recommendationLinkedClaimCount: 0,
      recommendationRelevant: baseRecommendationRelevant,
    };
  }

  const linkedClaims = propertyCase.claims.filter(
    (claim) => claim.citation === citationId,
  );
  const rationaleClaimIds = new Set(
    propertyCase.recommendedAction?.rationaleClaimIds ?? [],
  );
  const recommendationLinkedClaimCount = linkedClaims.filter((claim) =>
    rationaleClaimIds.has(claim.id),
  ).length;

  return {
    propertyCaseId: String(latestCase._id),
    linkedClaimCount: linkedClaims.length,
    linkedClaimTopics: Array.from(
      new Set(linkedClaims.map((claim) => claim.topic)),
    ) as AdjudicationLinkedClaimTopic[],
    recommendationLinkedClaimCount,
    recommendationRelevant:
      baseRecommendationRelevant || recommendationLinkedClaimCount > 0,
  };
}

export async function listOutputAdjudicationHistory(
  ctx: QueryCtx,
  outputId: Id<"aiEngineOutputs">,
): Promise<AdjudicationHistoryDoc[]> {
  return ctx.db
    .query("aiOutputAdjudications")
    .withIndex("by_engineOutputId_and_actedAt", (q) =>
      q.eq("engineOutputId", outputId),
    )
    .collect();
}

function reviewLatencyMs(generatedAt: string, reviewedAt: string): number {
  const generatedAtMs = Date.parse(generatedAt);
  const reviewedAtMs = Date.parse(reviewedAt);

  if (Number.isNaN(generatedAtMs) || Number.isNaN(reviewedAtMs)) {
    return 0;
  }

  return Math.max(0, reviewedAtMs - generatedAtMs);
}
