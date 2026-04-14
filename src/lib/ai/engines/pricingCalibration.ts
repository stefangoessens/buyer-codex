import {
  CALIBRATION_CONSUMERS,
  CONFIDENCE_BUCKETS,
  PRICING_ERROR_CATEGORIES,
  type CalibrationRecord,
  type ConfidenceBucket,
  type PricingCalibrationErrorCategory,
  type PricingCalibrationSummary,
  type PricingOutput,
} from "./types";

export const HIGH_ERROR_THRESHOLD = 0.08;
const ZERO_SCORE_ERROR_THRESHOLD = 0.2;

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function percentageError(predicted: number, actual: number): number {
  if (actual <= 0) return 0;
  return round4(Math.abs(predicted - actual) / actual);
}

export function confidenceBucketFor(confidence: number): ConfidenceBucket {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

export function scoreFromError(error: number): number {
  return round4(Math.max(0, 1 - error / ZERO_SCORE_ERROR_THRESHOLD));
}

export function computeDaysToAccept(
  submittedAt: string | null | undefined,
  acceptedAt: string,
): number | null {
  if (!submittedAt) return null;

  const submittedMs = Date.parse(submittedAt);
  const acceptedMs = Date.parse(acceptedAt);
  if (Number.isNaN(submittedMs) || Number.isNaN(acceptedMs) || acceptedMs < submittedMs) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  return Number(((acceptedMs - submittedMs) / msPerDay).toFixed(2));
}

function classifyPricingErrors(args: {
  pricing: PricingOutput;
  actualAcceptedPrice: number;
  meanAbsoluteError: number;
  countersMade: number;
}): PricingCalibrationErrorCategory[] {
  const categories: PricingCalibrationErrorCategory[] = [];

  if (args.actualAcceptedPrice < args.pricing.strongOpener.value) {
    categories.push("accepted_below_strong_opener");
  } else if (args.actualAcceptedPrice > args.pricing.walkAway.value) {
    categories.push("accepted_above_walk_away");
  } else {
    categories.push("within_expected_range");
  }

  if (args.actualAcceptedPrice < args.pricing.fairValue.value) {
    categories.push("accepted_below_fair_value");
  }

  if (args.actualAcceptedPrice > args.pricing.likelyAccepted.value) {
    categories.push("accepted_above_likely_accepted");
  }

  if (
    args.pricing.overallConfidence >= 0.8 &&
    args.meanAbsoluteError >= HIGH_ERROR_THRESHOLD
  ) {
    categories.push("confidence_overstated");
  }

  if (args.countersMade >= 2) {
    categories.push("required_heavy_negotiation");
  }

  return Array.from(new Set(categories));
}

export function buildCalibrationRecord(args: {
  propertyId: string;
  engineOutputId: string;
  promptVersion: string;
  modelId: string;
  pricing: PricingOutput;
  actualAcceptedPrice: number;
  acceptedAt: string;
  submittedAt?: string | null;
  countersMade: number;
  recordedAt?: string;
}): CalibrationRecord {
  const errorFairValue = percentageError(
    args.pricing.fairValue.value,
    args.actualAcceptedPrice,
  );
  const errorLikelyAccepted = percentageError(
    args.pricing.likelyAccepted.value,
    args.actualAcceptedPrice,
  );
  const errorStrongOpener = percentageError(
    args.pricing.strongOpener.value,
    args.actualAcceptedPrice,
  );
  const errorWalkAway = percentageError(
    args.pricing.walkAway.value,
    args.actualAcceptedPrice,
  );

  const meanAbsoluteError = Number(
    (
      (errorFairValue +
        errorLikelyAccepted +
        errorStrongOpener +
        errorWalkAway) /
      4
    ).toFixed(4),
  );
  const errorCategories = classifyPricingErrors({
    pricing: args.pricing,
    actualAcceptedPrice: args.actualAcceptedPrice,
    meanAbsoluteError,
    countersMade: args.countersMade,
  });
  const realizedScore = scoreFromError(meanAbsoluteError);

  return {
    propertyId: args.propertyId,
    engineOutputId: args.engineOutputId,
    predictedFairValue: args.pricing.fairValue.value,
    predictedLikelyAccepted: args.pricing.likelyAccepted.value,
    predictedStrongOpener: args.pricing.strongOpener.value,
    predictedWalkAway: args.pricing.walkAway.value,
    actualAcceptedPrice: args.actualAcceptedPrice,
    errorFairValue,
    errorLikelyAccepted,
    errorStrongOpener,
    errorWalkAway,
    meanAbsoluteError,
    highError: meanAbsoluteError >= HIGH_ERROR_THRESHOLD,
    overallConfidence: args.pricing.overallConfidence,
    realizedScore,
    confidenceDelta: round4(args.pricing.overallConfidence - realizedScore),
    withinPredictedRange:
      args.actualAcceptedPrice >= args.pricing.strongOpener.value &&
      args.actualAcceptedPrice <= args.pricing.walkAway.value,
    primaryErrorCategory: errorCategories[0] ?? "within_expected_range",
    errorCategories,
    daysToAccept: computeDaysToAccept(args.submittedAt, args.acceptedAt),
    countersMade: args.countersMade,
    acceptedAt: args.acceptedAt,
    promptVersion: args.promptVersion,
    modelId: args.modelId,
    recordedAt: args.recordedAt ?? args.acceptedAt,
  };
}

export function averageCalibrationDrift(
  records: Pick<CalibrationRecord, "meanAbsoluteError">[],
): number | null {
  if (records.length === 0) return null;

  const total = records.reduce((sum, record) => sum + record.meanAbsoluteError, 0);
  return round4(total / records.length);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round4(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function summarizePricingCalibration(
  records: CalibrationRecord[],
): PricingCalibrationSummary {
  const categoryCounts = PRICING_ERROR_CATEGORIES.map((category) => ({
    category,
    count: records.filter((record) => record.errorCategories.includes(category)).length,
  }));

  const confidenceBuckets = CONFIDENCE_BUCKETS.map((bucket) => {
    const bucketRecords = records.filter(
      (record) => confidenceBucketFor(record.overallConfidence) === bucket,
    );
    return {
      bucket,
      totalRecords: bucketRecords.length,
      averageConfidence: average(
        bucketRecords.map((record) => record.overallConfidence),
      ),
      averageRealizedScore: average(
        bucketRecords.map((record) => record.realizedScore),
      ),
      averageConfidenceDelta: average(
        bucketRecords.map((record) => record.confidenceDelta),
      ),
    };
  });

  return {
    kind: "pricing",
    totalRecords: records.length,
    meanAbsoluteError: average(records.map((record) => record.meanAbsoluteError)),
    highErrorRate:
      records.length === 0
        ? null
        : round4(
            records.filter((record) => record.highError).length / records.length,
          ),
    withinPredictedRangeRate:
      records.length === 0
        ? null
        : round4(
            records.filter((record) => record.withinPredictedRange).length /
              records.length,
          ),
    averageDaysToAccept: average(
      records
        .map((record) => record.daysToAccept)
        .filter((value): value is number => value !== null),
    ),
    averageCountersMade: average(records.map((record) => record.countersMade)),
    confidenceBuckets,
    categoryCounts,
    consumers: [...CALIBRATION_CONSUMERS],
  };
}
