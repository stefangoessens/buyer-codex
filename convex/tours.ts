import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/session";
import {
  summarizePostTourSignals,
  toBuyerVisibleObservation,
  type PostTourObservationEntry,
} from "../src/lib/tours/postTourSignals";

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

function trimOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeStringList(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

async function requireStaffUser(ctx: Parameters<typeof requireAuth>[0]) {
  const user = await requireAuth(ctx);
  if (user.role !== "broker" && user.role !== "admin") {
    throw new Error("Internal broker or admin access required");
  }
  return user;
}

async function loadPostTourObservationsForTour(
  ctx: { db: { query: (table: "tourPostObservations") => any } },
  tourId: Id<"tours">,
): Promise<Array<Doc<"tourPostObservations">>> {
  return await ctx.db
    .query("tourPostObservations")
    .withIndex("by_tourId_and_createdAt", (q: any) => q.eq("tourId", tourId))
    .collect();
}

function toSignalEntry(
  observation: Doc<"tourPostObservations">,
): PostTourObservationEntry {
  return {
    submittedAt: observation.createdAt,
    submittedByRole: observation.submittedByRole,
    sentiment: observation.sentiment,
    concerns: observation.concerns,
    offerReadiness: observation.offerReadiness,
    buyerVisibleNote: observation.buyerVisibleNote,
    internalNote: observation.internalNote,
    pricingSignal: observation.pricingSignal,
    leverageSignal: observation.leverageSignal,
    actionItems: observation.actionItems,
  };
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
    if (!tour.tourRequestId) {
      throw new Error(
        "MISSING_TOUR_LINKAGE: Tour must be linked to a tour request before post-tour capture can be stored",
      );
    }
    if (tour.status === "requested") {
      throw new Error(
        "Tour must be at least confirmed before post-tour observations can be stored",
      );
    }

    if (
      user.role === "buyer" &&
      tour.buyerId !== user._id
    ) {
      throw new Error("Not authorized to submit observations for this tour");
    }

    const buyerVisibleNote = trimOptionalText(args.buyerVisibleNote);
    const internalNote = trimOptionalText(args.internalNote);
    const concerns = normalizeStringList(args.concerns);
    const actionItems = normalizeStringList(args.actionItems ?? []);

    if (concerns.length === 0) {
      throw new Error("At least one structured concern is required");
    }
    if (buyerVisibleNote && buyerVisibleNote.length > 2000) {
      throw new Error("Buyer-visible note must be 2000 characters or fewer");
    }
    if (internalNote && internalNote.length > 2000) {
      throw new Error("Internal note must be 2000 characters or fewer");
    }

    if (user.role === "buyer") {
      if (internalNote || args.pricingSignal || args.leverageSignal || actionItems.length > 0) {
        throw new Error("Buyer submissions cannot include internal-only fields");
      }
    }

    const now = new Date().toISOString();
    const observationId = await ctx.db.insert("tourPostObservations", {
      tourId: args.tourId,
      tourRequestId: tour.tourRequestId,
      propertyId: tour.propertyId,
      buyerId: tour.buyerId,
      submittedById: user._id,
      submittedByRole: user.role,
      sentiment: args.sentiment,
      concerns,
      offerReadiness: args.offerReadiness,
      buyerVisibleNote,
      internalNote,
      pricingSignal: args.pricingSignal,
      leverageSignal: args.leverageSignal,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
      createdAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_post_observation_submitted",
      entityType: "tourPostObservations",
      entityId: observationId,
      details: JSON.stringify({
        tourId: args.tourId,
        tourRequestId: tour.tourRequestId,
        submittedByRole: user.role,
        hasBuyerVisibleNote: Boolean(buyerVisibleNote),
        hasInternalNote: Boolean(internalNote),
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

    const observations = await loadPostTourObservationsForTour(ctx as never, args.tourId);
    return observations
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((observation) => toBuyerVisibleObservation(toSignalEntry(observation)));
  },
});

export const listPostTourObservationsInternal = query({
  args: { tourId: v.id("tours") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireStaffUser(ctx);
    const observations = await loadPostTourObservationsForTour(ctx as never, args.tourId);
    return observations.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
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

    const selectors = [args.tourId, args.tourRequestId, args.propertyId].filter(Boolean);
    if (selectors.length !== 1) {
      throw new Error("Provide exactly one of tourId, tourRequestId, or propertyId");
    }

    let observations: Array<Doc<"tourPostObservations">>;
    if (args.tourId) {
      observations = await loadPostTourObservationsForTour(ctx as never, args.tourId);
    } else if (args.tourRequestId) {
      observations = await ctx.db
        .query("tourPostObservations")
        .withIndex("by_tourRequestId", (q) => q.eq("tourRequestId", args.tourRequestId!))
        .collect();
    } else {
      observations = await ctx.db
        .query("tourPostObservations")
        .withIndex("by_propertyId", (q) => q.eq("propertyId", args.propertyId!))
        .collect();
    }

    if (observations.length === 0) return null;

    const ordered = observations.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    const summary = summarizePostTourSignals(ordered.map(toSignalEntry));
    const latest = ordered[0]!;

    return {
      ...summary,
      tourId: latest.tourId,
      tourRequestId: latest.tourRequestId,
      propertyId: latest.propertyId,
      buyerId: latest.buyerId,
    };
  },
});
