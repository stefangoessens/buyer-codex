import fs from "node:fs";
import path from "node:path";

export type ParserPortal = "zillow" | "redfin" | "realtor";

interface ParserFixtureSignals {
  jsonLd: boolean;
  apollo: boolean;
  redux: boolean;
  nextData: boolean;
  htmlFallback: boolean;
}

interface ParserFixtureCanonical {
  addressLine1?: string;
  addressFormatted?: string;
  city: string;
  state: string;
  postalCode: string;
  priceUsd: number;
  beds: number;
  baths: number;
  bathsFull?: number;
  bathsHalf?: number;
  livingAreaSqft: number;
  yearBuilt: number;
  propertyType: string;
  propertyTypeDisplay?: string;
  daysOnMarket?: number;
  hoaMonthlyUsd?: number;
  lotSizeSqft?: number;
}

interface ParserFixtureWebParser {
  primaryStrategy?: string;
}

export interface ParserFixtureCase {
  fixture: string;
  sourceUrl: string;
  signals: ParserFixtureSignals;
  canonical: ParserFixtureCanonical;
  webParser?: ParserFixtureWebParser;
}

interface ParserFixtureManifest {
  version: number;
  portals: Record<ParserPortal, ParserFixtureCase[]>;
}

const manifestPath = path.resolve(
  process.cwd(),
  "python-workers/fixtures/parser_cases.json",
);

function loadManifest(): ParserFixtureManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ParserFixtureManifest;
}

export function loadParserFixtureCases(portal: ParserPortal): ParserFixtureCase[] {
  return loadManifest().portals[portal];
}

export function readParserFixture(portal: ParserPortal, fixture: string): string {
  const fixturePath = path.resolve(
    process.cwd(),
    "python-workers/fixtures/html",
    portal,
    fixture,
  );
  return fs.readFileSync(fixturePath, "utf8");
}
