import { describe, expect, it } from "vitest";
import type { BuyerReadinessSurface } from "@/lib/dealroom/buyer-readiness";
import { buildPropertyRecommendation } from "@/lib/dealroom/next-best-action";
import type { PropertyCaseOverviewSurface } from "@/lib/dealroom/property-case-overview";
import type { DealRoomRiskSummary } from "@/lib/dealroom/risk-summary";
import { previewPropertyCaseOverview } from "@/components/dealroom/preview-data";

function makeOverview(
  overrides: Partial<PropertyCaseOverviewSurface> = {},
): PropertyCaseOverviewSurface {
  const base = structuredClone(
    previewPropertyCaseOverview,
  ) as PropertyCaseOverviewSurface;

  return {
    ...base,
    ...overrides,
    decisionMemo: {
      ...base.decisionMemo,
      ...(overrides.decisionMemo ?? {}),
      recommendation: {
        ...base.decisionMemo.recommendation,
        ...(overrides.decisionMemo?.recommendation ?? {}),
      },
      upside: {
        ...base.decisionMemo.upside,
        ...(overrides.decisionMemo?.upside ?? {}),
      },
      downside: {
        ...base.decisionMemo.downside,
        ...(overrides.decisionMemo?.downside ?? {}),
      },
      unknowns: {
        ...base.decisionMemo.unknowns,
        ...(overrides.decisionMemo?.unknowns ?? {}),
      },
      unresolvedRisks: {
        ...base.decisionMemo.unresolvedRisks,
        ...(overrides.decisionMemo?.unresolvedRisks ?? {}),
      },
    },
    marketReality: overrides.marketReality
      ? {
          ...base.marketReality!,
          ...overrides.marketReality,
          position: {
            ...base.marketReality!.position,
            ...(overrides.marketReality.position ?? {}),
          },
        }
      : base.marketReality,
    action:
      overrides.action === null
        ? null
        : overrides.action
          ? {
              ...base.action!,
              ...overrides.action,
            }
          : base.action,
    artifacts: {
      ...base.artifacts,
      ...(overrides.artifacts ?? {}),
      recommendation: {
        ...base.artifacts.recommendation,
        ...(overrides.artifacts?.recommendation ?? {}),
      },
    },
    missingStates: overrides.missingStates ?? base.missingStates,
  } as PropertyCaseOverviewSurface;
}

function makeBuyerReadiness(
  overrides: Partial<BuyerReadinessSurface> = {},
): BuyerReadinessSurface {
  const base: BuyerReadinessSurface = {
    dealRoomId: "preview-miami-beach",
    propertyId: "preview-property-1",
    generatedAt: "2026-04-13T15:15:00.000Z",
    variant: "buyer_safe",
    currentStage: "tour",
    currentStageLabel: "Tour",
    currentState: "ready",
    currentStateLabel: "Ready",
    checkpoints: [
      {
        key: "tour",
        label: "Tour",
        state: "ready",
        stateLabel: "Ready",
        summary: "Tour stage is clear.",
        blockerIds: [],
      },
      {
        key: "offer",
        label: "Offer",
        state: "ready",
        stateLabel: "Ready",
        summary: "Offer stage is clear.",
        blockerIds: [],
      },
      {
        key: "negotiate",
        label: "Negotiate",
        state: "ready",
        stateLabel: "Ready",
        summary: "Negotiation stage is clear.",
        blockerIds: [],
      },
      {
        key: "close",
        label: "Close",
        state: "ready",
        stateLabel: "Ready",
        summary: "Close stage is clear.",
        blockerIds: [],
      },
    ],
    blockers: [],
    buyerSummary: {
      headline: "Buyer readiness is clear",
      body: "No readiness blockers are open.",
      nextSteps: [],
    },
    scopeNote:
      "Readiness tracks what is still preventing action on this property. It does not mean the property itself is good or bad.",
  };

  return {
    ...base,
    ...overrides,
    checkpoints: overrides.checkpoints ?? base.checkpoints,
    blockers: overrides.blockers ?? base.blockers,
    buyerSummary: {
      ...base.buyerSummary,
      ...(overrides.buyerSummary ?? {}),
    },
  } as BuyerReadinessSurface;
}

function makeRiskSummary(
  overrides: Omit<Partial<DealRoomRiskSummary>, "counts"> & {
    counts?: Partial<DealRoomRiskSummary["counts"]>;
  } = {},
): DealRoomRiskSummary {
  const base: DealRoomRiskSummary = {
    dealRoomId: "preview-miami-beach",
    propertyId: "preview-property-1",
    updatedAt: "2026-04-13T15:15:00.000Z",
    status: "clear",
    highestSeverity: null,
    counts: {
      total: 0,
      low: 0,
      medium: 0,
      high: 0,
      reviewRequired: 0,
    },
    items: [],
  };

  return {
    ...base,
    ...overrides,
    counts: {
      ...base.counts,
      ...(overrides.counts ?? {}),
    },
    items: overrides.items ?? base.items,
  };
}

describe("buildPropertyRecommendation", () => {
  it("recommends touring when the property looks actionable and tour readiness is clear", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        overallConfidence: 0.76,
        overallConfidenceLabel: "76% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          recommendation: {
            ...previewPropertyCaseOverview.decisionMemo.recommendation,
            verdict: "worth_pursuing",
            body: "The current evidence is strong enough to keep this home active.",
          },
        },
      }),
      readiness: makeBuyerReadiness({
        currentStage: "tour",
        currentStageLabel: "Tour",
      }),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("tour");
    expect(recommendation.label).toBe("Tour it next");
  });

  it("recommends offering now when offer readiness is clear and the offer path is visible", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        overallConfidence: 0.82,
        overallConfidenceLabel: "82% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          recommendation: {
            ...previewPropertyCaseOverview.decisionMemo.recommendation,
            verdict: "worth_pursuing",
            body: "The property case supports moving into an offer now.",
          },
        },
        artifacts: {
          ...previewPropertyCaseOverview.artifacts,
          recommendation: {
            ...previewPropertyCaseOverview.artifacts.recommendation,
            withholdOutput: false,
          },
        },
      }),
      readiness: makeBuyerReadiness({
        currentStage: "offer",
        currentStageLabel: "Offer",
      }),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("offer_now");
    expect(recommendation.buyerCta.href).toBe(
      "/dealroom/preview-miami-beach/offer",
    );
  });

  it("recommends proceeding with conditions when the property looks viable but readiness still blocks it", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        overallConfidence: 0.8,
        overallConfidenceLabel: "80% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          recommendation: {
            ...previewPropertyCaseOverview.decisionMemo.recommendation,
            verdict: "worth_pursuing",
            body: "The home still looks actionable once financing is cleared.",
          },
        },
      }),
      readiness: makeBuyerReadiness({
        currentStage: "offer",
        currentStageLabel: "Offer",
        currentState: "blocked",
        currentStateLabel: "Blocked",
        blockers: [
          {
            id: "financing-missing-preapproval",
            title: "Pre-approval is still missing",
            summary:
              "You can keep researching the property, but financing is not ready enough to move cleanly into an offer.",
            buyerAction: "Upload or confirm an active pre-approval.",
            effect: "blocks",
            checkpoints: ["offer", "negotiate", "close"],
            internal: {
              owner: "buyer",
              severity: "high",
              reasonCode: "financing_missing_preapproval",
              remediation: "Collect the buyer's pre-approval.",
              supportingSignals: ["Buyer profile preApproved flag is false."],
            },
          },
        ],
      }),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("proceed_with_conditions");
    expect(recommendation.blockersAndConditions[0]?.title).toBe(
      "Pre-approval is still missing",
    );
  });

  it("asks for docs first when the property case is still unclear and diligence blockers are open", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        viewState: "partial",
        overallConfidence: 0.48,
        overallConfidenceLabel: "48% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          recommendation: {
            ...previewPropertyCaseOverview.decisionMemo.recommendation,
            verdict: "wait_for_more_evidence",
            body: "The recommendation layer still needs more evidence.",
          },
        },
      }),
      readiness: makeBuyerReadiness({
        currentState: "needs_attention",
        currentStateLabel: "Needs attention",
        blockers: [
          {
            id: "document-review-inspection",
            title: "Inspection report needs review",
            summary:
              "This document is still in broker review and is not ready to clear the related step.",
            buyerAction: "Wait for broker review to clear this document.",
            effect: "blocks",
            checkpoints: ["offer", "negotiate"],
            internal: {
              owner: "broker",
              severity: "high",
              reasonCode: "document_review_required",
              remediation: "Review the extraction findings.",
              supportingSignals: ["Inspection report waiting on review."],
            },
          },
        ],
      }),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("ask_for_docs");
  });

  it("waits and watches when the case is still incomplete without a concrete diligence ask", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        viewState: "partial",
        overallConfidence: 0.5,
        overallConfidenceLabel: "50% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          recommendation: {
            ...previewPropertyCaseOverview.decisionMemo.recommendation,
            verdict: "wait_for_more_evidence",
          },
        },
        missingStates: [
          {
            engine: "pricing",
            label: "Pricing",
            tone: "pending",
            title: "Pricing is still being reviewed",
            description: "The upstream analysis is still running or waiting on review.",
          },
        ],
      }),
      readiness: makeBuyerReadiness(),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("wait_and_watch");
  });

  it("recommends skipping when strong negative property evidence and high risk line up", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        overallConfidence: 0.81,
        overallConfidenceLabel: "81% confidence",
        decisionMemo: {
          ...previewPropertyCaseOverview.decisionMemo,
          upside: {
            ...previewPropertyCaseOverview.decisionMemo.upside,
            items: previewPropertyCaseOverview.decisionMemo.upside.items.slice(0, 1),
          },
          downside: {
            ...previewPropertyCaseOverview.decisionMemo.downside,
            items: [
              ...previewPropertyCaseOverview.decisionMemo.downside.items,
              {
                id: "second-downside",
                title: "Insurance bindability",
                body: "The roof and insurance profile add real execution risk.",
                evidence: [],
              },
            ],
          },
        },
        marketReality: {
          ...previewPropertyCaseOverview.marketReality!,
          position: {
            ...previewPropertyCaseOverview.marketReality!.position,
            code: "overpriced",
          },
        },
      }),
      readiness: makeBuyerReadiness(),
      riskSummary: makeRiskSummary({
        status: "attention",
        highestSeverity: "high",
        counts: {
          total: 1,
          high: 1,
        },
        items: [
          {
            id: "property:insurance_bindability",
            name: "insurance_bindability",
            title: "Insurance bindability",
            summary:
              "Older roof profile without clear wind-hardening can increase insurance and bindability risk.",
            severity: "high",
            source: "canonical_property",
            reviewState: "ready",
            visibility: "shared",
          },
        ],
      }),
    });

    expect(recommendation.kind).toBe("skip");
  });

  it("keeps internal reason codes and broker-review reasons on the internal variant", () => {
    const recommendation = buildPropertyRecommendation({
      overview: {
        ...makeOverview(),
        variant: "internal",
        viewerRole: "broker",
        internal: {
          inputHash: "hash",
          synthesisVersion: "v1",
          contributingEngines: 4,
          droppedEngines: [],
          hitCount: 1,
          adjudicationSummary: {
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            buyerSafeCount: 0,
            internalOnlyCount: 0,
            adjustedCount: 0,
            overriddenCount: 0,
          },
          adjudicationItems: [],
          marketReality: null,
          confidenceSections: [],
          decisionMemo: {
            rationaleSummary: "Internal rationale",
            sections: [],
          },
          guardrails: [],
        },
      },
      readiness: {
        ...makeBuyerReadiness({
          currentStage: "offer",
          currentStageLabel: "Offer",
          currentState: "blocked",
          currentStateLabel: "Blocked",
          blockers: [
            {
              id: "financing-missing-preapproval",
              title: "Pre-approval is still missing",
              summary:
                "You can keep researching the property, but financing is not ready enough to move cleanly into an offer.",
              buyerAction: "Upload or confirm an active pre-approval.",
              effect: "blocks",
              checkpoints: ["offer", "negotiate", "close"],
              internal: {
                owner: "buyer",
                severity: "high",
                reasonCode: "financing_missing_preapproval",
                remediation: "Collect the buyer's pre-approval.",
                supportingSignals: ["Buyer profile preApproved flag is false."],
              },
            },
          ],
        }),
        variant: "internal",
        internal: {
          blockerCounts: {
            buyer: 1,
            broker: 0,
            system: 0,
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
          },
        },
      } as BuyerReadinessSurface,
      riskSummary: makeRiskSummary({
        status: "review_required",
        highestSeverity: "medium",
        counts: {
          total: 1,
          medium: 1,
          reviewRequired: 1,
        },
        items: [
          {
            id: "milestone:inspection",
            name: "inspection_document_review",
            title: "Inspection review required",
            summary:
              "Inspection findings need manual review before they drive buyer-facing guidance.",
            severity: "medium",
            source: "file_analysis",
            reviewState: "review_required",
            visibility: "internal",
            internal: {
              sourceRecordType: "contract_milestone",
              sourceRecordId: "milestone_1",
              reviewReason: "manual_flag",
            },
          },
        ],
      }),
    });

    expect(recommendation.variant).toBe("internal");
    if (recommendation.variant !== "internal") {
      throw new Error("Expected internal recommendation variant");
    }
    expect(recommendation.internal.reasonCodes).toContain(
      "financing_missing_preapproval",
    );
    expect(recommendation.internal.brokerReviewRequired).toBe(true);
    expect(recommendation.internal.brokerReviewReasons).toContain(
      "Inspection review required",
    );
  });

  it("uses a strong negative buyer-fit signal to keep the action skeptical", () => {
    const recommendation = buildPropertyRecommendation({
      overview: makeOverview({
        overallConfidence: 0.78,
        overallConfidenceLabel: "78% confidence",
        buyerFit: {
          ...previewPropertyCaseOverview.buyerFit,
          score: -0.52,
          scoreLabel: "Repeats patterns usually rejected",
          summary:
            "This property repeats patterns the buyer has usually moved away from, so the recommendation should stay skeptical.",
          supportingReasons: [],
          conflictingReasons: [
            {
              source: "inferred",
              kind: "conflicts",
              label: "Usually avoids high HOA fees",
              explanation:
                "Your recent behavior keeps leaning away from high HOA fees.",
              confidence: 0.76,
              status: "durable",
            },
          ],
          shouldInfluenceRecommendations: true,
        },
      }),
      readiness: makeBuyerReadiness({
        currentStage: "offer",
        currentStageLabel: "Offer",
      }),
      riskSummary: makeRiskSummary(),
    });

    expect(recommendation.kind).toBe("skip");
    expect(recommendation.rationale).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Repeated behavior leans away from this property",
        }),
      ]),
    );
  });
});
