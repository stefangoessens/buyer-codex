/**
 * Tour request flow — Convex module (KIN-802).
 *
 * Implements the request envelope side of the tour flow: drafts, submission,
 * blocking, assignment, confirmation, and cancellation. The executed tour
 * (the showing itself) lives in `convex/tours.ts`.
 *
 * Lifecycle:
 *   draft → submitted → { blocked | assigned } → confirmed → completed
 *   any state → canceled
 *   any non-terminal state → failed
 *
 * Validation logic is in `src/lib/tours/requestValidation.ts` — this module
 * only handles persistence, auth, and audit logging.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import type { Doc, Id } from "./_generated/dataModel";
import { buildTourFlowProfile, loadBuyerProfileView } from "./lib/buyerProfile";
import {
  assertTourRequestTransition,
  loadCurrentAgreementSnapshot,
  validateTourRequestDraftInputOrThrow,
} from "./lib/tourWorkflow";

// ═══ Shared validators ═══

const windowValidator = v.object({
  start: v.string(),
  end: v.string(),
});

// ═══ Queries ═══

/** Get a single tour request. Auth-gated to buyer owner or broker/admin. */
export const get = query({
  args: { requestId: v.id("tourRequests") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;
    if (
      request.buyerId !== user._id &&
      user.role !== "broker" &&
      user.role !== "admin"
    ) {
      return null;
    }
    return request;
  },
});

/** List all tour requests for the authenticated buyer. */
export const listMine = query({
  args: { status: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const all = await ctx.db
      .query("tourRequests")
      .withIndex("by_buyerId", (q) => q.eq("buyerId", user._id))
      .collect();
    const filtered = args.status
      ? all.filter((r) => r.status === args.status)
      : all;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

/** List requests for a deal room. Auth-gated. */
export const listByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) return [];
    if (
      dealRoom.buyerId !== user._id &&
      user.role !== "broker" &&
      user.role !== "admin"
    ) {
      return [];
    }
    return await ctx.db
      .query("tourRequests")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
  },
});

/** Ops queue — list all requests in "submitted" or "blocked" state. */
export const listForOps = query({
  args: { status: v.optional(v.string()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") return [];
    const targetStatus = args.status ?? "submitted";
    return await ctx.db
      .query("tourRequests")
      .withIndex("by_status", (q) => q.eq("status", targetStatus as never))
      .collect();
  },
});

// ═══ Mutations ═══

/**
 * Create a draft tour request. The buyer owns the draft until submission;
 * brokers can also create drafts on behalf of buyers.
 *
 * IMPORTANT: `agreementStateSnapshot` is NOT a client input. It is derived
 * from the live `agreements` table at creation time. A malicious client
 * cannot forge a signed snapshot.
 *
 * Input validation enforces attendee count bounds (1-10), preferred window
 * count (1-5), window date parseability, ordering (end > start), and
 * future-only start times. Invalid drafts NEVER hit storage.
 */
export const createDraft = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    propertyId: v.id("properties"),
    preferredWindows: v.array(windowValidator),
    attendeeCount: v.optional(v.number()),
    buyerNotes: v.optional(v.string()),
  },
  returns: v.id("tourRequests"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    // Verify deal room belongs to the buyer (or user is broker/admin)
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");
    if (
      dealRoom.buyerId !== user._id &&
      user.role !== "broker" &&
      user.role !== "admin"
    ) {
      throw new Error("Not authorized to create tour requests for this deal room");
    }

    // Verify property matches the deal room
    if (dealRoom.propertyId !== args.propertyId) {
      throw new Error("Property does not belong to the specified deal room");
    }

    // Derive agreement snapshot from the live agreements table. NEVER trust
    // a client-supplied snapshot — see loadCurrentAgreementSnapshot docs.
    const agreementStateSnapshot = await loadCurrentAgreementSnapshot(
      ctx,
      dealRoom.buyerId,
    );
    const buyerProfile = buildTourFlowProfile(
      await loadBuyerProfileView(ctx, dealRoom.buyerId, false),
    );
    const attendeeCount =
      args.attendeeCount ?? buyerProfile.attendeeCountDefault;

    // Validate input BEFORE persisting. Invalid drafts never hit storage.
    // Import the validator dynamically to avoid circular deps with tests.
    const now = new Date().toISOString();
    const validation = validateTourRequestDraftInputOrThrow({
      dealRoomId: args.dealRoomId,
      propertyId: args.propertyId,
      preferredWindows: args.preferredWindows,
      attendeeCount,
      buyerNotes: args.buyerNotes,
      agreementStateSnapshot,
    }, now);

    // Check for existing active request on this property for this buyer
    // (prevents accidental duplicates)
    const existing = await ctx.db
      .query("tourRequests")
      .withIndex("by_buyerId", (q) => q.eq("buyerId", dealRoom.buyerId))
      .collect();
    const activeStatuses = new Set([
      "draft",
      "submitted",
      "blocked",
      "assigned",
      "confirmed",
    ]);
    const duplicate = existing.find(
      (r) =>
        r.propertyId === args.propertyId &&
        activeStatuses.has(r.status),
    );
    if (duplicate) {
      throw new Error(
        `DUPLICATE_REQUEST: An active tour request already exists for this property (status: ${duplicate.status})`,
      );
    }

    const id = await ctx.db.insert("tourRequests", {
      dealRoomId: args.dealRoomId,
      propertyId: args.propertyId,
      buyerId: dealRoom.buyerId,
      status: "draft",
      preferredWindows: validation.preferredWindows,
      attendeeCount: validation.attendeeCount,
      buyerNotes: validation.buyerNotes,
      agreementStateSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_draft_created",
      entityType: "tourRequests",
      entityId: id,
      details: JSON.stringify({
        propertyId: args.propertyId,
        attendeeCount: validation.attendeeCount,
        windowCount: args.preferredWindows.length,
      }),
      timestamp: now,
    });

    return id;
  },
});

/**
 * Submit a draft tour request for broker triage. Enforces preconditions:
 * agreement must be signed, windows must be valid, attendee count sane.
 */
export const submit = mutation({
  args: { requestId: v.id("tourRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");

    if (request.buyerId !== user._id && user.role !== "broker" && user.role !== "admin") {
      throw new Error("Not authorized");
    }

    if (request.status !== "draft") {
      throw new Error(`Cannot submit request in status "${request.status}"`);
    }

    assertTourRequestTransition(request.status, "submitted");

    // Re-derive agreement snapshot from the LIVE agreements table at
    // submission time. Never trust the stored snapshot — an agreement can
    // be canceled or replaced between draft creation and submission, and
    // we must catch that at this gate.
    const freshSnapshot = await loadCurrentAgreementSnapshot(
      ctx,
      request.buyerId,
    );
    if (
      (freshSnapshot.type !== "tour_pass" &&
        freshSnapshot.type !== "full_representation") ||
      freshSnapshot.status !== "signed"
    ) {
      throw new Error(
        "MISSING_TOUR_PASS: A signed tour pass or full representation agreement is required to submit this request",
      );
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
      // Refresh the snapshot to reflect the live state at submission time
      agreementStateSnapshot: freshSnapshot,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_submitted",
      entityType: "tourRequests",
      entityId: args.requestId,
      timestamp: now,
    });

    return null;
  },
});

/**
 * Unblock a blocked request, returning it to `submitted` so broker can
 * then assign it. Matches the shared state machine: blocked → submitted.
 * Broker/admin only.
 */
export const unblock = mutation({
  args: { requestId: v.id("tourRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can unblock tour requests");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");
    if (request.status !== "blocked") {
      throw new Error(
        `ILLEGAL_TRANSITION: Cannot unblock request in status "${request.status}" — only blocked requests can be unblocked`,
      );
    }
    assertTourRequestTransition(request.status, "submitted");
    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "submitted",
      blockingReason: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_unblocked",
      entityType: "tourRequests",
      entityId: args.requestId,
      timestamp: now,
    });
    return null;
  },
});

/** Broker/admin marks a request blocked with a structured reason. */
export const markBlocked = mutation({
  args: {
    requestId: v.id("tourRequests"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can block tour requests");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");
    if (request.status !== "submitted") {
      throw new Error(`Cannot block request in status "${request.status}"`);
    }
    assertTourRequestTransition(request.status, "blocked");
    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "blocked",
      blockingReason: args.reason,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_blocked",
      entityType: "tourRequests",
      entityId: args.requestId,
      details: JSON.stringify({ reason: args.reason }),
      timestamp: now,
    });
    return null;
  },
});

/** Broker/admin assigns a request to an agent. */
export const assignAgent = mutation({
  args: {
    requestId: v.id("tourRequests"),
    agentId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can assign tour requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");
    // Only submitted requests can be assigned directly. A blocked request
    // must be unblocked (blocked → submitted via unblock()) before
    // assignment, matching the shared state machine in
    // src/lib/tours/requestValidation.ts.
    if (request.status !== "submitted") {
      throw new Error(
        `ILLEGAL_TRANSITION: Cannot assign request in status "${request.status}" — only submitted requests can be assigned (blocked requests must be unblocked first)`,
      );
    }
    assertTourRequestTransition(request.status, "assigned");

    // Verify the agent exists and has the right role
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");
    if (agent.role !== "broker" && agent.role !== "admin") {
      throw new Error("Assigned user must be a broker or admin");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "assigned",
      agentId: args.agentId,
      assignedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_assigned",
      entityType: "tourRequests",
      entityId: args.requestId,
      details: JSON.stringify({ agentId: args.agentId }),
      timestamp: now,
    });
    return null;
  },
});

/** Assigned agent confirms the request and optionally links an executed tour. */
export const confirm = mutation({
  args: {
    requestId: v.id("tourRequests"),
    linkedTourId: v.optional(v.id("tours")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can confirm tour requests");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");
    if (request.status !== "assigned") {
      throw new Error(`Cannot confirm request in status "${request.status}"`);
    }
    assertTourRequestTransition(request.status, "confirmed");

    // Validate linkedTourId belongs to the SAME deal room, property, and
    // buyer as this request before persisting. Prevents a broker from
    // accidentally attaching an unrelated tour row (which is hard to
    // unwind once persisted).
    if (args.linkedTourId) {
      const tour = await ctx.db.get(args.linkedTourId);
      if (!tour) throw new Error("Linked tour not found");
      if (tour.dealRoomId !== request.dealRoomId) {
        throw new Error(
          "Linked tour deal room does not match this tour request",
        );
      }
      if (tour.propertyId !== request.propertyId) {
        throw new Error(
          "Linked tour property does not match this tour request",
        );
      }
      if (tour.buyerId !== request.buyerId) {
        throw new Error(
          "Linked tour buyer does not match this tour request",
        );
      }
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "confirmed",
      confirmedAt: now,
      updatedAt: now,
      linkedTourId: args.linkedTourId,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_confirmed",
      entityType: "tourRequests",
      entityId: args.requestId,
      timestamp: now,
    });
    return null;
  },
});

/** Mark a request completed (after the tour actually happened). */
export const markCompleted = mutation({
  args: { requestId: v.id("tourRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can mark requests completed");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");
    if (request.status !== "confirmed") {
      throw new Error(`Cannot complete request in status "${request.status}"`);
    }
    assertTourRequestTransition(request.status, "completed");
    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_completed",
      entityType: "tourRequests",
      entityId: args.requestId,
      timestamp: now,
    });
    return null;
  },
});

/**
 * Cancel a request. The buyer can cancel their own request in any non-
 * terminal state. Brokers/admins can cancel any non-terminal request.
 */
export const cancel = mutation({
  args: {
    requestId: v.id("tourRequests"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");

    if (request.buyerId !== user._id && user.role !== "broker" && user.role !== "admin") {
      throw new Error("Not authorized");
    }

    const terminal = new Set(["completed", "canceled", "failed"]);
    if (terminal.has(request.status)) {
      throw new Error(`Cannot cancel request in terminal status "${request.status}"`);
    }
    assertTourRequestTransition(request.status, "canceled");

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "canceled",
      canceledAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_canceled",
      entityType: "tourRequests",
      entityId: args.requestId,
      details: args.reason ? JSON.stringify({ reason: args.reason }) : undefined,
      timestamp: now,
    });
    return null;
  },
});

/**
 * Broker/admin marks a request failed with a structured reason. Drafts
 * cannot fail — the state machine says draft can only transition to
 * submitted or canceled. A buyer can cancel a draft they no longer want.
 * Failed is reserved for in-flight requests that hit an unrecoverable
 * problem after submission.
 */
export const markFailed = mutation({
  args: {
    requestId: v.id("tourRequests"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can mark requests failed");
    }
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Tour request not found");

    // Aligned with the client-side state machine in
    // src/lib/tours/requestValidation.ts: only in-flight post-submission
    // states can transition to failed.
    const failable = new Set([
      "submitted",
      "blocked",
      "assigned",
      "confirmed",
    ]);
    if (!failable.has(request.status)) {
      throw new Error(
        `ILLEGAL_TRANSITION: Cannot mark request failed from status "${request.status}" (only submitted, blocked, assigned, or confirmed can fail)`,
      );
    }
    assertTourRequestTransition(request.status, "failed");

    const now = new Date().toISOString();
    await ctx.db.patch(args.requestId, {
      status: "failed",
      failureReason: args.reason,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "tour_request_failed",
      entityType: "tourRequests",
      entityId: args.requestId,
      details: JSON.stringify({ reason: args.reason }),
      timestamp: now,
    });
    return null;
  },
});

// ═══ Type helpers ═══

export type TourRequestDoc = Doc<"tourRequests">;
export type TourRequestId = Id<"tourRequests">;
