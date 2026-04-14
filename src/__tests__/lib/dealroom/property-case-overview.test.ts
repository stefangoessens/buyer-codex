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

function evidenceGraphFixture(): Pick<
  PropertyEvidenceGraph,
  "fingerprint" | "replayKey" | "sections"
> {
  return {
    fingerprint: "evidence-graph-v1",
    replayKey: "replay-key-v1",
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
      viewerRole: "buyer",
    });

    expect(surface.variant).toBe("buyer_safe");
    expect(surface.viewerRole).toBe("buyer");
    expect(surface.viewState).toBe("ready");
    expect(surface.claims).toHaveLength(3);
    expect(surface.claims[0]?.guardrailState).toBe("softened");
    expect(surface.keyTakeaways).toHaveLength(3);
    expect(surface.action?.openingPriceLabel).toBe("$615,000");
    expect(surface.action?.guardrailState).toBe("softened");
    expect(surface.sources[0]?.anchorId).toBe("source-engineOut_pricing_1");
    expect(surface.coverageStats.availableCount).toBe(4);
    expect(surface.confidenceFingerprint).toBe("evidence-graph-v1");
    expect(surface.confidenceReplayKey).toBe("replay-key-v1");
    expect(surface.confidenceSections[0]).toMatchObject({
      key: "pricing",
      band: "medium",
      contradictoryEvidence: ["conflicting portal estimates"],
      whatWouldIncreaseConfidence: expect.arrayContaining([
        "Add fresh neighborhood baselines.",
        "Resolve the conflict around conflicting portal estimates.",
      ]),
    });
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
    });
    expect(surface.internal.adjudicationItems[0]).toMatchObject({
      citationId: "engineOut_pricing_1",
      reviewState: "approved",
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
      evidenceGraph: evidenceGraphFixture(),
      viewerRole: "buyer",
    });

    expect(surface.viewState).toBe("empty");
    expect(surface.claims).toEqual([]);
    expect(surface.overallConfidence).toBeNull();
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
