import { describe, expect, it } from "vitest";
import type {
  ComparativeClaim,
  PropertyCase,
} from "@/lib/ai/engines/caseSynthesis";
import type { PropertyEvidenceGraph } from "@/lib/dossier/types";
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
    baselines: [
      {
        geoKey: "Palm Estates",
        geoKind: "subdivision" as const,
        windowDays: 90,
        avgPricePerSqft: 255,
        medianDom: 45,
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
          total: 2,
          sold: 2,
          active: 0,
          pending: 0,
          pricePerSqft: 2,
          dom: 2,
          saleToList: 2,
          reduction: 2,
        },
        provenance: {
          source: "bright-data://market/palm-estates/90",
          fetchedAt: "2026-04-13T18:00:00.000Z",
        },
        lastRefreshedAt: "2026-04-13T18:00:00.000Z",
      },
      {
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
    ],
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

function evidenceGraphFixture(): Pick<
  PropertyEvidenceGraph,
  "fingerprint" | "replayKey" | "nodes" | "sections"
> {
  return {
    fingerprint: "evidence-graph-v1",
    replayKey: "replay-key-v1",
    nodes: {
      "pricing-output": {
        id: "pricing-output",
        label: "Pricing output",
        summary: "Latest pricing engine output.",
        kind: "model_output",
        sourceCategory: "inferred_model_generated",
        confidence: 0.82,
        internal: {
          citations: ["engineOut_pricing_1"],
          provenance: [
            {
              label: "Pricing engine output",
              category: "inferred_model_generated",
              citation: "engineOut_pricing_1",
              capturedAt: "2026-04-13T18:55:00.000Z",
            },
          ],
        },
      },
      "portal-estimates": {
        id: "portal-estimates",
        label: "Portal estimate consensus",
        summary: "Consensus from portal estimate inputs.",
        kind: "portal_signals",
        sourceCategory: "market_baseline_aggregated",
        confidence: 0.78,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Portal estimate consensus",
              category: "market_baseline_aggregated",
              capturedAt: "2026-04-13T18:54:00.000Z",
            },
          ],
        },
      },
      "market-context": {
        id: "market-context",
        label: "Fresh neighborhood baselines",
        summary: "Fresh neighborhood baselines are still missing.",
        kind: "missing_evidence",
        sourceCategory: "market_baseline_aggregated",
        confidence: null,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Neighborhood baselines",
              category: "market_baseline_aggregated",
            },
          ],
        },
      },
      "conflicting-portal-estimates": {
        id: "conflicting-portal-estimates",
        label: "Conflicting portal estimates",
        summary: "Portal estimates are not aligned enough yet.",
        kind: "conflicting_evidence",
        sourceCategory: "market_baseline_aggregated",
        confidence: null,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Portal estimate disagreement",
              category: "market_baseline_aggregated",
            },
          ],
        },
      },
      "recent-sales": {
        id: "recent-sales",
        label: "Recent sold comps",
        summary: "Recent sold comps are available.",
        kind: "recent_sales",
        sourceCategory: "market_baseline_aggregated",
        confidence: 0.81,
        internal: {
          citations: ["engineOut_comps_1"],
          provenance: [
            {
              label: "Recent sold comps",
              category: "market_baseline_aggregated",
              citation: "engineOut_comps_1",
              capturedAt: "2026-04-13T18:50:00.000Z",
            },
          ],
        },
      },
      "browser-verification": {
        id: "browser-verification",
        label: "Browser verification",
        summary: "Browser verification captured listing posture and DOM.",
        kind: "browser_verification",
        sourceCategory: "browser_extracted_interactive",
        confidence: 0.66,
        internal: {
          citations: ["engineOut_leverage_1"],
          provenance: [
            {
              label: "Browser verification",
              category: "browser_extracted_interactive",
              citation: "engineOut_leverage_1",
              capturedAt: "2026-04-13T18:57:00.000Z",
            },
          ],
        },
      },
      "risk-hooks": {
        id: "risk-hooks",
        label: "Risk hooks",
        summary: "Known risk hooks were detected.",
        kind: "risk_hooks",
        sourceCategory: "deterministic_extracted",
        confidence: 0.79,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Risk hooks",
              category: "deterministic_extracted",
            },
          ],
        },
      },
      documents: {
        id: "documents",
        label: "Document findings",
        summary: "Document findings are available.",
        kind: "documents",
        sourceCategory: "document_derived",
        confidence: 0.79,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Document findings",
              category: "document_derived",
            },
          ],
        },
      },
      "offer-output": {
        id: "offer-output",
        label: "Offer output",
        summary: "Offer output is available but waits on leverage refresh.",
        kind: "model_output",
        sourceCategory: "inferred_model_generated",
        confidence: 0.68,
        internal: {
          citations: ["engineOut_offer_1"],
          provenance: [
            {
              label: "Offer output",
              category: "inferred_model_generated",
              citation: "engineOut_offer_1",
              capturedAt: "2026-04-13T18:59:00.000Z",
            },
          ],
        },
      },
      "leverage-output": {
        id: "leverage-output",
        label: "Broker-reviewed leverage output",
        summary: "Fresh leverage review is still missing.",
        kind: "missing_evidence",
        sourceCategory: "inferred_model_generated",
        confidence: null,
        internal: {
          citations: [],
          provenance: [
            {
              label: "Leverage output refresh",
              category: "inferred_model_generated",
            },
          ],
        },
      },
    },
    sections: {
      pricing: {
        key: "pricing",
        title: "Pricing",
        availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
        status: "conflicting_evidence",
        supportingNodeIds: ["pricing-output", "portal-estimates"],
        missingNodeIds: ["market-context"],
        conflictingNodeIds: ["conflicting-portal-estimates"],
        buyerSummary: {
          detailLevel: "buyer_safe_summary",
          headline: "Pricing is directionally usable, but some inputs disagree.",
          supportLabels: ["pricing output", "portal estimate consensus"],
          caution:
            "A few pricing inputs still conflict, so treat the range as directional.",
          status: "conflicting_evidence",
          dependsOnInference: false,
        },
        confidenceInputs: {
          score: 0.72,
          band: "medium",
          sourceCategories: [
            "market_baseline_aggregated",
            "inferred_model_generated",
          ],
          supportLabels: ["pricing output", "portal estimate consensus"],
          missingLabels: ["fresh neighborhood baselines"],
          conflictingLabels: ["conflicting portal estimates"],
          dependsOnInference: false,
          reasonCodes: [
            "conflicting_portal_estimates",
            "missing_market_context",
          ],
        },
        internalTrace: {
          detailLevel: "internal_deep_trace",
          summary:
            "Pricing confidence is limited by a missing market baseline and estimate disagreement.",
          sourceCategories: [
            "market_baseline_aggregated",
            "inferred_model_generated",
          ],
          reasonCodes: [
            "conflicting_portal_estimates",
            "missing_market_context",
          ],
          supportingNodeIds: ["pricing-output", "portal-estimates"],
          missingNodeIds: ["market-context"],
          conflictingNodeIds: ["conflicting-portal-estimates"],
        },
      },
      comps: {
        key: "comps",
        title: "Comparable sales",
        availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
        status: "supported",
        supportingNodeIds: ["recent-sales"],
        missingNodeIds: [],
        conflictingNodeIds: [],
        buyerSummary: {
          detailLevel: "buyer_safe_summary",
          headline: "Recent sold comps are aligned with the current pricing story.",
          supportLabels: ["local sold comps"],
          caution: null,
          status: "supported",
          dependsOnInference: false,
        },
        confidenceInputs: {
          score: 0.81,
          band: "high",
          sourceCategories: ["market_baseline_aggregated"],
          supportLabels: ["local sold comps"],
          missingLabels: [],
          conflictingLabels: [],
          dependsOnInference: false,
          reasonCodes: ["recent_sales_available"],
        },
        internalTrace: {
          detailLevel: "internal_deep_trace",
          summary: "Recent sold comps are present and fresh enough to support the section.",
          sourceCategories: ["market_baseline_aggregated"],
          reasonCodes: ["recent_sales_available"],
          supportingNodeIds: ["recent-sales"],
          missingNodeIds: [],
          conflictingNodeIds: [],
        },
      },
      leverage: {
        key: "leverage",
        title: "Negotiation leverage",
        availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
        status: "mixed",
        supportingNodeIds: ["browser-verification"],
        missingNodeIds: ["recent-sales"],
        conflictingNodeIds: [],
        buyerSummary: {
          detailLevel: "buyer_safe_summary",
          headline: "Leverage signals are helpful, but they still rely on a thin sample.",
          supportLabels: ["browser verification"],
          caution: "This still leans on inferred seller behavior.",
          status: "mixed",
          dependsOnInference: true,
        },
        confidenceInputs: {
          score: 0.66,
          band: "medium",
          sourceCategories: ["browser_extracted_interactive"],
          supportLabels: ["browser verification"],
          missingLabels: ["local sold comps"],
          conflictingLabels: [],
          dependsOnInference: true,
          reasonCodes: ["inference_heavy", "missing_recent_sales"],
        },
        internalTrace: {
          detailLevel: "internal_deep_trace",
          summary:
            "Leverage is inference-heavy because listing posture has verification but not enough closed-sale context.",
          sourceCategories: ["browser_extracted_interactive"],
          reasonCodes: ["inference_heavy", "missing_recent_sales"],
          supportingNodeIds: ["browser-verification"],
          missingNodeIds: ["recent-sales"],
          conflictingNodeIds: [],
        },
      },
      risk: {
        key: "risk",
        title: "Risk",
        availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
        status: "supported",
        supportingNodeIds: ["risk-hooks", "documents"],
        missingNodeIds: [],
        conflictingNodeIds: [],
        buyerSummary: {
          detailLevel: "buyer_safe_summary",
          headline: "Known property risks are visible in the current diligence set.",
          supportLabels: ["risk hooks", "document findings"],
          caution: null,
          status: "supported",
          dependsOnInference: false,
        },
        confidenceInputs: {
          score: 0.79,
          band: "high",
          sourceCategories: ["document_derived", "deterministic_extracted"],
          supportLabels: ["risk hooks", "document findings"],
          missingLabels: [],
          conflictingLabels: [],
          dependsOnInference: false,
          reasonCodes: ["risk_facts_available", "document_findings_available"],
        },
        internalTrace: {
          detailLevel: "internal_deep_trace",
          summary: "Risk is supported by both deterministic hooks and document findings.",
          sourceCategories: ["document_derived", "deterministic_extracted"],
          reasonCodes: ["risk_facts_available", "document_findings_available"],
          supportingNodeIds: ["risk-hooks", "documents"],
          missingNodeIds: [],
          conflictingNodeIds: [],
        },
      },
      offer_recommendation: {
        key: "offer_recommendation",
        title: "Offer recommendation",
        availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
        status: "waiting_on_evidence",
        supportingNodeIds: ["offer-output", "pricing-output"],
        missingNodeIds: ["leverage-output"],
        conflictingNodeIds: [],
        buyerSummary: {
          detailLevel: "buyer_safe_summary",
          headline: "The opener is grounded in pricing, but leverage still needs another pass.",
          supportLabels: ["offer output", "pricing output"],
          caution: "Treat the opener as provisional until leverage refreshes.",
          status: "waiting_on_evidence",
          dependsOnInference: false,
        },
        confidenceInputs: {
          score: 0.68,
          band: "medium",
          sourceCategories: ["inferred_model_generated"],
          supportLabels: ["offer output", "pricing output"],
          missingLabels: ["broker-reviewed leverage output"],
          conflictingLabels: [],
          dependsOnInference: false,
          reasonCodes: ["offer_requires_pricing_and_leverage"],
        },
        internalTrace: {
          detailLevel: "internal_deep_trace",
          summary:
            "Offer confidence is waiting on a leverage refresh before the recommendation can harden.",
          sourceCategories: ["inferred_model_generated"],
          reasonCodes: ["offer_requires_pricing_and_leverage"],
          supportingNodeIds: ["offer-output", "pricing-output"],
          missingNodeIds: ["leverage-output"],
          conflictingNodeIds: [],
        },
      },
    },
  };
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
        {
          citationId: "engineOut_offer_1",
          engineType: "offer",
          confidence: 0.88,
          generatedAt: "2026-04-13T18:56:00.000Z",
          reviewState: "approved",
        },
      ],
      evidenceGraph: evidenceGraphFixture(),
      marketContext: marketContextFixture(),
      propertyFacts: propertyFactsFixture(),
      viewerRole: "buyer",
    });

    expect(surface.variant).toBe("buyer_safe");
    expect(surface.viewerRole).toBe("buyer");
    expect(surface.viewState).toBe("ready");
    expect(surface.claims).toHaveLength(3);
    expect(surface.claims[0]?.guardrailState).toBe("softened");
    expect(surface.keyTakeaways).toHaveLength(3);
    expect(surface.decisionMemo.upside.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Time on market",
          evidence: [
            expect.objectContaining({
              citationId: "engineOut_leverage_1",
              sourceAnchorId: "source-engineOut_leverage_1",
            }),
          ],
        }),
      ]),
    );
    expect(surface.decisionMemo.downside.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Pricing",
          evidence: [
            expect.objectContaining({
              citationId: "engineOut_pricing_1",
              provenance: expect.arrayContaining([
                expect.objectContaining({
                  label: "Pricing engine output",
                }),
              ]),
            }),
          ],
        }),
      ]),
    );
    expect(surface.decisionMemo.unknowns.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("still needs more evidence"),
        }),
      ]),
    );
    expect(surface.decisionMemo.unresolvedRisks.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Risk",
        }),
      ]),
    );
    expect(surface.decisionMemo.recommendation.verdict).toBe("pursue_with_caution");
    expect(surface.action?.openingPriceLabel).toBe("$615,000");
    expect(surface.action?.guardrailState).toBe("softened");
    expect(surface.sources[0]?.anchorId).toBe("source-engineOut_pricing_1");
    expect(surface.coverageStats.availableCount).toBe(4);
    expect(surface.confidenceFingerprint).toBe("evidence-graph-v1");
    expect(surface.confidenceReplayKey).toBe("replay-key-v1");
    expect(surface.marketReality).toMatchObject({
      geographyLabel: "Neighborhood · Coconut Grove",
      fallbackNotice:
        "Using neighborhood data for Coconut Grove because the tighter market slice did not have enough sold homes.",
      sampleSizeLabel: "6 sold / 10 total records",
      reliabilityLabel: "High reliability",
      position: {
        code: "overpriced",
        label: "Overpriced for this market",
      },
    });
    expect(surface.confidenceSections[0]).toMatchObject({
      key: "pricing",
      band: "medium",
      contradictoryEvidence: ["conflicting portal estimates"],
      whatWouldIncreaseConfidence: expect.arrayContaining([
        "Add fresh neighborhood baselines.",
        "Resolve the conflict around conflicting portal estimates.",
      ]),
    });
    expect(surface.artifacts.memo.kind).toBe("conflicting");
    expect(surface.artifacts.recommendation.kind).toBe("partial");
    expect(surface.artifacts.summary.kind).toBe("conflicting");
    expect(surface.artifacts.summary.withholdOutput).toBe(true);
    expect(surface.clientReadySummary.whatMattersMost.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Market reality",
        }),
        expect.objectContaining({
          title: "Time on market",
        }),
        expect.objectContaining({
          title: "Pricing",
        }),
      ]),
    );
    expect(surface.clientReadySummary.attractive.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Time on market",
        }),
      ]),
    );
    expect(surface.clientReadySummary.riskyOrUncertain.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Pricing",
        }),
        expect.objectContaining({
          title: expect.stringContaining("still needs more evidence"),
        }),
      ]),
    );
    expect(surface.clientReadySummary.nextSteps.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: expect.stringContaining("recommendation"),
        }),
        expect.objectContaining({
          title: "Verify pricing",
        }),
      ]),
    );
    expect(surface.clientReadySummary.renderedText).toContain(
      "What matters most:",
    );
    expect(surface.clientReadySummary.renderedText).toContain(
      "What looks risky or uncertain:",
    );
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
          status: "available",
          reason: "Offer scenarios were generated but require broker review.",
        },
      ],
      citations: [
        {
          citationId: "engineOut_offer_1",
          engineType: "offer",
          confidence: 0.9,
          generatedAt: "2026-04-13T18:59:00.000Z",
          reviewState: "pending",
        },
      ],
      evidenceGraph: evidenceGraphFixture(),
      viewerRole: "buyer",
    });

    expect(surface.viewState).toBe("partial");
    expect(surface.coverageStats).toMatchObject({
      availableCount: 2,
      pendingCount: 1,
      uncertainCount: 1,
      missingCount: 0,
    });
    expect(surface.action).toBeNull();
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
          tone: "review_required",
        }),
      ]),
    );
    expect(
      surface.confidenceSections.find(
        (section) => section.key === "offer_recommendation",
      ),
    ).toMatchObject({
      status: "waiting_on_evidence",
      missingEvidence: ["broker-reviewed leverage output"],
    });
    expect(surface.artifacts.memo.kind).toBe("conflicting");
    expect(surface.artifacts.recommendation.kind).toBe("review_required");
    expect(surface.artifacts.recommendation.withholdOutput).toBe(true);
    expect(surface.artifacts.summary.kind).toBe("conflicting");
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
      citations: [
        {
          citationId: "engineOut_pricing_1",
          engineType: "pricing",
          confidence: 0.82,
          generatedAt: "2026-04-13T18:55:00.000Z",
          reviewState: "approved",
        },
      ],
      evidenceGraph: evidenceGraphFixture(),
      marketContext: marketContextFixture(),
      propertyFacts: propertyFactsFixture(),
      viewerRole: "broker",
    });

    expect(surface.variant).toBe("internal");
    if (surface.variant !== "internal") {
      throw new Error("expected internal surface");
    }

    expect(surface.viewerRole).toBe("broker");
    expect(surface.internal.hitCount).toBe(7);
    expect(surface.internal.inputHash).toBe("deadbeef");
    expect(surface.internal.droppedEngines).toContain("leverage");
    expect(surface.internal.adjudicationSummary).toEqual({
      pendingCount: 0,
      approvedCount: 1,
      rejectedCount: 0,
      buyerSafeCount: 1,
      internalOnlyCount: 0,
      adjustedCount: 0,
      overriddenCount: 0,
    });
    expect(surface.internal.adjudicationItems[0]).toMatchObject({
      citationId: "engineOut_pricing_1",
      reviewState: "approved",
      adjudicationStatus: "approved",
      visibility: "buyer_safe",
    });
    expect(surface.internal.marketReality).toMatchObject({
      selectedGeoKind: "neighborhood",
      selectedGeoKey: "Coconut Grove",
      marketWindowDays: 90,
      downgradeReasons: [
        "Subdivision baseline for Palm Estates only had 2 sold samples; minimum trustworthy sample is 3.",
      ],
    });
    expect(surface.internal.confidenceSections[0]).toMatchObject({
      key: "pricing",
      reasonCodes: expect.arrayContaining([
        "conflicting_portal_estimates",
        "missing_market_context",
      ]),
      sourceCategories: expect.arrayContaining([
        "market_baseline_aggregated",
        "inferred_model_generated",
      ]),
    });
    expect(surface.internal.guardrails[0]).toMatchObject({
      engineLabel: "Pricing",
      state: "softened",
    });
    expect(surface.internal.decisionMemo.rationaleSummary).toContain(
      "Internal rationale exposes",
    );
    expect(surface.internal.decisionMemo.sections[0]).toMatchObject({
      key: "pricing",
      reasonCodes: expect.arrayContaining([
        "conflicting_portal_estimates",
        "missing_market_context",
      ]),
    });
    expect(surface.clientReadySummary.title).toBe("Client-ready summary");
    expect(surface.internal.clientReadySummaryDiff.summary).toContain(
      "withholding",
    );
    expect(surface.internal.clientReadySummaryDiff.hiddenItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "internal_rationale",
          sectionKey: "pricing",
        }),
        expect.objectContaining({
          source: "guardrail",
          citationId: "engineOut_pricing_1",
        }),
      ]),
    );
  });

  it("marks recommendation artifacts conflicting when the evidence graph disagrees", () => {
    const evidenceGraph = evidenceGraphFixture();
    evidenceGraph.sections.offer_recommendation = {
      ...evidenceGraph.sections.offer_recommendation,
      status: "conflicting_evidence",
      conflictingNodeIds: ["conflicting-offer-input"],
      buyerSummary: {
        ...evidenceGraph.sections.offer_recommendation.buyerSummary,
        caution: "Portal estimates lowered confidence.",
        status: "conflicting_evidence",
      },
      confidenceInputs: {
        ...evidenceGraph.sections.offer_recommendation.confidenceInputs,
        band: "low",
        conflictingLabels: ["portal estimates"],
      },
      internalTrace: {
        ...evidenceGraph.sections.offer_recommendation.internalTrace!,
        conflictingNodeIds: ["conflicting-offer-input"],
      },
    };

    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: null,
      dealStatus: "offer_prep",
      caseRecord: {
        generatedAt: "2026-04-13T19:00:00.000Z",
        hitCount: 2,
        payload: payloadFixture(),
      },
      coverage: availableCoverage(),
      citations: [
        {
          citationId: "engineOut_offer_1",
          engineType: "offer",
          confidence: 0.82,
          generatedAt: "2026-04-13T18:56:00.000Z",
          reviewState: "approved",
        },
      ],
      evidenceGraph,
      viewerRole: "buyer",
    });

    expect(surface.action).not.toBeNull();
    expect(surface.artifacts.recommendation.kind).toBe("conflicting");
    expect(surface.artifacts.recommendation.withholdOutput).toBe(true);
    expect(surface.artifacts.summary.kind).toBe("conflicting");
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
    expect(surface.artifacts.memo.kind).toBe("missing");
    expect(surface.artifacts.summary.withholdOutput).toBe(true);
  });

  it("projects buyer-safe reviewed conclusions separately from internal notes", () => {
    const surface = buildPropertyCaseOverview({
      dealRoomId: "deal_123",
      propertyId: "property_123",
      propertyAddress: "123 Palm Way, Miami Beach, FL 33139",
      listPrice: 640_000,
      photoUrl: null,
      dealStatus: "offer_prep",
      caseRecord: {
        generatedAt: "2026-04-13T19:00:00.000Z",
        hitCount: 4,
        payload: payloadFixture({
          claims: [
            claimFixture({
              id: "offer_strategy",
              topic: "offer_recommendation",
              citation: "engineOut_offer_1",
              narrative: "Original recommendation should not survive to buyers.",
              marketReferenceLabel: "offer engine baseline",
            }),
          ],
          recommendedAction: {
            openingPrice: 615_000,
            rationaleClaimIds: ["offer_strategy"],
            suggestedContingencies: ["inspection"],
            riskLevel: "medium",
            confidence: 0.78,
          },
        }),
      },
      coverage: availableCoverage(),
      citations: [
        {
          citationId: "engineOut_offer_1",
          engineType: "offer",
          confidence: 0.88,
          generatedAt: "2026-04-13T18:56:00.000Z",
          reviewState: "approved",
          adjudication: {
            status: "adjusted",
            action: "adjust",
            visibility: "buyer_safe",
            rationale: "Broker softened the recommendation before buyer exposure.",
            reviewedConclusion:
              "Open at $615,000 with clean terms and keep concession asks light.",
            buyerExplanation:
              "This range was reviewed by your broker against comps and current seller posture.",
            internalNotes: "Internal-only calibration note.",
            actorUserId: "user_broker",
            actorName: "Broker",
            actedAt: "2026-04-13T19:05:00.000Z",
          },
          adjudicationHistory: [
            {
              status: "adjusted",
              action: "adjust",
              visibility: "buyer_safe",
              rationale: "Broker softened the recommendation before buyer exposure.",
              reviewedConclusion:
                "Open at $615,000 with clean terms and keep concession asks light.",
              buyerExplanation:
                "This range was reviewed by your broker against comps and current seller posture.",
              internalNotes: "Internal-only calibration note.",
              actorUserId: "user_broker",
              actorName: "Broker",
              actedAt: "2026-04-13T19:05:00.000Z",
              reviewStateBefore: "pending",
              reviewStateAfter: "approved",
            },
          ],
        },
      ],
      evidenceGraph: evidenceGraphFixture(),
      viewerRole: "buyer",
    });

    expect(surface.action?.reviewedConclusion).toBe(
      "Open at $615,000 with clean terms and keep concession asks light.",
    );
    expect(surface.action?.buyerExplanation).toBe(
      "This range was reviewed by your broker against comps and current seller posture.",
    );
    expect(surface.sources[0]).toMatchObject({
      adjudicationStatus: "adjusted",
      visibility: "buyer_safe",
      reviewedConclusion:
        "Open at $615,000 with clean terms and keep concession asks light.",
    });
    if (surface.variant !== "internal") {
      expect(surface.clientReadySummary.renderedText).not.toContain(
        "Internal-only calibration note.",
      );
    }
  });

  it("updates confidence fingerprints and section guidance deterministically when evidence changes", () => {
    const first = buildPropertyCaseOverview({
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
      citations: [],
      evidenceGraph: evidenceGraphFixture(),
      viewerRole: "buyer",
    });

    const updatedEvidence = evidenceGraphFixture();
    updatedEvidence.fingerprint = "evidence-graph-v2";
    updatedEvidence.sections.offer_recommendation = {
      ...updatedEvidence.sections.offer_recommendation,
      status: "supported",
      buyerSummary: {
        ...updatedEvidence.sections.offer_recommendation.buyerSummary,
        caution: null,
      },
      confidenceInputs: {
        ...updatedEvidence.sections.offer_recommendation.confidenceInputs,
        score: 0.8,
        band: "high",
        missingLabels: [],
      },
      internalTrace: {
        ...updatedEvidence.sections.offer_recommendation.internalTrace!,
        missingNodeIds: [],
      },
      missingNodeIds: [],
    };

    const second = buildPropertyCaseOverview({
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
      citations: [],
      evidenceGraph: updatedEvidence,
      viewerRole: "buyer",
    });

    expect(first.confidenceFingerprint).toBe("evidence-graph-v1");
    expect(second.confidenceFingerprint).toBe("evidence-graph-v2");
    expect(
      first.confidenceSections.find(
        (section) => section.key === "offer_recommendation",
      )?.whatWouldIncreaseConfidence,
    ).toContain("Add broker-reviewed leverage output.");
    expect(
      second.confidenceSections.find(
        (section) => section.key === "offer_recommendation",
      )?.whatWouldIncreaseConfidence,
    ).toContain("Keep the cited evidence fresh before finalizing the decision.");
  });
});
