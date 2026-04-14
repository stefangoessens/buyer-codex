import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireRole } from "./lib/session";
import { assignmentStatus } from "./lib/validators";
import {
  filterCoverageRegistry,
  selectRoutingDecision,
  type AgentCoverageRecord,
  type AvailabilityWindowRecord,
  type PreferredWindow,
} from "./lib/assignmentRouting";
import {
  assertTourAssignmentTransition,
  createAssignmentRecord,
  serializeDetails,
  syncCanonicalStateFromAssignment,
} from "./lib/tourWorkflow";
import { createPayoutObligationCore } from "./showingPayouts";

const coverageAreaValidator = v.object({
  zip: v.string(),
  city: v.optional(v.string()),
  county: v.optional(v.string()),
});

const preferredWindowValidator = v.object({
  start: v.string(),
  end: v.string(),
});

function toCoverageRecord(doc: Doc<"agentCoverage">): AgentCoverageRecord {
  return {
    agentId: doc.agentId,
    coverageAreas: doc.coverageAreas,
    isActive: doc.isActive,
    fixedFeePerShowing: doc.fixedFeePerShowing,
  };
}

function toAvailabilityRecord(
  doc: Doc<"availabilityWindows">,
): AvailabilityWindowRecord {
  return {
    ownerId: doc.ownerId,
    status: doc.status,
    startAt: doc.startAt,
    endAt: doc.endAt,
  };
}

async function loadCoverageDocs(
  ctx: any,
  onlyActive?: boolean,
): Promise<Array<Doc<"agentCoverage">>> {
  if (onlyActive === true) {
    return await ctx.db
      .query("agentCoverage")
      .withIndex("by_isActive", (q: any) => q.eq("isActive", true))
      .collect();
  }

  return await ctx.db.query("agentCoverage").collect();
}

async function loadAgentAvailability(
  ctx: any,
  agentIds: Array<string>,
): Promise<Array<Doc<"availabilityWindows">>> {
  if (agentIds.length === 0) {
    return [];
  }

  const all = await ctx.db.query("availabilityWindows").collect();
  const allowed = new Set(agentIds);
  return all.filter(
    (window: Doc<"availabilityWindows">) =>
      window.ownerType === "agent" && allowed.has(window.ownerId),
  );
}

export const listActiveAgents = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      return [];
    }

    return await ctx.db
      .query("agentCoverage")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const listCoverageRegistry = query({
  args: {
    zip: v.optional(v.string()),
    city: v.optional(v.string()),
    county: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    availabilityStatus: v.optional(
      v.union(
        v.literal("available"),
        v.literal("tentative"),
        v.literal("unavailable"),
      ),
    ),
    preferredWindows: v.optional(v.array(preferredWindowValidator)),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      return [];
    }

    const coverages = await loadCoverageDocs(ctx, args.isActive);
    const availability = await loadAgentAvailability(
      ctx,
      coverages.map((coverage) => coverage.agentId),
    );

    const registry = filterCoverageRegistry(
      coverages.map(toCoverageRecord),
      availability.map(toAvailabilityRecord),
      {
        zip: args.zip,
        city: args.city,
        county: args.county,
      },
      args.preferredWindows ?? [],
      args.availabilityStatus,
    );

    const availabilityByAgent = new Map(
      registry.map((entry) => [entry.coverage.agentId, entry.availabilityState]),
    );

    return coverages
      .filter((coverage) => availabilityByAgent.has(coverage.agentId))
      .map((coverage) => ({
        ...coverage,
        availabilityState: availabilityByAgent.get(coverage.agentId),
      }));
  },
});

export const findAgentsForZip = query({
  args: {
    zip: v.string(),
    preferredWindows: v.optional(v.array(preferredWindowValidator)),
    availabilityStatus: v.optional(
      v.union(
        v.literal("available"),
        v.literal("tentative"),
        v.literal("unavailable"),
      ),
    ),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      return [];
    }

    const coverages = await loadCoverageDocs(ctx, true);
    const availability = await loadAgentAvailability(
      ctx,
      coverages.map((coverage) => coverage.agentId),
    );
    const registry = filterCoverageRegistry(
      coverages.map(toCoverageRecord),
      availability.map(toAvailabilityRecord),
      { zip: args.zip },
      args.preferredWindows ?? [],
      args.availabilityStatus,
    );
    return registry.map((entry) => ({
      ...coverages.find((coverage) => coverage.agentId === entry.coverage.agentId),
      availabilityState: entry.availabilityState,
    }));
  },
});

export const getAgentCoverage = query({
  args: { agentId: v.id("users") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      return null;
    }

    return await ctx.db
      .query("agentCoverage")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();
  },
});

export const getAssignmentsByTour = query({
  args: { tourId: v.id("tours") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) {
      return [];
    }

    const isOwner = tour.buyerId === user._id;
    const isStaff = user.role === "broker" || user.role === "admin";
    if (!isOwner && !isStaff) {
      return [];
    }

    return await ctx.db
      .query("tourAssignments")
      .withIndex("by_tourId", (q) => q.eq("tourId", args.tourId))
      .collect();
  },
});

export const getAssignmentsByRequest = query({
  args: { requestId: v.id("tourRequests") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      return [];
    }

    const isOwner = request.buyerId === user._id;
    const isStaff = user.role === "broker" || user.role === "admin";
    if (!isOwner && !isStaff) {
      return [];
    }

    return await ctx.db
      .query("tourAssignments")
      .withIndex("by_tourRequestId", (q) => q.eq("tourRequestId", args.requestId))
      .collect();
  },
});

export const getAssignmentsByAgent = query({
  args: {
    agentId: v.id("users"),
    status: v.optional(assignmentStatus),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("tourAssignments")
        .withIndex("by_agentId_and_status", (q) =>
          q.eq("agentId", args.agentId).eq("status", args.status!),
        )
        .collect();
    }

    return await ctx.db
      .query("tourAssignments")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

export const createCoverage = mutation({
  args: {
    agentId: v.id("users"),
    coverageAreas: v.array(coverageAreaValidator),
    isActive: v.boolean(),
    maxToursPerDay: v.optional(v.number()),
    fixedFeePerShowing: v.number(),
    brokerage: v.string(),
    brokerageId: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
  },
  returns: v.id("agentCoverage"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");

    const agentUser = await ctx.db.get(args.agentId);
    if (!agentUser) {
      throw new Error("Agent user not found");
    }

    const existing = await ctx.db
      .query("agentCoverage")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();
    if (existing) {
      throw new Error("Coverage record already exists for this agent");
    }

    const now = new Date().toISOString();
    const coverageId = await ctx.db.insert("agentCoverage", {
      agentId: args.agentId,
      coverageAreas: args.coverageAreas,
      isActive: args.isActive,
      maxToursPerDay: args.maxToursPerDay,
      fixedFeePerShowing: args.fixedFeePerShowing,
      brokerage: args.brokerage,
      brokerageId: args.brokerageId,
      licenseNumber: args.licenseNumber,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "agent_coverage_created",
      entityType: "agentCoverage",
      entityId: coverageId,
      details: serializeDetails({
        agentId: args.agentId,
        isActive: args.isActive,
        zipCount: args.coverageAreas.length,
      }),
      timestamp: now,
    });

    return coverageId;
  },
});

export const updateCoverage = mutation({
  args: {
    coverageId: v.id("agentCoverage"),
    coverageAreas: v.optional(v.array(coverageAreaValidator)),
    isActive: v.optional(v.boolean()),
    maxToursPerDay: v.optional(v.number()),
    fixedFeePerShowing: v.optional(v.number()),
    brokerage: v.optional(v.string()),
    brokerageId: v.optional(v.string()),
    licenseNumber: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const existing = await ctx.db.get(args.coverageId);
    if (!existing) {
      throw new Error("Coverage record not found");
    }

    const now = new Date().toISOString();
    const patch: Partial<Doc<"agentCoverage">> = { updatedAt: now };
    if (args.coverageAreas !== undefined) patch.coverageAreas = args.coverageAreas;
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.maxToursPerDay !== undefined) patch.maxToursPerDay = args.maxToursPerDay;
    if (args.fixedFeePerShowing !== undefined) {
      patch.fixedFeePerShowing = args.fixedFeePerShowing;
    }
    if (args.brokerage !== undefined) patch.brokerage = args.brokerage;
    if (args.brokerageId !== undefined) patch.brokerageId = args.brokerageId;
    if (args.licenseNumber !== undefined) patch.licenseNumber = args.licenseNumber;

    await ctx.db.patch(args.coverageId, patch);
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "agent_coverage_updated",
      entityType: "agentCoverage",
      entityId: args.coverageId,
      details: serializeDetails({
        changedFields: Object.keys(patch).filter((key) => key !== "updatedAt"),
      }),
      timestamp: now,
    });

    return null;
  },
});

export const setAgentActive = mutation({
  args: {
    agentId: v.id("users"),
    isActive: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const coverage = await ctx.db
      .query("agentCoverage")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();
    if (!coverage) {
      throw new Error("Coverage record not found");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(coverage._id, {
      isActive: args.isActive,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: args.isActive ? "agent_activated" : "agent_deactivated",
      entityType: "agentCoverage",
      entityId: coverage._id,
      details: serializeDetails({ agentId: args.agentId, isActive: args.isActive }),
      timestamp: now,
    });

    return null;
  },
});

export const routeTourRequest = mutation({
  args: {
    requestId: v.id("tourRequests"),
    preferredAgentId: v.optional(v.id("users")),
    showamiFallbackId: v.optional(v.string()),
    showamiAgentId: v.optional(v.id("users")),
    cooperatingBrokerage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("tourAssignments"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Tour request not found");
    }
    if (!["submitted", "blocked", "assigned"].includes(request.status)) {
      throw new Error(
        `Cannot route request in status "${request.status}"`,
      );
    }

    if (args.preferredAgentId) {
      const preferredAgent = await ctx.db.get(args.preferredAgentId);
      if (!preferredAgent) {
        throw new Error("Preferred agent not found");
      }
    }

    if (args.showamiAgentId) {
      const showamiAgent = await ctx.db.get(args.showamiAgentId);
      if (!showamiAgent) {
        throw new Error("Showami agent not found");
      }
    }

    const property = await ctx.db.get(request.propertyId);
    if (!property) {
      throw new Error("Tour property not found");
    }

    const coverages = await loadCoverageDocs(ctx, true);
    const availability = await loadAgentAvailability(
      ctx,
      coverages.map((coverage) => coverage.agentId),
    );

    const decision = selectRoutingDecision({
      coverages: coverages.map(toCoverageRecord),
      availabilityWindows: availability.map(toAvailabilityRecord),
      geography: {
        zip: property.address.zip,
        city: property.address.city,
        county: property.address.county,
      },
      preferredWindows: request.preferredWindows as PreferredWindow[],
      preferredAgentId: args.preferredAgentId,
      showamiEnabled: args.showamiFallbackId !== undefined,
    });

    const resolvedAgentId =
      decision.routingPath === "showami"
        ? args.showamiAgentId
        : (decision.agentId as Id<"users"> | undefined);

    return await createAssignmentRecord(ctx, user._id, request, {
      routingPath: decision.routingPath,
      agentId: resolvedAgentId,
      notes: args.notes,
      showamiFallbackId:
        decision.routingPath === "showami" ? args.showamiFallbackId : undefined,
      routingReason: decision.reason,
      cooperatingBrokerage: args.cooperatingBrokerage,
    });
  },
});

export const recordAssignmentFromShowami = mutation({
  args: {
    requestId: v.id("tourRequests"),
    showamiFallbackId: v.string(),
    agentId: v.optional(v.id("users")),
    cooperatingBrokerage: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("tourAssignments"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Tour request not found");
    }

    if (args.agentId) {
      const agent = await ctx.db.get(args.agentId);
      if (!agent) {
        throw new Error("Showami agent not found");
      }
    }

    return await createAssignmentRecord(ctx, user._id, request, {
      routingPath: "showami",
      agentId: args.agentId,
      showamiFallbackId: args.showamiFallbackId,
      notes: args.notes,
      routingReason: "showami_fallback",
      cooperatingBrokerage: args.cooperatingBrokerage,
    });
  },
});

export const recordManualAssignment = mutation({
  args: {
    requestId: v.id("tourRequests"),
    agentId: v.optional(v.id("users")),
    notes: v.optional(v.string()),
  },
  returns: v.id("tourAssignments"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("Tour request not found");
    }

    if (args.agentId) {
      const agent = await ctx.db.get(args.agentId);
      if (!agent) {
        throw new Error("Agent not found");
      }
    }

    return await createAssignmentRecord(ctx, user._id, request, {
      routingPath: "manual",
      agentId: args.agentId,
      notes: args.notes,
      routingReason:
        args.agentId !== undefined ? "preferred_agent" : "manual_queue",
    });
  },
});

export const updateAssignmentStatus = mutation({
  args: {
    assignmentId: v.id("tourAssignments"),
    newStatus: assignmentStatus,
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    assertTourAssignmentTransition(assignment.status, args.newStatus);

    if (
      ["confirmed", "in_progress", "completed"].includes(args.newStatus) &&
      assignment.agentId === undefined
    ) {
      throw new Error(
        "An agent must be attached before confirming or completing an assignment",
      );
    }

    const now = new Date().toISOString();
    const patch: Partial<Doc<"tourAssignments">> = {
      status: args.newStatus,
      lastSyncedAt: now,
    };
    if (args.newStatus === "completed") {
      patch.completedAt = now;
    }
    if (args.newStatus === "canceled") {
      patch.canceledAt = now;
      patch.cancelReason = args.reason;
    }

    await ctx.db.patch(args.assignmentId, patch);
    await syncCanonicalStateFromAssignment(
      ctx,
      { ...assignment, ...patch },
      args.newStatus,
      now,
    );

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: `assignment_${args.newStatus}`,
      entityType: "tourAssignments",
      entityId: args.assignmentId,
      details: serializeDetails({
        from: assignment.status,
        to: args.newStatus,
        reason: args.reason,
      }),
      timestamp: now,
    });

    if (args.newStatus === "completed") {
      await createPayoutObligationCore(ctx, args.assignmentId, user._id);
    }

    return null;
  },
});

export const syncShowamiStatus = mutation({
  args: {
    showamiFallbackId: v.string(),
    newStatus: assignmentStatus,
    agentId: v.optional(v.id("users")),
    scheduledAt: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    cooperatingBrokerage: v.optional(v.string()),
    showamiStatus: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const assignment = await ctx.db
      .query("tourAssignments")
      .withIndex("by_showamiFallbackId", (q) =>
        q.eq("showamiFallbackId", args.showamiFallbackId),
      )
      .unique();

    if (!assignment || assignment.routingPath !== "showami") {
      throw new Error("Showami assignment not found");
    }

    if (args.agentId) {
      const agent = await ctx.db.get(args.agentId);
      if (!agent) {
        throw new Error("Showami agent not found");
      }
    }

    assertTourAssignmentTransition(assignment.status, args.newStatus);

    const resolvedAgentId = args.agentId ?? assignment.agentId;
    if (
      ["confirmed", "in_progress", "completed"].includes(args.newStatus) &&
      resolvedAgentId === undefined
    ) {
      throw new Error(
        "Showami sync requires an agent before confirming or completing a showing",
      );
    }

    const now = new Date().toISOString();
    const patch: Partial<Doc<"tourAssignments">> = {
      status: args.newStatus,
      agentId: resolvedAgentId,
      lastSyncedAt: now,
      showamiStatus: args.showamiStatus ?? args.newStatus,
    };
    if (args.cooperatingBrokerage !== undefined) {
      patch.cooperatingBrokerage = args.cooperatingBrokerage;
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes;
    }
    if (args.newStatus === "completed") {
      patch.completedAt = args.completedAt ?? now;
    }
    if (args.newStatus === "canceled") {
      patch.canceledAt = now;
      patch.cancelReason = "showami_canceled";
    }

    await ctx.db.patch(assignment._id, patch);
    await syncCanonicalStateFromAssignment(
      ctx,
      { ...assignment, ...patch },
      args.newStatus,
      now,
      {
        completedAt: args.completedAt,
        scheduledAt: args.scheduledAt,
        showamiStatus: args.showamiStatus ?? args.newStatus,
        agentId: resolvedAgentId,
        blockingReason:
          args.newStatus === "canceled" ? "showami_canceled" : undefined,
      },
    );

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "showami_sync",
      entityType: "tourAssignments",
      entityId: assignment._id,
      details: serializeDetails({
        showamiFallbackId: args.showamiFallbackId,
        from: assignment.status,
        to: args.newStatus,
        showamiStatus: args.showamiStatus ?? args.newStatus,
        agentId: resolvedAgentId,
      }),
      timestamp: now,
    });

    if (args.newStatus === "completed") {
      await createPayoutObligationCore(ctx, assignment._id, user._id);
    }

    return null;
  },
});
