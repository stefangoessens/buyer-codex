import {
  buildBuyerFeeLedgerReadModel,
  createEmptyBuyerFeeLedgerRollup,
  isValidCompensationTransition,
  reconcileBuyerFeeLedger,
  type BuyerFeeLedgerEntryRecord,
  type CompensationLedgerState,
} from "@buyer-codex/shared";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAuth, requireRole } from "./lib/session";
import {
  compensationStatus,
  contractLifecycleStatus,
  dealStatus,
  feeLedgerBucket,
  feeLedgerDimension,
  feeLedgerSource,
  ledgerInternalReviewState,
  offerStatus,
} from "./lib/validators";

type FeeLedgerEntryDoc = Doc<"feeLedgerEntries">;
type CompensationStatusDoc = Doc<"compensationStatus">;

function toLedgerEntryRecord(
  entry: FeeLedgerEntryDoc,
): BuyerFeeLedgerEntryRecord<Id<"feeLedgerEntries"> | Id<"offers"> | Id<"contracts"> | Id<"users"> | Id<"dealRooms">> {
  return {
    id: entry._id,
    dealRoomId: entry.dealRoomId,
    bucket: entry.bucket,
    dimension: entry.dimension,
    amount: entry.amount,
    description: entry.description,
    source: entry.source,
    lifecycle: entry.lifecycle,
    provenance: entry.provenance,
    createdAt: entry.createdAt,
  };
}

function createDefaultCompensationState(
  dealRoomId: Id<"dealRooms">,
  now: string,
): CompensationLedgerState<Id<"dealRooms"> | Id<"users">> {
  const empty = createEmptyBuyerFeeLedgerRollup();
  return {
    dealRoomId,
    status: "unknown",
    lastTransitionAt: now,
    expectedBuyerFee: empty.expectedBuyerFee,
    sellerPaidAmount: empty.sellerPaidAmount,
    buyerPaidAmount: empty.buyerPaidAmount,
    projectedClosingCredit: empty.projectedClosingCredit,
    createdAt: now,
    updatedAt: now,
  };
}

function toCompensationState(
  state: CompensationStatusDoc,
): CompensationLedgerState<Id<"dealRooms"> | Id<"users">> {
  return {
    dealRoomId: state.dealRoomId,
    status: state.status,
    previousStatus: state.previousStatus,
    transitionReason: state.transitionReason,
    transitionActorId: state.transitionActorId,
    lastTransitionAt: state.lastTransitionAt,
    expectedBuyerFee: state.expectedBuyerFee,
    sellerPaidAmount: state.sellerPaidAmount,
    buyerPaidAmount: state.buyerPaidAmount,
    projectedClosingCredit: state.projectedClosingCredit,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

async function loadCompensationState(
  ctx: { db: any },
  dealRoomId: Id<"dealRooms">,
) {
  const state = await ctx.db
    .query("compensationStatus")
    .withIndex("by_dealRoomId", (q: any) => q.eq("dealRoomId", dealRoomId))
    .unique();

  return state as CompensationStatusDoc | null;
}

export const getByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      return null;
    }
    if (user.role === "buyer" && dealRoom.buyerId !== user._id) {
      return null;
    }

    const entries = await ctx.db
      .query("feeLedgerEntries")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
    const state = await loadCompensationState(ctx, args.dealRoomId);
    const now = new Date().toISOString();

    return buildBuyerFeeLedgerReadModel({
      dealRoomId: args.dealRoomId,
      compensation: state
        ? toCompensationState(state)
        : createDefaultCompensationState(args.dealRoomId, now),
      entries: entries.map(toLedgerEntryRecord),
      forRole: user.role,
    });
  },
});

export const getLedgerSummary = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      return null;
    }
    if (user.role === "buyer" && dealRoom.buyerId !== user._id) {
      return null;
    }

    const entries = await ctx.db
      .query("feeLedgerEntries")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
    const state = await loadCompensationState(ctx, args.dealRoomId);
    const readModel = buildBuyerFeeLedgerReadModel({
      dealRoomId: args.dealRoomId,
      compensation: state
        ? toCompensationState(state)
        : createDefaultCompensationState(args.dealRoomId, new Date().toISOString()),
      entries: entries.map(toLedgerEntryRecord),
      forRole: user.role,
    });
    const summary = reconcileBuyerFeeLedger(readModel.projected, readModel.actual);

    return {
      dealRoomId: args.dealRoomId,
      entryCount: entries.length,
      ...summary,
    };
  },
});

export const getCompensationStatus = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      return null;
    }
    if (user.role === "buyer" && dealRoom.buyerId !== user._id) {
      return null;
    }

    return await ctx.db
      .query("compensationStatus")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .unique();
  },
});

export const getCompensationStatusInternal = internalQuery({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("compensationStatus")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .unique();
  },
});

export const createEntry = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    bucket: feeLedgerBucket,
    dimension: feeLedgerDimension,
    amount: v.number(),
    description: v.string(),
    source: feeLedgerSource,
    dealStatus,
    offerId: v.optional(v.id("offers")),
    offerStatus: v.optional(offerStatus),
    contractId: v.optional(v.id("contracts")),
    contractStatus: v.optional(contractLifecycleStatus),
    internalReviewState: v.optional(ledgerInternalReviewState),
    compensationStatus: v.optional(compensationStatus),
    triggeredBy: v.optional(v.string()),
    sourceDocument: v.optional(v.string()),
  },
  returns: v.id("feeLedgerEntries"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      throw new Error("Deal room not found");
    }

    const now = new Date().toISOString();
    const entryId = await ctx.db.insert("feeLedgerEntries", {
      dealRoomId: args.dealRoomId,
      bucket: args.bucket,
      dimension: args.dimension,
      amount: args.amount,
      description: args.description,
      source: args.source,
      lifecycle: {
        dealStatus: args.dealStatus,
        offerId: args.offerId,
        offerStatus: args.offerStatus,
        contractId: args.contractId,
        contractStatus: args.contractStatus,
        internalReviewState: args.internalReviewState ?? "not_submitted",
        compensationStatus: args.compensationStatus ?? "unknown",
      },
      provenance: {
        actorId: user._id,
        triggeredBy: args.triggeredBy,
        sourceDocument: args.sourceDocument,
        changedAt: now,
      },
      createdAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "fee_ledger_entry_created",
      entityType: "feeLedgerEntries",
      entityId: entryId,
      details: JSON.stringify({
        dealRoomId: args.dealRoomId,
        bucket: args.bucket,
        dimension: args.dimension,
        amount: args.amount,
        source: args.source,
      }),
      timestamp: now,
    });

    return entryId;
  },
});

export const transitionCompensationStatus = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    newStatus: compensationStatus,
    reason: v.optional(v.string()),
    expectedBuyerFee: v.optional(v.number()),
    sellerPaidAmount: v.optional(v.number()),
    buyerPaidAmount: v.optional(v.number()),
    projectedClosingCredit: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const current = await ctx.db
      .query("compensationStatus")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .unique();

    if (!current) {
      throw new Error(
        "Compensation status not initialized for this deal room. Call initializeCompensationStatus first.",
      );
    }
    if (!isValidCompensationTransition(current.status, args.newStatus)) {
      throw new Error(
        `Invalid transition: ${current.status} -> ${args.newStatus}`,
      );
    }

    const now = new Date().toISOString();
    await ctx.db.patch(current._id, {
      status: args.newStatus,
      previousStatus: current.status,
      transitionReason: args.reason,
      transitionActorId: user._id,
      lastTransitionAt: now,
      expectedBuyerFee: args.expectedBuyerFee ?? current.expectedBuyerFee,
      sellerPaidAmount: args.sellerPaidAmount ?? current.sellerPaidAmount,
      buyerPaidAmount: args.buyerPaidAmount ?? current.buyerPaidAmount,
      projectedClosingCredit:
        args.projectedClosingCredit ?? current.projectedClosingCredit,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "compensation_status_transitioned",
      entityType: "compensationStatus",
      entityId: current._id,
      details: JSON.stringify({
        dealRoomId: args.dealRoomId,
        from: current.status,
        to: args.newStatus,
        reason: args.reason,
      }),
      timestamp: now,
    });

    return null;
  },
});

export const initializeCompensationStatus = mutation({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      throw new Error("Deal room not found");
    }

    const existing = await ctx.db
      .query("compensationStatus")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .unique();

    if (existing) {
      return null;
    }

    const now = new Date().toISOString();
    const empty = createEmptyBuyerFeeLedgerRollup();
    const statusId = await ctx.db.insert("compensationStatus", {
      dealRoomId: args.dealRoomId,
      status: "unknown",
      lastTransitionAt: now,
      expectedBuyerFee: empty.expectedBuyerFee,
      sellerPaidAmount: empty.sellerPaidAmount,
      buyerPaidAmount: empty.buyerPaidAmount,
      projectedClosingCredit: empty.projectedClosingCredit,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "compensation_status_initialized",
      entityType: "compensationStatus",
      entityId: statusId,
      details: JSON.stringify({ dealRoomId: args.dealRoomId }),
      timestamp: now,
    });

    return null;
  },
});

export const initializeCompensationStatusInternal = internalMutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    actorUserId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      throw new Error("Deal room not found");
    }

    const existing = await ctx.db
      .query("compensationStatus")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .unique();

    if (existing) {
      return null;
    }

    const now = new Date().toISOString();
    const empty = createEmptyBuyerFeeLedgerRollup();
    const statusId = await ctx.db.insert("compensationStatus", {
      dealRoomId: args.dealRoomId,
      status: "unknown",
      lastTransitionAt: now,
      expectedBuyerFee: empty.expectedBuyerFee,
      sellerPaidAmount: empty.sellerPaidAmount,
      buyerPaidAmount: empty.buyerPaidAmount,
      projectedClosingCredit: empty.projectedClosingCredit,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: args.actorUserId,
      action: "compensation_status_initialized",
      entityType: "compensationStatus",
      entityId: statusId,
      details: JSON.stringify({ dealRoomId: args.dealRoomId }),
      timestamp: now,
    });

    return null;
  },
});
