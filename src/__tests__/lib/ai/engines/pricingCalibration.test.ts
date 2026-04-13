import { describe, expect, it } from "vitest";
import {
  averageCalibrationDrift,
  buildCalibrationRecord,
  computeDaysToAccept,
  HIGH_ERROR_THRESHOLD,
} from "@/lib/ai/engines/pricingCalibration";
import type { PricingOutput } from "@/lib/ai/engines/types";

const pricingOutput: PricingOutput = {
  fairValue: {
    value: 500_000,
    deltaVsListPrice: -2,
    deltaVsConsensus: 0,
    confidence: 0.85,
  },
  likelyAccepted: {
    value: 510_000,
    deltaVsListPrice: 0,
    deltaVsConsensus: 2,
    confidence: 0.8,
  },
  strongOpener: {
    value: 490_000,
    deltaVsListPrice: -4,
    deltaVsConsensus: -2,
    confidence: 0.75,
  },
  walkAway: {
    value: 530_000,
    deltaVsListPrice: 4,
    deltaVsConsensus: 6,
    confidence: 0.7,
  },
  consensusEstimate: 500_000,
  estimateSpread: 0.03,
  estimateSources: ["zillow", "redfin", "realtor"],
  overallConfidence: 0.82,
};

describe("pricingCalibration", () => {
  it("computes days-to-accept from submitted and accepted timestamps", () => {
    expect(
      computeDaysToAccept("2026-04-10T00:00:00.000Z", "2026-04-13T12:00:00.000Z"),
    ).toBe(3.5);
  });

  it("returns null when the timeline is invalid", () => {
    expect(
      computeDaysToAccept("2026-04-13T12:00:00.000Z", "2026-04-10T00:00:00.000Z"),
    ).toBeNull();
  });

  it("builds a full calibration record with per-price errors", () => {
    const record = buildCalibrationRecord({
      propertyId: "property-1",
      engineOutputId: "engine-1",
      promptVersion: "pricing-v2",
      modelId: "claude-sonnet-4-20250514",
      pricing: pricingOutput,
      actualAcceptedPrice: 520_000,
      acceptedAt: "2026-04-13T12:00:00.000Z",
      submittedAt: "2026-04-10T00:00:00.000Z",
      countersMade: 2,
    });

    expect(record.predictedFairValue).toBe(500_000);
    expect(record.predictedStrongOpener).toBe(490_000);
    expect(record.errorFairValue).toBeCloseTo(0.0385, 4);
    expect(record.errorLikelyAccepted).toBeCloseTo(0.0192, 4);
    expect(record.errorWalkAway).toBeCloseTo(0.0192, 4);
    expect(record.meanAbsoluteError).toBeCloseTo(0.0336, 4);
    expect(record.highError).toBe(false);
    expect(record.daysToAccept).toBe(3.5);
    expect(record.countersMade).toBe(2);
  });

  it("flags high-error predictions for review", () => {
    const record = buildCalibrationRecord({
      propertyId: "property-1",
      engineOutputId: "engine-1",
      promptVersion: "pricing-v2",
      modelId: "claude-sonnet-4-20250514",
      pricing: pricingOutput,
      actualAcceptedPrice: 610_000,
      acceptedAt: "2026-04-13T12:00:00.000Z",
      countersMade: 0,
    });

    expect(record.meanAbsoluteError).toBeGreaterThan(HIGH_ERROR_THRESHOLD);
    expect(record.highError).toBe(true);
  });

  it("computes average drift from recorded mean absolute errors", () => {
    expect(
      averageCalibrationDrift([
        { meanAbsoluteError: 0.05 },
        { meanAbsoluteError: 0.07 },
      ]),
    ).toBe(0.06);
    expect(averageCalibrationDrift([])).toBeNull();
  });
});
