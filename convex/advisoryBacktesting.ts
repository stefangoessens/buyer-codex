import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import { summarizePricingCalibration } from "../src/lib/ai/engines/pricingCalibration";
import { summarizeRecommendationBacktests } from "../src/lib/ai/engines/recommendationBacktest";
import { summarizeAdjudicationCalibration } from "../src/lib/ai/engines/adjudicationCalibration";
import type {
  AdjudicationCalibrationRecord,
  CalibrationRecord,
  RecommendationBacktestRecord,
} from "../src/lib/ai/engines/types";

export const getCalibrationSnapshot = query({
  args: {
    propertyId: v.optional(v.id("properties")),
    dealRoomId: v.optional(v.id("dealRooms")),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can review advisory backtests");
    }

    const [pricingRows, recommendationRows, adjudicationRows] = await Promise.all([
      ctx.db.query("pricingCalibrationRecords").collect(),
      ctx.db.query("recommendationBacktestRecords").collect(),
      ctx.db.query("adjudicationCalibrationRecords").collect(),
    ]);

    const pricing = pricingRows.filter((row) => {
      if (args.propertyId && row.propertyId !== args.propertyId) return false;
      if (args.dealRoomId) {
        const matchingRecommendation = recommendationRows.find(
          (recommendation) =>
            recommendation.propertyId === row.propertyId &&
            recommendation.dealRoomId === args.dealRoomId,
        );
        return Boolean(matchingRecommendation);
      }
      return true;
    }) as CalibrationRecord[];

    const recommendations = recommendationRows.filter((row) => {
      if (args.propertyId && row.propertyId !== args.propertyId) return false;
      if (args.dealRoomId && row.dealRoomId !== args.dealRoomId) return false;
      return true;
    }) as RecommendationBacktestRecord[];

    const adjudications = adjudicationRows.filter((row) => {
      if (args.propertyId && row.propertyId !== args.propertyId) return false;
      if (args.dealRoomId && row.dealRoomId !== args.dealRoomId) return false;
      return true;
    }) as AdjudicationCalibrationRecord[];

    const limit = args.limit ?? 10;

    return {
      pricingSummary: summarizePricingCalibration(pricing),
      recommendationSummary: summarizeRecommendationBacktests(recommendations),
      adjudicationSignals: {
        overallSummary: summarizeAdjudicationCalibration(adjudications),
        confidenceSummary: summarizeAdjudicationCalibration(
          adjudications,
          "confidence",
        ),
        recommendationSummary: summarizeAdjudicationCalibration(
          adjudications,
          "recommendation",
        ),
        recent: [...adjudications]
          .sort((left, right) =>
            right.adjudicatedAt.localeCompare(left.adjudicatedAt),
          )
          .slice(0, limit),
      },
      recentPricing: [...pricing]
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
        .slice(0, limit),
      recentRecommendation: [...recommendations]
        .sort((left, right) =>
          right.outcomeRecordedAt.localeCompare(left.outcomeRecordedAt),
        )
        .slice(0, limit),
    };
  },
});
