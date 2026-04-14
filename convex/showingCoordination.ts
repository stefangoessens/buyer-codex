/**
 * Showing coordination workspace — Convex module (KIN-803).
 *
 * Backend queries + mutations for the internal ops workspace that
 * triages and advances tour requests. Consumes the tourRequests table
 * from KIN-802 and adds:
 *   - Queue views with filters (by status, agent, age, prerequisite
 *     failures) and stale detection
 *   - Bucket composition (incoming / blocked / assigned / confirmed /
 *     stale) for the canonical ops surface
 *   - Internal coordinator notes mutations (hidden from buyers)
 *
 * The pure filter logic lives in `src/lib/tours/coordinationFilters.ts`.
 * This module owns the Convex data joins and delegates the deterministic
 * queue logic to that shared layer.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import type { Doc } from "./_generated/dataModel";
import {
  ACTIVE_STATUSES,
  applyCoordinationFilters,
  bucketizeQueue,
  detectPrerequisiteFailures,
  isStale,
  sortByCoordinationPriority,
  type CoordinationTourRequest,
} from "../src/lib/tours/coordinationFilters";
import { loadCurrentAgreementSnapshot } from "./lib/tourWorkflow";

type TourRequest = Doc<"tourRequests">;

function normalizeSearchText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function formatPropertyAddress(property: Doc<"properties"> | null): string {
  if (!property) return "Unknown property";
  if (property.address.formatted) return property.address.formatted;
  const street = `${property.address.street}${
    property.address.unit ? ` ${property.address.unit}` : ""
  }`;
  return `${street}, ${property.address.city}, ${property.address.state} ${property.address.zip}`;
}

function matchesGeographyQuery(
  property: Doc<"properties"> | null,
  geographyQuery: string | undefined,
): boolean {
  const normalized = normalizeSearchText(geographyQuery);
  if (normalized.length === 0) return true;
  if (!property) return false;

  return [
    property.address.city,
    property.address.county,
    property.address.zip,
    property.address.state,
    property.address.formatted,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => normalizeSearchText(value).includes(normalized));
}

// ═══ Auth helper ═══

async function requireInternalUser(
  ctx: { auth: unknown; db: unknown } & Parameters<typeof requireAuth>[0],
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "broker" && user.role !== "admin") {
    throw new Error("Showing coordination is internal — broker/admin only");
  }
  return user;
}

interface WorkspaceFilterArgs {
  statuses?: TourRequest["status"][];
  agentId?: TourRequest["agentId"];
  unassignedOnly?: boolean;
  assignedOnly?: boolean;
  minAgeHours?: number;
  maxAgeHours?: number;
  hasPrerequisiteFailure?: boolean;
  staleOnly?: boolean;
  geographyQuery?: string;
  limit?: number;
}

function toCoordinationRequest(
  request: TourRequest,
  liveAgreement = request.agreementStateSnapshot,
): CoordinationTourRequest {
  return {
    _id: request._id as unknown as string,
    dealRoomId: request.dealRoomId as unknown as string,
    propertyId: request.propertyId as unknown as string,
    buyerId: request.buyerId as unknown as string,
    agentId: request.agentId as unknown as string | undefined,
    status: request.status,
    submittedAt: request.submittedAt,
    assignedAt: request.assignedAt,
    updatedAt: request.updatedAt,
    createdAt: request.createdAt,
    blockingReason: request.blockingReason,
    agreementStateSnapshot: {
      type: liveAgreement.type,
      status: liveAgreement.status,
    },
  };
}

async function filterRequestsForWorkspace(
  ctx: { db: { query: (table: "tourRequests") => any; get: (id: unknown) => Promise<unknown> } },
  args: WorkspaceFilterArgs,
): Promise<TourRequest[]> {
  const all = (await ctx.db.query("tourRequests").collect()) as TourRequest[];
  const nowIso = new Date().toISOString();

  const liveAgreementCache = new Map<
    string,
    Awaited<ReturnType<typeof loadCurrentAgreementSnapshot>>
  >();
  const getLiveFor = async (buyerId: TourRequest["buyerId"]) => {
    const key = buyerId as unknown as string;
    if (!liveAgreementCache.has(key)) {
      liveAgreementCache.set(
        key,
        await loadCurrentAgreementSnapshot(ctx as never, buyerId),
      );
    }
    return liveAgreementCache.get(key)!;
  };

  const materialized = await Promise.all(
    all.map(async (request) =>
      toCoordinationRequest(request, await getLiveFor(request.buyerId)),
    ),
  );

  let filtered = applyCoordinationFilters(materialized, args, nowIso);
  if (args.staleOnly) {
    filtered = filtered.filter((request) => isStale(request, nowIso));
  }

  const keptIds = new Set(filtered.map((request) => request._id));
  const matching: TourRequest[] = [];
  for (const request of all) {
    if (!keptIds.has(request._id as unknown as string)) continue;
    if (args.geographyQuery) {
      const property = (await ctx.db.get(request.propertyId)) as Doc<"properties"> | null;
      if (!matchesGeographyQuery(property, args.geographyQuery)) continue;
    }
    matching.push(request);
  }

  const sorted = sortByCoordinationPriority(
    matching.map((request) => toCoordinationRequest(request)),
    nowIso,
  );
  const sortedIds = new Map(
    sorted.map((request, index) => [request._id, index]),
  );

  matching.sort((left, right) => {
    return (
      (sortedIds.get(left._id as unknown as string) ?? 0) -
      (sortedIds.get(right._id as unknown as string) ?? 0)
    );
  });

  return matching.slice(0, args.limit ?? 100);
}

// ═══ Queries ═══

/**
 * Bucketize the active queue into incoming / blocked / assigned /
 * confirmed / stale for the ops workspace. Broker/admin only.
 */
export const getQueueBuckets = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    await requireInternalUser(ctx);

    const nowIso = new Date().toISOString();
    const all = (await ctx.db.query("tourRequests").collect()) as TourRequest[];
    const buckets = bucketizeQueue(
      all.map((request) => toCoordinationRequest(request)),
      nowIso,
    );

    return {
      ...buckets,
      generatedAt: nowIso,
    };
  },
});

/**
 * List requests with filters. Used by the detail search view where
 * ops can query across all statuses, agents, ages, and prereq states.
 */
export const listFiltered = query({
  args: {
    statuses: v.optional(
      v.array(
        v.union(
          v.literal("draft"),
          v.literal("submitted"),
          v.literal("blocked"),
          v.literal("assigned"),
          v.literal("confirmed"),
          v.literal("completed"),
          v.literal("canceled"),
          v.literal("failed"),
        ),
      ),
    ),
    agentId: v.optional(v.id("users")),
    unassignedOnly: v.optional(v.boolean()),
    assignedOnly: v.optional(v.boolean()),
    minAgeHours: v.optional(v.number()),
    maxAgeHours: v.optional(v.number()),
    hasPrerequisiteFailure: v.optional(v.boolean()),
    staleOnly: v.optional(v.boolean()),
    geographyQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireInternalUser(ctx);
    return await filterRequestsForWorkspace(ctx as never, args);
  },
});

/**
 * Enriched showing-coordination workspace rows. Builds on the same
 * backend filters as `listFiltered` but joins the request with buyer,
 * property, assignment, and latest-note context so the admin UI can
 * render one typed workspace without client-side fan-out queries.
 */
export const listWorkspace = query({
  args: {
    statuses: v.optional(
      v.array(
        v.union(
          v.literal("draft"),
          v.literal("submitted"),
          v.literal("blocked"),
          v.literal("assigned"),
          v.literal("confirmed"),
          v.literal("completed"),
          v.literal("canceled"),
          v.literal("failed"),
        ),
      ),
    ),
    agentId: v.optional(v.id("users")),
    unassignedOnly: v.optional(v.boolean()),
    assignedOnly: v.optional(v.boolean()),
    minAgeHours: v.optional(v.number()),
    maxAgeHours: v.optional(v.number()),
    hasPrerequisiteFailure: v.optional(v.boolean()),
    staleOnly: v.optional(v.boolean()),
    geographyQuery: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    rows: v.array(v.any()),
    generatedAt: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireInternalUser(ctx);
    const filtered = await filterRequestsForWorkspace(ctx as never, args);
    const allNotes = await ctx.db.query("showingCoordinatorNotes").collect();
    const latestNoteByRequest = new Map<string, Doc<"showingCoordinatorNotes">>();
    for (const note of allNotes) {
      const key = note.tourRequestId as unknown as string;
      const existing = latestNoteByRequest.get(key);
      if (!existing || note.createdAt > existing.createdAt) {
        latestNoteByRequest.set(key, note);
      }
    }

    const propertyCache = new Map<string, Doc<"properties"> | null>();
    const userCache = new Map<string, Doc<"users"> | null>();
    const assignmentCache = new Map<string, Doc<"tourAssignments"> | null>();

    const loadProperty = async (propertyId: TourRequest["propertyId"]) => {
      const key = propertyId as unknown as string;
      if (!propertyCache.has(key)) {
        propertyCache.set(
          key,
          ((await ctx.db.get(propertyId)) as Doc<"properties"> | null) ?? null,
        );
      }
      return propertyCache.get(key) ?? null;
    };

    const loadUser = async (
      userId: TourRequest["buyerId"] | TourRequest["agentId"] | Doc<"showingCoordinatorNotes">["authorId"],
    ) => {
      if (!userId) return null;
      const key = userId as unknown as string;
      if (!userCache.has(key)) {
        userCache.set(key, ((await ctx.db.get(userId)) as Doc<"users"> | null) ?? null);
      }
      return userCache.get(key) ?? null;
    };

    const loadAssignment = async (assignmentId: TourRequest["currentAssignmentId"]) => {
      if (!assignmentId) return null;
      const key = assignmentId as unknown as string;
      if (!assignmentCache.has(key)) {
        assignmentCache.set(
          key,
          ((await ctx.db.get(assignmentId)) as Doc<"tourAssignments"> | null) ??
            null,
        );
      }
      return assignmentCache.get(key) ?? null;
    };

    const nowIso = new Date().toISOString();
    const nowMs = Date.parse(nowIso);
    const rows = await Promise.all(
      filtered.map(async (request) => {
        const property = await loadProperty(request.propertyId);
        const buyer = await loadUser(request.buyerId);
        const assignedAgent = await loadUser(request.agentId);
        const assignment = await loadAssignment(request.currentAssignmentId);
        const latestNote = latestNoteByRequest.get(request._id as unknown as string);
        const latestNoteAuthor = latestNote
          ? await loadUser(latestNote.authorId)
          : null;
        const liveAgreement = await loadCurrentAgreementSnapshot(
          ctx as never,
          request.buyerId,
        );
        const coordinationRequest = toCoordinationRequest(request, liveAgreement);
        const failures = detectPrerequisiteFailures(
          coordinationRequest,
          nowIso,
          liveAgreement,
        );
        const createdMs = Date.parse(request.createdAt);
        const ageHours =
          Number.isNaN(createdMs) || Number.isNaN(nowMs)
            ? null
            : Math.max(0, Math.floor((nowMs - createdMs) / (60 * 60 * 1000)));

        return {
          requestId: request._id,
          dealRoomId: request.dealRoomId,
          propertyId: request.propertyId,
          buyerId: request.buyerId,
          agentId: request.agentId ?? null,
          currentAssignmentId: request.currentAssignmentId ?? null,
          currentAssignmentStatus: assignment?.status ?? null,
          assignmentRoutingPath:
            assignment?.routingPath ?? request.assignmentRoutingPath ?? null,
          propertyAddress: formatPropertyAddress(property),
          geography: property
            ? {
                city: property.address.city,
                county: property.address.county ?? null,
                state: property.address.state,
                zip: property.address.zip,
              }
            : null,
          buyerName: buyer?.name ?? "Unknown buyer",
          assignedAgentName: assignedAgent?.name ?? null,
          status: request.status,
          blockingReason: request.blockingReason ?? null,
          failureReason: request.failureReason ?? null,
          preferredWindows: request.preferredWindows,
          attendeeCount: request.attendeeCount,
          buyerNotes: request.buyerNotes ?? null,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          submittedAt: request.submittedAt ?? null,
          assignedAt: request.assignedAt ?? null,
          confirmedAt: request.confirmedAt ?? null,
          ageHours,
          isStale: isStale(coordinationRequest, nowIso),
          prerequisiteFailures: failures,
          latestCoordinatorNote: latestNote
            ? {
                body: latestNote.body,
                category: latestNote.category,
                createdAt: latestNote.createdAt,
                authorName: latestNoteAuthor?.name ?? "Unknown user",
              }
            : null,
        };
      }),
    );

    return {
      rows,
      generatedAt: nowIso,
    };
  },
});

export const listAssignableAgents = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireInternalUser(ctx);

    const coverages = await ctx.db
      .query("agentCoverage")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const seen = new Set<string>();
    const options = [];
    for (const coverage of coverages) {
      const key = coverage.agentId as unknown as string;
      if (seen.has(key)) continue;
      seen.add(key);

      const user = (await ctx.db.get(coverage.agentId)) as Doc<"users"> | null;
      if (!user) continue;

      options.push({
        agentId: coverage.agentId,
        name: user.name,
        brokerage: coverage.brokerage,
        geographyCount: coverage.coverageAreas.length,
      });
    }

    return options.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single request with its prerequisite failure analysis.
 * Used by the detail view so ops can see what's wrong in one query.
 */
export const getWithPrereqAnalysis = query({
  args: { requestId: v.id("tourRequests") },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireInternalUser(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request) return null;

    const nowIso = new Date().toISOString();
    // Load the live agreement state so the prereq analysis reflects
    // the current agreement, not just the frozen submission snapshot.
    const liveAgreement = await loadCurrentAgreementSnapshot(
      ctx as never,
      request.buyerId,
    );
    const coordinationRequest = toCoordinationRequest(request, liveAgreement);
    return {
      request,
      liveAgreement,
      prerequisiteFailures: detectPrerequisiteFailures(
        coordinationRequest,
        nowIso,
        liveAgreement,
      ),
      isStale: isStale(coordinationRequest, nowIso),
      analyzedAt: nowIso,
    };
  },
});

/**
 * List all coordinator notes for a tour request, newest first.
 * Broker/admin only — these are internal-only notes.
 */
export const listCoordinatorNotes = query({
  args: { requestId: v.id("tourRequests") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireInternalUser(ctx);

    const notes = await ctx.db
      .query("showingCoordinatorNotes")
      .withIndex("by_tourRequestId", (q) => q.eq("tourRequestId", args.requestId))
      .collect();

    return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

// ═══ Mutations ═══

/**
 * Add a coordinator note to a tour request. Notes are internal-only and
 * never surfaced to buyers. Used to capture broker triage context and
 * hand-offs between coordinators.
 */
export const addCoordinatorNote = mutation({
  args: {
    tourRequestId: v.id("tourRequests"),
    body: v.string(),
    category: v.optional(
      v.union(
        v.literal("triage"),
        v.literal("coverage"),
        v.literal("handoff"),
        v.literal("escalation"),
        v.literal("other"),
      ),
    ),
  },
  returns: v.id("showingCoordinatorNotes"),
  handler: async (ctx, args) => {
    const user = await requireInternalUser(ctx);

    const request = await ctx.db.get(args.tourRequestId);
    if (!request) throw new Error("Tour request not found");

    const body = args.body.trim();
    if (body.length === 0) {
      throw new Error("Coordinator note body cannot be empty");
    }
    if (body.length > 4000) {
      throw new Error("Coordinator note must be ≤4000 characters");
    }

    const now = new Date().toISOString();
    const id = await ctx.db.insert("showingCoordinatorNotes", {
      tourRequestId: args.tourRequestId,
      dealRoomId: request.dealRoomId,
      authorId: user._id,
      authorRole: user.role,
      category: args.category ?? "other",
      body,
      createdAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "showing_coordinator_note_added",
      entityType: "showingCoordinatorNotes",
      entityId: id,
      details: JSON.stringify({
        tourRequestId: args.tourRequestId,
        category: args.category ?? "other",
      }),
      timestamp: now,
    });

    return id;
  },
});

/**
 * Bulk-escalate a set of stale/blocked requests. Broker/admin only.
 * Records each escalation as an auditLog row and (optionally) adds a
 * coordinator note summarizing the reason.
 */
export const escalateBatch = mutation({
  args: {
    requestIds: v.array(v.id("tourRequests")),
    escalationReason: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await requireInternalUser(ctx);

    if (args.requestIds.length === 0) return 0;
    if (args.requestIds.length > 100) {
      throw new Error("Batch size limited to 100 requests");
    }

    const now = new Date().toISOString();
    let escalated = 0;
    for (const requestId of args.requestIds) {
      const request = await ctx.db.get(requestId);
      if (!request) continue;

      // Only escalate active requests
      if (!ACTIVE_STATUSES.includes(request.status)) continue;

      await ctx.db.insert("showingCoordinatorNotes", {
        tourRequestId: requestId,
        dealRoomId: request.dealRoomId,
        authorId: user._id,
        authorRole: user.role,
        category: "escalation",
        body: `Escalated: ${args.escalationReason}`,
        createdAt: now,
      });

      await ctx.db.insert("auditLog", {
        userId: user._id,
        action: "showing_request_escalated",
        entityType: "tourRequests",
        entityId: requestId,
        details: JSON.stringify({ reason: args.escalationReason }),
        timestamp: now,
      });

      escalated++;
    }

    return escalated;
  },
});
