import { describe, expect, it } from "vitest";
import type {
  ComparativeClaim,
  PropertyCase,
} from "@/lib/ai/engines/caseSynthesis";
import {
  buildAdvisoryBrokerAdjudicationOpenedPayload,
  buildAdvisoryMemoViewedPayload,
  buildAdvisoryRecommendationFeedbackPayload,
  buildAdvisorySourceTraceOpenedPayload,
  buildAdvisorySummaryCopiedPayload,
  buildBuyerSafeSummaryText,
} from "@/lib/dealroom/advisoryTelemetry";
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
        id: "offer_strategy",
        topic: "offer_recommendation",
        citation: "engineOut_offer_1",
        narrative: "Use a clean opener backed by comps and leverage.",
        marketReferenceLabel: "offer engine baseline",
      }),
    ],
    recommendedAction: {
      openingPrice: 615_000,
      rationaleClaimIds: ["pricing_vs_consensus", "offer_strategy"],
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
    { key: "leverage", status: "pending", confidence: 0.78 },
    { key: "offer", status: "available", confidence: 0.75 },
  ];
}

function propertyFactsFixture(overrides: Record<string, unknown> = {}) {
  return {
    daysOnMarket: 58,
    sqftLiving: 2400,
    priceReductions: [{ amount: 15000, date: "2026-04-02T00:00:00.000Z" }],
    updatedAt: "2026-04-13T18:30:00.000Z",
    ...overrides,
  };
}

function marketContextFixture() {
  return {
    propertyId: "property_123",
    baselines: [],
    windows: [
      {
        windowDays: 90,
        selectedContext: {
          geoKey: "Coconut Grove",
          geoKind: "neighborhood" as const,
          windowDays: 90,
          avgPricePerSqft: 255,
          medianDom: 32,
          medianPricePerSqft: 250,
          medianListPrice: 620_000,
          avgSaleToListRatio: 0.973,
          medianSaleToListRatio: 0.968,
          priceReductionFrequency: 0.38,
          avgReductionPct: 0.031,
          medianReductionPct: 0.026,
          inventoryCount: 9,
          pendingCount: 3,
          salesVelocity: 0.7,
          trajectory: "flat" as const,
          sampleSize: {
            total: 10,
            sold: 6,
            active: 2,
            pending: 2,
            pricePerSqft: 6,
            dom: 6,
            saleToList: 6,
            reduction: 5,
          },
          provenance: {
            source: "bright-data://market/coconut-grove/90",
            fetchedAt: "2026-04-13T18:00:00.000Z",
          },
          lastRefreshedAt: "2026-04-13T18:00:00.000Z",
        },
        selectedGeoKind: "neighborhood" as const,
        selectedGeoKey: "Coconut Grove",
        downgradeReasons: [
          {
            code: "insufficient_sold_sample" as const,
            geoKind: "subdivision" as const,
            geoKey: "Palm Estates",
            message:
              "Subdivision baseline for Palm Estates only had 2 sold samples; minimum trustworthy sample is 3.",
          },
        ],
        confidence: 0.88,
      },
    ],
    generatedAt: "2026-04-13T18:30:00.000Z",
  };
}

function buildSurface(viewerRole: "buyer" | "broker" | "admin" = "buyer") {
  return buildPropertyCaseOverview({
    dealRoomId: "deal_123",
    propertyId: "property_123",
    propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
    listPrice: 640_000,
    photoUrl: null,
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
      {
        citationId: "engineOut_offer_1",
        engineType: "offer",
        confidence: 0.78,
        generatedAt: "2026-04-13T18:59:00.000Z",
        reviewState: viewerRole === "buyer" ? "approved" : "pending",
      },
      {
        citationId: "engineOut_comps_1",
        engineType: "comps",
        confidence: 0.55,
        generatedAt: "2026-04-13T18:50:00.000Z",
        reviewState: viewerRole === "buyer" ? "approved" : "rejected",
      },
    ],
    marketContext: marketContextFixture(),
    propertyFacts: propertyFactsFixture(),
    viewerRole,
  });
}

describe("advisoryTelemetry", () => {
  it("builds memo payloads with explicit coverage and calibration context", () => {
    const overview = buildSurface();
    const payload = buildAdvisoryMemoViewedPayload(overview);

    expect(payload).toMatchObject({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      actorRole: "buyer",
      variant: "buyer_safe",
      viewState: "partial",
      claimCount: 2,
      sourceCount: 2,
      missingSignalCount: 1,
      coverageAvailableCount: 3,
      coveragePendingCount: 1,
      coverageUncertainCount: 0,
      coverageMissingCount: 0,
      hasRecommendation: true,
      overallConfidence: 0.82,
      recommendationConfidence: 0.78,
    });
  });

  it("builds source-trace payloads with source status and claim topic", () => {
    const overview = buildSurface();
    const source = overview.sources.find(
      (item) => item.citationId === "engineOut_pricing_1",
    );
    const claim = overview.claims.find(
      (item) => item.citationId === "engineOut_pricing_1",
    );

    if (!source || !claim) {
      throw new Error("expected pricing source");
    }

    const payload = buildAdvisorySourceTraceOpenedPayload(overview, {
      source,
      trigger: "claim_link",
      claim,
    });

    expect(payload).toMatchObject({
      citationId: "engineOut_pricing_1",
      engineType: "pricing",
      linkedClaimCount: 1,
      sourceStatus: "available",
      trigger: "claim_link",
      claimTopic: "pricing",
    });
  });

  it("builds broker adjudication payloads from internal review summary", () => {
    const overview = buildSurface("broker");
    if (overview.variant !== "internal") {
      throw new Error("expected internal surface");
    }

    const payload = buildAdvisoryBrokerAdjudicationOpenedPayload(overview);
    expect(payload).toMatchObject({
      actorRole: "broker",
      variant: "internal",
      pendingSourceCount: 1,
      approvedSourceCount: 1,
      rejectedSourceCount: 1,
    });
  });

  it("builds recommendation feedback payloads with explicit user decision", () => {
    const overview = buildSurface();
    const payload = buildAdvisoryRecommendationFeedbackPayload(
      overview,
      "deferred",
    );

    expect(payload.decision).toBe("deferred");
    expect(payload.recommendationConfidence).toBe(0.78);
  });

  it("builds buyer-safe summary exports with measurable length and recommendation inclusion", () => {
    const overview = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: null,
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
        {
          citationId: "engineOut_offer_1",
          engineType: "offer",
          confidence: 0.78,
          generatedAt: "2026-04-13T18:59:00.000Z",
          reviewState: "approved",
          adjudication: {
            status: "adjusted",
            action: "adjust",
            visibility: "buyer_safe",
            rationale: "Reviewed before buyer exposure.",
            reviewedConclusion:
              "Open near $615,000 and keep the first draft clean.",
            buyerExplanation:
              "Your broker reviewed this recommendation against the live market context.",
            actorUserId: "user_broker",
            actorName: "Broker",
            actedAt: "2026-04-13T19:05:00.000Z",
          },
          adjudicationHistory: [],
        },
        {
          citationId: "engineOut_comps_1",
          engineType: "comps",
          confidence: 0.55,
          generatedAt: "2026-04-13T18:50:00.000Z",
          reviewState: "approved",
        },
      ],
      marketContext: marketContextFixture(),
      propertyFacts: propertyFactsFixture(),
      viewerRole: "buyer",
    });
    const summary = buildBuyerSafeSummaryText(overview);
    const payload = buildAdvisorySummaryCopiedPayload(overview, summary);

    expect(summary).toContain("Neighborhood reality: Overpriced for this market.");
    expect(summary).toContain(
      "Market context: Neighborhood · Coconut Grove; 6 sold / 10 total records; Fresh · 30m old; High reliability.",
    );
    expect(summary).toContain(
      "Fallback geography: Using neighborhood data for Coconut Grove because the tighter market slice did not have enough sold homes.",
    );
    expect(summary).toContain("Recommended opener");
    expect(summary).toContain("Broker-reviewed conclusion");
    expect(payload.summaryLength).toBe(summary.length);
    expect(payload.includesRecommendation).toBe(true);
  });
});
