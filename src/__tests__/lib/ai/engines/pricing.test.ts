import { describe, expect, it } from "vitest";
import {
  buildPricePoint,
  buildPricingRequest,
  computeConsensus,
  executePricingAnalysis,
  parsePricingResponse,
  spreadConfidenceAdjustment,
} from "@/lib/ai/engines/pricing";
import type { GatewayProvider } from "@/lib/ai/types";

function mockProvider(
  id: GatewayProvider["id"],
  implementation: GatewayProvider["execute"],
): GatewayProvider {
  return {
    id,
    execute: implementation,
  };
}

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
    const point = buildPricePoint(480000, 500000, 490000, 0.85, {
      neighborhoodMedianPrice: 495000,
      compAveragePrice: 485000,
    });
    expect(point.value).toBe(480000);
    expect(point.deltaVsListPrice).toBe(-4);
    expect(point.deltaVsConsensus).toBeCloseTo(-2, 0);
    expect(point.deltaVsNeighborhoodMedian).toBeCloseTo(-3, 0);
    expect(point.deltaVsCompAverage).toBeCloseTo(-1, 0);
    expect(point.confidence).toBe(0.85);
  });
});

describe("parsePricingResponse", () => {
  const input = {
    propertyId: "p1",
    listPrice: 500000,
    address: "123 Main",
    beds: 3,
    baths: 2,
    sqft: 1800,
    yearBuilt: 2020,
    propertyType: "Condo",
    neighborhoodMedianPsf: 275,
    compAvgPsf: 265,
  };

  it("adds comparative references and keeps spread as a ratio", () => {
    const output = parsePricingResponse(
      JSON.stringify({
        fairValue: 480000,
        likelyAccepted: 490000,
        strongOpener: 470000,
        walkAway: 460000,
      }),
      input,
      490000,
      0.045,
      ["zillow", "redfin", "realtor"],
    );

    expect(output).not.toBeNull();
    expect(output?.estimateSpread).toBe(0.045);
    expect(output?.marketReferences).toEqual({
      listPrice: 500000,
      consensusEstimate: 490000,
      neighborhoodMedianPrice: 495000,
      compAveragePrice: 477000,
    });
    expect(output?.fairValue.deltaVsNeighborhoodMedian).toBeCloseTo(-3, 0);
    expect(output?.fairValue.deltaVsCompAverage).toBeCloseTo(1, 0);
    expect(output?.reviewFallback).toEqual({
      reviewRequired: false,
      reasons: [],
      summary: null,
    });
  });

  it("marks sparse or conflicting inputs for broker review", () => {
    const output = parsePricingResponse(
      JSON.stringify({
        fairValue: 480000,
        likelyAccepted: 490000,
        strongOpener: 470000,
        walkAway: 460000,
      }),
      input,
      490000,
      0.14,
      ["zillow"],
    );

    expect(output).not.toBeNull();
    expect(output?.overallConfidence).toBeLessThan(0.8);
    expect(output?.reviewFallback?.reviewRequired).toBe(true);
    expect(output?.reviewFallback?.reasons).toEqual([
      "sparse_estimates",
      "estimate_disagreement",
    ]);
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
    let capturedRequest: Parameters<GatewayProvider["execute"]>[0] | null = null;
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
      promptKey: "default",
      promptVersion: "v-pricing",
      promptModel: "claude-sonnet-4-20250514",
      dealRoomId: "deal_room_1",
      gatewayDependencies: {
        anthropic: mockProvider("anthropic", async (request) => {
          capturedRequest = request;
          return {
            content:
              "{\"fairValue\": 480000, \"likelyAccepted\": 490000, \"strongOpener\": 470000, \"walkAway\": 460000}",
            usage: {
              inputTokens: 50,
              outputTokens: 20,
              model: request.model,
              provider: "anthropic",
              latencyMs: 90,
              estimatedCost: 0.002,
              fallbackUsed: false,
            },
          };
        }),
        openai: mockProvider("openai", async () => {
          throw new Error("should not be called");
        }),
      },
    });

    expect(result.output.fairValue.value).toBe(480000);
    expect(result.usage.model).toBe("claude-sonnet-4-20250514");
    expect(result.usage.provider).toBe("anthropic");
    expect(capturedRequest).toMatchObject({
      model: "claude-sonnet-4-20250514",
      metadata: {
        engineType: "pricing",
        dealRoomId: "deal_room_1",
        promptKey: "default",
        promptVersion: "v-pricing",
      },
    });
  });
});
