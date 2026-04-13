import { query, type QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import { buildNeighborhoodRequests } from "../src/lib/enrichment/jobContext";
import {
  SOURCE_CACHE_TTL_HOURS,
  type EnrichmentSource,
} from "../src/lib/enrichment/types";
import {
  DOSSIER_REVIEW_THRESHOLD,
  buildAggregatedComparableMap,
  buildBrowserUseComparableMap,
  buildDeterministicComparableMap,
  buildDossierCompletenessScore,
  calculateConflictRate,
  classifyFreshness,
  evaluateThresholds,
  type ComparableSourceMap,
  type ConflictComparisonKey,
  type ConflictRateSummary,
  type DossierSectionKey,
  type DossierSupportSignals,
  type FreshnessStatus,
} from "../src/lib/intelligence/monitoring";

const extractionPathValidator = v.union(
  v.literal("deterministic_intake"),
  v.literal("browser_use_hosted"),
  v.literal("aggregated_baseline"),
);

const alertStatusValidator = v.union(
  v.literal("ok"),
  v.literal("warn"),
  v.literal("alert"),
  v.literal("unavailable"),
);

const sectionScoreValidator = v.object({
  key: v.string(),
  label: v.string(),
  score: v.number(),
  filledFields: v.number(),
  totalFields: v.number(),
  missingFields: v.array(v.string()),
  criticalMissingFields: v.array(v.string()),
});

async function requireInternalUser(ctx: QueryCtx) {
  const user = await requireAuth(ctx);
  if (user.role !== "broker" && user.role !== "admin") {
    throw new Error("Internal console access required");
  }
  return user;
}

function safeParseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampWindowDays(days: number | undefined): number {
  if (!Number.isFinite(days)) return 30;
  return Math.max(7, Math.min(90, Math.floor(days!)));
}

function toKey(value: unknown): string {
  return String(value);
}

function withinWindow(iso: string | undefined, startMs: number): boolean {
  if (!iso) return false;
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp) && timestamp >= startMs;
}

function windowByCreationTime(
  row: { _creationTime: number },
  startMs: number,
): boolean {
  return row._creationTime >= startMs;
}

function pickPortalFromBrowserUseJob(job: any): string {
  const result = safeParseJson<Record<string, unknown>>(job.resultRef);
  if (typeof result?.portal === "string") return result.portal;
  const context = safeParseJson<Record<string, unknown>>(job.contextJson);
  if (typeof context?.portal === "string") return context.portal;
  return "unknown";
}

function pickTriggerFromBrowserUseJob(job: any): string | null {
  const result = safeParseJson<Record<string, unknown>>(job.resultRef);
  if (typeof result?.trigger === "string") return result.trigger;
  const context = safeParseJson<Record<string, unknown>>(job.contextJson);
  if (typeof context?.trigger === "string") return context.trigger;
  return null;
}

function pickLatestEstimateValues(rows: Array<any>) {
  const latestByPortal = new Map<"zillow" | "redfin" | "realtor", any>();
  for (const row of rows) {
    const existing = latestByPortal.get(row.portal);
    if (!existing || row.capturedAt > existing.capturedAt) {
      latestByPortal.set(row.portal, row);
    }
  }

  return {
    values: {
      zillow: latestByPortal.get("zillow")?.estimateValue,
      redfin: latestByPortal.get("redfin")?.estimateValue,
      realtor: latestByPortal.get("realtor")?.estimateValue,
    },
    rows: Array.from(latestByPortal.values()),
  };
}

function compareIsoDesc(a: string | undefined, b: string | undefined) {
  return (b ?? "").localeCompare(a ?? "");
}

function addCount(bucket: Map<string, number>, key: string) {
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}

function topCounts(bucket: Map<string, number>) {
  return Array.from(bucket.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));
}

function addSourceHealthRow(
  bucket: Map<
    string,
    {
      source: string;
      path: "deterministic_intake" | "browser_use_hosted" | "aggregated_baseline";
      total: number;
      succeeded: number;
      failed: number;
      pending: number;
      failureCodes: Map<string, number>;
      driftSignals: Map<string, number>;
    }
  >,
  args: {
    source: string;
    path: "deterministic_intake" | "browser_use_hosted" | "aggregated_baseline";
    status: "success" | "failure" | "pending";
    failureCode?: string | null;
    driftSignal?: string | null;
  },
) {
  const key = `${args.path}::${args.source}`;
  const current =
    bucket.get(key) ??
    {
      source: args.source,
      path: args.path,
      total: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
      failureCodes: new Map<string, number>(),
      driftSignals: new Map<string, number>(),
    };

  current.total += 1;
  if (args.status === "success") current.succeeded += 1;
  if (args.status === "failure") current.failed += 1;
  if (args.status === "pending") current.pending += 1;
  if (args.failureCode) addCount(current.failureCodes, args.failureCode);
  if (args.driftSignal) addCount(current.driftSignals, args.driftSignal);
  bucket.set(key, current);
}

function addConflictSummary(
  bucket: Map<
    ConflictComparisonKey,
    {
      label: string;
      comparableFields: number;
      conflictingFields: number;
      sampleFields: Set<string>;
    }
  >,
  summary: ConflictRateSummary,
) {
  const current =
    bucket.get(summary.comparison) ??
    {
      label: summary.label,
      comparableFields: 0,
      conflictingFields: 0,
      sampleFields: new Set<string>(),
    };

  current.comparableFields += summary.comparableFields;
  current.conflictingFields += summary.conflictingFields;
  for (const field of summary.sampleFields) {
    if (current.sampleFields.size < 5) current.sampleFields.add(field);
  }
  bucket.set(summary.comparison, current);
}

function latestBrowserUseResultByProperty(rows: Array<any>) {
  const latest = new Map<string, any>();
  for (const row of rows) {
    if (row.source !== "browser_use_hosted" || row.status !== "succeeded") continue;
    const propertyId = toKey(row.propertyId);
    const existing = latest.get(propertyId);
    const candidateTime = row.completedAt ?? row.requestedAt;
    const existingTime = existing?.completedAt ?? existing?.requestedAt;
    if (!existing || (candidateTime ?? "") > (existingTime ?? "")) {
      latest.set(propertyId, row);
    }
  }
  return latest;
}

function browserUseCanonicalFields(job: any) {
  const result = safeParseJson<Record<string, unknown>>(job?.resultRef);
  return result?.canonicalFields &&
    typeof result.canonicalFields === "object" &&
    !Array.isArray(result.canonicalFields)
    ? (result.canonicalFields as Record<string, unknown>)
    : null;
}

function snapshotPayloadMap(rows: Array<any>) {
  const byProperty = new Map<string, Map<string, any>>();
  for (const row of rows) {
    const propertyKey = toKey(row.propertyId);
    const current = byProperty.get(propertyKey) ?? new Map<string, any>();
    current.set(row.source, {
      lastRefreshedAt: row.lastRefreshedAt,
      payload: safeParseJson<Record<string, unknown>>(row.payloadJson) ?? {},
    });
    byProperty.set(propertyKey, current);
  }
  return byProperty;
}

function portalEstimateMap(rows: Array<any>) {
  const byProperty = new Map<string, Array<any>>();
  for (const row of rows) {
    const key = toKey(row.propertyId);
    const current = byProperty.get(key) ?? [];
    current.push(row);
    byProperty.set(key, current);
  }
  return byProperty;
}

function recentSalesMap(rows: Array<any>) {
  const byProperty = new Map<string, { count: number; latestCapturedAt?: string }>();
  for (const row of rows) {
    const key = toKey(row.propertyId);
    const current = byProperty.get(key) ?? { count: 0, latestCapturedAt: undefined };
    current.count += 1;
    if (!current.latestCapturedAt || row.capturedAt > current.latestCapturedAt) {
      current.latestCapturedAt = row.capturedAt;
    }
    byProperty.set(key, current);
  }
  return byProperty;
}

function listingAgentMap(links: Array<any>, agents: Array<any>) {
  const agentById = new Map(agents.map((agent) => [toKey(agent._id), agent]));
  const byProperty = new Map<string, { count: number; lastRefreshedAt?: string }>();

  for (const link of links) {
    const propertyKey = toKey(link.propertyId);
    const agent = agentById.get(toKey(link.agentId));
    const current = byProperty.get(propertyKey) ?? { count: 0, lastRefreshedAt: undefined };
    current.count += 1;
    if (
      agent?.lastRefreshedAt &&
      (!current.lastRefreshedAt || agent.lastRefreshedAt > current.lastRefreshedAt)
    ) {
      current.lastRefreshedAt = agent.lastRefreshedAt;
    }
    byProperty.set(propertyKey, current);
  }

  return byProperty;
}

function neighborhoodIndex(rows: Array<any>) {
  return new Map(
    rows.map((row) => [
      `${row.geoKind}::${row.geoKey}::${row.windowDays}`,
      row,
    ]),
  );
}

function neighborhoodRowsForProperty(
  property: any,
  index: Map<string, any>,
) {
  const requests = buildNeighborhoodRequests({
    canonicalId: property.canonicalId,
    sourcePlatform: property.sourcePlatform,
    address: {
      city: property.address.city,
      formatted: property.address.formatted,
      zip: property.address.zip,
    },
    buildingName: property.buildingName,
    neighborhood: property.neighborhood,
    subdivision: property.subdivision,
    schoolDistrict: property.schoolDistrict,
  });

  const rows = requests
    .map((request) =>
      index.get(`${request.geoKind}::${request.geoKey}::${request.windowDays}`),
    )
    .filter(Boolean);

  return {
    applicable: requests.length > 0,
    rows,
    oldestLastRefreshedAt: rows
      .map((row) => row.lastRefreshedAt as string)
      .sort()[0],
  };
}

function buildSupportSignals(args: {
  property: any;
  snapshotRows: Map<string, any> | undefined;
  latestEstimateRows: Array<any>;
  recentSalesInfo: { count: number; latestCapturedAt?: string } | undefined;
  listingAgentInfo: { count: number; lastRefreshedAt?: string } | undefined;
  neighborhoodInfo: { applicable: boolean; rows: Array<any> };
  browserUseFields: Record<string, unknown> | null;
}): DossierSupportSignals {
  return {
    portalEstimateCount: args.latestEstimateRows.length,
    recentSalesCount: args.recentSalesInfo?.count ?? 0,
    neighborhoodContextCount: args.neighborhoodInfo.rows.length,
    hasListingAgentProfile: (args.listingAgentInfo?.count ?? 0) > 0,
    hasCrossPortalMatch:
      args.snapshotRows?.has("cross_portal_match") ??
      Boolean(args.property.zillowId || args.property.redfinId || args.property.realtorId),
    hasCountyRecord: args.snapshotRows?.has("county_appraiser") ?? false,
    hasFloodSnapshot: args.snapshotRows?.has("fema_flood") ?? false,
    hasCensusGeocode: args.snapshotRows?.has("census_geocode") ?? false,
    browserUseFieldCount: Object.keys(args.browserUseFields ?? {}).length,
  };
}

function freshnessEntriesForProperty(args: {
  property: any;
  snapshots: Map<string, any> | undefined;
  latestEstimateRows: Array<any>;
  recentSalesInfo: { count: number; latestCapturedAt?: string } | undefined;
  listingAgentInfo: { count: number; lastRefreshedAt?: string } | undefined;
  neighborhoodInfo: { applicable: boolean; oldestLastRefreshedAt?: string };
  now: Date;
}) {
  const entries: Array<{ source: EnrichmentSource; status: FreshnessStatus }> = [];
  const addEntry = (
    source: EnrichmentSource,
    lastUpdatedAt: string | undefined | null,
    applicable = true,
  ) => {
    if (!applicable) return;
    entries.push({
      source,
      status: classifyFreshness({ source, lastUpdatedAt, now: args.now }),
    });
  };

  addEntry("cross_portal_match", args.snapshots?.get("cross_portal_match")?.lastRefreshedAt);
  addEntry("county_appraiser", args.snapshots?.get("county_appraiser")?.lastRefreshedAt);
  addEntry("fema_flood", args.snapshots?.get("fema_flood")?.lastRefreshedAt);
  addEntry("census_geocode", args.snapshots?.get("census_geocode")?.lastRefreshedAt);

  const oldestEstimate =
    args.latestEstimateRows.length === 0
      ? undefined
      : args.latestEstimateRows
          .map((row) => row.capturedAt as string)
          .sort()[0];
  addEntry("portal_estimates", oldestEstimate);
  addEntry("recent_sales", args.recentSalesInfo?.latestCapturedAt);
  addEntry(
    "listing_agent_profile",
    args.listingAgentInfo?.lastRefreshedAt,
    Boolean(args.property.listingAgentName || args.listingAgentInfo?.count),
  );
  addEntry(
    "neighborhood_market",
    args.neighborhoodInfo.oldestLastRefreshedAt,
    args.neighborhoodInfo.applicable,
  );

  return entries;
}

function conflictSummariesForProperty(args: {
  deterministic: ComparableSourceMap;
  browserUse: ComparableSourceMap;
  aggregated: ComparableSourceMap;
}) {
  return [
    calculateConflictRate({
      comparison: "deterministic_vs_browser_use",
      label: "Deterministic vs Browser Use",
      left: args.deterministic,
      right: args.browserUse,
    }),
    calculateConflictRate({
      comparison: "deterministic_vs_aggregated",
      label: "Deterministic vs Aggregated",
      left: args.deterministic,
      right: args.aggregated,
    }),
    calculateConflictRate({
      comparison: "browser_use_vs_aggregated",
      label: "Browser Use vs Aggregated",
      left: args.browserUse,
      right: args.aggregated,
    }),
  ];
}

export const getOverview = query({
  args: {
    windowDays: v.optional(v.number()),
    propertyLimit: v.optional(v.number()),
  },
  returns: v.object({
    generatedAt: v.string(),
    window: v.object({
      start: v.string(),
      end: v.string(),
      days: v.number(),
    }),
    summary: v.object({
      propertiesReviewed: v.number(),
      deterministicSuccessRate: v.number(),
      overallCompletenessScore: v.number(),
      parserSchemaRate: v.number(),
      crossSourceConflictRate: v.number(),
      staleOrMissingRate: v.number(),
    }),
    alerts: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        direction: v.union(v.literal("higher_is_worse"), v.literal("lower_is_worse")),
        warn: v.number(),
        alert: v.number(),
        note: v.string(),
        value: v.union(v.number(), v.null()),
        status: alertStatusValidator,
      }),
    ),
    extractionHealth: v.array(
      v.object({
        source: v.string(),
        path: extractionPathValidator,
        total: v.number(),
        succeeded: v.number(),
        failed: v.number(),
        pending: v.number(),
        failureRate: v.number(),
        topFailureCodes: v.array(v.object({ code: v.string(), count: v.number() })),
        driftSignals: v.array(v.object({ code: v.string(), count: v.number() })),
      }),
    ),
    driftIndicators: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        count: v.number(),
        denominator: v.number(),
        rate: v.number(),
      }),
    ),
    completeness: v.object({
      overallAverage: v.number(),
      sections: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          averageScore: v.number(),
          propertiesBelowReviewThreshold: v.number(),
          criticalMissingRate: v.number(),
        }),
      ),
      lowestProperties: v.array(
        v.object({
          propertyId: v.id("properties"),
          canonicalId: v.string(),
          sourcePlatform: v.string(),
          address: v.string(),
          updatedAt: v.string(),
          overallScore: v.number(),
          sectionsNeedingReview: v.array(v.string()),
          staleSources: v.array(v.string()),
          sectionScores: v.array(sectionScoreValidator),
        }),
      ),
    }),
    conflicts: v.array(
      v.object({
        comparison: v.string(),
        label: v.string(),
        comparableFields: v.number(),
        conflictingFields: v.number(),
        conflictRate: v.number(),
        sampleFields: v.array(v.string()),
      }),
    ),
    freshness: v.array(
      v.object({
        source: v.string(),
        ttlHours: v.number(),
        fresh: v.number(),
        stale: v.number(),
        missing: v.number(),
        staleRate: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireInternalUser(ctx);

    const now = new Date();
    const windowDays = clampWindowDays(args.windowDays);
    const propertyLimit = Math.max(5, Math.min(25, Math.floor(args.propertyLimit ?? 12)));
    const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const startMs = start.getTime();

    const [
      sourceListings,
      properties,
      enrichmentJobs,
      snapshots,
      portalEstimates,
      recentSales,
      propertyAgentLinks,
      listingAgents,
      neighborhoodRows,
    ] = await Promise.all([
      ctx.db.query("sourceListings").collect(),
      ctx.db.query("properties").collect(),
      ctx.db.query("enrichmentJobs").collect(),
      ctx.db.query("propertyEnrichmentSnapshots").collect(),
      ctx.db.query("portalEstimates").collect(),
      ctx.db.query("recentComparableSales").collect(),
      ctx.db.query("propertyAgentLinks").collect(),
      ctx.db.query("listingAgents").collect(),
      ctx.db.query("neighborhoodMarketContext").collect(),
    ]);

    const extractionHealthBuckets = new Map<string, any>();
    const recentDeterministicRows = sourceListings.filter((row) =>
      windowByCreationTime(row as any, startMs),
    );
    for (const row of recentDeterministicRows) {
      addSourceHealthRow(extractionHealthBuckets, {
        source: row.sourcePlatform,
        path: "deterministic_intake",
        status:
          row.status === "failed"
            ? "failure"
            : row.status === "pending"
              ? "pending"
              : "success",
        failureCode: row.status === "failed" ? "failed" : null,
      });
    }

    const recentEnrichmentJobs = enrichmentJobs.filter((job) =>
      withinWindow(job.requestedAt, startMs) ||
      withinWindow(job.completedAt, startMs) ||
      withinWindow(job.startedAt, startMs),
    );
    for (const job of recentEnrichmentJobs) {
      if (job.source === "browser_use_hosted") {
        addSourceHealthRow(extractionHealthBuckets, {
          source: pickPortalFromBrowserUseJob(job),
          path: "browser_use_hosted",
          status:
            job.status === "failed" || job.status === "escalated"
              ? "failure"
              : job.status === "succeeded"
                ? "success"
                : "pending",
          failureCode:
            job.status === "failed" || job.status === "escalated"
              ? job.errorCode ?? job.status
              : null,
          driftSignal: pickTriggerFromBrowserUseJob(job),
        });
        continue;
      }

      addSourceHealthRow(extractionHealthBuckets, {
        source: job.source,
        path: "aggregated_baseline",
        status:
          job.status === "failed" || job.status === "escalated"
            ? "failure"
            : job.status === "succeeded"
              ? "success"
              : "pending",
        failureCode:
          job.status === "failed" || job.status === "escalated"
            ? job.errorCode ?? job.status
            : null,
        driftSignal: job.errorCode === "parse_error" ? "parse_error" : null,
      });
    }

    const snapshotByProperty = snapshotPayloadMap(snapshots);
    const portalEstimatesByProperty = portalEstimateMap(portalEstimates);
    const recentSalesByProperty = recentSalesMap(recentSales);
    const agentsByProperty = listingAgentMap(propertyAgentLinks, listingAgents);
    const neighborhoodByKey = neighborhoodIndex(neighborhoodRows);
    const latestBrowserUseByProperty = latestBrowserUseResultByProperty(enrichmentJobs);

    const sectionAccumulators = new Map<
      DossierSectionKey,
      {
        label: string;
        scoreTotal: number;
        propertyCount: number;
        belowReview: number;
        criticalMissing: number;
      }
    >();
    const conflictAccumulators = new Map<
      ConflictComparisonKey,
      {
        label: string;
        comparableFields: number;
        conflictingFields: number;
        sampleFields: Set<string>;
      }
    >();
    const freshnessAccumulators = new Map<
      EnrichmentSource,
      { fresh: number; stale: number; missing: number }
    >();

    const sortedProperties = [...properties].sort((a, b) =>
      compareIsoDesc(a.updatedAt ?? a.extractedAt, b.updatedAt ?? b.extractedAt),
    );

    const propertySummaries = sortedProperties.map((property) => {
      const propertyKey = toKey(property._id);
      const snapshotRows = snapshotByProperty.get(propertyKey);
      const latestEstimateRows = portalEstimatesByProperty.get(propertyKey) ?? [];
      const latestEstimates = pickLatestEstimateValues(latestEstimateRows);
      const recentSalesInfo = recentSalesByProperty.get(propertyKey);
      const listingAgentInfo = agentsByProperty.get(propertyKey);
      const neighborhoodInfo = neighborhoodRowsForProperty(property, neighborhoodByKey);
      const browserUseJob = latestBrowserUseByProperty.get(propertyKey);
      const browserUseFields = browserUseCanonicalFields(browserUseJob);
      const support = buildSupportSignals({
        property,
        snapshotRows,
        latestEstimateRows: latestEstimates.rows,
        recentSalesInfo,
        listingAgentInfo,
        neighborhoodInfo,
        browserUseFields,
      });
      const completeness = buildDossierCompletenessScore({
        property: property as any,
        support,
      });

      for (const section of completeness.sections) {
        const current =
          sectionAccumulators.get(section.key) ??
          {
            label: section.label,
            scoreTotal: 0,
            propertyCount: 0,
            belowReview: 0,
            criticalMissing: 0,
          };
        current.scoreTotal += section.score;
        current.propertyCount += 1;
        if (
          section.score < DOSSIER_REVIEW_THRESHOLD ||
          section.criticalMissingFields.length > 0
        ) {
          current.belowReview += 1;
        }
        if (section.criticalMissingFields.length > 0) current.criticalMissing += 1;
        sectionAccumulators.set(section.key, current);
      }

      const freshnessEntries = freshnessEntriesForProperty({
        property,
        snapshots: snapshotRows,
        latestEstimateRows: latestEstimates.rows,
        recentSalesInfo,
        listingAgentInfo,
        neighborhoodInfo,
        now,
      });
      for (const entry of freshnessEntries) {
        const current = freshnessAccumulators.get(entry.source) ?? {
          fresh: 0,
          stale: 0,
          missing: 0,
        };
        if (entry.status === "fresh") current.fresh += 1;
        if (entry.status === "stale") current.stale += 1;
        if (entry.status === "missing") current.missing += 1;
        freshnessAccumulators.set(entry.source, current);
      }

      const deterministicMap = buildDeterministicComparableMap(property as any);
      const aggregatedMap = buildAggregatedComparableMap({
        countySnapshot: snapshotRows?.get("county_appraiser")?.payload,
        floodSnapshot: snapshotRows?.get("fema_flood")?.payload,
        censusSnapshot: snapshotRows?.get("census_geocode")?.payload,
        crossPortalSnapshot: snapshotRows?.get("cross_portal_match")?.payload,
        latestPortalEstimates: latestEstimates.values,
      });
      const browserUseMap = buildBrowserUseComparableMap(browserUseFields);
      for (const summary of conflictSummariesForProperty({
        deterministic: deterministicMap,
        browserUse: browserUseMap,
        aggregated: aggregatedMap,
      })) {
        addConflictSummary(conflictAccumulators, summary);
      }

      return {
        propertyId: property._id,
        canonicalId: property.canonicalId,
        sourcePlatform: property.sourcePlatform,
        address:
          property.address.formatted ??
          [
            property.address.street,
            property.address.city,
            `${property.address.state} ${property.address.zip}`,
          ]
            .filter(Boolean)
            .join(", "),
        updatedAt: property.updatedAt ?? property.extractedAt,
        overallScore: completeness.overallScore,
        sectionsNeedingReview: completeness.sectionsNeedingReview,
        staleSources: freshnessEntries
          .filter((entry) => entry.status !== "fresh")
          .map((entry) => entry.source),
        sectionScores: completeness.sections,
      };
    });

    const completenessAverage =
      propertySummaries.length === 0
        ? 0
        : propertySummaries.reduce((sum, row) => sum + row.overallScore, 0) /
          propertySummaries.length;

    const sectionSummaries = Array.from(sectionAccumulators.entries()).map(
      ([key, value]) => ({
        key,
        label: value.label,
        averageScore:
          value.propertyCount === 0 ? 0 : value.scoreTotal / value.propertyCount,
        propertiesBelowReviewThreshold: value.belowReview,
        criticalMissingRate:
          value.propertyCount === 0 ? 0 : value.criticalMissing / value.propertyCount,
      }),
    );

    const conflicts = Array.from(conflictAccumulators.entries()).map(
      ([comparison, value]) => ({
        comparison,
        label: value.label,
        comparableFields: value.comparableFields,
        conflictingFields: value.conflictingFields,
        conflictRate:
          value.comparableFields === 0
            ? 0
            : value.conflictingFields / value.comparableFields,
        sampleFields: Array.from(value.sampleFields),
      }),
    );

    const freshness = Array.from(
      Object.entries(SOURCE_CACHE_TTL_HOURS),
    ).map(([source, ttlHours]) => {
      const current = freshnessAccumulators.get(source as EnrichmentSource) ?? {
        fresh: 0,
        stale: 0,
        missing: 0,
      };
      const total = current.fresh + current.stale + current.missing;
      return {
        source,
        ttlHours,
        fresh: current.fresh,
        stale: current.stale,
        missing: current.missing,
        staleRate: total === 0 ? 0 : (current.stale + current.missing) / total,
      };
    });

    const extractionHealth = Array.from(extractionHealthBuckets.values())
      .map((row) => ({
        source: row.source,
        path: row.path,
        total: row.total,
        succeeded: row.succeeded,
        failed: row.failed,
        pending: row.pending,
        failureRate: row.total === 0 ? 0 : row.failed / row.total,
        topFailureCodes: topCounts(row.failureCodes),
        driftSignals: topCounts(row.driftSignals),
      }))
      .sort((a, b) => {
        if (a.path !== b.path) return a.path.localeCompare(b.path);
        return b.failureRate - a.failureRate || a.source.localeCompare(b.source);
      });

    const browserUseWindowJobs = recentEnrichmentJobs.filter(
      (job) => job.source === "browser_use_hosted",
    );
    const baselineWindowJobs = recentEnrichmentJobs.filter(
      (job) => job.source !== "browser_use_hosted",
    );
    const parseErrorCount = baselineWindowJobs.filter(
      (job) => job.errorCode === "parse_error",
    ).length;
    const browserUseParserFailures = browserUseWindowJobs.filter(
      (job) => pickTriggerFromBrowserUseJob(job) === "parser_failure",
    ).length;
    const browserUseLowConfidence = browserUseWindowJobs.filter(
      (job) => pickTriggerFromBrowserUseJob(job) === "low_confidence_parse",
    ).length;
    const browserUseMissingCritical = browserUseWindowJobs.filter(
      (job) => pickTriggerFromBrowserUseJob(job) === "missing_critical_fields",
    ).length;
    const invalidBrowserUsePayloads = browserUseWindowJobs.filter((job) =>
      String(job.errorMessage ?? "").includes("Invalid browser_use_hosted payload"),
    ).length;

    const driftIndicators = [
      {
        key: "baseline_parse_error_rate",
        label: "Baseline parse-error rate",
        count: parseErrorCount,
        denominator: baselineWindowJobs.length,
        rate:
          baselineWindowJobs.length === 0
            ? 0
            : parseErrorCount / baselineWindowJobs.length,
      },
      {
        key: "browser_use_parser_failure_rate",
        label: "Browser Use parser-failure trigger rate",
        count: browserUseParserFailures,
        denominator: browserUseWindowJobs.length,
        rate:
          browserUseWindowJobs.length === 0
            ? 0
            : browserUseParserFailures / browserUseWindowJobs.length,
      },
      {
        key: "browser_use_low_confidence_rate",
        label: "Browser Use low-confidence trigger rate",
        count: browserUseLowConfidence,
        denominator: browserUseWindowJobs.length,
        rate:
          browserUseWindowJobs.length === 0
            ? 0
            : browserUseLowConfidence / browserUseWindowJobs.length,
      },
      {
        key: "browser_use_missing_critical_rate",
        label: "Browser Use missing-critical-fields trigger rate",
        count: browserUseMissingCritical,
        denominator: browserUseWindowJobs.length,
        rate:
          browserUseWindowJobs.length === 0
            ? 0
            : browserUseMissingCritical / browserUseWindowJobs.length,
      },
      {
        key: "browser_use_invalid_payload_rate",
        label: "Browser Use invalid-payload rate",
        count: invalidBrowserUsePayloads,
        denominator: browserUseWindowJobs.length,
        rate:
          browserUseWindowJobs.length === 0
            ? 0
            : invalidBrowserUsePayloads / browserUseWindowJobs.length,
      },
    ];

    const deterministicRows = extractionHealth.filter(
      (row) => row.path === "deterministic_intake",
    );
    const deterministicTotals = deterministicRows.reduce(
      (acc, row) => {
        acc.total += row.total;
        acc.succeeded += row.succeeded;
        acc.failed += row.failed;
        return acc;
      },
      { total: 0, succeeded: 0, failed: 0 },
    );

    const deterministicSuccessRate =
      deterministicTotals.total === 0
        ? 0
        : deterministicTotals.succeeded / deterministicTotals.total;
    const deterministicFailureRate =
      deterministicTotals.total === 0
        ? 0
        : deterministicTotals.failed / deterministicTotals.total;
    const crossSourceConflictRate = conflicts.reduce(
      (max, item) => Math.max(max, item.conflictRate),
      0,
    );
    const staleOrMissingRate =
      freshness.length === 0
        ? 0
        : freshness.reduce((sum, row) => sum + row.staleRate, 0) / freshness.length;
    const marketIntelligenceAverage =
      sectionSummaries.find((section) => section.key === "market_intelligence")
        ?.averageScore ?? 0;
    const parserSchemaRate = Math.max(
      ...driftIndicators.map((indicator) => indicator.rate),
      0,
    );

    const alerts = evaluateThresholds({
      "dossier.overall_completeness": completenessAverage,
      "dossier.market_intelligence_completeness": marketIntelligenceAverage,
      "extraction.deterministic_failure_rate": deterministicFailureRate,
      "drift.parser_schema_rate": parserSchemaRate,
      "conflicts.cross_source_rate": crossSourceConflictRate,
      "freshness.stale_or_missing_rate": staleOrMissingRate,
    });

    return {
      generatedAt: now.toISOString(),
      window: {
        start: start.toISOString(),
        end: now.toISOString(),
        days: windowDays,
      },
      summary: {
        propertiesReviewed: propertySummaries.length,
        deterministicSuccessRate,
        overallCompletenessScore: completenessAverage,
        parserSchemaRate,
        crossSourceConflictRate,
        staleOrMissingRate,
      },
      alerts,
      extractionHealth,
      driftIndicators,
      completeness: {
        overallAverage: completenessAverage,
        sections: sectionSummaries.sort((a, b) => a.label.localeCompare(b.label)),
        lowestProperties: [...propertySummaries]
          .sort(
            (a, b) =>
              a.overallScore - b.overallScore ||
              b.staleSources.length - a.staleSources.length,
          )
          .slice(0, propertyLimit),
      },
      conflicts: conflicts.sort((a, b) => b.conflictRate - a.conflictRate),
      freshness: freshness.sort((a, b) => b.staleRate - a.staleRate),
    };
  },
});
