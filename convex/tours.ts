import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import {
  getPostTourObservationSummary,
  listBuyerVisiblePostTourObservations,
  listInternalPostTourObservations,
  storePostTourObservation,
} from "./lib/tourPostObservations";

const postTourSentimentValidator = v.union(
  v.literal("positive"),
  v.literal("mixed"),
  v.literal("negative"),
);

const postTourOfferReadinessValidator = v.union(
  v.literal("not_ready"),
  v.literal("considering"),
  v.literal("ready_soon"),
  v.literal("ready_now"),
);

const postTourPricingSignalValidator = v.union(
  v.literal("below_expectations"),
  v.literal("at_expectations"),
  v.literal("above_expectations"),
);

const postTourLeverageSignalValidator = v.union(
  v.literal("strong"),
  v.literal("neutral"),
  v.literal("weak"),
);

async function requireStaffUser(ctx: Parameters<typeof requireAuth>[0]) {
  const user = await requireAuth(ctx);
  if (user.role !== "broker" && user.role !== "admin") {
    throw new Error("Internal broker or admin access required");
  }
  return user;
}

/** Request a tour — requires signed tour_pass agreement */
export const requestTour = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    propertyId: v.id("properties"),
    scheduledAt: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.id("tours"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Check for signed tour_pass agreement
    const agreements = await ctx.db
      .query("agreements")
      .withIndex("by_buyerId_and_type", (q) =>
        q.eq("buyerId", user._id).eq("type", "tour_pass")
      )
      .collect();
    const hasTourPass = agreements.some((a) => a.status === "signed");

    if (!hasTourPass) {
      throw new Error("A signed Tour Pass agreement is required before requesting a tour");
    }

    // Validate deal room belongs to this buyer
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom || dealRoom.buyerId !== user._id) {
      throw new Error("Deal room not found or not owned by this buyer");
    }

    const id = await ctx.db.insert("tours", {
      dealRoomId: args.dealRoomId,
      propertyId: dealRoom.propertyId,
      buyerId: user._id,
      status: "requested",
      scheduledAt: args.scheduledAt,
      notes: args.notes,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_requested",
      entityType: "tours",
      entityId: id,
      details: JSON.stringify({ dealRoomId: args.dealRoomId, propertyId: args.propertyId }),
      timestamp: new Date().toISOString(),
    });

    return id;
  },
});

/** List tours for the authenticated buyer */
export const listByBuyer = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return await ctx.db
      .query("tours")
      .withIndex("by_buyerId", (q) => q.eq("buyerId", user._id))
      .collect();
  },
});

/** List tours for an agent (broker/admin) */
export const listByAgent = query({
  args: { agentId: v.id("users") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") return [];

    return await ctx.db
      .query("tours")
      .withIndex("by_agentId_and_status", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

/** List unassigned requested tours (broker/admin — for assignment queue) */
export const listUnassigned = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") return [];

    // Get all requested tours and filter for unassigned
    const requested = await ctx.db
      .query("tours")
      .collect();
    return requested.filter((t) => t.status === "requested" && !t.agentId);
  },
});

/** Update tour status (broker/admin only) */
export const updateStatus = mutation({
  args: {
    tourId: v.id("tours"),
    status: v.union(
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("canceled"),
      v.literal("no_show")
    ),
    agentId: v.optional(v.id("users")),
    scheduledAt: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can update tour status");
    }

    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour not found");

    // Validate transition
    const validTransitions: Record<string, string[]> = {
      requested: ["confirmed", "canceled"],
      confirmed: ["completed", "canceled", "no_show"],
    };
    const allowed = validTransitions[tour.status] ?? [];
    if (!allowed.includes(args.status)) {
      throw new Error(`Cannot transition from ${tour.status} to ${args.status}`);
    }

    const patch: Record<string, unknown> = { status: args.status };
    if (args.agentId) patch.agentId = args.agentId;
    if (args.scheduledAt) patch.scheduledAt = args.scheduledAt;
    if (args.notes) patch.notes = args.notes;
    if (args.status === "completed") patch.completedAt = new Date().toISOString();

    await ctx.db.patch(args.tourId, patch);

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: `tour_${args.status}`,
      entityType: "tours",
      entityId: args.tourId,
      timestamp: new Date().toISOString(),
    });

    return null;
  },
});

export const submitPostTourObservation = mutation({
  args: {
    tourId: v.id("tours"),
    sentiment: postTourSentimentValidator,
    concerns: v.array(v.string()),
    offerReadiness: postTourOfferReadinessValidator,
    buyerVisibleNote: v.optional(v.string()),
    internalNote: v.optional(v.string()),
    pricingSignal: v.optional(postTourPricingSignalValidator),
    leverageSignal: v.optional(postTourLeverageSignalValidator),
    actionItems: v.optional(v.array(v.string())),
  },
  returns: v.id("tourPostObservations"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour not found");
    const observationId = await storePostTourObservation(ctx, user, tour, {
      sentiment: args.sentiment,
      concerns: args.concerns,
      offerReadiness: args.offerReadiness,
      buyerVisibleNote: args.buyerVisibleNote,
      internalNote: args.internalNote,
      pricingSignal: args.pricingSignal,
      leverageSignal: args.leverageSignal,
      actionItems: args.actionItems,
    });

    const now = new Date().toISOString();
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_post_observation_submitted",
      entityType: "tourPostObservations",
      entityId: observationId,
      details: JSON.stringify({
        tourId: args.tourId,
        tourRequestId: tour.tourRequestId,
        submittedByRole: user.role,
        hasBuyerVisibleNote: Boolean(args.buyerVisibleNote?.trim()),
        hasInternalNote: Boolean(args.internalNote?.trim()),
      }),
      timestamp: now,
    });

    return observationId;
  },
});

export const listPostTourObservationsForBuyer = query({
  args: { tourId: v.id("tours") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tour = await ctx.db.get(args.tourId);
    if (!tour) return [];

    const isOwner = tour.buyerId === user._id;
    const isStaff = user.role === "broker" || user.role === "admin";
    if (!isOwner && !isStaff) return [];

    return await listBuyerVisiblePostTourObservations(ctx as never, args.tourId);
  },
});

export const listPostTourObservationsInternal = query({
  args: { tourId: v.id("tours") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireStaffUser(ctx);
    return await listInternalPostTourObservations(ctx as never, args.tourId);
  },
});

export const getPostTourSignalSummary = query({
  args: {
    tourId: v.optional(v.id("tours")),
    tourRequestId: v.optional(v.id("tourRequests")),
    propertyId: v.optional(v.id("properties")),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    await requireStaffUser(ctx);
    return await getPostTourObservationSummary(ctx as never, args);
  },
});
