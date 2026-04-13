import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  calculateMortgagePayment,
  computeOwnershipCosts,
  estimateFlInsurance,
  estimateFloodInsurance,
} from "@/lib/ai/engines/cost";

function readFixture<T>(relativePath: string): T {
  const fixturePath = path.resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(fixturePath, "utf8")) as T;
}

const zillowFixture = readFixture<{
  address: { state: string; county?: string };
  listPrice: number;
  yearBuilt: number;
  roofYear?: number;
  impactWindows?: boolean;
  stormShutters?: boolean;
  constructionType?: string;
  floodZone?: string;
  waterfrontType?: string;
  hoaFee?: number;
  hoaFrequency?: string;
  taxAnnual?: number;
}>("src/test/fixtures/zillow-listing.json");

const redfinFixture = readFixture<{
  address: { state: string; county?: string };
  listPrice: number;
  yearBuilt: number;
  roofYear?: number;
  impactWindows?: boolean;
  stormShutters?: boolean;
  constructionType?: string;
  floodZone?: string;
  waterfrontType?: string;
  hoaFee?: number;
  hoaFrequency?: string;
  taxAnnual?: number;
}>("src/test/fixtures/redfin-listing.json");

describe("calculateMortgagePayment", () => {
  it("computes standard 30yr payment", () => {
    const payment = calculateMortgagePayment(400000, 0.065);
    expect(payment).toBeGreaterThan(2500);
    expect(payment).toBeLessThan(2600);
  });

  it("returns 0 for zero principal", () => {
    expect(calculateMortgagePayment(0, 0.065)).toBe(0);
  });
});

describe("estimateFlInsurance", () => {
  it("increases with roof age", () => {
    const newRoof = estimateFlInsurance(500000, 2023);
    const oldRoof = estimateFlInsurance(500000, 2000);
    expect(oldRoof.mid).toBeGreaterThan(newRoof.mid);
  });

  it("discounts for wind mitigation", () => {
    const without = estimateFlInsurance(500000, 2015);
    const withWindows = estimateFlInsurance(500000, 2015, undefined, true);
    expect(withWindows.mid).toBeLessThan(without.mid);
  });

  it("increases for properties close to the coast", () => {
    const inland = estimateFlInsurance(500000, 2015, undefined, true, false, "CBS", 20);
    const coastal = estimateFlInsurance(500000, 2015, undefined, true, false, "CBS", 0.5);
    expect(coastal.mid).toBeGreaterThan(inland.mid);
  });
});

describe("estimateFloodInsurance", () => {
  it("returns high for VE zone", () => {
    expect(estimateFloodInsurance("VE").mid).toBeGreaterThanOrEqual(5000);
  });

  it("uses elevation to reduce AE-zone premium", () => {
    const lowElevation = estimateFloodInsurance("AE", 4);
    const highElevation = estimateFloodInsurance("AE", 18);
    expect(lowElevation.mid).toBeGreaterThan(highElevation.mid);
  });

  it("returns zero for no zone", () => {
    expect(estimateFloodInsurance(undefined).mid).toBe(0);
  });
});

describe("computeOwnershipCosts", () => {
  it("produces deterministic ranges for the Zillow fixture scenario", () => {
    const result = computeOwnershipCosts({
      purchasePrice: zillowFixture.listPrice,
      state: zillowFixture.address.state,
      county: zillowFixture.address.county,
      taxAnnual: zillowFixture.taxAnnual,
      hoaFee: zillowFixture.hoaFee,
      hoaFrequency: zillowFixture.hoaFrequency,
      roofYear: zillowFixture.roofYear,
      yearBuilt: zillowFixture.yearBuilt,
      impactWindows: zillowFixture.impactWindows,
      stormShutters: zillowFixture.stormShutters,
      constructionType: zillowFixture.constructionType,
      floodZone: zillowFixture.floodZone,
      waterfrontType: zillowFixture.waterfrontType,
    });

    expect(result.totalMonthlyLow).toBe(7364);
    expect(result.totalMonthlyMid).toBe(8041);
    expect(result.totalMonthlyHigh).toBe(8851);
    expect(result.annualRange.mid).toBe(result.totalAnnual);
    expect(result.annualRange).toEqual({ low: 88351, mid: 96490, high: 106199 });
    expect(result.upfrontCosts.totalRange).toEqual({
      low: 197313,
      mid: 201250,
      high: 205187,
    });

    const insurance = result.lineItems.find((item) => item.category === "insurance");
    const flood = result.lineItems.find((item) => item.category === "flood");

    expect(insurance?.notes).toContain("not a quote");
    expect(insurance?.annualMid).toBe(9446);
    expect(insurance?.basis?.coastDistanceMiles).toBe(0.5);
    expect(flood?.basis?.floodZone).toBe("AE");
    expect(flood?.annualMid).toBe(2500);
  });

  it("produces deterministic ranges for the Redfin coastal fixture scenario", () => {
    const result = computeOwnershipCosts({
      purchasePrice: redfinFixture.listPrice,
      state: redfinFixture.address.state,
      county: redfinFixture.address.county,
      taxAnnual: redfinFixture.taxAnnual,
      hoaFee: redfinFixture.hoaFee,
      hoaFrequency: redfinFixture.hoaFrequency,
      roofYear: redfinFixture.roofYear,
      yearBuilt: redfinFixture.yearBuilt,
      impactWindows: redfinFixture.impactWindows,
      stormShutters: redfinFixture.stormShutters,
      constructionType: redfinFixture.constructionType,
      floodZone: redfinFixture.floodZone,
      waterfrontType: redfinFixture.waterfrontType,
      elevationFeet: 7,
    });

    const insurance = result.lineItems.find((item) => item.category === "insurance");
    const flood = result.lineItems.find((item) => item.category === "flood");

    expect(result.totalMonthlyLow).toBe(13157);
    expect(result.totalMonthlyMid).toBe(14625);
    expect(result.totalMonthlyHigh).toBe(16528);
    expect(result.annualRange).toEqual({ low: 157884, mid: 175496, high: 198320 });
    expect(insurance?.annualMid).toBe(32612);
    expect(flood?.annualMid).toBe(6500);
    expect(flood?.notes).toContain("estimate, not a quote");
  });

  it("includes PMI for low down payment", () => {
    const result = computeOwnershipCosts({
      purchasePrice: 500000,
      yearBuilt: 2020,
      assumptions: { downPaymentPct: 0.05 },
    });
    const pmi = result.lineItems.find((item) => item.category === "pmi");
    expect(pmi).toBeDefined();
    expect(pmi?.source).toBe("estimate");
  });

  it("applies Florida homestead logic for owner-occupied estimates", () => {
    const ownerOccupied = computeOwnershipCosts({
      purchasePrice: 500000,
      state: "FL",
      county: "Broward",
      yearBuilt: 2020,
      taxAssessedValue: 450000,
      ownerOccupied: true,
    });
    const investor = computeOwnershipCosts({
      purchasePrice: 500000,
      state: "FL",
      county: "Broward",
      yearBuilt: 2020,
      taxAssessedValue: 450000,
      ownerOccupied: false,
    });

    const ownerTax = ownerOccupied.lineItems.find((item) => item.category === "tax");
    const investorTax = investor.lineItems.find((item) => item.category === "tax");

    expect(ownerTax?.annualMid).toBeLessThan(investorTax?.annualMid ?? 0);
    expect(ownerTax?.label).toContain("homestead");
    expect(ownerTax?.basis?.homesteadApplied).toBe(true);
  });

  it("separates facts, assumptions, and estimates", () => {
    const result = computeOwnershipCosts({
      purchasePrice: 500000,
      state: "FL",
      yearBuilt: 2020,
      taxAnnual: 8000,
      hoaFee: 400,
      floodZone: "AE",
    });
    const facts = result.lineItems.filter((item) => item.source === "fact");
    const assumptions = result.lineItems.filter(
      (item) => item.source === "assumption",
    );
    const estimates = result.lineItems.filter((item) => item.source === "estimate");

    expect(facts.length).toBeGreaterThanOrEqual(2);
    expect(assumptions.length).toBeGreaterThanOrEqual(2);
    expect(estimates.length).toBeGreaterThanOrEqual(2);
  });
});
