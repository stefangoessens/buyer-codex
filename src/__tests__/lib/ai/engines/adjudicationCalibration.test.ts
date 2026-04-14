import { describe, expect, it } from "vitest";
import {
  buildAdjudicationCalibrationRecord,
  summarizeAdjudicationCalibration,
} from "@/lib/ai/engines/adjudicationCalibration";

describe("adjudicationCalibration", () => {
  it("builds typed calibration inputs from broker disagreement", () => {
    const record = buildAdjudicationCalibrationRecord({
      propertyId: "property-1",
      dealRoomId: "deal-1",
      propertyCaseId: "case-1",
      engineOutputId: "output-1",
      adjudicationId: "adj-1",
      engineType: "offer",
      action: "adjust",
      visibility: "buyer_safe",
      reasonCategory: "human_judgment",
      outputConfidence: 0.82,
      promptVersion: "offer-v3",
      modelId: "gpt-5.4",
      reviewStateBefore: "pending",
      reviewStateAfter: "approved",
      linkedClaimCount: 2,
      linkedClaimTopics: ["offer_recommendation", "pricing"],
      recommendationLinkedClaimCount: 1,
      recommendationRelevant: true,
      reviewedConclusionPresent: true,
      buyerExplanationPresent: true,
      internalNotesPresent: false,
      generatedAt: "2026-04-13T18:00:00.000Z",
      adjudicatedAt: "2026-04-13T18:15:00.000Z",
      reviewLatencyMs: 900000,
    });

    expect(record).toMatchObject({
      confidenceBucket: "high",
      confidenceSignal: "review_required",
      recommendationSignal: "recommendation_adjusted",
      revisionType: "reviewed_conclusion",
      calibrationTargets: ["confidence", "recommendation"],
    });
  });

  it("summarizes where and why overrides happen for recommendation tuning", () => {
    const adjusted = buildAdjudicationCalibrationRecord({
      propertyId: "property-1",
      dealRoomId: "deal-1",
      propertyCaseId: "case-1",
      engineOutputId: "output-1",
      adjudicationId: "adj-1",
      engineType: "offer",
      action: "adjust",
      visibility: "buyer_safe",
      reasonCategory: "human_judgment",
      outputConfidence: 0.82,
      promptVersion: "offer-v3",
      modelId: "gpt-5.4",
      reviewStateBefore: "pending",
      reviewStateAfter: "approved",
      linkedClaimCount: 2,
      linkedClaimTopics: ["offer_recommendation", "pricing"],
      recommendationLinkedClaimCount: 1,
      recommendationRelevant: true,
      reviewedConclusionPresent: true,
      buyerExplanationPresent: true,
      internalNotesPresent: false,
      generatedAt: "2026-04-13T18:00:00.000Z",
      adjudicatedAt: "2026-04-13T18:15:00.000Z",
      reviewLatencyMs: 900000,
    });
    const overridden = buildAdjudicationCalibrationRecord({
      propertyId: "property-2",
      dealRoomId: "deal-2",
      propertyCaseId: null,
      engineOutputId: "output-2",
      adjudicationId: "adj-2",
      engineType: "pricing",
      action: "override",
      visibility: "internal_only",
      reasonCategory: "stale_evidence",
      outputConfidence: 0.91,
      promptVersion: "pricing-v4",
      modelId: "gpt-5.4",
      reviewStateBefore: "approved",
      reviewStateAfter: "rejected",
      linkedClaimCount: 1,
      linkedClaimTopics: ["pricing"],
      recommendationLinkedClaimCount: 0,
      recommendationRelevant: false,
      reviewedConclusionPresent: false,
      buyerExplanationPresent: false,
      internalNotesPresent: true,
      generatedAt: "2026-04-13T18:00:00.000Z",
      adjudicatedAt: "2026-04-13T18:30:00.000Z",
      reviewLatencyMs: 1800000,
    });

    const summary = summarizeAdjudicationCalibration(
      [adjusted, overridden],
      "recommendation",
    );

    expect(summary).toMatchObject({
      kind: "adjudication_calibration",
      target: "recommendation",
      totalRecords: 1,
      uniqueOutputs: 1,
      reviewedConclusionRate: 1,
      recommendationRelevantRate: 1,
      consumers: ["confidence", "telemetry", "override_learning"],
    });
    expect(
      summary.reasonCategoryCounts.find(
        (entry) => entry.reasonCategory === "human_judgment",
      )?.count,
    ).toBe(1);
    expect(
      summary.recommendationSignalCounts.find(
        (entry) => entry.signal === "recommendation_adjusted",
      )?.count,
    ).toBe(1);
    expect(
      summary.linkedClaimTopicCounts.find(
        (entry) => entry.topic === "offer_recommendation",
      )?.count,
    ).toBe(1);
  });
});
