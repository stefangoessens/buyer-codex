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
 * The pure filter logic is in `src/lib/tours/coordinationFilters.ts` —
 * this module mirrors the essential helpers inline to keep Convex
 * self-contained.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import type { Doc } from "./_generated/dataModel";

// ═══ Inline filter helpers (mirror src/lib/tours/coordinationFilters.ts) ═══

type TourRequest = Doc<"tourRequests">;

const STALE_THRESHOLDS_HOURS = {
  submitted: 24,
  blocked: 48,
  assigned: 12,
};

function isStaleInternal(request: TourRequest, nowIso: string): boolean {
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(nowMs)) return false;
  const threshold = (h: number) => h * 60 * 60 * 1000;

  if (request.status === "submitted") {
    const refMs = Date.parse(request.submittedAt ?? request.createdAt);
    if (Number.isNaN(refMs)) return false;
    return nowMs - refMs > threshold(STALE_THRESHOLDS_HOURS.submitted);
  }
  if (request.status === "blocked") {
    // Anchor to updatedAt (written by markBlocked) so a long-submitted
    // request that was only recently blocked gets a fresh 48h window.
    const anchor =
      request.updatedAt ?? request.submittedAt ?? request.createdAt;
    const refMs = Date.parse(anchor);
    if (Number.isNaN(refMs)) return false;
    return nowMs - refMs > threshold(STALE_THRESHOLDS_HOURS.blocked);
  }
  if (request.status === "assigned") {
    const refMs = Date.parse(request.assignedAt ?? request.createdAt);
    if (Number.isNaN(refMs)) return false;
    return nowMs - refMs > threshold(STALE_THRESHOLDS_HOURS.assigned);
  }
  return false;
}

/**
 * Load the live agreement state for a buyer — the authoritative
 * current status (signed, canceled, replaced, etc.) derived from the
 * `agreements` table. Used by the prereq detector to catch agreements
 * that were canceled or replaced AFTER the tour request was submitted.
 */
async function loadLiveAgreementState(
  ctx: { db: { query: (t: "agreements") => unknown } } & { db: { query: typeof import("./_generated/server").query extends never ? never : (t: "agreements") => unknown } },
  buyerId: TourRequest["buyerId"],
): Promise<{
  type: "none" | "tour_pass" | "full_representation";
  status: "none" | "draft" | "sent" | "signed" | "replaced" | "canceled";
}> {
  type AgreementLike = {
    type: "tour_pass" | "full_representation" | "none";
    status: "draft" | "sent" | "signed" | "replaced" | "canceled" | "none";
    signedAt?: string;
  };

  const db = (ctx as { db: { query: (table: "agreements") => any } }).db;
  const agreements = await db
    .query("agreements")
    .withIndex("by_buyerId", (q: { eq: (field: string, value: unknown) => unknown }) =>
      q.eq("buyerId", buyerId),
    )
    .collect() as AgreementLike[];

  // Prefer full_representation over tour_pass (stronger grant)
  const signedFullRep = agreements
    .filter((a) => a.type === "full_representation" && a.status === "signed")
    .sort((a, b) => (b.signedAt ?? "").localeCompare(a.signedAt ?? ""))
    .at(0);
  if (signedFullRep) return { type: "full_representation", status: "signed" };

  const signedTourPass = agreements
    .filter((a) => a.type === "tour_pass" && a.status === "signed")
    .sort((a, b) => (b.signedAt ?? "").localeCompare(a.signedAt ?? ""))
    .at(0);
  if (signedTourPass) return { type: "tour_pass", status: "signed" };

  return { type: "none", status: "none" };
}

function detectPrereqFailuresInternal(
  request: TourRequest,
  nowIso: string,
  liveAgreement?: {
    type: "none" | "tour_pass" | "full_representation";
    status: "none" | "draft" | "sent" | "signed" | "replaced" | "canceled";
  },
): string[] {
  const failures: string[] = [];
  // Prefer live agreement state over the frozen snapshot.
  const effectiveAgreement = liveAgreement ?? request.agreementStateSnapshot;
  if (
    (effectiveAgreement.type !== "tour_pass" &&
      effectiveAgreement.type !== "full_representation") ||
    effectiveAgreement.status !== "signed"
  ) {
    failures.push("missing_agreement");
  }
  if (
    request.status === "submitted" &&
    !request.agentId &&
    isStaleInternal(request, nowIso)
  ) {
    failures.push("no_agent_coverage");
  }
  if (request.status === "submitted" && isStaleInternal(request, nowIso)) {
    failures.push("stale_submission");
  }
  if (request.status === "blocked" && isStaleInternal(request, nowIso)) {
    failures.push("stale_blocked");
  }
  if (request.status === "assigned" && isStaleInternal(request, nowIso)) {
    failures.push("stale_assigned");
  }
  return failures;
}

const ACTIVE_STATUSES: Array<TourRequest["status"]> = [
  "submitted",
  "blocked",
  "assigned",
  "confirmed",
];

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

async function filterRequestsForWorkspace(
  ctx: { db: { query: (table: "tourRequests") => any; get: (id: unknown) => Promise<unknown> } },
  args: WorkspaceFilterArgs,
): Promise<TourRequest[]> {
  const all = (await ctx.db.query("tourRequests").collect()) as TourRequest[];
  const nowIso = new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  const statusSet =
    args.statuses && args.statuses.length > 0
      ? new Set(args.statuses)
      : new Set(ACTIVE_STATUSES);

  const liveAgreementCache = new Map<
    string,
    Awaited<ReturnType<typeof loadLiveAgreementState>>
  >();
  const getLiveFor = async (buyerId: TourRequest["buyerId"]) => {
    const key = buyerId as unknown as string;
    if (!liveAgreementCache.has(key)) {
      liveAgreementCache.set(key, await loadLiveAgreementState(ctx as never, buyerId));
    }
    return liveAgreementCache.get(key)!;
  };

  const filtered: TourRequest[] = [];
  for (const r of all) {
    if (!statusSet.has(r.status)) continue;
    if (args.unassignedOnly && r.agentId) continue;
    if (args.assignedOnly && !r.agentId) continue;
    if (args.agentId && r.agentId !== args.agentId) continue;
    if (args.staleOnly && !isStaleInternal(r, nowIso)) continue;

    if (typeof args.minAgeHours === "number") {
      const createdMs = Date.parse(r.createdAt);
      if (Number.isNaN(createdMs)) continue;
      if (nowMs - createdMs < args.minAgeHours * 60 * 60 * 1000) continue;
    }
    if (typeof args.maxAgeHours === "number") {
      const createdMs = Date.parse(r.createdAt);
      if (Number.isNaN(createdMs)) continue;
      if (nowMs - createdMs > args.maxAgeHours * 60 * 60 * 1000) continue;
    }

    if (args.hasPrerequisiteFailure) {
      const live = await getLiveFor(r.buyerId);
      const failures = detectPrereqFailuresInternal(r, nowIso, live);
      if (failures.length === 0) continue;
    }

    if (args.geographyQuery) {
      const property = (await ctx.db.get(r.propertyId)) as Doc<"properties"> | null;
      if (!matchesGeographyQuery(property, args.geographyQuery)) continue;
    }

    filtered.push(r);
  }

  filtered.sort((a, b) => {
    const aStale = isStaleInternal(a, nowIso) ? 1 : 0;
    const bStale = isStaleInternal(b, nowIso) ? 1 : 0;
    if (aStale !== bStale) return bStale - aStale;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return filtered.slice(0, args.limit ?? 100);
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

    // Fetch all non-terminal tour requests. In production this could be
    // paginated or bounded by a date window; for now we expect the
    // active queue to stay small (< a few hundred rows).
    const all = await ctx.db.query("tourRequests").collect();
    const active = all.filter((r) => ACTIVE_STATUSES.includes(r.status));

    const nowIso = new Date().toISOString();
    const incoming: TourRequest[] = [];
    const blocked: TourRequest[] = [];
    const assigned: TourRequest[] = [];
    const confirmed: TourRequest[] = [];
    const stale: TourRequest[] = [];

    for (const r of active) {
      if (isStaleInternal(r, nowIso)) stale.push(r);

      if (r.status === "submitted" && !r.agentId) {
        incoming.push(r);
      } else if (r.status === "blocked") {
        blocked.push(r);
      } else if (r.status === "assigned") {
        assigned.push(r);
      } else if (r.status === "confirmed") {
        confirmed.push(r);
      }
    }

    return {
      incoming,
      blocked,
      assigned,
      confirmed,
      stale,
      totalActive:
        incoming.length + blocked.length + assigned.length + confirmed.length,
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
        const liveAgreement = await loadLiveAgreementState(ctx, request.buyerId);
        const failures = detectPrereqFailuresInternal(request, nowIso, liveAgreement);
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
          isStale: isStaleInternal(request, nowIso),
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
    const liveAgreement = await loadLiveAgreementState(ctx, request.buyerId);
    return {
      request,
      liveAgreement,
      prerequisiteFailures: detectPrereqFailuresInternal(
        request,
        nowIso,
        liveAgreement,
      ),
      isStale: isStaleInternal(request, nowIso),
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
