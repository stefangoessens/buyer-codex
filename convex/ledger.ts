import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireAuth, requireRole } from "./lib/session";
import {
  compensationStatus,
  feeLedgerBucket,
  feeLedgerDimension,
  feeLedgerSource,
  ledgerInternalReviewState,
} from "./lib/validators";
import {
  buildBuyerFeeLedgerReadModel,
  isValidCompensationTransition,
  rollupBuyerFeeLedgerEntries,
  type BuyerFeeLedgerDimension,
  type BuyerFeeLedgerInternalReviewState,
} from "../packages/shared/src/contracts";

type DealRoomDoc = Doc<"dealRooms">;
type CompensationDoc = Doc<"compensationStatus">;
type LedgerEntryDoc = Doc<"feeLedgerEntries">;

const DIMENSION_FIELD_MAP: Record<
  BuyerFeeLedgerDimension,
  keyof Pick<
    CompensationDoc,
    | "expectedBuyerFee"
    | "sellerPaidAmount"
    | "buyerPaidAmount"
    | "projectedClosingCredit"
  >
> = {
  expectedBuyerFee: "expectedBuyerFee",
  sellerPaidAmount: "sellerPaidAmount",
  buyerPaidAmount: "buyerPaidAmount",
  projectedClosingCredit: "projectedClosingCredit",
};

function defaultCompensationState(
  dealRoomId: string,
  nowIso: string,
): {
  dealRoomId: string;
  status: "unknown";
  previousStatus: undefined;
  transitionReason: undefined;
  transitionActorId: undefined;
  lastTransitionAt: string;
  expectedBuyerFee: number;
  sellerPaidAmount: number;
  buyerPaidAmount: number;
  projectedClosingCredit: number;
  createdAt: string;
  updatedAt: string;
} {
  return {
    dealRoomId,
    status: "unknown",
    previousStatus: undefined,
    transitionReason: undefined,
    transitionActorId: undefined,
    lastTransitionAt: nowIso,
    expectedBuyerFee: 0,
    sellerPaidAmount: 0,
    buyerPaidAmount: 0,
    projectedClosingCredit: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function getCompensationRecord(
  ctx: QueryCtx | MutationCtx,
  dealRoomId: Id<"dealRooms">,
): Promise<CompensationDoc | null> {
  return await ctx.db
    .query("compensationStatus")
    .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", dealRoomId))
    .unique();
}

async function ensureCompensationRecord(
  ctx: MutationCtx,
  dealRoom: DealRoomDoc,
  actorUserId?: Id<"users">,
): Promise<CompensationDoc> {
  const existing = await getCompensationRecord(ctx, dealRoom._id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const recordId = await ctx.db.insert("compensationStatus", {
    dealRoomId: dealRoom._id,
    status: "unknown",
    lastTransitionAt: now,
    expectedBuyerFee: 0,
    sellerPaidAmount: 0,
    buyerPaidAmount: 0,
    projectedClosingCredit: 0,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.db.insert("auditLog", {
    userId: actorUserId,
    action: "compensation_status_initialized",
    entityType: "compensationStatus",
    entityId: recordId,
    details: JSON.stringify({ dealRoomId: dealRoom._id }),
    timestamp: now,
  });

  const created = await ctx.db.get(recordId);
  if (!created) {
    throw new Error("Failed to read back compensation status after initialization");
  }
  return created;
}

async function resolveInternalReviewState(
  ctx: QueryCtx | MutationCtx,
  dealRoomId: Id<"dealRooms">,
  offerId: Id<"offers"> | undefined,
  override: BuyerFeeLedgerInternalReviewState | undefined,
): Promise<BuyerFeeLedgerInternalReviewState> {
  if (override) return override;

  const drafts = await ctx.db
    .query("offerCockpitDrafts")
    .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", dealRoomId))
    .order("desc")
    .take(10);

  const match = offerId
    ? drafts.find((draft) => draft.offerId === offerId) ?? drafts[0]
    : drafts[0];

  return match?.brokerReviewState ?? "not_submitted";
}

async function buildLifecycleSnapshot(
  ctx: QueryCtx | MutationCtx,
  args: {
    dealRoom: DealRoomDoc;
    status: CompensationDoc["status"];
    offerId?: Id<"offers">;
    contractId?: Id<"contracts">;
    internalReviewState?: BuyerFeeLedgerInternalReviewState;
  },
) {
  const offer = args.offerId ? await ctx.db.get(args.offerId) : null;
  if (offer && offer.dealRoomId !== args.dealRoom._id) {
    throw new Error("Offer does not belong to the specified deal room");
  }

  const contract = args.contractId ? await ctx.db.get(args.contractId) : null;
  if (contract && contract.dealRoomId !== args.dealRoom._id) {
    throw new Error("Contract does not belong to the specified deal room");
  }

  return {
    dealStatus: args.dealRoom.status,
    offerId: offer?._id,
    offerStatus: offer?.status,
    contractId: contract?._id,
    contractStatus: contract?.status,
    internalReviewState: await resolveInternalReviewState(
      ctx,
      args.dealRoom._id,
      offer?._id,
      args.internalReviewState,
    ),
    compensationStatus: args.status,
  };
}

function applyProjectedDelta(
  compensation: CompensationDoc,
  dimension: BuyerFeeLedgerDimension,
  amount: number,
) {
  const field = DIMENSION_FIELD_MAP[dimension];
  return {
    [field]: compensation[field] + amount,
  } as Pick<
    CompensationDoc,
    | "expectedBuyerFee"
    | "sellerPaidAmount"
    | "buyerPaidAmount"
    | "projectedClosingCredit"
  >;
}

async function insertLedgerEntry(
  ctx: MutationCtx,
  args: {
    dealRoom: DealRoomDoc;
    compensation: CompensationDoc;
    bucket: "projected" | "actual";
    dimension: BuyerFeeLedgerDimension;
    amount: number;
    description: string;
    source: Doc<"feeLedgerEntries">["source"];
    offerId?: Id<"offers">;
    contractId?: Id<"contracts">;
    internalReviewState?: BuyerFeeLedgerInternalReviewState;
    actorUserId?: Id<"users">;
    triggeredBy?: string;
    sourceDocument?: string;
  },
): Promise<Id<"feeLedgerEntries">> {
  const now = new Date().toISOString();
  const lifecycle = await buildLifecycleSnapshot(ctx, {
    dealRoom: args.dealRoom,
    status: args.compensation.status,
    offerId: args.offerId,
    contractId: args.contractId,
    internalReviewState: args.internalReviewState,
  });

  const entryId = await ctx.db.insert("feeLedgerEntries", {
    dealRoomId: args.dealRoom._id,
    bucket: args.bucket,
    dimension: args.dimension,
    amount: args.amount,
    description: args.description,
    source: args.source,
    lifecycle,
    provenance: {
      actorId: args.actorUserId,
      triggeredBy: args.triggeredBy,
      sourceDocument: args.sourceDocument,
      changedAt: now,
    },
    createdAt: now,
  });

  await ctx.db.insert("auditLog", {
    userId: args.actorUserId,
    action: "fee_ledger_entry_created",
    entityType: "feeLedgerEntries",
    entityId: entryId,
    details: JSON.stringify({
      dealRoomId: args.dealRoom._id,
      bucket: args.bucket,
      dimension: args.dimension,
      amount: args.amount,
      source: args.source,
      lifecycle,
    }),
    timestamp: now,
  });

  return entryId;
}

function toEntryRecord(doc: LedgerEntryDoc) {
  return {
    id: String(doc._id),
    dealRoomId: String(doc.dealRoomId),
    bucket: doc.bucket,
    dimension: doc.dimension,
    amount: doc.amount,
    description: doc.description,
    source: doc.source,
    lifecycle: {
      dealStatus: doc.lifecycle.dealStatus,
      offerId: doc.lifecycle.offerId ? String(doc.lifecycle.offerId) : undefined,
      offerStatus: doc.lifecycle.offerStatus,
      contractId: doc.lifecycle.contractId
        ? String(doc.lifecycle.contractId)
        : undefined,
      contractStatus: doc.lifecycle.contractStatus,
      internalReviewState: doc.lifecycle.internalReviewState,
      compensationStatus: doc.lifecycle.compensationStatus,
    },
    provenance: {
      actorId: doc.provenance.actorId ? String(doc.provenance.actorId) : undefined,
      triggeredBy: doc.provenance.triggeredBy,
      sourceDocument: doc.provenance.sourceDocument,
      changedAt: doc.provenance.changedAt,
    },
    createdAt: doc.createdAt,
  } as const;
}

function toCompensationView(
  dealRoom: DealRoomDoc,
  compensation: CompensationDoc | null,
) {
  if (!compensation) {
    return defaultCompensationState(String(dealRoom._id), dealRoom.createdAt);
  }

  return {
    dealRoomId: String(compensation.dealRoomId),
    status: compensation.status,
    previousStatus: compensation.previousStatus,
    transitionReason: compensation.transitionReason,
    transitionActorId: compensation.transitionActorId
      ? String(compensation.transitionActorId)
      : undefined,
    lastTransitionAt: compensation.lastTransitionAt,
    expectedBuyerFee: compensation.expectedBuyerFee,
    sellerPaidAmount: compensation.sellerPaidAmount,
    buyerPaidAmount: compensation.buyerPaidAmount,
    projectedClosingCredit: compensation.projectedClosingCredit,
    createdAt: compensation.createdAt,
    updatedAt: compensation.updatedAt,
  } as const;
}

async function canAccessDealRoom(
  ctx: QueryCtx,
  dealRoomId: Id<"dealRooms">,
) {
  const user = await requireAuth(ctx);
  const dealRoom = await ctx.db.get(dealRoomId);
  if (!dealRoom) return { user, dealRoom: null as DealRoomDoc | null };
  if (user.role === "buyer" && dealRoom.buyerId !== user._id) {
    return { user, dealRoom: null as DealRoomDoc | null };
  }
  return { user, dealRoom };
}

/** Get all ledger entries for a deal room. Buyer sees buyer-safe rows; broker/admin sees internal rows. */
export const getByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const { user, dealRoom } = await canAccessDealRoom(ctx, args.dealRoomId);
    if (!dealRoom) return [];

    const compensation = await getCompensationRecord(ctx, args.dealRoomId);
    const entries = await ctx.db
      .query("feeLedgerEntries")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();

    const readModel = buildBuyerFeeLedgerReadModel({
      dealRoomId: String(args.dealRoomId),
      compensation: toCompensationView(dealRoom, compensation),
      entries: entries.map(toEntryRecord),
      forRole: user.role,
    });

    return readModel.entries;
  },
});

/** Get the typed ledger read model for a deal room. */
export const getReadModel = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { user, dealRoom } = await canAccessDealRoom(ctx, args.dealRoomId);
    if (!dealRoom) return null;

    const compensation = await getCompensationRecord(ctx, args.dealRoomId);
    const entries = await ctx.db
      .query("feeLedgerEntries")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();

    return buildBuyerFeeLedgerReadModel({
      dealRoomId: String(args.dealRoomId),
      compensation: toCompensationView(dealRoom, compensation),
      entries: entries.map(toEntryRecord),
      forRole: user.role,
    });
  },
});

/** Get computed ledger rollups for a deal room. */
export const getLedgerSummary = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { dealRoom } = await canAccessDealRoom(ctx, args.dealRoomId);
    if (!dealRoom) return null;

    const compensation = await getCompensationRecord(ctx, args.dealRoomId);
    const entries = await ctx.db
      .query("feeLedgerEntries")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();

    const projected = rollupBuyerFeeLedgerEntries(entries, "projected");
    const actual = rollupBuyerFeeLedgerEntries(entries, "actual");
    const hasActual = entries.some((entry) => entry.bucket === "actual");

    return {
      dealRoomId: args.dealRoomId,
      compensation: toCompensationView(dealRoom, compensation),
      projected,
      actual: hasActual ? actual : null,
      latestActualAt:
        entries
          .filter((entry) => entry.bucket === "actual")
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ??
        null,
      entryCount: entries.length,
    };
  },
});

/** Get current compensation status + snapshot for a deal room. */
export const getCompensationStatus = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { dealRoom } = await canAccessDealRoom(ctx, args.dealRoomId);
    if (!dealRoom) return null;

    const compensation = await getCompensationRecord(ctx, args.dealRoomId);
    return toCompensationView(dealRoom, compensation);
  },
});

/** Internal: get compensation status without auth check. */
export const getCompensationStatusInternal = internalQuery({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) return null;
    const compensation = await getCompensationRecord(ctx, args.dealRoomId);
    return toCompensationView(dealRoom, compensation);
  },
});

/** Add a typed ledger entry. Broker/admin only. */
export const createEntry = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    bucket: feeLedgerBucket,
    dimension: feeLedgerDimension,
    amount: v.number(),
    description: v.string(),
    source: feeLedgerSource,
    offerId: v.optional(v.id("offers")),
    contractId: v.optional(v.id("contracts")),
    internalReviewState: v.optional(ledgerInternalReviewState),
    triggeredBy: v.optional(v.string()),
    sourceDocument: v.optional(v.string()),
  },
  returns: v.id("feeLedgerEntries"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    const compensation = await ensureCompensationRecord(ctx, dealRoom, user._id);
    const entryId = await insertLedgerEntry(ctx, {
      dealRoom,
      compensation,
      bucket: args.bucket,
      dimension: args.dimension,
      amount: args.amount,
      description: args.description,
      source: args.source,
      offerId: args.offerId,
      contractId: args.contractId,
      internalReviewState: args.internalReviewState,
      actorUserId: user._id,
      triggeredBy: args.triggeredBy,
      sourceDocument: args.sourceDocument,
    });

    if (args.bucket === "projected" && args.amount !== 0) {
      await ctx.db.patch(compensation._id, {
        ...applyProjectedDelta(compensation, args.dimension, args.amount),
        updatedAt: new Date().toISOString(),
      });
    }

    return entryId;
  },
});

/** Transition the compensation state machine and persist any resulting projected deltas. */
export const transitionCompensationStatus = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    newStatus: compensationStatus,
    source: feeLedgerSource,
    reason: v.optional(v.string()),
    expectedBuyerFee: v.optional(v.number()),
    sellerPaidAmount: v.optional(v.number()),
    buyerPaidAmount: v.optional(v.number()),
    projectedClosingCredit: v.optional(v.number()),
    offerId: v.optional(v.id("offers")),
    contractId: v.optional(v.id("contracts")),
    internalReviewState: v.optional(ledgerInternalReviewState),
    triggeredBy: v.optional(v.string()),
    sourceDocument: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    const current = await ensureCompensationRecord(ctx, dealRoom, user._id);
    if (!isValidCompensationTransition(current.status, args.newStatus)) {
      throw new Error(
        `Invalid transition: ${current.status} -> ${args.newStatus}`,
      );
    }

    if (
      args.newStatus === "seller_disclosed_off_mls" &&
      args.sellerPaidAmount === undefined
    ) {
      throw new Error(
        "sellerPaidAmount is required when transitioning to seller_disclosed_off_mls",
      );
    }
    if (
      args.newStatus === "negotiated_in_offer" &&
      args.sellerPaidAmount === undefined
    ) {
      throw new Error(
        "sellerPaidAmount is required when transitioning to negotiated_in_offer",
      );
    }
    if (
      args.newStatus === "buyer_paid" &&
      args.buyerPaidAmount === undefined
    ) {
      throw new Error(
        "buyerPaidAmount is required when transitioning to buyer_paid",
      );
    }

    const nextSnapshot = {
      expectedBuyerFee: args.expectedBuyerFee ?? current.expectedBuyerFee,
      sellerPaidAmount: args.sellerPaidAmount ?? current.sellerPaidAmount,
      buyerPaidAmount: args.buyerPaidAmount ?? current.buyerPaidAmount,
      projectedClosingCredit:
        args.projectedClosingCredit ?? current.projectedClosingCredit,
    };

    const deltaEntries = [
      {
        dimension: "expectedBuyerFee" as const,
        nextAmount: nextSnapshot.expectedBuyerFee,
        currentAmount: current.expectedBuyerFee,
      },
      {
        dimension: "sellerPaidAmount" as const,
        nextAmount: nextSnapshot.sellerPaidAmount,
        currentAmount: current.sellerPaidAmount,
      },
      {
        dimension: "buyerPaidAmount" as const,
        nextAmount: nextSnapshot.buyerPaidAmount,
        currentAmount: current.buyerPaidAmount,
      },
      {
        dimension: "projectedClosingCredit" as const,
        nextAmount: nextSnapshot.projectedClosingCredit,
        currentAmount: current.projectedClosingCredit,
      },
    ].filter((entry) => entry.nextAmount !== entry.currentAmount);

    for (const deltaEntry of deltaEntries) {
      await insertLedgerEntry(ctx, {
        dealRoom,
        compensation: {
          ...current,
          status: args.newStatus,
        },
        bucket: "projected",
        dimension: deltaEntry.dimension,
        amount: deltaEntry.nextAmount - deltaEntry.currentAmount,
        description: args.reason
          ? `Compensation transition to ${args.newStatus}: ${args.reason}`
          : `Compensation transition to ${args.newStatus}`,
        source: args.source,
        offerId: args.offerId,
        contractId: args.contractId,
        internalReviewState: args.internalReviewState,
        actorUserId: user._id,
        triggeredBy: args.triggeredBy,
        sourceDocument: args.sourceDocument,
      });
    }

    const now = new Date().toISOString();
    await ctx.db.patch(current._id, {
      status: args.newStatus,
      previousStatus: current.status,
      transitionReason: args.reason,
      transitionActorId: user._id,
      lastTransitionAt: now,
      updatedAt: now,
      ...nextSnapshot,
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
        ...nextSnapshot,
      }),
      timestamp: now,
    });

    return null;
  },
});

/** Initialize compensation status for a deal room (idempotent). Broker/admin only. */
export const initializeCompensationStatus = mutation({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");
    await ensureCompensationRecord(ctx, dealRoom, user._id);
    return null;
  },
});

/** Internal variant so deal-room creation can seed Unknown status immediately. */
export const initializeCompensationStatusInternal = internalMutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    actorUserId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");
    await ensureCompensationRecord(ctx, dealRoom, args.actorUserId);
    return null;
  },
});

/** Internal typed ledger write for trusted lifecycle hooks. */
export const createEntryInternal = internalMutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    bucket: feeLedgerBucket,
    dimension: feeLedgerDimension,
    amount: v.number(),
    description: v.string(),
    source: feeLedgerSource,
    offerId: v.optional(v.id("offers")),
    contractId: v.optional(v.id("contracts")),
    internalReviewState: v.optional(ledgerInternalReviewState),
    actorUserId: v.optional(v.id("users")),
    triggeredBy: v.optional(v.string()),
    sourceDocument: v.optional(v.string()),
  },
  returns: v.id("feeLedgerEntries"),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    const compensation = await ensureCompensationRecord(
      ctx,
      dealRoom,
      args.actorUserId,
    );
    const entryId = await insertLedgerEntry(ctx, {
      dealRoom,
      compensation,
      bucket: args.bucket,
      dimension: args.dimension,
      amount: args.amount,
      description: args.description,
      source: args.source,
      offerId: args.offerId,
      contractId: args.contractId,
      internalReviewState: args.internalReviewState,
      actorUserId: args.actorUserId,
      triggeredBy: args.triggeredBy,
      sourceDocument: args.sourceDocument,
    });

    if (args.bucket === "projected" && args.amount !== 0) {
      await ctx.db.patch(compensation._id, {
        ...applyProjectedDelta(compensation, args.dimension, args.amount),
        updatedAt: new Date().toISOString(),
      });
    }

    return entryId;
  },
});
