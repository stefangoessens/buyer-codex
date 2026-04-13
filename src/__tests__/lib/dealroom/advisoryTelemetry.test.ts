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
    const overview = buildSurface();
    const summary = buildBuyerSafeSummaryText(overview);
    const payload = buildAdvisorySummaryCopiedPayload(overview, summary);

    expect(summary).toContain("Recommended opener");
    expect(payload.summaryLength).toBe(summary.length);
    expect(payload.includesRecommendation).toBe(true);
  });
});
