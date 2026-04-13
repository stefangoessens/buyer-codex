import type { CalibrationRecord, PricingOutput } from "./types";

export const HIGH_ERROR_THRESHOLD = 0.08;

function percentageError(predicted: number, actual: number): number {
  if (actual <= 0) return 0;
  return Number((Math.abs(predicted - actual) / actual).toFixed(4));
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
  return Number((total / records.length).toFixed(4));
}
