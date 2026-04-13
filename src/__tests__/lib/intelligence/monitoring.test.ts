import { describe, expect, it } from "vitest";
import {
  buildAggregatedComparableMap,
  buildBrowserUseComparableMap,
  buildDeterministicComparableMap,
  buildDossierCompletenessScore,
  calculateConflictRate,
  evaluateThresholds,
} from "@/lib/intelligence/monitoring";

describe("buildDossierCompletenessScore", () => {
  it("scores a richly populated dossier near complete and keeps review flags clear", () => {
    const score = buildDossierCompletenessScore({
      property: {
        canonicalId: "zillow:123",
        address: {
          street: "123 Palm Ave",
          city: "Miami",
          state: "FL",
          zip: "33139",
          formatted: "123 Palm Ave, Miami, FL 33139",
        },
        status: "active",
        listPrice: 950000,
        listDate: "2026-04-01T00:00:00.000Z",
        sourcePlatform: "zillow",
        zillowId: "123",
        propertyType: "Single Family",
        beds: 4,
        bathsFull: 3,
        sqftLiving: 2400,
        lotSize: 6000,
        yearBuilt: 2018,
        garageSpaces: 2,
        folioNumber: "01-2345",
        hoaFee: 450,
        taxAnnual: 8500,
        taxAssessedValue: 740000,
        floodZone: "AE",
        hurricaneZone: "HVHZ",
        roofYear: 2021,
        impactWindows: true,
        stormShutters: false,
        waterfrontType: "canal",
        schoolDistrict: "Miami-Dade",
        elementarySchool: "Sunset",
        middleSchool: "Palmetto",
        highSchool: "Coral Reef",
        subdivision: "Palm Estates",
        coordinates: { lat: 25.7617, lng: -80.1918 },
        description: "Renovated home",
        photoCount: 24,
        virtualTourUrl: "https://example.com/tour",
        daysOnMarket: 6,
        listingAgentName: "Jamie Agent",
        listingBrokerage: "Kind Realty",
      },
      support: {
        portalEstimateCount: 3,
        recentSalesCount: 12,
        neighborhoodContextCount: 2,
        hasListingAgentProfile: true,
        hasCrossPortalMatch: true,
        hasCountyRecord: true,
        hasFloodSnapshot: true,
        hasCensusGeocode: true,
        browserUseFieldCount: 8,
      },
    });

    expect(score.overallScore).toBeGreaterThan(0.9);
    expect(score.sectionsNeedingReview).toHaveLength(0);
    expect(
      score.sections.find((section) => section.key === "market_intelligence")?.score,
    ).toBe(1);
  });

  it("flags sparse market intelligence and missing core fields for review", () => {
    const score = buildDossierCompletenessScore({
      property: {
        canonicalId: "redfin:456",
        address: {
          street: "99 Drift Ct",
          city: "Tampa",
          state: "FL",
          zip: "33602",
        },
        status: "active",
        sourcePlatform: "redfin",
        beds: 3,
      },
      support: {
        portalEstimateCount: 0,
        recentSalesCount: 0,
        neighborhoodContextCount: 0,
        hasListingAgentProfile: false,
        hasCrossPortalMatch: false,
        hasCountyRecord: false,
        hasFloodSnapshot: false,
        hasCensusGeocode: false,
        browserUseFieldCount: 0,
      },
    });

    expect(score.overallScore).toBeLessThan(0.45);
    expect(score.sectionsNeedingReview).toContain("core_listing");
    expect(score.sectionsNeedingReview).toContain("market_intelligence");
    expect(
      score.sections.find((section) => section.key === "market_intelligence")
        ?.criticalMissingFields,
    ).toContain("Portal estimates");
  });
});

describe("calculateConflictRate", () => {
  it("counts overlapping comparable fields and computes pairwise conflict rate", () => {
    const deterministic = buildDeterministicComparableMap({
      listPrice: 900000,
      beds: 4,
      bathsFull: 3,
      sqftLiving: 2400,
      yearBuilt: 2018,
      floodZone: "AE",
      zillowId: "111",
      zestimate: 910000,
    });
    const browserUse = buildBrowserUseComparableMap({
      listPrice: 905000,
      beds: 4,
      baths: 3,
      sqft: 2400,
      yearBuilt: 2019,
      floodZone: "AE",
      zillowId: "111",
      zestimate: 890000,
    });
    const aggregated = buildAggregatedComparableMap({
      countySnapshot: { yearBuilt: 2018, assessedValue: 730000 },
      floodSnapshot: { zone: "VE" },
      crossPortalSnapshot: { zillowId: "111" },
      latestPortalEstimates: { zillow: 910000 },
    });

    const deterministicVsBrowserUse = calculateConflictRate({
      comparison: "deterministic_vs_browser_use",
      label: "Deterministic vs Browser Use",
      left: deterministic,
      right: browserUse,
    });
    const deterministicVsAggregated = calculateConflictRate({
      comparison: "deterministic_vs_aggregated",
      label: "Deterministic vs Aggregated",
      left: deterministic,
      right: aggregated,
    });

    expect(deterministicVsBrowserUse.comparableFields).toBe(8);
    expect(deterministicVsBrowserUse.conflictingFields).toBe(3);
    expect(deterministicVsBrowserUse.conflictRate).toBeCloseTo(0.375, 5);
    expect(deterministicVsBrowserUse.sampleFields).toEqual(
      expect.arrayContaining(["listPrice", "yearBuilt", "zestimate"]),
    );

    expect(deterministicVsAggregated.comparableFields).toBe(4);
    expect(deterministicVsAggregated.conflictingFields).toBe(1);
    expect(deterministicVsAggregated.sampleFields).toEqual(["floodZone"]);
  });
});

describe("evaluateThresholds", () => {
  it("marks warn and alert statuses when monitoring values cross thresholds", () => {
    const evaluations = evaluateThresholds({
      "dossier.overall_completeness": 0.78,
      "dossier.market_intelligence_completeness": 0.55,
      "extraction.deterministic_failure_rate": 0.11,
      "drift.parser_schema_rate": 0.12,
      "conflicts.cross_source_rate": 0.04,
      "freshness.stale_or_missing_rate": 0.22,
    });

    expect(
      evaluations.find((item) => item.key === "dossier.overall_completeness")?.status,
    ).toBe("warn");
    expect(
      evaluations.find(
        (item) => item.key === "dossier.market_intelligence_completeness",
      )?.status,
    ).toBe("alert");
    expect(
      evaluations.find(
        (item) => item.key === "extraction.deterministic_failure_rate",
      )?.status,
    ).toBe("warn");
    expect(
      evaluations.find((item) => item.key === "drift.parser_schema_rate")?.status,
    ).toBe("alert");
    expect(
      evaluations.find((item) => item.key === "conflicts.cross_source_rate")?.status,
    ).toBe("ok");
    expect(
      evaluations.find(
        (item) => item.key === "freshness.stale_or_missing_rate",
      )?.status,
    ).toBe("warn");
  });
});
