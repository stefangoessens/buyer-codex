/**
 * Background enrichment pipeline types (KIN-782).
 *
 * Enrichment augments extracted property records with secondary data
 * sources: flood zones, public records, cross-portal matches, listing-agent
 * profile stats, and neighborhood market context. Jobs run async after
 * primary extraction so the deal room can progressively render as data
 * lands. Failures are isolated per source; a single failed source never
 * corrupts the canonical property record.
 */

// ───────────────────────────────────────────────────────────────────────────
// Source registry
// ───────────────────────────────────────────────────────────────────────────

/**
 * Every enrichment runs under one of these source names. Adding a source
 * means: 1) adding it here, 2) registering its worker in
 * `src/lib/ai/engines/enrichmentWorker.ts`, 3) extending the Convex
 * `enrichmentJobs.source` validator.
 */
export const ENRICHMENT_SOURCES = [
  "fema_flood",
  "county_appraiser",
  "census_geocode",
  "cross_portal_match",
  "listing_agent_profile",
  "neighborhood_market",
  "portal_estimates",
  "recent_sales",
  // KIN-1019: Browser Use hosted is an explicit enrichment source for
  // interactive, agentic extraction when deterministic parsing alone is
  // insufficient. It remains opt-in and trigger-driven rather than a
  // speculative primary pass.
  "browser_use_hosted",
] as const;

export type EnrichmentSource = (typeof ENRICHMENT_SOURCES)[number];

/** Sources that must succeed before the deal room considers a property
 * "enriched enough" to show AI engine output. Failures here still don't
 * corrupt the record — they just leave the UI in a degraded state. */
export const CRITICAL_SOURCES: readonly EnrichmentSource[] = [
  "cross_portal_match",
  "portal_estimates",
];

/** Default priority per source — lower number = higher priority. Browser
 * Use hosted sits at priority 5 because explicit Browser Use runs are
 * high-value operator-visible enrichments once they have been triggered. */
export const SOURCE_PRIORITY: Record<EnrichmentSource, number> = {
  browser_use_hosted: 5,
  cross_portal_match: 10,
  portal_estimates: 20,
  census_geocode: 30,
  fema_flood: 40,
  county_appraiser: 50,
  listing_agent_profile: 60,
  neighborhood_market: 70,
  recent_sales: 80,
};

/** Default retry budget per source. Browser Use is expensive and flaky so
 * we cap at 2 attempts and escalate to manual ops after. */
export const SOURCE_MAX_ATTEMPTS: Record<EnrichmentSource, number> = {
  browser_use_hosted: 2,
  cross_portal_match: 2,
  portal_estimates: 3,
  census_geocode: 2,
  fema_flood: 3,
  county_appraiser: 3,
  listing_agent_profile: 2,
  neighborhood_market: 2,
  recent_sales: 2,
};

// ───────────────────────────────────────────────────────────────────────────
// Job lifecycle
// ───────────────────────────────────────────────────────────────────────────

export type EnrichmentJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "escalated";

export interface EnrichmentJob {
  propertyId: string;
  source: EnrichmentSource;
  status: EnrichmentJobStatus;
  attempt: number;
  maxAttempts: number;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  nextRetryAt?: string;
  errorCode?: string;
  errorMessage?: string;
  dedupeKey: string;
  resultRef?: string;
  priority: number;
}

/** Result returned by a source worker after it finishes. */
export interface EnrichmentResult<T = unknown> {
  source: EnrichmentSource;
  propertyId: string;
  payload: T;
  /** Caller supplies a short citation — URL or source identifier. */
  citation: string;
  fetchedAt: string;
}

/** Typed error returned when a source worker fails. */
export interface EnrichmentError {
  source: EnrichmentSource;
  propertyId: string;
  code: EnrichmentErrorCode;
  message: string;
  retryable: boolean;
}

export type EnrichmentErrorCode =
  | "network_error"
  | "not_found"
  | "rate_limited"
  | "parse_error"
  | "unauthorized"
  | "timeout"
  | "unknown";

/** Retryable errors — the scheduler will schedule `nextRetryAt`. */
export const RETRYABLE_ERRORS: readonly EnrichmentErrorCode[] = [
  "network_error",
  "rate_limited",
  "timeout",
];

// ───────────────────────────────────────────────────────────────────────────
// Canonical listing-agent record
// ───────────────────────────────────────────────────────────────────────────

/** Per-field provenance entry — which source filled this field, when. */
export interface FieldProvenance {
  source: string;
  fetchedAt: string;
}

export interface ListingAgentProfile {
  canonicalAgentId: string;
  name: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  zillowProfileUrl?: string;
  redfinProfileUrl?: string;
  realtorProfileUrl?: string;
  activeListings?: number;
  soldCount?: number;
  avgDaysOnMarket?: number;
  medianListToSellRatio?: number;
  priceCutFrequency?: number;
  recentActivityCount?: number;
  provenance: Record<string, FieldProvenance>;
  lastRefreshedAt: string;
}

/** Raw observation of an agent from a single portal — the input to merge. */
export interface AgentObservation {
  source: "zillow" | "redfin" | "realtor";
  name: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  profileUrl?: string;
  activeListings?: number;
  soldCount?: number;
  avgDaysOnMarket?: number;
  medianListToSellRatio?: number;
  priceCutFrequency?: number;
  recentActivityCount?: number;
  fetchedAt: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Market context
// ───────────────────────────────────────────────────────────────────────────

export type GeoKind =
  | "building"
  | "subdivision"
  | "neighborhood"
  | "school_zone"
  | "zip"
  | "broader_area"
  // Legacy alias for older rows that used `city` as the broad fallback.
  | "city";

export type MarketTrajectory = "rising" | "flat" | "falling";

export interface NeighborhoodContextSampleSize {
  total: number;
  sold: number;
  active: number;
  pending: number;
  pricePerSqft: number;
  dom: number;
  saleToList: number;
  reduction: number;
}

export interface NeighborhoodContext {
  geoKey: string;
  geoKind: GeoKind;
  windowDays: number;
  avgPricePerSqft?: number;
  medianDom?: number;
  medianPricePerSqft?: number;
  medianListPrice?: number;
  avgSaleToListRatio?: number;
  medianSaleToListRatio?: number;
  priceReductionFrequency?: number;
  avgReductionPct?: number;
  medianReductionPct?: number;
  inventoryCount?: number;
  pendingCount?: number;
  salesVelocity?: number;
  trajectory?: MarketTrajectory;
  sampleSize: NeighborhoodContextSampleSize;
  provenance: FieldProvenance;
  lastRefreshedAt: string;
}

/** Raw sale used when computing `NeighborhoodContext` aggregates. */
export interface NeighborhoodSale {
  soldPrice: number;
  soldDate: string;
  listPrice?: number;
  sqft?: number;
  dom?: number;
  reductionCount?: number;
  totalReductionAmount?: number;
  totalReductionPct?: number;
  priceReductions?: Array<{ amount: number; date: string }>;
  status: "sold" | "pending" | "active";
}

export interface MarketContextSubject {
  propertyId: string;
  buildingName?: string;
  subdivision?: string;
  neighborhood?: string;
  schoolDistrict?: string;
  zip?: string;
  broaderArea?: string;
}

export type MarketContextDowngradeReasonCode =
  | "missing_geo_key"
  | "missing_baseline"
  | "insufficient_sold_sample";

export interface MarketContextDowngradeReason {
  code: MarketContextDowngradeReasonCode;
  geoKind: GeoKind;
  geoKey?: string;
  message: string;
}

export interface ResolvedMarketContext {
  windowDays: number;
  selectedContext: NeighborhoodContext | null;
  selectedGeoKind?: GeoKind;
  selectedGeoKey?: string;
  downgradeReasons: MarketContextDowngradeReason[];
  confidence: number;
}

export interface PropertyMarketContext {
  propertyId: string;
  baselines: NeighborhoodContext[];
  windows: ResolvedMarketContext[];
  generatedAt: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Per-portal property estimate
// ───────────────────────────────────────────────────────────────────────────

export type PortalName = "zillow" | "redfin" | "realtor";

export interface PortalEstimate {
  propertyId: string;
  portal: PortalName;
  estimateValue: number;
  estimateLow?: number;
  estimateHigh?: number;
  asOfDate?: string;
  provenance: FieldProvenance;
  capturedAt: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Stored enrichment artifacts
// ───────────────────────────────────────────────────────────────────────────

export type SnapshotSource =
  | "fema_flood"
  | "county_appraiser"
  | "census_geocode"
  | "cross_portal_match";

export interface PropertyEnrichmentSnapshot<T = unknown> {
  propertyId: string;
  source: SnapshotSource;
  payload: T;
  provenance: FieldProvenance;
  lastRefreshedAt: string;
}

export interface RecentComparableSale {
  propertyId: string;
  portal: PortalName;
  canonicalId: string;
  address: string;
  soldPrice: number;
  soldDate: string;
  listPrice?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  lotSize?: number;
  propertyType?: string;
  waterfront?: boolean;
  pool?: boolean;
  hoaFee?: number;
  subdivision?: string;
  schoolDistrict?: string;
  zip?: string;
  garageSpaces?: number;
  condition?: "renovated" | "original" | "unknown";
  dom?: number;
  reductionCount?: number;
  totalReductionAmount?: number;
  totalReductionPct?: number;
  provenance: FieldProvenance;
  capturedAt: string;
}

export interface PortalEstimateRequestTarget {
  portal: PortalName;
  canonicalId: string;
}

export interface ListingAgentPortalTarget {
  portal: PortalName;
  propertyExternalId?: string;
  profileUrl?: string;
}

export interface NeighborhoodMarketRequest {
  geoKey: string;
  geoKind: GeoKind;
  windowDays: number;
}

// ───────────────────────────────────────────────────────────────────────────
// Dedupe / cache helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Dedupe key for an enrichment job. Enrichment jobs are idempotent —
 * enqueueing the same (propertyId, source, dedupe hint) twice in a short
 * window must not double-fetch. Callers pass a stable hint (e.g., a
 * content hash or a time bucket) to distinguish "retry the same thing"
 * from "refresh because the upstream data changed".
 */
export function buildDedupeKey(
  propertyId: string,
  source: EnrichmentSource,
  hint = "",
): string {
  return `${propertyId}::${source}::${hint}`;
}

/** Cache freshness horizons per source, in hours. After this, a job is
 * considered stale and eligible for a scheduled refresh. Browser Use
 * hosted never auto-refreshes — every run is explicitly triggered, so
 * the TTL only gates same-hour dedupe. */
export const SOURCE_CACHE_TTL_HOURS: Record<EnrichmentSource, number> = {
  browser_use_hosted: 1,
  cross_portal_match: 72,
  portal_estimates: 24,
  census_geocode: 24 * 30,
  fema_flood: 24 * 30,
  county_appraiser: 24 * 7,
  listing_agent_profile: 24 * 3,
  neighborhood_market: 24,
  recent_sales: 12,
};

// ───────────────────────────────────────────────────────────────────────────
// Browser Use hosted enrichment (KIN-1019)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Explicit trigger reasons for Browser Use hosted. These are the only
 * conditions under which the agentic extraction path may run.
 */
export const BROWSER_USE_TRIGGER_TYPES = [
  "parser_failure",
  "low_confidence_parse",
  "missing_critical_fields",
  "conflicting_portal_data",
  "operator_requested_deep_extract",
] as const;

export type BrowserUseTriggerType =
  (typeof BROWSER_USE_TRIGGER_TYPES)[number];

export const BROWSER_USE_TRIGGER_LABELS: Record<
  BrowserUseTriggerType,
  string
> = {
  parser_failure:
    "Deterministic parser failed to recover required listing structure",
  low_confidence_parse:
    "Deterministic parse confidence fell below the Browser Use threshold",
  missing_critical_fields:
    "Critical listing fields are missing after deterministic parsing",
  conflicting_portal_data:
    "Portal data conflicts require interactive verification",
  operator_requested_deep_extract:
    "Operator explicitly requested deep Browser Use extraction",
};

/**
 * Browser Use hosted run states are tracked separately from deterministic
 * extraction. The enrichment queue uses the same lifecycle shape.
 */
export type BrowserUseRunState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "escalated";

export type BrowserUseReviewState = "pending" | "needs_review" | "approved";

export interface BrowserUseHostedContext {
  propertyId: string;
  sourceUrl: string;
  portal: PortalName;
  trigger: BrowserUseTriggerType;
  extractorErrorCode?: EnrichmentErrorCode;
  parseConfidence?: number;
  minimumParseConfidence?: number;
  missingCriticalFields?: string[];
  conflictingFields?: string[];
  note?: string;
}

/**
 * A citation or artifact URL supporting a Browser Use extracted field.
 */
export interface BrowserUseCitation {
  url: string;
  label?: string;
}

export interface BrowserUseFieldMetadata {
  confidence: number;
  citations: BrowserUseCitation[];
}

export interface BrowserUseTraceArtifact {
  kind: "screenshot" | "html" | "json" | "console" | "network";
  url: string;
  label?: string;
}

export interface BrowserUseTraceStep {
  label: string;
  status: "completed" | "failed" | "skipped";
  evidenceUrl?: string;
}

export interface BrowserUseTrace {
  runId?: string;
  sessionId?: string;
  summary?: string;
  steps: BrowserUseTraceStep[];
  artifacts: BrowserUseTraceArtifact[];
}

/**
 * The typed payload a Browser Use hosted worker returns after a successful
 * run. Fields land in the canonical merge path while retaining per-field
 * metadata, citations, and operator-review artifacts.
 */
export interface BrowserUseHostedResult {
  sourceUrl: string;
  portal: PortalName;
  canonicalFields: Record<string, unknown>;
  fieldMetadata: Record<string, BrowserUseFieldMetadata>;
  confidence: number;
  citations: BrowserUseCitation[];
  trace: BrowserUseTrace;
  reviewState: BrowserUseReviewState;
  trigger: BrowserUseTriggerType;
  capturedAt: string;
}
