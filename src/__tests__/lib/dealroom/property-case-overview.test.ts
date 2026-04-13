import { describe, expect, it } from "vitest";
import type {
  ComparativeClaim,
  PropertyCase,
} from "@/lib/ai/engines/caseSynthesis";
import {
  buildPropertyCaseOverview,
  type PropertyCaseCoverageInput,
} from "@/lib/dealroom/property-case-overview";

function claimFixture(
  overrides: Partial<ComparativeClaim> = {},
): ComparativeClaim {
  return {
    id: "pricing_vs_consensus",
    topic: "pricing",
    value: 640_000,
    unit: "usd",
    marketReference: 621_000,
    marketReferenceLabel: "consensus of 3 estimates",
    delta: 19_000,
    deltaPct: 3.1,
    direction: "above",
    confidence: 0.82,
    citation: "engineOut_pricing_1",
    narrative: "Above the consensus of 3 estimates by 3.1%",
    ...overrides,
  };
}

function payloadFixture(overrides: Partial<PropertyCase> = {}): PropertyCase {
  return {
    claims: [
      claimFixture(),
      claimFixture({
        id: "list_vs_comps_median",
        topic: "comps",
        value: 640_000,
        marketReference: 630_000,
        marketReferenceLabel: "median sold price of 5 comps",
        delta: 10_000,
        deltaPct: 1.6,
        citation: "engineOut_comps_1",
        narrative: "List price above median of 5 recent comps by 1.6%",
      }),
      claimFixture({
        id: "leverage_dom_vs_median",
        topic: "days_on_market",
        value: 58,
        unit: "days",
        marketReference: 28,
        marketReferenceLabel: "neighborhood median",
        delta: 30,
        deltaPct: 107.1,
        citation: "engineOut_leverage_1",
        narrative: "days on market: 58 vs 28 (bullish sentiment, above numerically)",
      }),
    ],
    recommendedAction: {
      openingPrice: 615_000,
      rationaleClaimIds: ["pricing_vs_consensus", "leverage_dom_vs_median"],
      suggestedContingencies: ["inspection", "financing"],
      riskLevel: "medium",
      confidence: 0.78,
    },
    overallConfidence: 0.82,
    contributingEngines: 4,
    inputHash: "deadbeef",
    synthesisVersion: "1.0.0",
    droppedEngines: [],
    ...overrides,
  };
}

function availableCoverage(): PropertyCaseCoverageInput[] {
  return [
    { key: "pricing", status: "available", confidence: 0.82 },
    { key: "comps", status: "available", confidence: 0.8 },
    { key: "leverage", status: "available", confidence: 0.78 },
    { key: "offer", status: "available", confidence: 0.75 },
  ];
}

describe("buildPropertyCaseOverview", () => {
  it("builds a buyer-safe ready surface from a full property case", () => {
    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: "https://images.example/property.jpg",
      dealStatus: "analysis",
      caseRecord: {
        generatedAt: "2026-04-13T19:00:00.000Z",
        hitCount: 3,
        payload: payloadFixture(),
      },
      coverage: availableCoverage(),
      citations: [
        {
          citationId: "engineOut_pricing_1",
          engineType: "pricing",
          confidence: 0.82,
          generatedAt: "2026-04-13T18:55:00.000Z",
          reviewState: "approved",
        },
      ],
      viewerRole: "buyer",
    });

    expect(surface.variant).toBe("buyer_safe");
    expect(surface.viewState).toBe("ready");
    expect(surface.claims).toHaveLength(3);
    expect(surface.keyTakeaways).toHaveLength(3);
    expect(surface.action?.openingPriceLabel).toBe("$615,000");
    expect(surface.sources[0]?.anchorId).toBe("source-engineOut_pricing_1");
    expect(surface.internal).toBeUndefined();
  });

  it("marks dropped and pending signals explicitly when the case is partial", () => {
    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: null,
      dealStatus: "analysis",
      caseRecord: {
        generatedAt: "2026-04-13T19:00:00.000Z",
        hitCount: 1,
        payload: payloadFixture({
          claims: [claimFixture()],
          recommendedAction: undefined,
          droppedEngines: ["comps"],
          contributingEngines: 2,
        }),
      },
      coverage: [
        { key: "pricing", status: "available", confidence: 0.82 },
        { key: "comps", status: "available", confidence: 0.7 },
        {
          key: "leverage",
          status: "pending",
          reason: "Leverage analysis is under review.",
        },
        {
          key: "offer",
          status: "unavailable",
          reason: "Offer scenarios have not been generated yet.",
        },
      ],
      viewerRole: "buyer",
    });

    expect(surface.viewState).toBe("partial");
    expect(surface.missingStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          engine: "comps",
          tone: "uncertain",
        }),
        expect.objectContaining({
          engine: "leverage",
          tone: "pending",
        }),
        expect.objectContaining({
          engine: "offer",
          tone: "missing",
        }),
      ]),
    );
    expect(surface.action).toBeNull();
  });

  it("keeps internal-only cache metadata off buyer-safe views and on staff views", () => {
    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: null,
      dealStatus: "offer_prep",
      caseRecord: {
        generatedAt: "2026-04-13T19:00:00.000Z",
        hitCount: 7,
        payload: payloadFixture({
          droppedEngines: ["leverage"],
        }),
      },
      coverage: availableCoverage(),
      viewerRole: "broker",
    });

    expect(surface.variant).toBe("internal");
    if (surface.variant !== "internal") {
      throw new Error("expected internal surface");
    }

    expect(surface.internal.hitCount).toBe(7);
    expect(surface.internal.inputHash).toBe("deadbeef");
    expect(surface.internal.droppedEngines).toContain("leverage");
  });

  it("returns an empty state when no case exists and nothing is actively pending", () => {
    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: null,
      photoUrl: null,
      dealStatus: "analysis",
      caseRecord: null,
      coverage: [
        {
          key: "pricing",
          status: "unavailable",
          reason: "Pricing has not been generated yet.",
        },
        {
          key: "comps",
          status: "unavailable",
          reason: "Comparable-sales analysis has not produced a buyer-safe result yet.",
        },
        {
          key: "leverage",
          status: "unavailable",
          reason: "Leverage has not been generated yet.",
        },
        {
          key: "offer",
          status: "unavailable",
          reason: "Offer scenarios have not been generated yet.",
        },
      ],
      viewerRole: "buyer",
    });

    expect(surface.viewState).toBe("empty");
    expect(surface.claims).toEqual([]);
    expect(surface.overallConfidence).toBeNull();
  });
});
