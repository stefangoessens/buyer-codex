import { describe, expect, it } from "vitest";

import { extractRedfinListingHtml } from "@/lib/intake";
import {
  loadParserFixtureCases,
  readParserFixture,
} from "@/test/parser-fixtures";

const CONTRACT_CASES = loadParserFixtureCases("redfin");
const CONDO_CASE = CONTRACT_CASES.find(
  (fixtureCase) => fixtureCase.fixture === "redfin_condo_miami_beach.html",
);
const HTML_ONLY_CASE = CONTRACT_CASES.find(
  (fixtureCase) => fixtureCase.fixture === "redfin_townhome_delray.html",
);
const REDUX_CASE = CONTRACT_CASES.find(
  (fixtureCase) => fixtureCase.fixture === "redfin_sfh_cutler_bay.html",
);

function loadFixture(name: string): string {
  return readParserFixture("redfin", name);
}

describe("extractRedfinListingHtml", () => {
  it("extracts a condo listing from JSON-LD first", () => {
    const result = extractRedfinListingHtml({
      html: loadFixture(CONDO_CASE!.fixture),
      sourceUrl: CONDO_CASE!.sourceUrl,
      fetchedAt: "2026-04-12T12:00:00Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.reviewState).toBe("partial");
    expect(result.payload.data.address.formatted).toBe(
      CONDO_CASE!.canonical.addressFormatted,
    );
    expect(result.payload.data.coordinates).toEqual({
      lat: 25.783,
      lng: -80.13,
    });
    expect(result.payload.data.listPrice).toBe(CONDO_CASE!.canonical.priceUsd);
    expect(result.payload.data.propertyType).toBe(
      CONDO_CASE!.canonical.propertyTypeDisplay,
    );
    expect(result.payload.data.beds).toBe(CONDO_CASE!.canonical.beds);
    expect(result.payload.data.bathsFull).toBe(CONDO_CASE!.canonical.bathsFull);
    expect(result.payload.data.bathsHalf).toBe(CONDO_CASE!.canonical.bathsHalf);
    expect(result.payload.data.sqftLiving).toBe(
      CONDO_CASE!.canonical.livingAreaSqft,
    );
    expect(result.payload.data.hoaFee).toBe(675);
    expect(result.payload.data.daysOnMarket).toBe(9);
    expect(result.payload.data.mlsNumber).toBe("A11500001");
    expect(result.payload.data.photoCount).toBe(4);
    expect(result.payload.source.strategiesUsed).toContain("json-ld");
    expect(result.payload.source.fieldStrategies.listPrice).toBe("json-ld");
  });

  it("extracts a single-family listing from Redux state", () => {
    const result = extractRedfinListingHtml({
      html: loadFixture(REDUX_CASE!.fixture),
      sourceUrl: REDUX_CASE!.sourceUrl,
      fetchedAt: "2026-04-12T12:00:00Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.reviewState).toBe("complete");
    expect(result.payload.data.redfinId).toBe("20000005");
    expect(result.payload.data.address.formatted).toBe(
      "19850 Old Cutler Rd, Cutler Bay, FL 33189",
    );
    expect(result.payload.data.listPrice).toBe(REDUX_CASE!.canonical.priceUsd);
    expect(result.payload.data.propertyType).toBe(
      REDUX_CASE!.canonical.propertyTypeDisplay,
    );
    expect(result.payload.data.beds).toBe(REDUX_CASE!.canonical.beds);
    expect(result.payload.data.bathsFull).toBe(REDUX_CASE!.canonical.bathsFull);
    expect(result.payload.data.bathsHalf).toBe(REDUX_CASE!.canonical.bathsHalf);
    expect(result.payload.data.sqftLiving).toBe(
      REDUX_CASE!.canonical.livingAreaSqft,
    );
    expect(result.payload.data.lotSize).toBe(8712);
    expect(result.payload.data.yearBuilt).toBe(2000);
    expect(result.payload.data.daysOnMarket).toBe(34);
    expect(result.payload.data.mlsNumber).toBe("A11777005");
    expect(result.payload.source.strategiesUsed).toContain("redux-state");
    expect(result.payload.source.fieldStrategies.lotSize).toBe("redux-state");
  });

  it("falls back to HTML-only markup for townhouse variants", () => {
    const result = extractRedfinListingHtml({
      html: loadFixture(HTML_ONLY_CASE!.fixture),
      sourceUrl: HTML_ONLY_CASE!.sourceUrl,
      fetchedAt: "2026-04-12T12:00:00Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.payload.reviewState).toBe("complete");
    expect(result.payload.data.address.formatted).toBe(
      HTML_ONLY_CASE!.canonical.addressFormatted,
    );
    expect(result.payload.data.listPrice).toBe(HTML_ONLY_CASE!.canonical.priceUsd);
    expect(result.payload.data.propertyType).toBe(
      HTML_ONLY_CASE!.canonical.propertyTypeDisplay,
    );
    expect(result.payload.data.beds).toBe(HTML_ONLY_CASE!.canonical.beds);
    expect(result.payload.data.bathsFull).toBe(
      HTML_ONLY_CASE!.canonical.bathsFull,
    );
    expect(result.payload.data.bathsHalf).toBe(
      HTML_ONLY_CASE!.canonical.bathsHalf,
    );
    expect(result.payload.data.sqftLiving).toBe(
      HTML_ONLY_CASE!.canonical.livingAreaSqft,
    );
    expect(result.payload.data.yearBuilt).toBe(
      HTML_ONLY_CASE!.canonical.yearBuilt,
    );
    expect(result.payload.data.hoaFee).toBe(320);
    expect(result.payload.data.hoaFrequency).toBe("monthly");
    expect(result.payload.data.daysOnMarket).toBe(15);
    expect(result.payload.data.photoCount).toBe(3);
    expect(result.payload.source.strategiesUsed).toContain("html-text");
    expect(result.payload.source.fieldStrategies.description).toBe("html-text");
  });

  it("returns a typed parser error when required fields are missing", () => {
    const result = extractRedfinListingHtml({
      html: "<html><body><main><h1>Nothing useful here</h1></main></body></html>",
      sourceUrl:
        "https://www.redfin.com/FL/Miami/999-Mystery-Rd-33101/home/44556677",
      fetchedAt: "2026-04-12T12:00:00Z",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe("missing_required_fields");
    expect(result.error.listingId).toBe("44556677");
    expect(result.error.missingFields).toEqual(
      expect.arrayContaining(["address", "listPrice"]),
    );
    expect(result.error.attemptedStrategies).toContain("html-text");
  });

  it("rejects non-Redfin URLs before attempting extraction", () => {
    const result = extractRedfinListingHtml({
      html: loadFixture("redfin_condo_miami_beach.html"),
      sourceUrl:
        "https://www.zillow.com/homedetails/100-Las-Olas-Blvd-Fort-Lauderdale-FL-33301/12345678_zpid/",
      fetchedAt: "2026-04-12T12:00:00Z",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.code).toBe("unsupported_platform");
    expect(result.error.attemptedStrategies).toEqual([]);
  });
});
