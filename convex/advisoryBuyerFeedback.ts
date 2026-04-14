import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import { trackPosthogEvent } from "./lib/analytics";
import {
  advisoryFeedbackArtifact,
  advisoryFeedbackDimension,
  advisoryFeedbackReasonCode,
  advisoryFeedbackSentiment,
} from "./lib/validators";
import {
  normalizeAdvisoryFeedbackReasonCodes,
  normalizeAdvisoryFeedbackResponses,
  type AdvisoryFeedbackArtifact,
  type AdvisoryFeedbackReasonCode,
  type AdvisoryFeedbackResponse,
} from "../src/lib/dealroom/advisory-feedback";
import { rebuildBuyerPreferenceMemory } from "./lib/buyerPreferenceMemory";

function buildReasonCodeKey(reasonCodes: AdvisoryFeedbackReasonCode[]): string {
  return reasonCodes.length > 0 ? reasonCodes.join("|") : "none";
}

export const submit = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    propertyId: v.id("properties"),
    surface: v.literal("deal_room_overview"),
    artifact: advisoryFeedbackArtifact,
    synthesisVersion: v.optional(v.string()),
    artifactGeneratedAt: v.optional(v.string()),
    viewState: v.union(
      v.literal("ready"),
      v.literal("partial"),
      v.literal("empty")
    ),
    overallConfidence: v.optional(v.number()),
    recommendationConfidence: v.optional(v.number()),
    claimCount: v.number(),
    sourceCount: v.number(),
    missingSignalCount: v.number(),
    coverageAvailableCount: v.number(),
    coveragePendingCount: v.number(),
    coverageUncertainCount: v.number(),
    coverageMissingCount: v.number(),
    responses: v.array(
      v.object({
        dimension: advisoryFeedbackDimension,
        sentiment: advisoryFeedbackSentiment,
      })
    ),
    reasonCodes: v.array(advisoryFeedbackReasonCode),
  },
  returns: v.id("advisoryBuyerFeedback"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "buyer") {
      throw new Error("Only buyers can submit advisory feedback.");
    }

    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) {
      throw new Error("Deal room not found.");
    }
    if (dealRoom.buyerId !== user._id) {
      throw new Error("Cannot submit advisory feedback for another buyer.");
    }
    if (dealRoom.propertyId !== args.propertyId) {
      throw new Error("Deal room does not match the specified property.");
    }

    const responses = normalizeAdvisoryFeedbackResponses(
      args.responses as AdvisoryFeedbackResponse[],
    );
    if (responses.length === 0) {
      throw new Error("Structured advisory feedback requires at least one response.");
    }

    const reasonCodes = normalizeAdvisoryFeedbackReasonCodes(
      args.artifact as AdvisoryFeedbackArtifact,
      responses,
      args.reasonCodes as AdvisoryFeedbackReasonCode[],
    );
    const submittedAt = new Date().toISOString();

    const feedbackId = await ctx.db.insert("advisoryBuyerFeedback", {
      dealRoomId: args.dealRoomId,
      propertyId: args.propertyId,
      buyerId: user._id,
      surface: args.surface,
      artifact: args.artifact,
      synthesisVersion: args.synthesisVersion,
      artifactGeneratedAt: args.artifactGeneratedAt,
      viewState: args.viewState,
      overallConfidence: args.overallConfidence,
      recommendationConfidence: args.recommendationConfidence,
      claimCount: args.claimCount,
      sourceCount: args.sourceCount,
      missingSignalCount: args.missingSignalCount,
      coverageAvailableCount: args.coverageAvailableCount,
      coveragePendingCount: args.coveragePendingCount,
      coverageUncertainCount: args.coverageUncertainCount,
      coverageMissingCount: args.coverageMissingCount,
      responses,
      reasonCodes,
      submittedAt,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "advisory_buyer_feedback_submitted",
      entityType: "advisoryBuyerFeedback",
      entityId: String(feedbackId),
      details: JSON.stringify({
        artifact: args.artifact,
        synthesisVersion: args.synthesisVersion ?? null,
        artifactGeneratedAt: args.artifactGeneratedAt ?? null,
        responses,
        reasonCodes,
      }),
      timestamp: submittedAt,
    });

    for (const response of responses) {
      await trackPosthogEvent(
        "advisory_buyer_feedback_submitted",
        {
          dealRoomId: String(args.dealRoomId),
          propertyId: String(args.propertyId),
          actorRole: "buyer",
          surface: args.surface,
          variant: "buyer_safe",
          viewState: args.viewState,
          claimCount: args.claimCount,
          sourceCount: args.sourceCount,
          missingSignalCount: args.missingSignalCount,
          coverageAvailableCount: args.coverageAvailableCount,
          coveragePendingCount: args.coveragePendingCount,
          coverageUncertainCount: args.coverageUncertainCount,
          coverageMissingCount: args.coverageMissingCount,
          artifact: args.artifact,
          ...(args.synthesisVersion
            ? { synthesisVersion: args.synthesisVersion }
            : {}),
          ...(args.artifactGeneratedAt
            ? { artifactGeneratedAt: args.artifactGeneratedAt }
            : {}),
          dimension: response.dimension,
          sentiment: response.sentiment,
          responseCount: responses.length,
          reasonCount: reasonCodes.length,
          reasonCodeKey: buildReasonCodeKey(reasonCodes),
          ...(args.artifactGeneratedAt ? { generatedAt: args.artifactGeneratedAt } : {}),
          ...(typeof args.overallConfidence === "number"
            ? { overallConfidence: args.overallConfidence }
            : {}),
          ...(typeof args.recommendationConfidence === "number"
            ? { recommendationConfidence: args.recommendationConfidence }
            : {}),
        },
        user._id,
      );
    }

    await rebuildBuyerPreferenceMemory(ctx, user._id);

    return feedbackId;
  },
});
