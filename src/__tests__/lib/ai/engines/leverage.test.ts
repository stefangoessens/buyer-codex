import { describe, expect, it } from "vitest";
import {
  analyzeLeverage,
  computeLeverageScore,
  detectDomPressure,
  detectMotivatedLanguage,
  detectPriceReductions,
  evaluateLeverageAnalysis,
} from "@/lib/ai/engines/leverage";

describe("detectMotivatedLanguage", () => {
  it("detects motivated seller phrases with deterministic rationale", () => {
    const result = detectMotivatedLanguage(
      "Must sell. Bring all offers. Sold as-is.",
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      name: "motivated_seller_language",
      value: 3,
      marketReference: 0,
      delta: 3,
      direction: "bullish",
    });
    expect(result?.explanation).toContain("must sell");
    expect(result?.explanation).toContain("bring all offers");
    expect(result?.explanation).toContain("as-is");
  });

  it("returns null for clean descriptions", () => {
    expect(
      detectMotivatedLanguage("Beautiful 3-bed home with pool."),
    ).toBeNull();
  });
});

describe("detectDomPressure", () => {
  it("expresses DOM as a delta vs neighborhood median", () => {
    const result = detectDomPressure(90, 30);

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      name: "days_on_market_pressure",
      value: 90,
      marketReference: 30,
      delta: 60,
      direction: "bullish",
    });
    expect(result?.explanation).toContain("90 days");
    expect(result?.explanation).toContain("30");
  });

  it("detects low DOM as bearish", () => {
    expect(detectDomPressure(5, 30)?.direction).toBe("bearish");
  });
});

describe("detectPriceReductions", () => {
  it("compares cut count against a neighborhood markdown norm", () => {
    const result = detectPriceReductions(
      [
        { amount: 10000, date: "2026-01-01" },
        { amount: 5000, date: "2026-02-01" },
      ],
      1 / 3,
      0.98,
    );

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      name: "price_cut_count",
      value: 2,
      marketReference: 1,
      delta: 1,
      direction: "bullish",
    });
    expect(result?.explanation).toContain("2 price cuts");
  });

  it("returns null for no reductions", () => {
    expect(detectPriceReductions([], 0.98)).toBeNull();
  });
});

describe("computeLeverageScore", () => {
  it("returns 50 for no signals", () => {
    expect(computeLeverageScore([])).toBe(50);
  });

  it("decreases for bearish signals", () => {
    const score = computeLeverageScore([
      {
        name: "price_vs_market",
        value: 620,
        marketReference: 500,
        delta: 120,
        confidence: 0.8,
        citation: "test",
        direction: "bearish",
        explanation: "Listing is meaningfully above neighborhood pricing.",
      },
    ]);

    expect(score).toBeLessThan(50);
  });
});

describe("analyzeLeverage", () => {
  it("produces deterministic seller-pressure output for a rich fixture", () => {
    const result = analyzeLeverage({
      propertyId: "p1",
      listPrice: 500000,
      daysOnMarket: 90,
      sqft: 1800,
      description:
        "Must sell. Bring all offers. Priced to sell after a recent price improvement.",
      neighborhoodMedianDom: 30,
      neighborhoodMedianPsf: 280,
      neighborhoodSalesVelocity: 0.23,
      neighborhoodInventoryCount: 12,
      neighborhoodMarketTrajectory: "falling",
      neighborhoodMedianSaleToListRatio: 0.98,
      neighborhoodMedianPriceCutFrequency: 1 / 3,
      neighborhoodMedianReductionPct: 2,
      priceReductions: [{ amount: 20000, date: "2026-02-01" }],
      wasRelisted: true,
      wasPendingFellThrough: true,
      listingAgentAvgDom: 46,
      listingAgentAvgSaleToList: 0.972,
      listingAgentPriceCutFrequency: 0.35,
      sellerEquityPct: 60,
      occupancyStatus: "vacant",
    });

    expect(result.score).toBeGreaterThan(70);
    expect(result.overallConfidence).toBeGreaterThan(0.7);
    expect(result.signalCount).toBe(result.signals.length);
    expect(result.summary).toBe(
      "Seller pressure looks elevated. Description includes motivated-seller language: must sell, bring all offers, priced to sell, price improvement.",
    );
    expect(result.rationale ?? []).toEqual([
      "Description includes motivated-seller language: must sell, bring all offers, priced to sell, price improvement.",
      "Listing has been on market 90 days versus a neighborhood median of 30 days (+200.0%).",
      "Listing age is 90 days versus an estimated 52.2-day absorption pace from neighborhood inventory and sales velocity (+72.4%).",
      "Neighborhood market trajectory is falling, which typically increases seller pressure versus a flat market.",
    ]);
    expect(result.signals.map((signal) => signal.name)).toEqual([
      "days_on_market_pressure",
      "price_cut_count",
      "price_cut_total",
      "motivated_seller_language",
      "price_vs_market",
      "listing_trajectory",
      "listing_age",
      "agent_avg_dom",
      "agent_sale_to_list",
      "agent_price_cut_frequency",
      "seller_equity",
      "occupancy_pressure",
      "market_temperature",
    ]);
  });

  it("degrades gracefully when market inputs are missing", () => {
    const result = analyzeLeverage({
      propertyId: "p2",
      listPrice: 450000,
      daysOnMarket: 12,
      sqft: 1500,
    });

    expect(result).toEqual({
      score: 50,
      signals: [],
      overallConfidence: 0.5,
      signalCount: 0,
      summary:
        "Leverage is neutral because no seller-pressure signals were available.",
      rationale: [],
    });
  });

  it("captures bearish leverage when the listing is moving faster than market", () => {
    const result = analyzeLeverage({
      propertyId: "p3",
      listPrice: 600000,
      daysOnMarket: 9,
      sqft: 1000,
      neighborhoodMedianDom: 30,
      neighborhoodMedianPsf: 500,
      neighborhoodSalesVelocity: 0.4,
      neighborhoodInventoryCount: 8,
      neighborhoodMarketTrajectory: "rising",
      neighborhoodMedianSaleToListRatio: 0.985,
      neighborhoodMedianPriceCutFrequency: 0.15,
      neighborhoodMedianReductionPct: 1.2,
      listingAgentAvgDom: 18,
      listingAgentAvgSaleToList: 0.995,
      listingAgentPriceCutFrequency: 0.1,
    });

    expect(result.score).toBeLessThan(50);
    expect(result.summary).toBe(
      "Seller leverage looks firmer than buyer leverage. Listing has been on market 9 days versus a neighborhood median of 30 days (-70.0%).",
    );
    expect((result.rationale ?? [])[0]).toBe(
      "Listing has been on market 9 days versus a neighborhood median of 30 days (-70.0%).",
    );
    expect(result.signals.some((signal) => signal.direction === "bearish")).toBe(
      true,
    );
  });

  it("packages deterministic execution metadata for replay and persistence", () => {
    const execution = evaluateLeverageAnalysis({
      propertyId: "p4",
      listPrice: 500000,
      daysOnMarket: 70,
      sqft: 1800,
      neighborhoodMedianDom: 30,
      description: "Must sell. Bring all offers.",
    });

    expect(execution.modelId).toBe("deterministic-leverage-v2");
    expect(execution.confidence).toBeGreaterThan(0.6);
    expect(execution.citations).toContain(
      "Listing DOM vs neighborhood median DOM",
    );
    expect(execution.citations).toContain("Listing description analysis");
  });
});
