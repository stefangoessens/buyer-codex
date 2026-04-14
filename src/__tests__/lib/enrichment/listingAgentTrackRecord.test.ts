import { describe, expect, it } from "vitest";

import { buildListingAgentTrackRecord } from "@/lib/enrichment/listingAgentTrackRecord";
import type { ListingAgentProfile, PropertyMarketContext } from "@/lib/enrichment/types";

function marketContextFixture(): PropertyMarketContext {
  return {
    propertyId: "prop-1",
    baselines: [],
    windows: [
      {
        windowDays: 90,
        selectedContext: {
          geoKey: "South Beach",
          geoKind: "neighborhood",
          windowDays: 90,
          medianDom: 28,
          medianPricePerSqft: 625,
          medianSaleToListRatio: 0.985,
          priceReductionFrequency: 0.22,
          sampleSize: {
            total: 32,
            sold: 18,
            active: 10,
            pending: 4,
            pricePerSqft: 18,
            dom: 18,
            saleToList: 18,
            reduction: 15,
          },
          provenance: {
            source: "bright-data://south-beach/90",
            fetchedAt: "2026-04-13T18:00:00.000Z",
          },
          lastRefreshedAt: "2026-04-13T18:00:00.000Z",
        },
        selectedGeoKind: "neighborhood",
        selectedGeoKey: "South Beach",
        downgradeReasons: [],
        confidence: 0.86,
      },
    ],
    generatedAt: "2026-04-13T18:00:00.000Z",
  };
}

describe("buildListingAgentTrackRecord", () => {
  it("builds an area-relative narrowed track record when core samples are viable", () => {
    const agent: ListingAgentProfile = {
      canonicalAgentId: "agent-1",
      name: "Taylor Listing",
      brokerage: "Harbor Group",
      soldCount: 14,
      avgDaysOnMarket: 41,
      medianListToSellRatio: 0.962,
      priceCutFrequency: 0.41,
      recentActivityCount: 12,
      provenance: {
        avgDaysOnMarket: {
          source: "zillow://agent/1",
          fetchedAt: "2026-04-13T18:05:00.000Z",
        },
        medianListToSellRatio: {
          source: "zillow://agent/1",
          fetchedAt: "2026-04-13T18:05:00.000Z",
        },
        priceCutFrequency: {
          source: "zillow://agent/1",
          fetchedAt: "2026-04-13T18:05:00.000Z",
        },
      },
      lastRefreshedAt: "2026-04-13T18:05:00.000Z",
    };

    const trackRecord = buildListingAgentTrackRecord({
      agent,
      marketContext: marketContextFixture(),
    });

    expect(trackRecord.status).toBe("narrowed");
    expect(trackRecord.benchmarkArea).toMatchObject({
      geoKind: "neighborhood",
      geoKey: "South Beach",
      windowDays: 90,
    });
    expect(trackRecord.acquisition.availableMetrics).toEqual(
      expect.arrayContaining([
        "days_on_market",
        "ask_to_sale_ratio",
        "price_cut_frequency",
      ]),
    );
    expect(trackRecord.acquisition.unavailableMetrics).toEqual(
      expect.arrayContaining(["price_cut_severity", "relist_rate"]),
    );
    expect(trackRecord.buyerSafeSummary).toContain("longer to sell");
    expect(trackRecord.buyerSafeSummary).toContain("larger ask-to-sale discounts");
    expect(trackRecord.buyerSafeSummary).toContain("price cuts more often");
    expect(trackRecord.confidence).toBeGreaterThan(0.6);
  });

  it("stays buyer-safe when the agent history sample is too small", () => {
    const agent: ListingAgentProfile = {
      canonicalAgentId: "agent-2",
      name: "Sparse Sample",
      soldCount: 3,
      avgDaysOnMarket: 33,
      medianListToSellRatio: 0.976,
      provenance: {
        avgDaysOnMarket: {
          source: "zillow://agent/2",
          fetchedAt: "2026-04-13T18:05:00.000Z",
        },
        medianListToSellRatio: {
          source: "zillow://agent/2",
          fetchedAt: "2026-04-13T18:05:00.000Z",
        },
      },
      lastRefreshedAt: "2026-04-13T18:05:00.000Z",
    };

    const trackRecord = buildListingAgentTrackRecord({
      agent,
      marketContext: marketContextFixture(),
    });

    expect(trackRecord.status).toBe("insufficient_data");
    expect(trackRecord.confidenceLabel).toBe("low");
    expect(trackRecord.buyerSafeSummary).toContain("not enough verified listing-agent history");
    expect(trackRecord.acquisition.notes[0]).toContain("Only 3 sold listings");
  });
});
