import { describe, expect, it } from "vitest";
import { analyzeLeverage } from "@/lib/ai/engines/leverage";
import { generateOfferScenarios } from "@/lib/ai/engines/offer";
import type {
  LeverageInput,
  OfferInput,
  PricingOutput,
} from "@/lib/ai/engines/types";
import {
  buildOfferWhatIfModel,
  OFFER_WHAT_IF_WAIT_DAYS,
} from "@/lib/dealroom/offer-what-if";

function baseOfferInput(overrides: Partial<OfferInput> = {}): OfferInput {
  return {
    listPrice: 650_000,
    fairValue: 625_000,
    leverageScore: 64,
    buyerMaxBudget: 680_000,
    daysOnMarket: 48,
    competingOffers: 1,
    ...overrides,
  };
}

function baseLeverageInput(
  overrides: Partial<LeverageInput> = {},
): LeverageInput {
  return {
    propertyId: "prop_1",
    listPrice: 650_000,
    daysOnMarket: 48,
    neighborhoodMedianDom: 27,
    neighborhoodMedianPsf: 410,
    neighborhoodSalesVelocity: 12,
    neighborhoodInventoryCount: 40,
    neighborhoodMarketTrajectory: "flat",
    neighborhoodMedianSaleToListRatio: 0.978,
    neighborhoodMedianPriceCutFrequency: 0.22,
    neighborhoodMedianReductionPct: 2.1,
    sqft: 1_600,
    priceReductions: [{ amount: 15_000, date: "2026-03-20" }],
    ...overrides,
  };
}

function basePricingOutput(
  overrides: Partial<PricingOutput> = {},
): PricingOutput {
  return {
    fairValue: {
      value: 625_000,
      deltaVsListPrice: -3.8,
      deltaVsConsensus: -1,
      deltaVsNeighborhoodMedian: null,
      deltaVsCompAverage: null,
      confidence: 0.76,
    },
    likelyAccepted: {
      value: 637_000,
      deltaVsListPrice: -2,
      deltaVsConsensus: 0.8,
      deltaVsNeighborhoodMedian: null,
      deltaVsCompAverage: null,
      confidence: 0.72,
    },
    strongOpener: {
      value: 615_000,
      deltaVsListPrice: -5.4,
      deltaVsConsensus: -2.6,
      deltaVsNeighborhoodMedian: null,
      deltaVsCompAverage: null,
      confidence: 0.7,
    },
    walkAway: {
      value: 670_000,
      deltaVsListPrice: 3.1,
      deltaVsConsensus: 6,
      deltaVsNeighborhoodMedian: null,
      deltaVsCompAverage: null,
      confidence: 0.7,
    },
    consensusEstimate: 632_000,
    estimateSpread: 0.06,
    estimateSources: ["zillow", "redfin", "realtor"],
    overallConfidence: 0.74,
    marketReferences: {
      listPrice: 650_000,
      consensusEstimate: 632_000,
      neighborhoodMedianPrice: null,
      compAveragePrice: null,
    },
    ...overrides,
  };
}

describe("buildOfferWhatIfModel", () => {
  it("is deterministic for the same inputs", () => {
    const offerInput = baseOfferInput();
    const leverageInput = baseLeverageInput();
    const output = generateOfferScenarios(offerInput);
    const leverageOutput = analyzeLeverage(leverageInput);
    const pricingOutput = basePricingOutput();

    const first = buildOfferWhatIfModel({
      offerInput,
      offerOutput: output,
      offerConfidence: 0.81,
      offerReviewState: "approved",
      pricingOutput,
      leverageInput,
      leverageOutput,
    });
    const second = buildOfferWhatIfModel({
      offerInput,
      offerOutput: output,
      offerConfidence: 0.81,
      offerReviewState: "approved",
      pricingOutput,
      leverageInput,
      leverageOutput,
    });

    expect(first).toEqual(second);
  });

  it("labels the price-cut assumption explicitly", () => {
    const offerInput = baseOfferInput();
    const model = buildOfferWhatIfModel({
      offerInput,
      offerOutput: generateOfferScenarios(offerInput),
      offerConfidence: 0.81,
      offerReviewState: "approved",
      leverageInput: baseLeverageInput(),
      leverageOutput: analyzeLeverage(baseLeverageInput()),
      pricingOutput: basePricingOutput(),
    });

    const priceScenario = model?.scenarios.find(
      (scenario) => scenario.kind === "price_change",
    );
    expect(priceScenario?.changedAssumptions).toEqual([
      {
        key: "list_price",
        label: "Seller asking price",
        before: "$650,000",
        after: "$637,000",
      },
    ]);
    expect(priceScenario?.assumptionValue).toBe("-2%");
  });

  it("updates days on market and leverage when the buyer waits", () => {
    const offerInput = baseOfferInput({ competingOffers: 0 });
    const leverageInput = baseLeverageInput();
    const leverageOutput = analyzeLeverage(leverageInput);
    const model = buildOfferWhatIfModel({
      offerInput,
      offerOutput: generateOfferScenarios(offerInput),
      offerConfidence: 0.78,
      offerReviewState: "approved",
      leverageInput,
      leverageOutput,
      pricingOutput: basePricingOutput(),
    });

    const waitScenario = model?.scenarios.find(
      (scenario) => scenario.kind === "timing_change",
    );
    expect(waitScenario?.changedAssumptions).toContainEqual({
      key: "wait_window",
      label: "Buyer wait time",
      before: "Today",
      after: `+${OFFER_WHAT_IF_WAIT_DAYS} days`,
    });
    expect(waitScenario?.changedAssumptions).toContainEqual({
      key: "days_on_market",
      label: "Observed days on market",
      before: "48 days",
      after: "62 days",
    });
    expect(waitScenario?.internalSummary.headline).toContain(
      "Recomputed leverage",
    );
  });

  it("prefers a pricing-resolution scenario when pricing review is still required", () => {
    const offerInput = baseOfferInput();
    const model = buildOfferWhatIfModel({
      offerInput,
      offerOutput: generateOfferScenarios(offerInput),
      offerConfidence: 0.68,
      offerReviewState: "approved",
      leverageInput: baseLeverageInput(),
      leverageOutput: analyzeLeverage(baseLeverageInput()),
      pricingOutput: basePricingOutput({
        reviewFallback: {
          reviewRequired: true,
          reasons: ["estimate_disagreement"],
          summary: "Portal estimates are disagreeing.",
        },
      }),
    });

    const uncertaintyScenario = model?.scenarios.find(
      (scenario) => scenario.kind === "uncertainty_resolved",
    );
    expect(uncertaintyScenario?.title).toBe("Pricing is clarified");
    expect(uncertaintyScenario?.changedAssumptions).toEqual([
      {
        key: "pricing_anchor",
        label: "Pricing anchor",
        before: "$625,000",
        after: "$637,000",
      },
    ]);
  });
});
