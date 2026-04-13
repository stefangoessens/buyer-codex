import { describe, expect, it } from "vitest";
import {
  buildCompCandidatesFromRecentSales,
  buildLeverageInputFromEnrichment,
  buildPricingInputFromEnrichment,
  pickNeighborhoodContext,
} from "@/lib/enrichment/engineContext";
import { buildPropertyMarketContext } from "@/lib/enrichment/marketContext";

const property = {
  propertyId: "p1",
  listPrice: 900_000,
  address: {
    formatted: "100 Las Olas Blvd #1001, Fort Lauderdale, FL 33301",
    zip: "33301",
  },
  beds: 3,
  bathsFull: 2,
  bathsHalf: 1,
  sqftLiving: 1_850,
  yearBuilt: 2019,
  propertyType: "Condo",
  daysOnMarket: 44,
  description: "Seller motivated after recent price improvement.",
};

const contexts = [
  {
    geoKey: "33301",
    geoKind: "zip" as const,
    windowDays: 30,
    medianDom: 28,
    medianPricePerSqft: 505,
    medianListPrice: 880_000,
    inventoryCount: 12,
    pendingCount: 5,
    salesVelocity: 0.23,
    trajectory: "rising" as const,
    priceReductionFrequency: 0.4,
    medianReductionPct: 2.5,
    sampleSize: {
      total: 18,
      sold: 7,
      active: 12,
      pending: 5,
      pricePerSqft: 7,
      dom: 7,
      saleToList: 6,
      reduction: 10,
    },
    provenance: { source: "market://30", fetchedAt: "2026-04-12T12:00:00Z" },
    lastRefreshedAt: "2026-04-12T12:00:00Z",
  },
  {
    geoKey: "33301",
    geoKind: "zip" as const,
    windowDays: 90,
    medianDom: 31,
    medianPricePerSqft: 498,
    medianListPrice: 870_000,
    inventoryCount: 18,
    pendingCount: 6,
    salesVelocity: 0.17,
    trajectory: "flat" as const,
    priceReductionFrequency: 0.28,
    medianReductionPct: 1.8,
    sampleSize: {
      total: 24,
      sold: 9,
      active: 18,
      pending: 6,
      pricePerSqft: 9,
      dom: 9,
      saleToList: 8,
      reduction: 16,
    },
    provenance: { source: "market://90", fetchedAt: "2026-04-12T12:00:00Z" },
    lastRefreshedAt: "2026-04-12T12:00:00Z",
  },
];

const marketContext = buildPropertyMarketContext({
  baselines: contexts,
  subject: {
    propertyId: "p1",
    zip: "33301",
    broaderArea: "Fort Lauderdale",
  },
  generatedAt: "2026-04-12T12:00:00Z",
});

const estimates = [
  {
    propertyId: "p1",
    portal: "zillow" as const,
    estimateValue: 915_000,
    provenance: { source: "zillow://estimate", fetchedAt: "2026-04-12T12:00:00Z" },
    capturedAt: "2026-04-12T12:00:00Z",
  },
  {
    propertyId: "p1",
    portal: "redfin" as const,
    estimateValue: 905_000,
    provenance: { source: "redfin://estimate", fetchedAt: "2026-04-12T12:00:00Z" },
    capturedAt: "2026-04-12T12:00:00Z",
  },
  {
    propertyId: "p1",
    portal: "realtor" as const,
    estimateValue: 895_000,
    provenance: { source: "realtor://estimate", fetchedAt: "2026-04-12T12:00:00Z" },
    capturedAt: "2026-04-12T12:00:00Z",
  },
];

const recentSales = [
  {
    propertyId: "p1",
    portal: "zillow" as const,
    canonicalId: "comp-1",
    address: "90 Las Olas Blvd #903, Fort Lauderdale, FL 33301",
    soldPrice: 880_000,
    soldDate: "2026-03-31",
    listPrice: 895_000,
    beds: 3,
    baths: 2.5,
    sqft: 1_780,
    yearBuilt: 2018,
    propertyType: "Condo",
    schoolDistrict: "Broward County",
    zip: "33301",
    dom: 21,
    provenance: { source: "zillow://comp-1", fetchedAt: "2026-04-12T12:00:00Z" },
    capturedAt: "2026-04-12T12:00:00Z",
  },
  {
    propertyId: "p1",
    portal: "redfin" as const,
    canonicalId: "comp-2",
    address: "120 Las Olas Blvd #1102, Fort Lauderdale, FL 33301",
    soldPrice: 920_000,
    soldDate: "2026-03-20",
    listPrice: 930_000,
    beds: 3,
    baths: 2.5,
    sqft: 1_900,
    yearBuilt: 2020,
    propertyType: "Condo",
    schoolDistrict: "Broward County",
    zip: "33301",
    dom: 18,
    provenance: { source: "redfin://comp-2", fetchedAt: "2026-04-12T12:00:00Z" },
    capturedAt: "2026-04-12T12:00:00Z",
  },
];

describe("enrichment/engineContext", () => {
  it("prefers the requested neighborhood window when available", () => {
    expect(pickNeighborhoodContext(contexts, 90)?.windowDays).toBe(90);
    expect(pickNeighborhoodContext(contexts, 60)?.windowDays).toBe(30);
  });

  it("builds pricing input from stored portal estimates + 90-day context", () => {
    const input = buildPricingInputFromEnrichment({
      property,
      estimates,
      marketContext,
      contexts,
      recentSales,
    });

    expect(input.zestimate).toBe(915_000);
    expect(input.redfinEstimate).toBe(905_000);
    expect(input.realtorEstimate).toBe(895_000);
    expect(input.neighborhoodMedianPsf).toBe(498);
    expect(input.compAvgPsf).toBeCloseTo(489.3, 1);
  });

  it("builds leverage input from 30-day market context + listing-agent stats", () => {
    const input = buildLeverageInputFromEnrichment({
      property,
      marketContext,
      contexts,
      listingAgent: {
        canonicalAgentId: "jane-smith::compass",
        name: "Jane Smith",
        brokerage: "Compass",
        avgDaysOnMarket: 46,
        medianListToSellRatio: 0.972,
        priceCutFrequency: 0.35,
        provenance: {},
        lastRefreshedAt: "2026-04-12T12:00:00Z",
      },
      recentSales,
    });

    expect(input.neighborhoodMedianDom).toBe(28);
    expect(input.neighborhoodMedianPsf).toBe(505);
    expect(input.neighborhoodSalesVelocity).toBe(0.23);
    expect(input.neighborhoodInventoryCount).toBe(12);
    expect(input.neighborhoodMarketTrajectory).toBe("rising");
    expect(input.neighborhoodMedianSaleToListRatio).toBeCloseTo(0.9862, 4);
    expect(input.neighborhoodMedianPriceCutFrequency).toBeCloseTo(0.4, 2);
    expect(input.neighborhoodMedianReductionPct).toBeCloseTo(2.5, 2);
    expect(input.listingAgentAvgDom).toBe(46);
    expect(input.listingAgentAvgSaleToList).toBeCloseTo(0.972, 3);
    expect(input.listingAgentPriceCutFrequency).toBeCloseTo(0.35, 2);
  });

  it("maps recent comparable sales into comps-engine candidates", () => {
    const candidates = buildCompCandidatesFromRecentSales(recentSales);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      canonicalId: "comp-1",
      sourcePlatform: "zillow",
      sourceCitation: "zillow://comp-1",
      soldPrice: 880_000,
      schoolDistrict: "Broward County",
      zip: "33301",
    });
  });
});
