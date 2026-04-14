import { describe, expect, it } from "vitest";
import type { PropertyCase } from "@/lib/ai/engines/caseSynthesis";
import {
  buildRecommendationBacktestRecord,
  summarizeRecommendationBacktests,
} from "@/lib/ai/engines/recommendationBacktest";

function propertyCaseFixture(): PropertyCase {
  return {
    claims: [
      {
        id: "pricing_vs_consensus",
        topic: "pricing",
        value: 615_000,
        unit: "usd",
        marketReference: 605_000,
        marketReferenceLabel: "consensus estimate",
        delta: 10_000,
        deltaPct: 1.65,
        direction: "above",
        confidence: 0.82,
        citation: "engine_pricing_1",
        narrative: "List price sits just above consensus.",
      },
      {
        id: "leverage_dom",
        topic: "leverage",
        value: 28,
        unit: "days",
        marketReference: 18,
        marketReferenceLabel: "median DOM",
        delta: 10,
        deltaPct: 55.5,
        direction: "above",
        confidence: 0.78,
        citation: "engine_leverage_1",
        narrative: "Days on market are elevated.",
      },
    ],
    recommendedAction: {
      openingPrice: 600_000,
      rationaleClaimIds: ["pricing_vs_consensus", "leverage_dom"],
      suggestedContingencies: ["inspection", "financing"],
      riskLevel: "medium",
      confidence: 0.78,
    },
    overallConfidence: 0.78,
    contributingEngines: 3,
    inputHash: "input-hash",
    synthesisVersion: "1.0.0",
    droppedEngines: [],
  };
}

describe("recommendationBacktest", () => {
  it("builds a recommendation record against later offer behavior", () => {
    const record = buildRecommendationBacktestRecord({
      propertyId: "property-1",
      dealRoomId: "deal-room-1",
      offerId: "offer-1",
      propertyCaseId: "case-1",
      propertyCase: propertyCaseFixture(),
      synthesisVersion: "1.0.0",
      recommendationGeneratedAt: "2026-04-13T12:00:00.000Z",
      actualOfferPrice: 603_000,
      actualAcceptedPrice: 605_000,
      actualOutcome: "accepted",
      actualContingencies: ["inspection", "financing"],
      countersMade: 1,
      outcomeRecordedAt: "2026-04-14T12:00:00.000Z",
    });

    expect(record.sourceOutputIds).toEqual([
      "engine_pricing_1",
      "engine_leverage_1",
    ]);
    expect(record.priceDeltaPct).toBe(0.005);
    expect(record.contingencyMatchRatio).toBe(1);
    expect(record.adoptionScore).toBeCloseTo(0.875, 3);
    expect(record.followedRecommendation).toBe(true);
    expect(record.primaryErrorCategory).toBe("followed_recommendation");
    expect(record.errorCategories).toEqual(["followed_recommendation"]);
  });

  it("flags overrides and confidence misses when the buyer diverges", () => {
    const record = buildRecommendationBacktestRecord({
      propertyId: "property-2",
      dealRoomId: "deal-room-2",
      offerId: "offer-2",
      propertyCaseId: "case-2",
      propertyCase: {
        ...propertyCaseFixture(),
        recommendedAction: {
          ...propertyCaseFixture().recommendedAction!,
          confidence: 0.9,
        },
      },
      synthesisVersion: "1.0.0",
      recommendationGeneratedAt: "2026-04-13T12:00:00.000Z",
      actualOfferPrice: 630_000,
      actualAcceptedPrice: 632_000,
      actualOutcome: "accepted",
      actualContingencies: ["waive_appraisal"],
      countersMade: 3,
      outcomeRecordedAt: "2026-04-15T12:00:00.000Z",
    });

    expect(record.followedRecommendation).toBe(false);
    expect(record.errorCategories).toContain("opened_above_recommendation");
    expect(record.errorCategories).toContain("contingencies_mismatch");
    expect(record.errorCategories).toContain("accepted_after_override");
    expect(record.errorCategories).toContain("confidence_overstated");
  });

  it("summarizes recommendation backtests for calibration review", () => {
    const followed = buildRecommendationBacktestRecord({
      propertyId: "property-1",
      dealRoomId: "deal-room-1",
      offerId: "offer-1",
      propertyCaseId: "case-1",
      propertyCase: propertyCaseFixture(),
      synthesisVersion: "1.0.0",
      recommendationGeneratedAt: "2026-04-13T12:00:00.000Z",
      actualOfferPrice: 603_000,
      actualAcceptedPrice: 605_000,
      actualOutcome: "accepted",
      actualContingencies: ["inspection", "financing"],
      countersMade: 1,
      outcomeRecordedAt: "2026-04-14T12:00:00.000Z",
    });
    const override = buildRecommendationBacktestRecord({
      propertyId: "property-2",
      dealRoomId: "deal-room-2",
      offerId: "offer-2",
      propertyCaseId: "case-2",
      propertyCase: propertyCaseFixture(),
      synthesisVersion: "1.0.0",
      recommendationGeneratedAt: "2026-04-13T12:00:00.000Z",
      actualOfferPrice: 630_000,
      actualOutcome: "rejected",
      actualContingencies: ["waive_appraisal"],
      countersMade: 0,
      outcomeRecordedAt: "2026-04-15T12:00:00.000Z",
    });

    const summary = summarizeRecommendationBacktests([followed, override]);

    expect(summary).toMatchObject({
      kind: "recommendation",
      totalRecords: 2,
      consumers: ["confidence", "telemetry", "override_learning"],
    });
    expect(summary.followedRecommendationRate).toBe(0.5);
    expect(summary.acceptedOutcomeRate).toBe(0.5);
    expect(summary.acceptedWhenFollowedRate).toBe(1);
    expect(
      summary.categoryCounts.find(
        (entry) => entry.category === "opened_above_recommendation",
      )?.count,
    ).toBe(1);
  });
});
