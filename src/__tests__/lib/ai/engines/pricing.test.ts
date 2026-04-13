import { describe, expect, it } from "vitest";
import {
  buildPricePoint,
  buildPricingRequest,
  computeConsensus,
  executePricingAnalysis,
  spreadConfidenceAdjustment,
} from "@/lib/ai/engines/pricing";

describe("computeConsensus", () => {
  it("computes median of all three estimates", () => {
    const result = computeConsensus({
      propertyId: "p1",
      listPrice: 500000,
      address: "123 Main",
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 2020,
      propertyType: "Condo",
      zestimate: 490000,
      redfinEstimate: 510000,
      realtorEstimate: 500000,
    });
    expect(result.consensus).toBe(500000);
    expect(result.sources).toHaveLength(3);
  });

  it("handles single estimate", () => {
    const result = computeConsensus({
      propertyId: "p1",
      listPrice: 500000,
      address: "123 Main",
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 2020,
      propertyType: "Condo",
      zestimate: 480000,
    });
    expect(result.consensus).toBe(480000);
    expect(result.sources).toEqual(["zillow"]);
  });

  it("falls back to list price when no estimates", () => {
    const result = computeConsensus({
      propertyId: "p1",
      listPrice: 500000,
      address: "123 Main",
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 2020,
      propertyType: "Condo",
    });
    expect(result.consensus).toBe(500000);
    expect(result.spread).toBe(0);
  });

  it("computes spread as coefficient of variation", () => {
    const result = computeConsensus({
      propertyId: "p1",
      listPrice: 500000,
      address: "123 Main",
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 2020,
      propertyType: "Condo",
      zestimate: 400000,
      redfinEstimate: 600000,
      realtorEstimate: 500000,
    });
    expect(result.spread).toBeGreaterThan(0.1);
  });
});

describe("spreadConfidenceAdjustment", () => {
  it("returns 1.0 for tight agreement", () => {
    expect(spreadConfidenceAdjustment(0.02)).toBe(1.0);
  });

  it("lowers confidence for high spread", () => {
    expect(spreadConfidenceAdjustment(0.15)).toBe(0.6);
  });
});

describe("buildPricePoint", () => {
  it("computes deltas correctly", () => {
    const point = buildPricePoint(480000, 500000, 490000, 0.85);
    expect(point.value).toBe(480000);
    expect(point.deltaVsListPrice).toBe(-4);
    expect(point.deltaVsConsensus).toBeCloseTo(-2, 0);
    expect(point.confidence).toBe(0.85);
  });
});

describe("buildPricingRequest", () => {
  it("tags the request as the pricing engine", () => {
    const request = buildPricingRequest(
      {
        propertyId: "p1",
        listPrice: 500000,
        address: "123 Main",
        beds: 3,
        baths: 2,
        sqft: 1800,
        yearBuilt: 2020,
        propertyType: "Condo",
      },
      "Fair value for {{address}} is {{listPrice}}",
      "Return JSON only",
    );

    expect(request.engineType).toBe("pricing");
    expect(request.messages[0]).toEqual({
      role: "system",
      content: "Return JSON only",
    });
  });
});

describe("executePricingAnalysis", () => {
  it("routes the pricing engine through the gateway and returns usage metadata", async () => {
    const result = await executePricingAnalysis({
      input: {
        propertyId: "p1",
        listPrice: 500000,
        address: "123 Main",
        beds: 3,
        baths: 2,
        sqft: 1800,
        yearBuilt: 2020,
        propertyType: "Condo",
        zestimate: 490000,
        redfinEstimate: 500000,
      },
      promptTemplate:
        "{\"fairValue\": 480000, \"likelyAccepted\": 490000, \"strongOpener\": 470000, \"walkAway\": 460000}",
      dealRoomId: "deal_room_1",
      gatewayDependencies: {
        anthropic: async () => ({
          content:
            "{\"fairValue\": 480000, \"likelyAccepted\": 490000, \"strongOpener\": 470000, \"walkAway\": 460000}",
          usage: {
            inputTokens: 50,
            outputTokens: 20,
            model: "claude-sonnet-4-20250514",
            provider: "anthropic",
            latencyMs: 90,
            estimatedCost: 0.002,
            fallbackUsed: false,
          },
        }),
        openai: async () => {
          throw new Error("should not be called");
        },
      },
    });

    expect(result.output.fairValue.value).toBe(480000);
    expect(result.usage.model).toBe("claude-sonnet-4-20250514");
    expect(result.usage.provider).toBe("anthropic");
  });
});
