import { describe, expect, it } from "vitest";
import {
  buildPropertyMarketContext,
  computeNeighborhoodContext,
  computeSalesVelocity,
  computeTrajectory,
  median,
} from "@/lib/enrichment/neighborhoodStats";
import type { NeighborhoodSale } from "@/lib/enrichment/types";

function sample(
  overrides: Partial<NeighborhoodSale> & {
    soldDate: string;
    soldPrice: number;
  },
): NeighborhoodSale {
  return {
    listPrice: overrides.soldPrice,
    sqft: 2000,
    dom: 30,
    status: "sold",
    ...overrides,
  };
}

describe("enrichment/neighborhoodStats", () => {
  describe("median", () => {
    it("returns the middle value for odd-length arrays", () => {
      expect(median([3, 1, 2])).toBe(2);
    });

    it("returns the mean of the two middle values for even length", () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });

    it("returns null for empty arrays", () => {
      expect(median([])).toBeNull();
    });
  });

  describe("computeTrajectory", () => {
    it("returns rising/falling/flat deterministically", () => {
      expect(
        computeTrajectory([
          sample({ soldDate: "2026-01-01", soldPrice: 500_000 }),
          sample({ soldDate: "2026-01-15", soldPrice: 520_000 }),
          sample({ soldDate: "2026-03-01", soldPrice: 600_000 }),
          sample({ soldDate: "2026-03-15", soldPrice: 620_000 }),
        ]),
      ).toBe("rising");

      expect(
        computeTrajectory([
          sample({ soldDate: "2026-01-01", soldPrice: 600_000 }),
          sample({ soldDate: "2026-01-15", soldPrice: 620_000 }),
          sample({ soldDate: "2026-03-01", soldPrice: 500_000 }),
          sample({ soldDate: "2026-03-15", soldPrice: 520_000 }),
        ]),
      ).toBe("falling");

      expect(
        computeTrajectory([
          sample({ soldDate: "2026-01-01", soldPrice: 500_000 }),
          sample({ soldDate: "2026-01-15", soldPrice: 510_000 }),
          sample({ soldDate: "2026-03-01", soldPrice: 505_000 }),
          sample({ soldDate: "2026-03-15", soldPrice: 507_000 }),
        ]),
      ).toBe("flat");
    });
  });

  describe("computeSalesVelocity", () => {
    it("divides sold count by window days and ignores non-sold rows", () => {
      const sales: NeighborhoodSale[] = [
        sample({ soldDate: "2026-03-01", soldPrice: 500_000, status: "sold" }),
        sample({ soldDate: "2026-03-15", soldPrice: 550_000, status: "pending" }),
        sample({ soldDate: "2026-04-01", soldPrice: 600_000, status: "sold" }),
      ];

      expect(computeSalesVelocity(sales, 20)).toBe(0.1);
      expect(computeSalesVelocity([], 30)).toBe(0);
    });
  });

  describe("computeNeighborhoodContext", () => {
    it("computes dense-data market baselines with sample-size metadata", () => {
      const sales: NeighborhoodSale[] = [
        sample({
          soldDate: "2026-03-01",
          soldPrice: 500_000,
          sqft: 2_000,
          dom: 20,
          listPrice: 510_000,
          reductionCount: 1,
          totalReductionPct: 2,
        }),
        sample({
          soldDate: "2026-03-15",
          soldPrice: 620_000,
          sqft: 2_500,
          dom: 35,
          listPrice: 630_000,
          reductionCount: 0,
          totalReductionPct: 0,
        }),
        sample({
          soldDate: "2026-04-01",
          soldPrice: 480_000,
          sqft: 1_800,
          dom: 42,
          listPrice: 500_000,
          reductionCount: 2,
          totalReductionPct: 3,
        }),
        sample({
          soldDate: "2026-04-05",
          soldPrice: 600_000,
          sqft: 2_400,
          dom: 28,
          listPrice: 610_000,
          reductionCount: 0,
          totalReductionPct: 0,
        }),
        sample({
          soldDate: "2026-04-08",
          soldPrice: 550_000,
          status: "pending",
          reductionCount: 1,
          totalReductionPct: 4,
        }),
        sample({
          soldDate: "2026-04-10",
          soldPrice: 700_000,
          status: "active",
          listPrice: 710_000,
          reductionCount: 0,
          totalReductionPct: 0,
        }),
      ];

      const ctx = computeNeighborhoodContext({
        geoKey: "Ocean House",
        geoKind: "subdivision",
        windowDays: 30,
        sales,
        fetchedAt: "2026-04-12T12:00:00Z",
        sourceLabel: "bright-data",
      });

      expect(ctx).toMatchObject({
        geoKey: "Ocean House",
        geoKind: "subdivision",
        windowDays: 30,
        medianDom: 31.5,
        medianPricePerSqft: 250,
        avgSaleToListRatio: 0.977,
        medianSaleToListRatio: 0.982,
        priceReductionFrequency: 0.5,
        avgReductionPct: 3,
        medianReductionPct: 3,
        inventoryCount: 1,
        pendingCount: 1,
        salesVelocity: 0.1333,
        provenance: { source: "bright-data", fetchedAt: "2026-04-12T12:00:00Z" },
        sampleSize: {
          total: 6,
          sold: 4,
          active: 1,
          pending: 1,
          pricePerSqft: 4,
          dom: 4,
          saleToList: 4,
          reduction: 6,
        },
      });
      expect(ctx.avgPricePerSqft).toBeCloseTo(253.6667, 4);
      expect(ctx.lastRefreshedAt).toBe("2026-04-12T12:00:00Z");
    });

    it("handles sparse-data baselines and degrades explicitly to broader geographies", () => {
      const subject = {
        propertyId: "prop-1",
        subdivision: "Rare Isle",
        schoolDistrict: "Small District",
        zip: "33301",
        broaderArea: "Fort Lauderdale",
      };
      const generatedAt = "2026-04-12T12:00:00Z";
      const baselines = [
        computeNeighborhoodContext({
          geoKey: "Rare Isle",
          geoKind: "subdivision",
          windowDays: 30,
          sales: [sample({ soldDate: "2026-04-01", soldPrice: 500_000 })],
          fetchedAt: generatedAt,
          sourceLabel: "bright-data://subdivision",
        }),
        computeNeighborhoodContext({
          geoKey: "Small District",
          geoKind: "school_zone",
          windowDays: 30,
          sales: [
            sample({ soldDate: "2026-04-01", soldPrice: 500_000 }),
            sample({ soldDate: "2026-04-05", soldPrice: 510_000 }),
          ],
          fetchedAt: generatedAt,
          sourceLabel: "bright-data://school",
        }),
        computeNeighborhoodContext({
          geoKey: "33301",
          geoKind: "zip",
          windowDays: 30,
          sales: [
            sample({ soldDate: "2026-04-01", soldPrice: 500_000 }),
            sample({ soldDate: "2026-04-02", soldPrice: 505_000 }),
            sample({ soldDate: "2026-04-03", soldPrice: 510_000 }),
            sample({ soldDate: "2026-04-04", soldPrice: 515_000 }),
          ],
          fetchedAt: generatedAt,
          sourceLabel: "bright-data://zip",
        }),
      ];

      const snapshot = buildPropertyMarketContext({
        baselines,
        subject,
        generatedAt,
        windowDays: [30],
      });

      expect(snapshot.baselines).toHaveLength(3);
      expect(snapshot.windows).toHaveLength(1);
      expect(snapshot.windows[0]).toMatchObject({
        windowDays: 30,
        selectedGeoKind: "zip",
        selectedGeoKey: "33301",
      });
      expect(snapshot.windows[0].selectedContext?.sampleSize.sold).toBe(4);
      expect(snapshot.windows[0].confidence).toBeGreaterThan(0.5);
      expect(snapshot.windows[0].downgradeReasons.map((reason) => reason.code)).toEqual([
        "missing_geo_key",
        "insufficient_sold_sample",
        "missing_geo_key",
        "insufficient_sold_sample",
      ]);
    });
  });
});
