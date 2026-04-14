import type { PropertyCase } from "./caseSynthesis";
import { confidenceBucketFor } from "./pricingCalibration";
import {
  CALIBRATION_CONSUMERS,
  CONFIDENCE_BUCKETS,
  RECOMMENDATION_ERROR_CATEGORIES,
  type RecommendationBacktestOutcome,
  type RecommendationBacktestRecord,
  type RecommendationCalibrationSummary,
} from "./types";

export const RECOMMENDATION_PRICE_FOLLOW_THRESHOLD = 0.02;
export const RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD = 0.75;

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function computeContingencyMatchRatio(
  recommended: string[],
  actual: string[],
): number {
  const recommendedSet = new Set(recommended.map(normalizeTerm));
  const actualSet = new Set(actual.map(normalizeTerm));
  const union = new Set([...recommendedSet, ...actualSet]);
  if (union.size === 0) return 1;

  const intersection = Array.from(recommendedSet).filter((value) =>
    actualSet.has(value),
  );
  return round4(intersection.length / union.size);
}

function computePriceDeltaPct(
  recommendedOpeningPrice: number,
  actualOfferPrice: number,
): number {
  if (recommendedOpeningPrice <= 0) return 0;
  return round4(
    Math.abs(actualOfferPrice - recommendedOpeningPrice) /
      recommendedOpeningPrice,
  );
}

function computeAdoptionScore(
  priceDeltaPct: number,
  contingencyMatchRatio: number,
): number {
  const priceScore = Math.max(
    0,
    1 - priceDeltaPct / RECOMMENDATION_PRICE_FOLLOW_THRESHOLD,
  );
  return round4((priceScore + contingencyMatchRatio) / 2);
}

function sourceOutputIdsForRecommendation(propertyCase: PropertyCase): string[] {
  const claimById = new Map(propertyCase.claims.map((claim) => [claim.id, claim]));
  return unique(
    (propertyCase.recommendedAction?.rationaleClaimIds ?? [])
      .map((claimId) => claimById.get(claimId)?.citation ?? null)
      .filter((citation): citation is string => Boolean(citation)),
  );
}

function classifyRecommendationErrors(args: {
  actualOfferPrice: number;
  recommendedOpeningPrice: number;
  contingencyMatchRatio: number;
  adoptionScore: number;
  recommendationConfidence: number;
  actualOutcome: RecommendationBacktestOutcome;
}): RecommendationBacktestRecord["errorCategories"] {
  const categories: RecommendationBacktestRecord["errorCategories"] = [];
  const priceDelta =
    args.actualOfferPrice - args.recommendedOpeningPrice;

  if (args.adoptionScore >= RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD) {
    categories.push("followed_recommendation");
  } else if (priceDelta > 0) {
    categories.push("opened_above_recommendation");
  } else if (priceDelta < 0) {
    categories.push("opened_below_recommendation");
  } else {
    categories.push("followed_recommendation");
  }

  if (
    args.contingencyMatchRatio < RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD
  ) {
    categories.push("contingencies_mismatch");
  }

  if (
    args.actualOutcome !== "accepted" &&
    args.adoptionScore >= RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD
  ) {
    categories.push("followed_but_unsuccessful");
  }

  if (
    args.actualOutcome === "accepted" &&
    args.adoptionScore < RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD
  ) {
    categories.push("accepted_after_override");
  }

  if (args.recommendationConfidence >= 0.8 && args.adoptionScore < 0.6) {
    categories.push("confidence_overstated");
  }

  return unique(categories) as RecommendationBacktestRecord["errorCategories"];
}

export function buildRecommendationBacktestRecord(args: {
  propertyId: string;
  dealRoomId: string;
  offerId: string;
  propertyCaseId: string;
  propertyCase: PropertyCase;
  synthesisVersion: string;
  recommendationGeneratedAt: string;
  actualOfferPrice: number;
  actualAcceptedPrice?: number | null;
  actualOutcome: RecommendationBacktestOutcome;
  actualContingencies?: string[];
  countersMade: number;
  outcomeRecordedAt: string;
}): RecommendationBacktestRecord {
  const recommendation = args.propertyCase.recommendedAction;
  if (!recommendation) {
    throw new Error("Property case does not include a recommended action");
  }

  const actualContingencies = [...(args.actualContingencies ?? [])];
  const priceDeltaPct = computePriceDeltaPct(
    recommendation.openingPrice,
    args.actualOfferPrice,
  );
  const contingencyMatchRatio = computeContingencyMatchRatio(
    recommendation.suggestedContingencies,
    actualContingencies,
  );
  const adoptionScore = computeAdoptionScore(
    priceDeltaPct,
    contingencyMatchRatio,
  );
  const errorCategories = classifyRecommendationErrors({
    actualOfferPrice: args.actualOfferPrice,
    recommendedOpeningPrice: recommendation.openingPrice,
    contingencyMatchRatio,
    adoptionScore,
    recommendationConfidence: recommendation.confidence,
    actualOutcome: args.actualOutcome,
  });

  return {
    propertyId: args.propertyId,
    dealRoomId: args.dealRoomId,
    offerId: args.offerId,
    propertyCaseId: args.propertyCaseId,
    synthesisVersion: args.synthesisVersion,
    recommendationGeneratedAt: args.recommendationGeneratedAt,
    recommendationConfidence: recommendation.confidence,
    recommendedOpeningPrice: recommendation.openingPrice,
    recommendedRiskLevel: recommendation.riskLevel,
    recommendedContingencies: [...recommendation.suggestedContingencies],
    sourceOutputIds: sourceOutputIdsForRecommendation(args.propertyCase),
    actualOfferPrice: args.actualOfferPrice,
    actualAcceptedPrice: args.actualAcceptedPrice ?? null,
    actualOutcome: args.actualOutcome,
    actualContingencies,
    priceDeltaPct,
    contingencyMatchRatio,
    adoptionScore,
    followedRecommendation:
      adoptionScore >= RECOMMENDATION_CONTINGENCY_MATCH_THRESHOLD,
    realizedScore: adoptionScore,
    confidenceDelta: round4(recommendation.confidence - adoptionScore),
    primaryErrorCategory: errorCategories[0] ?? "followed_recommendation",
    errorCategories,
    countersMade: args.countersMade,
    outcomeRecordedAt: args.outcomeRecordedAt,
  };
}

export function summarizeRecommendationBacktests(
  records: RecommendationBacktestRecord[],
): RecommendationCalibrationSummary {
  const followedRecords = records.filter((record) => record.followedRecommendation);
  const acceptedRecords = records.filter(
    (record) => record.actualOutcome === "accepted",
  );

  return {
    kind: "recommendation",
    totalRecords: records.length,
    followedRecommendationRate:
      records.length === 0
        ? null
        : round4(followedRecords.length / records.length),
    acceptedOutcomeRate:
      records.length === 0
        ? null
        : round4(acceptedRecords.length / records.length),
    acceptedWhenFollowedRate:
      followedRecords.length === 0
        ? null
        : round4(
            followedRecords.filter((record) => record.actualOutcome === "accepted")
              .length / followedRecords.length,
          ),
    averagePriceDeltaPct: average(records.map((record) => record.priceDeltaPct)),
    averageContingencyMatchRatio: average(
      records.map((record) => record.contingencyMatchRatio),
    ),
    averageAdoptionScore: average(records.map((record) => record.adoptionScore)),
    confidenceBuckets: CONFIDENCE_BUCKETS.map((bucket) => {
      const bucketRecords = records.filter(
        (record) =>
          confidenceBucketFor(record.recommendationConfidence) === bucket,
      );
      return {
        bucket,
        totalRecords: bucketRecords.length,
        averageConfidence: average(
          bucketRecords.map((record) => record.recommendationConfidence),
        ),
        averageRealizedScore: average(
          bucketRecords.map((record) => record.realizedScore),
        ),
        averageConfidenceDelta: average(
          bucketRecords.map((record) => record.confidenceDelta),
        ),
      };
    }),
    categoryCounts: RECOMMENDATION_ERROR_CATEGORIES.map((category) => ({
      category,
      count: records.filter((record) => record.errorCategories.includes(category))
        .length,
    })),
    consumers: [...CALIBRATION_CONSUMERS],
  };
}
