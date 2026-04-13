import { query, mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { determineReviewState, ENGINE_TYPES } from "./lib/engineResult";
import { trackPosthogEvent } from "./lib/analytics";
import { getCurrentUser, requireRole } from "./lib/session";
import type { Id } from "./_generated/dataModel";

const advisorySurfaceValidator = v.union(
  v.literal("deal_room_overview"),
  v.literal("broker_review_queue"),
);

const brokerOverrideReasonCategoryValidator = v.union(
  v.literal("unsupported_evidence"),
  v.literal("stale_evidence"),
  v.literal("policy_guardrail"),
  v.literal("market_context_shift"),
  v.literal("human_judgment"),
  v.literal("other"),
);

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

    return await ctx.db
      .query("aiEngineOutputs")
      .withIndex("by_reviewState", (q) => q.eq("reviewState", "pending"))
      .take(args.limit ?? 50);
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
      throw new Error(`Invalid engine type: ${args.engineType}. Valid: ${ENGINE_TYPES.join(", ")}`);
    }
    const reviewState = determineReviewState(args.confidence);
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

/** Approve an engine output (broker/admin review action) */
export const approveOutput = mutation({
  args: {
    outputId: v.id("aiEngineOutputs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");

    await ctx.db.patch(args.outputId, {
      reviewState: "approved" as const,
      reviewedBy: user._id,
      reviewedAt: new Date().toISOString(),
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "ai_output_approved",
      entityType: "aiEngineOutputs",
      entityId: args.outputId,
      timestamp: new Date().toISOString(),
    });

    return null;
  },
});

/** Reject an engine output (broker/admin review action) */
export const rejectOutput = mutation({
  args: {
    outputId: v.id("aiEngineOutputs"),
    dealRoomId: v.optional(v.id("dealRooms")),
    surface: v.optional(advisorySurfaceValidator),
    reasonCategory: brokerOverrideReasonCategoryValidator,
    reasonDetail: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const output = await ctx.db.get(args.outputId);
    if (!output) {
      throw new Error("Engine output not found");
    }
    const reviewedAt = new Date().toISOString();
    const linkedClaimCount = await countClaimsLinkedToOutput(
      ctx,
      args.dealRoomId,
      String(args.outputId),
    );

    await ctx.db.patch(args.outputId, {
      reviewState: "rejected" as const,
      reviewedBy: user._id,
      reviewedAt,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "ai_output_rejected",
      entityType: "aiEngineOutputs",
      entityId: args.outputId,
      details: JSON.stringify({
        reasonCategory: args.reasonCategory,
        reasonDetail: args.reasonDetail ?? null,
      }),
      timestamp: reviewedAt,
    });

    await trackPosthogEvent(
      "advisory_broker_override_submitted",
      {
        outputId: String(output._id),
        propertyId: String(output.propertyId),
        actorRole: user.role === "admin" ? "admin" : "broker",
        surface: args.surface ?? "deal_room_overview",
        engineType: output.engineType,
        priorReviewState: output.reviewState,
        reasonCategory: args.reasonCategory,
        hasReasonDetail: Boolean(args.reasonDetail?.trim()),
        outputConfidence: output.confidence,
        linkedClaimCount,
        reviewLatencyMs: reviewLatencyMs(output.generatedAt, reviewedAt),
        ...(args.dealRoomId ? { dealRoomId: String(args.dealRoomId) } : {}),
        ...(output.generatedAt ? { generatedAt: output.generatedAt } : {}),
      },
      String(user._id),
    );

    return null;
  },
});

async function countClaimsLinkedToOutput(
  ctx: MutationCtx,
  dealRoomId: Id<"dealRooms"> | undefined,
  citationId: string,
): Promise<number> {
  if (!dealRoomId) return 0;

  const latestCase = (
    await ctx.db
      .query("propertyCases")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", dealRoomId))
      .collect()
  )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .at(0);

  if (!latestCase) return 0;

  try {
    const parsed = JSON.parse(latestCase.payload) as {
      claims?: Array<{ citation?: string }>;
    };
    if (!Array.isArray(parsed.claims)) return 0;
    return parsed.claims.filter((claim) => claim?.citation === citationId).length;
  } catch {
    return 0;
  }
}

function reviewLatencyMs(generatedAt: string, reviewedAt: string): number {
  const generatedAtMs = Date.parse(generatedAt);
  const reviewedAtMs = Date.parse(reviewedAt);

  if (Number.isNaN(generatedAtMs) || Number.isNaN(reviewedAtMs)) {
    return 0;
  }

  return Math.max(0, reviewedAtMs - generatedAtMs);
}
