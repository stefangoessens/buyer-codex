import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/session";
import {
  reconcileBuyerFeeLedger,
  rollupBuyerFeeLedgerEntries,
} from "../packages/shared/src/contracts";

const DISCREPANCY_THRESHOLD = 50;

type LedgerEntryDoc = Doc<"feeLedgerEntries">;

function buildReconciliation(entries: LedgerEntryDoc[]) {
  const expected = rollupBuyerFeeLedgerEntries(entries, "projected");
  const hasActual = entries.some((entry) => entry.bucket === "actual");
  const actual = hasActual ? rollupBuyerFeeLedgerEntries(entries, "actual") : null;
  return reconcileBuyerFeeLedger(expected, actual, DISCREPANCY_THRESHOLD);
}

async function persistReport(
  ctx: MutationCtx,
  args: {
    dealRoomId: Id<"dealRooms">;
    reportType: "post_close" | "monthly";
    reportMonth?: string;
    actorUserId?: Id<"users">;
    internalRun?: boolean;
  },
): Promise<Id<"reconciliationReports">> {
  const ledgerEntries = await ctx.db
    .query("feeLedgerEntries")
    .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
    .collect();

  const reconciliation = buildReconciliation(ledgerEntries);
  const now = new Date().toISOString();

  const reportId = await ctx.db.insert("reconciliationReports", {
    dealRoomId: args.dealRoomId,
    reportType: args.reportType,
    expectedRollup: reconciliation.expected,
    actualRollup: reconciliation.actual ?? undefined,
    deltaRollup: reconciliation.delta ?? undefined,
    discrepancyAmount: reconciliation.discrepancyAmount ?? undefined,
    discrepancyDimensions:
      reconciliation.discrepancyDimensions.length > 0
        ? reconciliation.discrepancyDimensions
        : undefined,
    discrepancyFlag: reconciliation.discrepancyFlag,
    discrepancyDetails: reconciliation.discrepancyDetails,
    reviewStatus: "pending",
    reportMonth: args.reportMonth,
    generatedAt: now,
  });

  await ctx.db.insert("auditLog", {
    userId: args.actorUserId,
    action: "reconciliation_report_generated",
    entityType: "reconciliationReports",
    entityId: reportId,
    details: JSON.stringify({
      reportType: args.reportType,
      dealRoomId: args.dealRoomId,
      reportMonth: args.reportMonth ?? null,
      discrepancyFlag: reconciliation.discrepancyFlag,
      discrepancyDimensions: reconciliation.discrepancyDimensions,
      internal: args.internalRun ?? false,
    }),
    timestamp: now,
  });

  return reportId;
}

/** Get all reconciliation reports for a deal room. Broker/admin only. */
export const getReportsByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "broker");

    return await ctx.db
      .query("reconciliationReports")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
  },
});

/** Get all reconciliation reports for a given month. Broker/admin only. */
export const getReportsByMonth = query({
  args: { reportMonth: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    await requireRole(ctx, "broker");

    return await ctx.db
      .query("reconciliationReports")
      .withIndex("by_reportMonth", (q) => q.eq("reportMonth", args.reportMonth))
      .collect();
  },
});

/** Get all reports with discrepancyFlag=true and reviewStatus="pending". Broker/admin only. */
export const getPendingDiscrepancies = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireRole(ctx, "broker");

    const pending = await ctx.db
      .query("reconciliationReports")
      .withIndex("by_reviewStatus", (q) => q.eq("reviewStatus", "pending"))
      .collect();

    return pending.filter((report) => report.discrepancyFlag === true);
  },
});

/** Generate a post-close reconciliation report for a deal room. */
export const generatePostCloseReport = mutation({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.id("reconciliationReports"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    return await persistReport(ctx, {
      dealRoomId: args.dealRoomId,
      reportType: "post_close",
      actorUserId: user._id,
    });
  },
});

/** Record actual closing-statement amounts and generate a post-close report. */
export const recordActualClosing = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    actualSellerPaidAmount: v.number(),
    actualBuyerPaidAmount: v.number(),
    actualClosingCredit: v.number(),
    actualExpectedBuyerFee: v.optional(v.number()),
    sourceDocument: v.optional(v.string()),
    offerId: v.optional(v.id("offers")),
    contractId: v.optional(v.id("contracts")),
  },
  returns: v.id("reconciliationReports"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    const actualExpectedBuyerFee =
      args.actualExpectedBuyerFee ??
      args.actualSellerPaidAmount +
        args.actualBuyerPaidAmount -
        args.actualClosingCredit;

    const actualEntries = [
      {
        dimension: "expectedBuyerFee" as const,
        amount: actualExpectedBuyerFee,
      },
      {
        dimension: "sellerPaidAmount" as const,
        amount: args.actualSellerPaidAmount,
      },
      {
        dimension: "buyerPaidAmount" as const,
        amount: args.actualBuyerPaidAmount,
      },
      {
        dimension: "projectedClosingCredit" as const,
        amount: args.actualClosingCredit,
      },
    ];

    for (const entry of actualEntries) {
      await ctx.runMutation(internal.ledger.createEntryInternal, {
        dealRoomId: args.dealRoomId,
        bucket: "actual",
        dimension: entry.dimension,
        amount: entry.amount,
        description: "Actual closing statement amount",
        source: "closing_statement",
        offerId: args.offerId,
        contractId: args.contractId,
        actorUserId: user._id,
        triggeredBy: "reconciliation.recordActualClosing",
        sourceDocument: args.sourceDocument,
      });
    }

    return await persistReport(ctx, {
      dealRoomId: args.dealRoomId,
      reportType: "post_close",
      actorUserId: user._id,
    });
  },
});

/** Generate monthly reconciliation reports for all deal rooms closed in a given month. */
export const generateMonthlyReport = mutation({
  args: { reportMonth: v.string() },
  returns: v.array(v.id("reconciliationReports")),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");

    if (!/^\d{4}-\d{2}$/.test(args.reportMonth)) {
      throw new Error("reportMonth must be in YYYY-MM format");
    }

    const closedDealRooms = await ctx.db
      .query("dealRooms")
      .withIndex("by_buyerId_and_status")
      .collect();

    const matchingRooms = closedDealRooms.filter(
      (dealRoom) =>
        dealRoom.status === "closed" &&
        dealRoom.updatedAt.startsWith(args.reportMonth),
    );

    const reportIds: Id<"reconciliationReports">[] = [];
    for (const dealRoom of matchingRooms) {
      const reportId = await persistReport(ctx, {
        dealRoomId: dealRoom._id,
        reportType: "monthly",
        reportMonth: args.reportMonth,
        actorUserId: user._id,
      });
      reportIds.push(reportId);
    }

    return reportIds;
  },
});

/** Mark a discrepancy report as reviewed or resolved. */
export const reviewDiscrepancy = mutation({
  args: {
    reportId: v.id("reconciliationReports"),
    reviewStatus: v.union(v.literal("reviewed"), v.literal("resolved")),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Reconciliation report not found");

    const now = new Date().toISOString();
    await ctx.db.patch(args.reportId, {
      reviewStatus: args.reviewStatus,
      reviewedBy: user._id,
      reviewedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "reconciliation_discrepancy_reviewed",
      entityType: "reconciliationReports",
      entityId: args.reportId,
      details: JSON.stringify({
        reviewStatus: args.reviewStatus,
        notes: args.notes,
        previousStatus: report.reviewStatus,
      }),
      timestamp: now,
    });

    return null;
  },
});

/** Generate a post-close reconciliation report without auth. For internal use by lifecycle hooks. */
export const generatePostCloseReportInternal = internalMutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    actorUserId: v.optional(v.id("users")),
  },
  returns: v.id("reconciliationReports"),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");

    return await persistReport(ctx, {
      dealRoomId: args.dealRoomId,
      reportType: "post_close",
      actorUserId: args.actorUserId,
      internalRun: true,
    });
  },
});
