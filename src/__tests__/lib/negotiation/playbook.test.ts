import { describe, expect, it } from "vitest";
import type {
  LeverageOutput,
  OfferOutput,
  PricingOutput,
} from "@/lib/ai/engines/types";
import {
  buildNegotiationPlaybookBundle,
  projectNegotiationPlaybookForAudience,
  type NegotiationPlaybookInputs,
} from "@/lib/negotiation/playbook";
import type { PropertyMarketContext } from "@/lib/enrichment/types";

function pricingFixture(): PricingOutput {
  return {
    fairValue: {
      value: 625_000,
      deltaVsListPrice: -2.3,
      deltaVsConsensus: 0.5,
      confidence: 0.84,
    },
    likelyAccepted: {
      value: 615_000,
      deltaVsListPrice: -3.9,
      deltaVsConsensus: -1.1,
      confidence: 0.8,
    },
    strongOpener: {
      value: 598_000,
      deltaVsListPrice: -6.5,
      deltaVsConsensus: -3.8,
      confidence: 0.77,
    },
    walkAway: {
      value: 660_000,
      deltaVsListPrice: 3.1,
      deltaVsConsensus: 5.8,
      confidence: 0.74,
    },
    consensusEstimate: 621_000,
    estimateSpread: 0.045,
    estimateSources: ["zillow", "redfin", "realtor"],
    overallConfidence: 0.85,
  };
}

function leverageFixture(): LeverageOutput {
  return {
    score: 72,
    signals: [
      {
        name: "dom_vs_median",
        value: 58,
        marketReference: 28,
        delta: 107.1,
        confidence: 0.9,
        citation: "mls_dom",
        direction: "bullish",
      },
      {
        name: "price_reductions",
        value: 2,
        marketReference: 0,
        delta: 2,
        confidence: 0.88,
        citation: "listing_history",
        direction: "bullish",
      },
      {
        name: "sale_to_list",
        value: 0.97,
        marketReference: 0.99,
        delta: -2,
        confidence: 0.8,
        citation: "market_context",
        direction: "bullish",
      },
    ],
    overallConfidence: 0.86,
    signalCount: 3,
    summary: "Seller pressure looks elevated.",
  };
}

function offerFixture(overrides: Partial<OfferOutput> = {}): OfferOutput {
  return {
    scenarios: [
      {
        name: "Aggressive",
        price: 598_000,
        priceVsListPct: -6.6,
        earnestMoney: 10_000,
        closingDays: 45,
        contingencies: ["inspection", "financing", "appraisal"],
        competitivenessScore: 58,
        riskLevel: "low",
        explanation: "Lean on stale DOM and keep protections intact.",
      },
      {
        name: "Balanced",
        price: 615_000,
        priceVsListPct: -4.0,
        earnestMoney: 15_000,
        closingDays: 30,
        contingencies: ["inspection", "financing"],
        competitivenessScore: 76,
        riskLevel: "medium",
        explanation: "Near likely accepted without giving away too much.",
      },
      {
        name: "Competitive",
        price: 635_000,
        priceVsListPct: -0.8,
        earnestMoney: 20_000,
        closingDays: 21,
        contingencies: ["inspection"],
        competitivenessScore: 90,
        riskLevel: "high",
        explanation: "Use this only if the listing gets hotter.",
      },
    ],
    recommendedIndex: 1,
    inputSummary: "Standard ladder",
    refreshable: true,
    ...overrides,
  };
}

function marketContextFixture(): PropertyMarketContext {
  return {
    propertyId: "prop_1",
    baselines: [],
    windows: [
      {
        windowDays: 30,
        selectedContext: {
          geoKey: "South Beach",
          geoKind: "neighborhood",
          windowDays: 30,
          medianDom: 28,
          medianPricePerSqft: 250,
          medianSaleToListRatio: 0.97,
          priceReductionFrequency: 0.24,
          trajectory: "falling",
          inventoryCount: 14,
          pendingCount: 4,
          salesVelocity: 0.5,
          sampleSize: {
            total: 18,
            sold: 7,
            active: 8,
            pending: 3,
            pricePerSqft: 7,
            dom: 7,
            saleToList: 7,
            reduction: 10,
          },
          provenance: {
            source: "market_context",
            fetchedAt: "2026-04-13T18:00:00.000Z",
          },
          lastRefreshedAt: "2026-04-13T18:00:00.000Z",
        },
        selectedGeoKind: "neighborhood",
        selectedGeoKey: "South Beach",
        downgradeReasons: [],
        confidence: 0.84,
      },
    ],
    generatedAt: "2026-04-13T18:00:00.000Z",
  };
}

function inputFixture(
  overrides: Partial<NegotiationPlaybookInputs> = {},
): NegotiationPlaybookInputs {
  return {
    subject: {
      propertyId: "prop_1",
      address: "404 Ocean Dr, Miami Beach, FL 33139",
      listPrice: 640_000,
      daysOnMarket: 58,
      priceReductions: [{ amount: 15_000, date: "2026-03-20" }],
    },
    pricing: {
      version: "pricing-v1",
      confidence: 0.85,
      reviewState: "approved",
      output: pricingFixture(),
    },
    leverage: {
      version: "leverage-v1",
      confidence: 0.86,
      reviewState: "approved",
      output: leverageFixture(),
    },
    offer: {
      version: "offer-v1",
      confidence: 0.84,
      reviewState: "approved",
      output: offerFixture(),
    },
    marketContext: marketContextFixture(),
    listingAgent: {
      name: "Taylor Listing",
      brokerage: "Harbor Group",
      avgDaysOnMarket: 31,
      medianListToSellRatio: 0.973,
      priceCutFrequency: 0.29,
    },
    buyer: {
      budgetMax: 636_000,
      financingType: "conventional",
      preApproved: true,
      preApprovalAmount: 645_000,
      lenderName: "Coastal Lending",
    },
    generatedAt: "2026-04-13T20:00:00.000Z",
    ...overrides,
  };
}

describe("buildNegotiationPlaybookBundle", () => {
  it("builds primary and fallback strategy branches from the offer ladder", () => {
    const bundle = buildNegotiationPlaybookBundle(inputFixture());

    expect(bundle.status).toBe("ready");
    expect(bundle.primary?.scenarioName).toBe("Balanced");
    expect(bundle.primary?.askPrice).toBe(615_000);
    expect(bundle.fallback?.scenarioName).toBe("Competitive");
    expect(bundle.fallback?.askPrice).toBe(635_000);
    expect(
      bundle.fallback?.concessionPlan.some((item) => item.kind === "price_step"),
    ).toBe(true);
  });

  it("creates explicit buyer-safe and internal variants", () => {
    const bundle = buildNegotiationPlaybookBundle(inputFixture());
    const buyerSafe = projectNegotiationPlaybookForAudience(bundle, "buyer_safe");
    const internal = projectNegotiationPlaybookForAudience(bundle, "internal");

    expect(buyerSafe.audience).toBe("buyer_safe");
    expect(internal.audience).toBe("internal");
    expect(buyerSafe.primary?.rationale[0]).toContain("Pricing sits below or near list");
    expect(internal.primary?.rationale[0]).toContain("Fair value reads");
    expect(internal.invalidationConditions[0]).toContain("Buyer readiness");
  });

  it("hides buyer-safe branches when negotiation language still needs review", () => {
    const bundle = buildNegotiationPlaybookBundle(
      inputFixture({
        offer: {
          version: "offer-v1",
          confidence: 0.4,
          reviewState: "pending",
          output: offerFixture(),
        },
      }),
    );

    expect(bundle.status).toBe("needs_review");
    expect(bundle.review.state).toBe("review_required");
    expect(bundle.buyerSafe.primary).toBeNull();
    expect(bundle.internal.primary?.askLabel).toContain("$615,000");
  });

  it("falls back to a ceiling-hold branch when the recommended scenario is already max competitive", () => {
    const bundle = buildNegotiationPlaybookBundle(
      inputFixture({
        offer: {
          version: "offer-v1",
          confidence: 0.84,
          reviewState: "approved",
          output: offerFixture({ recommendedIndex: 2 }),
        },
      }),
    );

    expect(bundle.primary?.scenarioName).toBe("Competitive");
    expect(bundle.fallback?.posture).toBe("ceiling_hold");
    expect(bundle.fallback?.askPrice).toBe(bundle.primary?.askPrice);
    expect(
      bundle.fallback?.concessionPlan.some((item) => item.kind === "broker_review"),
    ).toBe(true);
  });
});
