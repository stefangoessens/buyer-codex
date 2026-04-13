import { query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildNeighborhoodRequests } from "../src/lib/enrichment/jobContext";
import { buildPropertyMarketContext } from "../src/lib/enrichment/marketContext";
import {
  buildCompCandidatesFromRecentSales,
  buildLeverageInputFromEnrichment,
  buildPricingInputFromEnrichment,
} from "../src/lib/enrichment/engineContext";

function summarizeJobs(jobs: Array<any>) {
  let queued = 0;
  let succeeded = 0;
  let failed = 0;
  let running = 0;
  let escalated = 0;
  let lastUpdated: string | undefined;

  for (const job of jobs) {
    switch (job.status) {
      case "queued":
        queued++;
        break;
      case "succeeded":
        succeeded++;
        break;
      case "failed":
        failed++;
        break;
      case "running":
        running++;
        break;
      case "escalated":
        escalated++;
        break;
    }

    const candidate = job.completedAt ?? job.startedAt ?? job.requestedAt;
    if (candidate && (!lastUpdated || candidate > lastUpdated)) {
      lastUpdated = candidate;
    }
  }

  return {
    totalJobs: jobs.length,
    queued,
    succeeded,
    failed,
    running,
    escalated,
    lastUpdated,
  };
}

function safeParseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadBrowserUseRuns(jobs: Array<any>) {
  return jobs
    .filter((job) => job.source === "browser_use_hosted")
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""))
    .map((job) => {
      const context = safeParseJson<Record<string, any>>(job.contextJson) ?? {};
      const result = safeParseJson<Record<string, any>>(job.resultRef) ?? {};
      return {
        jobId: job._id,
        runState: job.status,
        reviewState:
          typeof result.reviewState === "string"
            ? result.reviewState
            : job.status === "escalated"
              ? "needs_review"
              : "pending",
        trigger:
          typeof result.trigger === "string"
            ? result.trigger
            : typeof context.trigger === "string"
              ? context.trigger
              : undefined,
        sourceUrl:
          typeof result.sourceUrl === "string"
            ? result.sourceUrl
            : typeof context.sourceUrl === "string"
              ? context.sourceUrl
              : undefined,
        portal:
          typeof result.portal === "string"
            ? result.portal
            : typeof context.portal === "string"
              ? context.portal
              : undefined,
        note:
          typeof context.note === "string" && context.note.length > 0
            ? context.note
            : undefined,
        parseConfidence:
          typeof context.parseConfidence === "number"
            ? context.parseConfidence
            : undefined,
        minimumParseConfidence:
          typeof context.minimumParseConfidence === "number"
            ? context.minimumParseConfidence
            : undefined,
        missingCriticalFields: Array.isArray(context.missingCriticalFields)
          ? context.missingCriticalFields
          : [],
        conflictingFields: Array.isArray(context.conflictingFields)
          ? context.conflictingFields
          : [],
        confidence:
          typeof result.confidence === "number" ? result.confidence : undefined,
        citations: Array.isArray(result.citations) ? result.citations : [],
        trace:
          result.trace && typeof result.trace === "object"
            ? result.trace
            : { steps: [], artifacts: [] },
        canonicalFields:
          result.canonicalFields && typeof result.canonicalFields === "object"
            ? result.canonicalFields
            : {},
        fieldMetadata:
          result.fieldMetadata && typeof result.fieldMetadata === "object"
            ? result.fieldMetadata
            : {},
        mergeProvenance:
          result.mergeProvenance && typeof result.mergeProvenance === "object"
            ? result.mergeProvenance
            : {},
        conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
        requestedAt: job.requestedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      };
    });
}

async function loadListingAgentsForProperty(ctx: any, propertyId: Id<"properties">) {
  const links = await ctx.db
    .query("propertyAgentLinks")
    .withIndex("by_propertyId", (q: any) => q.eq("propertyId", propertyId))
    .collect();

  const agents: Array<any> = [];
  for (const link of links) {
    const agent = await ctx.db.get(link.agentId);
    if (!agent) continue;
    agents.push({
      ...agent,
      linkRole: link.role,
      linkSource: link.source,
      linkedAt: link.capturedAt,
    });
  }

  agents.sort((a, b) => (b.linkedAt ?? "").localeCompare(a.linkedAt ?? ""));
  return agents;
}

async function loadNeighborhoodContextsForProperty(ctx: any, property: any) {
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

  const rows: Array<any> = [];
  for (const request of requests) {
    const row = await ctx.db
      .query("neighborhoodMarketContext")
      .withIndex("by_geoKind_and_geoKey_and_windowDays", (q: any) =>
        q
          .eq("geoKind", request.geoKind)
          .eq("geoKey", request.geoKey)
          .eq("windowDays", request.windowDays),
      )
      .unique();
    if (row) rows.push(row);
  }
  return rows;
}

async function loadLatestPortalEstimates(ctx: any, propertyId: Id<"properties">) {
  const rows = await ctx.db
    .query("portalEstimates")
    .withIndex("by_propertyId_and_capturedAt", (q: any) =>
      q.eq("propertyId", propertyId),
    )
    .order("desc")
    .collect();

  const latestByPortal = new Map<string, any>();
  for (const row of rows) {
    if (!latestByPortal.has(row.portal)) {
      latestByPortal.set(row.portal, row);
    }
  }

  return Array.from(latestByPortal.values());
}

async function buildEnrichmentPayload(ctx: any, propertyId: Id<"properties">) {
  const property = await ctx.db.get(propertyId);
  if (!property) return null;

  const jobs = await ctx.db
    .query("enrichmentJobs")
    .withIndex("by_propertyId_and_source", (q: any) => q.eq("propertyId", propertyId))
    .collect();
  const snapshots = await ctx.db
    .query("propertyEnrichmentSnapshots")
    .withIndex("by_propertyId_and_source", (q: any) => q.eq("propertyId", propertyId))
    .collect();
  const listingAgents = await loadListingAgentsForProperty(ctx, propertyId);
  const neighborhoodContexts = await loadNeighborhoodContextsForProperty(ctx, property);
  const portalEstimates = await loadLatestPortalEstimates(ctx, propertyId);
  const recentSales = await ctx.db
    .query("recentComparableSales")
    .withIndex("by_propertyId_and_soldDate", (q: any) => q.eq("propertyId", propertyId))
    .order("desc")
    .collect();
  const marketContext = buildPropertyMarketContext({
    baselines: neighborhoodContexts,
    subject: {
      propertyId,
      buildingName: property.buildingName,
      subdivision: property.subdivision,
      neighborhood: property.neighborhood,
      schoolDistrict: property.schoolDistrict,
      zip: property.zip ?? property.address?.zip,
      broaderArea: property.address?.city,
    },
    generatedAt:
      neighborhoodContexts
        .map((context: any) => context.lastRefreshedAt)
        .sort()
        .at(-1) ??
      property.updatedAt ??
      property.createdAt ??
      "",
  });
  const browserUseRuns = loadBrowserUseRuns(jobs);

  return {
    summary: summarizeJobs(jobs),
    snapshots,
    listingAgents,
    marketContext,
    neighborhoodContexts,
    portalEstimates,
    recentSales,
    browserUseRuns,
    engineInputs: {
      marketContext,
      pricing: buildPricingInputFromEnrichment({
        property,
        estimates: portalEstimates,
        marketContext,
        contexts: neighborhoodContexts,
        recentSales,
      }),
      leverage: buildLeverageInputFromEnrichment({
        property,
        marketContext,
        contexts: neighborhoodContexts,
        listingAgent: listingAgents.find((agent) => agent.linkRole === "listing") ?? null,
        recentSales,
      }),
      compsCandidates: buildCompCandidatesFromRecentSales(recentSales),
    },
  };
}

function toBuyerSafeAgent(agent: any, includeContact: boolean) {
  return {
    canonicalAgentId: agent.canonicalAgentId,
    name: agent.name,
    brokerage: agent.brokerage,
    zillowProfileUrl: agent.zillowProfileUrl,
    redfinProfileUrl: agent.redfinProfileUrl,
    realtorProfileUrl: agent.realtorProfileUrl,
    activeListings: agent.activeListings,
    soldCount: agent.soldCount,
    avgDaysOnMarket: agent.avgDaysOnMarket,
    medianListToSellRatio: agent.medianListToSellRatio,
    priceCutFrequency: agent.priceCutFrequency,
    recentActivityCount: agent.recentActivityCount,
    provenance: agent.provenance,
    lastRefreshedAt: agent.lastRefreshedAt,
    phone: includeContact ? agent.phone : undefined,
    email: includeContact ? agent.email : undefined,
  };
}

export const getForPropertyInternal = internalQuery({
  args: { propertyId: v.id("properties") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await buildEnrichmentPayload(ctx, args.propertyId);
  },
});

export const getForProperty = query({
  args: {
    propertyId: v.id("properties"),
    includeInternal: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const payload = await buildEnrichmentPayload(ctx, args.propertyId);
    if (!payload) return null;

    return {
      summary: payload.summary,
      marketContext: payload.marketContext,
      neighborhoodContexts: payload.neighborhoodContexts,
      portalEstimates: payload.portalEstimates,
      recentSales: payload.recentSales,
      listingAgents: payload.listingAgents.map((agent: any) =>
        toBuyerSafeAgent(agent, args.includeInternal ?? false),
      ),
      browserUseRuns: args.includeInternal ? payload.browserUseRuns : undefined,
      snapshots: args.includeInternal ? payload.snapshots : undefined,
      engineInputs: args.includeInternal ? payload.engineInputs : undefined,
    };
  },
});

export const enqueueScheduledRefreshes = internalMutation({
  args: {
    propertyIds: v.optional(v.array(v.id("properties"))),
    limit: v.optional(v.number()),
    forceRefresh: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      propertyId: v.id("properties"),
      jobCount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 25;
    let propertyIds = args.propertyIds ?? [];

    if (propertyIds.length === 0) {
      const statuses = ["active", "pending", "contingent"] as const;
      const collected: Array<Id<"properties">> = [];
      for (const status of statuses) {
        const rows = await ctx.db
          .query("properties")
          .withIndex("by_status", (q: any) => q.eq("status", status))
          .take(limit);
        for (const row of rows) {
          if (collected.length >= limit) break;
          collected.push(row._id);
        }
        if (collected.length >= limit) break;
      }
      propertyIds = collected;
    }

    const results: Array<{ propertyId: Id<"properties">; jobCount: number }> = [];
    for (const propertyId of propertyIds.slice(0, limit)) {
      const jobIds: Array<Id<"enrichmentJobs">> = await ctx.runMutation(
        internal.enrichmentJobs.enqueueAllSourcesForProperty,
        {
          propertyId,
          forceRefresh: args.forceRefresh,
        },
      );
      results.push({
        propertyId,
        jobCount: jobIds.length,
      });
    }

    return results;
  },
});
