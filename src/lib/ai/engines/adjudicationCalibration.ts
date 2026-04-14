import {
  ADJUDICATION_CONFIDENCE_SIGNALS,
  ADJUDICATION_LINKED_CLAIM_TOPICS,
  ADJUDICATION_RECOMMENDATION_SIGNALS,
  ADJUDICATION_REVISION_TYPES,
  CONFIDENCE_BUCKETS,
  type AdjudicationCalibrationRecord,
  type AdjudicationCalibrationSummary,
  type AdjudicationCalibrationTarget,
  type AdjudicationConfidenceSignal,
  type AdjudicationLinkedClaimTopic,
  type AdjudicationRecommendationSignal,
  type AdjudicationRevisionType,
  type CalibrationConsumer,
  CALIBRATION_CONSUMERS,
} from "./types";
import { confidenceBucketFor } from "./pricingCalibration";

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function countBy<T extends string>(
  values: T[],
): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) =>
      right.count === left.count
        ? String(left.key).localeCompare(String(right.key))
        : right.count - left.count,
    );
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function recommendationSignalFor(args: {
  action: "adjust" | "override";
  recommendationRelevant: boolean;
}): AdjudicationRecommendationSignal {
  if (!args.recommendationRelevant) return "not_applicable";
  return args.action === "override"
    ? "recommendation_overridden"
    : "recommendation_adjusted";
}

function confidenceSignalFor(reviewStateBefore: "pending" | "approved" | "rejected"): AdjudicationConfidenceSignal {
  return reviewStateBefore === "approved"
    ? "confidence_overstated"
    : "review_required";
}

function revisionTypeFor(args: {
  reviewedConclusionPresent: boolean;
  buyerExplanationPresent: boolean;
}): AdjudicationRevisionType {
  if (args.reviewedConclusionPresent) return "reviewed_conclusion";
  if (args.buyerExplanationPresent) return "buyer_explanation_only";
  return "rationale_only";
}

export function recommendationRelevantFromEngineType(engineType: string): boolean {
  return engineType === "offer" || engineType === "case_synthesis";
}

export function buildAdjudicationCalibrationRecord(args: {
  propertyId: string;
  dealRoomId?: string | null;
  propertyCaseId?: string | null;
  engineOutputId: string;
  adjudicationId: string;
  engineType: string;
  action: "adjust" | "override";
  visibility: "buyer_safe" | "internal_only";
  reasonCategory?: string | null;
  outputConfidence: number;
  promptVersion?: string | null;
  modelId: string;
  reviewStateBefore: "pending" | "approved" | "rejected";
  reviewStateAfter: "pending" | "approved" | "rejected";
  linkedClaimCount: number;
  linkedClaimTopics: AdjudicationLinkedClaimTopic[];
  recommendationLinkedClaimCount: number;
  recommendationRelevant: boolean;
  reviewedConclusionPresent: boolean;
  buyerExplanationPresent: boolean;
  internalNotesPresent: boolean;
  generatedAt: string;
  adjudicatedAt: string;
  reviewLatencyMs: number;
}): AdjudicationCalibrationRecord {
  const recommendationSignal = recommendationSignalFor({
    action: args.action,
    recommendationRelevant: args.recommendationRelevant,
  });
  const confidenceSignal = confidenceSignalFor(args.reviewStateBefore);
  const revisionType = revisionTypeFor({
    reviewedConclusionPresent: args.reviewedConclusionPresent,
    buyerExplanationPresent: args.buyerExplanationPresent,
  });

  const calibrationTargets: AdjudicationCalibrationTarget[] = ["confidence"];
  if (recommendationSignal !== "not_applicable") {
    calibrationTargets.push("recommendation");
  }

  return {
    propertyId: args.propertyId,
    dealRoomId: args.dealRoomId ?? null,
    propertyCaseId: args.propertyCaseId ?? null,
    engineOutputId: args.engineOutputId,
    adjudicationId: args.adjudicationId,
    engineType: args.engineType,
    action: args.action,
    visibility: args.visibility,
    reasonCategory: args.reasonCategory ?? null,
    outputConfidence: args.outputConfidence,
    confidenceBucket: confidenceBucketFor(args.outputConfidence),
    promptVersion: args.promptVersion ?? "unknown",
    modelId: args.modelId,
    reviewStateBefore: args.reviewStateBefore,
    reviewStateAfter: args.reviewStateAfter,
    confidenceSignal,
    recommendationSignal,
    revisionType,
    calibrationTargets,
    linkedClaimCount: args.linkedClaimCount,
    linkedClaimTopics: unique(args.linkedClaimTopics),
    recommendationLinkedClaimCount: args.recommendationLinkedClaimCount,
    recommendationRelevant: args.recommendationRelevant,
    reviewedConclusionPresent: args.reviewedConclusionPresent,
    buyerExplanationPresent: args.buyerExplanationPresent,
    internalNotesPresent: args.internalNotesPresent,
    generatedAt: args.generatedAt,
    adjudicatedAt: args.adjudicatedAt,
    reviewLatencyMs: args.reviewLatencyMs,
  };
}

export function summarizeAdjudicationCalibration(
  records: AdjudicationCalibrationRecord[],
  target: AdjudicationCalibrationTarget | "all" = "all",
): AdjudicationCalibrationSummary {
  const relevantRecords =
    target === "all"
      ? records
      : records.filter((record) => record.calibrationTargets.includes(target));

  const confidenceBuckets = countBy(
    relevantRecords.map((record) => record.confidenceBucket),
  );
  const engineTypeCounts = countBy(
    relevantRecords.map((record) => record.engineType),
  );
  const reasonCategoryCounts = countBy(
    relevantRecords.map((record) => record.reasonCategory ?? "unspecified"),
  );
  const actionCounts = countBy(relevantRecords.map((record) => record.action));
  const confidenceSignalCounts = countBy(
    relevantRecords.map((record) => record.confidenceSignal),
  );
  const recommendationSignalCounts = countBy(
    relevantRecords.map((record) => record.recommendationSignal),
  );
  const revisionTypeCounts = countBy(
    relevantRecords.map((record) => record.revisionType),
  );
  const linkedClaimTopicCounts = countBy(
    relevantRecords.flatMap((record) => record.linkedClaimTopics),
  );

  const consumers: CalibrationConsumer[] = [...CALIBRATION_CONSUMERS];

  return {
    kind: "adjudication_calibration",
    target,
    totalRecords: relevantRecords.length,
    uniqueOutputs: new Set(relevantRecords.map((record) => record.engineOutputId)).size,
    averageOutputConfidence: average(
      relevantRecords.map((record) => record.outputConfidence),
    ),
    internalOnlyRate:
      relevantRecords.length === 0
        ? null
        : round4(
            relevantRecords.filter((record) => record.visibility === "internal_only")
              .length / relevantRecords.length,
          ),
    reviewedConclusionRate:
      relevantRecords.length === 0
        ? null
        : round4(
            relevantRecords.filter((record) => record.reviewedConclusionPresent)
              .length / relevantRecords.length,
          ),
    recommendationRelevantRate:
      relevantRecords.length === 0
        ? null
        : round4(
            relevantRecords.filter((record) => record.recommendationRelevant).length /
              relevantRecords.length,
          ),
    confidenceBuckets: CONFIDENCE_BUCKETS.map((bucket) => {
      const bucketRecords = relevantRecords.filter(
        (record) => record.confidenceBucket === bucket,
      );
      return {
        bucket,
        totalRecords: bucketRecords.length,
        averageConfidence: average(
          bucketRecords.map((record) => record.outputConfidence),
        ),
        averageRealizedScore: null,
        averageConfidenceDelta: null,
      };
    }),
    engineTypeCounts: engineTypeCounts.map(({ key, count }) => ({
      engineType: key,
      count,
    })),
    reasonCategoryCounts: reasonCategoryCounts.map(({ key, count }) => ({
      reasonCategory: key,
      count,
    })),
    actionCounts: actionCounts.map(({ key, count }) => ({
      action: key,
      count,
    })),
    confidenceSignalCounts: ADJUDICATION_CONFIDENCE_SIGNALS.map((signal) => ({
      signal,
      count:
        confidenceSignalCounts.find((entry) => entry.key === signal)?.count ?? 0,
    })),
    recommendationSignalCounts: ADJUDICATION_RECOMMENDATION_SIGNALS.map(
      (signal) => ({
        signal,
        count:
          recommendationSignalCounts.find((entry) => entry.key === signal)?.count ??
          0,
      }),
    ),
    revisionTypeCounts: ADJUDICATION_REVISION_TYPES.map((revisionType) => ({
      revisionType,
      count:
        revisionTypeCounts.find((entry) => entry.key === revisionType)?.count ?? 0,
    })),
    linkedClaimTopicCounts: ADJUDICATION_LINKED_CLAIM_TOPICS.map((topic) => ({
      topic,
      count: linkedClaimTopicCounts.find((entry) => entry.key === topic)?.count ?? 0,
    })),
    consumers,
  };
}
