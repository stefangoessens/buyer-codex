import {
  SOURCE_CACHE_TTL_HOURS,
  type EnrichmentSource,
} from "@/lib/enrichment/types";

export const DOSSIER_SECTION_ORDER = [
  "core_listing",
  "physical_profile",
  "ownership_costs",
  "risk_resilience",
  "location_schools",
  "media_listing",
  "market_intelligence",
] as const;

export type DossierSectionKey = (typeof DOSSIER_SECTION_ORDER)[number];

export interface DossierSupportSignals {
  portalEstimateCount: number;
  recentSalesCount: number;
  neighborhoodContextCount: number;
  hasListingAgentProfile: boolean;
  hasCrossPortalMatch: boolean;
  hasCountyRecord: boolean;
  hasFloodSnapshot: boolean;
  hasCensusGeocode: boolean;
  browserUseFieldCount: number;
}

export interface DossierSectionScore {
  key: DossierSectionKey;
  label: string;
  score: number;
  filledFields: number;
  totalFields: number;
  missingFields: string[];
  criticalMissingFields: string[];
}

export interface DossierCompletenessScore {
  overallScore: number;
  filledFields: number;
  totalFields: number;
  sections: DossierSectionScore[];
  sectionsNeedingReview: DossierSectionKey[];
}

interface DossierRule {
  key: string;
  label: string;
  critical?: boolean;
  present: (args: {
    property: Record<string, unknown>;
    support: DossierSupportSignals;
  }) => boolean;
}

interface DossierSectionDefinition {
  key: DossierSectionKey;
  label: string;
  rules: readonly DossierRule[];
}

export const DOSSIER_REVIEW_THRESHOLD = 0.7;
export const DOSSIER_ALERT_THRESHOLD = 0.5;

const DOSSIER_SECTIONS: readonly DossierSectionDefinition[] = [
  {
    key: "core_listing",
    label: "Core listing",
    rules: [
      rule("canonicalId", "Canonical property id", true, ({ property }) =>
        hasValue(readPath(property, "canonicalId")),
      ),
      rule("address", "Address", true, ({ property }) => {
        const formatted = readPath(property, "address.formatted");
        if (hasValue(formatted)) return true;
        return ["address.street", "address.city", "address.state", "address.zip"].every(
          (path) => hasValue(readPath(property, path)),
        );
      }),
      rule("status", "Listing status", true, ({ property }) =>
        hasValue(readPath(property, "status")),
      ),
      rule("listPrice", "List price", true, ({ property }) =>
        hasValue(readPath(property, "listPrice")),
      ),
      rule("listDate", "List date", ({ property }) =>
        hasValue(readPath(property, "listDate")),
      ),
      rule("sourcePlatform", "Source platform", true, ({ property }) =>
        hasValue(readPath(property, "sourcePlatform")),
      ),
      rule("portalId", "Portal listing id", ({ property }) =>
        hasAnyValue(property, ["zillowId", "redfinId", "realtorId", "mlsNumber"]),
      ),
    ],
  },
  {
    key: "physical_profile",
    label: "Physical profile",
    rules: [
      rule("propertyType", "Property type", true, ({ property }) =>
        hasValue(readPath(property, "propertyType")),
      ),
      rule("beds", "Bedrooms", true, ({ property }) =>
        hasValue(readPath(property, "beds")),
      ),
      rule("baths", "Bathrooms", true, ({ property }) =>
        hasAnyValue(property, ["bathsFull", "bathsHalf", "baths"]),
      ),
      rule("sqftLiving", "Living area", true, ({ property }) =>
        hasAnyValue(property, ["sqftLiving", "sqft"]),
      ),
      rule("lotSize", "Lot size", ({ property }) =>
        hasValue(readPath(property, "lotSize")),
      ),
      rule("yearBuilt", "Year built", ({ property }) =>
        hasValue(readPath(property, "yearBuilt")),
      ),
      rule("garageSpaces", "Garage spaces", ({ property }) =>
        hasValue(readPath(property, "garageSpaces")),
      ),
    ],
  },
  {
    key: "ownership_costs",
    label: "Ownership & costs",
    rules: [
      rule("folioNumber", "Folio / parcel id", ({ property }) =>
        hasValue(readPath(property, "folioNumber")),
      ),
      rule("hoaFee", "HOA fee", ({ property }) =>
        hasValue(readPath(property, "hoaFee")),
      ),
      rule("taxAnnual", "Annual taxes", ({ property }) =>
        hasValue(readPath(property, "taxAnnual")),
      ),
      rule("taxAssessedValue", "Assessed value", ({ property }) =>
        hasValue(readPath(property, "taxAssessedValue")),
      ),
      rule("countyRecord", "County record", true, ({ support }) => support.hasCountyRecord),
    ],
  },
  {
    key: "risk_resilience",
    label: "Risk & resilience",
    rules: [
      rule("floodZone", "Flood zone", true, ({ property, support }) =>
        hasValue(readPath(property, "floodZone")) || support.hasFloodSnapshot,
      ),
      rule("hurricaneZone", "Hurricane zone", ({ property }) =>
        hasValue(readPath(property, "hurricaneZone")),
      ),
      rule("roofYear", "Roof year", ({ property }) =>
        hasValue(readPath(property, "roofYear")),
      ),
      rule("impactWindows", "Impact windows", ({ property }) =>
        hasValue(readPath(property, "impactWindows")),
      ),
      rule("stormShutters", "Storm shutters", ({ property }) =>
        hasValue(readPath(property, "stormShutters")),
      ),
      rule("waterfrontType", "Waterfront type", ({ property }) =>
        hasValue(readPath(property, "waterfrontType")),
      ),
    ],
  },
  {
    key: "location_schools",
    label: "Location & schools",
    rules: [
      rule("schoolDistrict", "School district", ({ property }) =>
        hasValue(readPath(property, "schoolDistrict")),
      ),
      rule("elementarySchool", "Elementary school", ({ property }) =>
        hasValue(readPath(property, "elementarySchool")),
      ),
      rule("middleSchool", "Middle school", ({ property }) =>
        hasValue(readPath(property, "middleSchool")),
      ),
      rule("highSchool", "High school", ({ property }) =>
        hasValue(readPath(property, "highSchool")),
      ),
      rule("subdivision", "Subdivision / neighborhood", ({ property }) =>
        hasAnyValue(property, ["subdivision", "neighborhood"]),
      ),
      rule("coordinates", "Coordinates", true, ({ property, support }) =>
        hasValue(readPath(property, "coordinates")) || support.hasCensusGeocode,
      ),
    ],
  },
  {
    key: "media_listing",
    label: "Media & listing context",
    rules: [
      rule("description", "Description", ({ property }) =>
        hasValue(readPath(property, "description")),
      ),
      rule("photos", "Photos", true, ({ property }) => {
        const photoCount = readPath(property, "photoCount");
        if (typeof photoCount === "number" && photoCount > 0) return true;
        const photoUrls = readPath(property, "photoUrls");
        return Array.isArray(photoUrls) && photoUrls.length > 0;
      }),
      rule("virtualTourUrl", "Virtual tour", ({ property }) =>
        hasValue(readPath(property, "virtualTourUrl")),
      ),
      rule("daysOnMarket", "Days on market", ({ property }) =>
        hasValue(readPath(property, "daysOnMarket")),
      ),
      rule("listingAgentName", "Listing agent name", ({ property }) =>
        hasValue(readPath(property, "listingAgentName")),
      ),
      rule("listingBrokerage", "Listing brokerage", ({ property }) =>
        hasValue(readPath(property, "listingBrokerage")),
      ),
    ],
  },
  {
    key: "market_intelligence",
    label: "Market intelligence",
    rules: [
      rule("crossPortalMatch", "Cross-portal match", true, ({ support }) =>
        support.hasCrossPortalMatch,
      ),
      rule("portalEstimates", "Portal estimates", true, ({ support }) =>
        support.portalEstimateCount >= 2,
      ),
      rule("recentSales", "Recent comparable sales", true, ({ support }) =>
        support.recentSalesCount > 0,
      ),
      rule("neighborhoodContext", "Neighborhood context", true, ({ support }) =>
        support.neighborhoodContextCount > 0,
      ),
      rule("listingAgentProfile", "Listing-agent profile", ({ support }) =>
        support.hasListingAgentProfile,
      ),
      rule("browserUseEvidence", "Browser Use evidence", ({ support }) =>
        support.browserUseFieldCount > 0,
      ),
    ],
  },
] as const;

export const COMPARABLE_FIELDS = [
  "listPrice",
  "beds",
  "bathsTotal",
  "sqftLiving",
  "yearBuilt",
  "hoaFee",
  "taxAssessedValue",
  "floodZone",
  "coordinates",
  "zillowId",
  "redfinId",
  "realtorId",
  "zestimate",
  "redfinEstimate",
  "realtorEstimate",
] as const;

export type ComparableFieldKey = (typeof COMPARABLE_FIELDS)[number];
export type ComparableSourceMap = Partial<Record<ComparableFieldKey, unknown>>;

export const CONFLICT_COMPARISONS = [
  "deterministic_vs_browser_use",
  "deterministic_vs_aggregated",
  "browser_use_vs_aggregated",
] as const;

export type ConflictComparisonKey = (typeof CONFLICT_COMPARISONS)[number];

export interface ConflictRateSummary {
  comparison: ConflictComparisonKey;
  label: string;
  comparableFields: number;
  conflictingFields: number;
  conflictRate: number;
  sampleFields: string[];
}

export type FreshnessStatus = "fresh" | "stale" | "missing";

export type ThresholdDirection = "higher_is_worse" | "lower_is_worse";
export type ThresholdStatus = "ok" | "warn" | "alert" | "unavailable";

export interface MonitoringThreshold {
  key: string;
  label: string;
  direction: ThresholdDirection;
  warn: number;
  alert: number;
  note: string;
}

export interface ThresholdEvaluation extends MonitoringThreshold {
  value: number | null;
  status: ThresholdStatus;
}

export const MONITORING_THRESHOLDS: readonly MonitoringThreshold[] = [
  {
    key: "dossier.overall_completeness",
    label: "Overall dossier completeness",
    direction: "lower_is_worse",
    warn: 0.8,
    alert: 0.65,
    note: "Review when average dossier coverage drops below 80%.",
  },
  {
    key: "dossier.market_intelligence_completeness",
    label: "Market-intelligence completeness",
    direction: "lower_is_worse",
    warn: 0.75,
    alert: 0.6,
    note: "Market context must stay substantially populated for advisory output.",
  },
  {
    key: "extraction.deterministic_failure_rate",
    label: "Deterministic extraction failure rate",
    direction: "higher_is_worse",
    warn: 0.08,
    alert: 0.15,
    note: "Primary intake should stay clearly healthier than the fallback lane.",
  },
  {
    key: "drift.parser_schema_rate",
    label: "Parser/schema drift rate",
    direction: "higher_is_worse",
    warn: 0.05,
    alert: 0.1,
    note: "Schema drift should remain exceptional, not a normal recovery path.",
  },
  {
    key: "conflicts.cross_source_rate",
    label: "Cross-source conflict rate",
    direction: "higher_is_worse",
    warn: 0.12,
    alert: 0.2,
    note: "High disagreement across deterministic, Browser Use, and baselines needs review.",
  },
  {
    key: "freshness.stale_or_missing_rate",
    label: "Stale or missing source rate",
    direction: "higher_is_worse",
    warn: 0.2,
    alert: 0.35,
    note: "Critical intelligence sources should remain fresh for most dossiers.",
  },
] as const;

export function buildDossierCompletenessScore(args: {
  property: Record<string, unknown>;
  support: DossierSupportSignals;
}): DossierCompletenessScore {
  const sections = DOSSIER_SECTIONS.map((section) => {
    const missingFields: string[] = [];
    const criticalMissingFields: string[] = [];
    let filledFields = 0;

    for (const field of section.rules) {
      if (field.present(args)) {
        filledFields += 1;
        continue;
      }
      missingFields.push(field.label);
      if (field.critical) criticalMissingFields.push(field.label);
    }

    const totalFields = section.rules.length;
    const score = totalFields === 0 ? 1 : filledFields / totalFields;
    return {
      key: section.key,
      label: section.label,
      score,
      filledFields,
      totalFields,
      missingFields,
      criticalMissingFields,
    };
  });

  const filledFields = sections.reduce((sum, section) => sum + section.filledFields, 0);
  const totalFields = sections.reduce((sum, section) => sum + section.totalFields, 0);
  const overallScore = totalFields === 0 ? 1 : filledFields / totalFields;

  return {
    overallScore,
    filledFields,
    totalFields,
    sections,
    sectionsNeedingReview: sections
      .filter(
        (section) =>
          section.score < DOSSIER_REVIEW_THRESHOLD ||
          section.criticalMissingFields.length > 0,
      )
      .map((section) => section.key),
  };
}

export function buildDeterministicComparableMap(
  property: Record<string, unknown>,
): ComparableSourceMap {
  return compactComparableMap({
    listPrice: readPath(property, "listPrice"),
    beds: readPath(property, "beds"),
    bathsTotal: readBathCount(property),
    sqftLiving: pickValue(property, ["sqftLiving", "sqft"]),
    yearBuilt: readPath(property, "yearBuilt"),
    hoaFee: readPath(property, "hoaFee"),
    taxAssessedValue: readPath(property, "taxAssessedValue"),
    floodZone: readPath(property, "floodZone"),
    coordinates: readCoordinates(readPath(property, "coordinates")),
    zillowId: readPath(property, "zillowId"),
    redfinId: readPath(property, "redfinId"),
    realtorId: readPath(property, "realtorId"),
    zestimate: readPath(property, "zestimate"),
    redfinEstimate: readPath(property, "redfinEstimate"),
    realtorEstimate: readPath(property, "realtorEstimate"),
  });
}

export function buildBrowserUseComparableMap(
  canonicalFields: Record<string, unknown> | null | undefined,
): ComparableSourceMap {
  if (!canonicalFields) return {};

  return compactComparableMap({
    listPrice: pickValue(canonicalFields, ["listPrice", "price"]),
    beds: pickValue(canonicalFields, ["beds"]),
    bathsTotal: pickValue(canonicalFields, ["bathsTotal", "baths", "bathrooms"]),
    sqftLiving: pickValue(canonicalFields, ["sqftLiving", "sqft", "livingArea"]),
    yearBuilt: pickValue(canonicalFields, ["yearBuilt"]),
    hoaFee: pickValue(canonicalFields, ["hoaFee"]),
    taxAssessedValue: pickValue(canonicalFields, ["taxAssessedValue", "assessedValue"]),
    floodZone: pickValue(canonicalFields, ["floodZone", "femaZone"]),
    coordinates: readCoordinates(
      pickValue(canonicalFields, ["coordinates", "location", "latLng"]),
    ),
    zillowId: pickValue(canonicalFields, ["zillowId"]),
    redfinId: pickValue(canonicalFields, ["redfinId"]),
    realtorId: pickValue(canonicalFields, ["realtorId"]),
    zestimate: pickValue(canonicalFields, ["zestimate"]),
    redfinEstimate: pickValue(canonicalFields, ["redfinEstimate"]),
    realtorEstimate: pickValue(canonicalFields, ["realtorEstimate"]),
  });
}

export function buildAggregatedComparableMap(args: {
  countySnapshot?: Record<string, unknown> | null;
  floodSnapshot?: Record<string, unknown> | null;
  censusSnapshot?: Record<string, unknown> | null;
  crossPortalSnapshot?: Record<string, unknown> | null;
  latestPortalEstimates?: Partial<Record<"zillow" | "redfin" | "realtor", number>>;
}): ComparableSourceMap {
  return compactComparableMap({
    yearBuilt: args.countySnapshot?.yearBuilt,
    taxAssessedValue: args.countySnapshot?.assessedValue,
    floodZone: args.floodSnapshot?.zone,
    coordinates: readCoordinates({
      lat: args.censusSnapshot?.lat,
      lng: args.censusSnapshot?.lng,
    }),
    zillowId: args.crossPortalSnapshot?.zillowId,
    redfinId: args.crossPortalSnapshot?.redfinId,
    realtorId: args.crossPortalSnapshot?.realtorId,
    zestimate: args.latestPortalEstimates?.zillow,
    redfinEstimate: args.latestPortalEstimates?.redfin,
    realtorEstimate: args.latestPortalEstimates?.realtor,
  });
}

export function calculateConflictRate(args: {
  comparison: ConflictComparisonKey;
  label: string;
  left: ComparableSourceMap;
  right: ComparableSourceMap;
}): ConflictRateSummary {
  let comparableFields = 0;
  let conflictingFields = 0;
  const sampleFields: string[] = [];

  for (const field of COMPARABLE_FIELDS) {
    const left = args.left[field];
    const right = args.right[field];
    if (!hasComparableValue(left) || !hasComparableValue(right)) continue;

    comparableFields += 1;
    if (!valuesConflict(field, left, right)) continue;

    conflictingFields += 1;
    if (sampleFields.length < 5) sampleFields.push(field);
  }

  return {
    comparison: args.comparison,
    label: args.label,
    comparableFields,
    conflictingFields,
    conflictRate:
      comparableFields === 0 ? 0 : conflictingFields / comparableFields,
    sampleFields,
  };
}

export function classifyFreshness(args: {
  source: EnrichmentSource;
  lastUpdatedAt?: string | null;
  now?: Date;
}): FreshnessStatus {
  if (!args.lastUpdatedAt) return "missing";
  const updatedAt = Date.parse(args.lastUpdatedAt);
  if (Number.isNaN(updatedAt)) return "stale";

  const ttlMs = SOURCE_CACHE_TTL_HOURS[args.source] * 60 * 60 * 1000;
  const nowMs = (args.now ?? new Date()).getTime();
  return nowMs - updatedAt > ttlMs ? "stale" : "fresh";
}

export function evaluateThresholds(
  values: Record<string, number | null | undefined>,
): ThresholdEvaluation[] {
  return MONITORING_THRESHOLDS.map((threshold) => {
    const value = values[threshold.key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ...threshold, value: null, status: "unavailable" as const };
    }

    if (threshold.direction === "higher_is_worse") {
      if (value >= threshold.alert) {
        return { ...threshold, value, status: "alert" as const };
      }
      if (value >= threshold.warn) {
        return { ...threshold, value, status: "warn" as const };
      }
      return { ...threshold, value, status: "ok" as const };
    }

    if (value <= threshold.alert) {
      return { ...threshold, value, status: "alert" as const };
    }
    if (value <= threshold.warn) {
      return { ...threshold, value, status: "warn" as const };
    }
    return { ...threshold, value, status: "ok" as const };
  });
}

function rule(
  key: string,
  label: string,
  critical: boolean | DossierRule["present"],
  maybePresent?: DossierRule["present"],
): DossierRule {
  if (typeof critical === "function") {
    return {
      key,
      label,
      critical: false,
      present: critical,
    };
  }

  return {
    key,
    label,
    critical,
    present: maybePresent ?? (() => false),
  };
}

function readPath(record: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = record;

  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function pickValue(
  record: Record<string, unknown>,
  paths: readonly string[],
): unknown {
  for (const path of paths) {
    const value = readPath(record, path);
    if (hasValue(value)) return value;
  }
  return undefined;
}

function hasAnyValue(record: Record<string, unknown>, paths: readonly string[]): boolean {
  return paths.some((path) => hasValue(readPath(record, path)));
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function readBathCount(record: Record<string, unknown>): number | undefined {
  const direct = pickValue(record, ["bathsTotal", "baths", "bathrooms"]);
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  const full = readPath(record, "bathsFull");
  const half = readPath(record, "bathsHalf");
  const fullValue = typeof full === "number" && Number.isFinite(full) ? full : 0;
  const halfValue = typeof half === "number" && Number.isFinite(half) ? half : 0;
  if (fullValue === 0 && halfValue === 0) return undefined;
  return fullValue + halfValue * 0.5;
}

function readCoordinates(
  value: unknown,
): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const lat = (value as Record<string, unknown>).lat;
  const lng = (value as Record<string, unknown>).lng;
  if (typeof lat !== "number" || !Number.isFinite(lat)) return undefined;
  if (typeof lng !== "number" || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

function compactComparableMap(
  map: ComparableSourceMap,
): ComparableSourceMap {
  return Object.fromEntries(
    Object.entries(map).filter(([, value]) => hasComparableValue(value)),
  ) as ComparableSourceMap;
}

function hasComparableValue(value: unknown): boolean {
  if (!hasValue(value)) return false;
  if (typeof value === "object" && value !== null) {
    const coords = readCoordinates(value);
    return coords !== undefined;
  }
  return true;
}

function valuesConflict(
  field: ComparableFieldKey,
  left: unknown,
  right: unknown,
): boolean {
  if (field === "coordinates") {
    const leftCoords = readCoordinates(left);
    const rightCoords = readCoordinates(right);
    if (!leftCoords || !rightCoords) return false;
    return (
      Math.abs(leftCoords.lat - rightCoords.lat) > 0.0005 ||
      Math.abs(leftCoords.lng - rightCoords.lng) > 0.0005
    );
  }

  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) > 0.5;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return left !== right;
  }

  return normalizeScalar(left) !== normalizeScalar(right);
}

function normalizeScalar(value: unknown): string {
  if (typeof value === "string") return value.trim().toLowerCase();
  if (typeof value === "number") return String(Math.round(value * 100) / 100);
  if (typeof value === "boolean") return value ? "true" : "false";
  return JSON.stringify(value);
}
