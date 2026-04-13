import {
  reconcileBuyerFeeLedger,
  rollupBuyerFeeLedgerEntries,
  type BuyerFeeLedgerEntryRecord,
} from "@buyer-codex/shared";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireRole } from "./lib/session";

const DISCREPANCY_THRESHOLD = 50;

type FeeLedgerEntryDoc = Doc<"feeLedgerEntries">;

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

async function loadLedgerEntries(
  ctx: { db: { query: any } },
  dealRoomId: Id<"dealRooms">,
) {
  const entries = await ctx.db
    .query("feeLedgerEntries")
    .withIndex("by_dealRoomId", (q: any) => q.eq("dealRoomId", dealRoomId))
    .collect();

  return (entries as FeeLedgerEntryDoc[]).map(toLedgerEntryRecord);
}

function buildReportFields(
  entries: BuyerFeeLedgerEntryRecord<
    Id<"feeLedgerEntries"> | Id<"offers"> | Id<"contracts"> | Id<"users"> | Id<"dealRooms">
  >[],
) {
  const expectedRollup = rollupBuyerFeeLedgerEntries(entries, "projected");
  const hasActualEntries = entries.some((entry) => entry.bucket === "actual");
  const actualRollup = hasActualEntries
    ? rollupBuyerFeeLedgerEntries(entries, "actual")
    : null;
  const reconciliation = reconcileBuyerFeeLedger(
    expectedRollup,
    actualRollup,
    DISCREPANCY_THRESHOLD,
  );

  return {
    expectedRollup,
    actualRollup: reconciliation.actual ?? undefined,
    deltaRollup: reconciliation.delta ?? undefined,
    discrepancyAmount: reconciliation.discrepancyAmount ?? undefined,
    discrepancyDimensions:
      reconciliation.discrepancyDimensions.length > 0
        ? reconciliation.discrepancyDimensions
        : undefined,
    discrepancyFlag: reconciliation.discrepancyFlag,
    discrepancyDetails: reconciliation.discrepancyDetails,
  };
}

async function insertReport(
  ctx: { db: { insert: any } },
  args: {
    dealRoomId: Id<"dealRooms">;
    reportType: "post_close" | "monthly";
    generatedAt: string;
    reportMonth?: string;
    entries: BuyerFeeLedgerEntryRecord<
      Id<"feeLedgerEntries"> | Id<"offers"> | Id<"contracts"> | Id<"users"> | Id<"dealRooms">
    >[];
  },
) {
  return await ctx.db.insert("reconciliationReports", {
    dealRoomId: args.dealRoomId,
    reportType: args.reportType,
    ...buildReportFields(args.entries),
    reviewStatus: "pending",
    reportMonth: args.reportMonth,
    generatedAt: args.generatedAt,
  });
}

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

export const getPendingDiscrepancies = query({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx) => {
    await requireRole(ctx, "broker");

    const pending = await ctx.db
      .query("reconciliationReports")
      .withIndex("by_reviewStatus", (q) => q.eq("reviewStatus", "pending"))
      .collect();

    return pending.filter((report) => report.discrepancyFlag);
  },
});

export const generatePostCloseReport = mutation({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.id("reconciliationReports"),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      throw new Error("Deal room not found");
    }

    const generatedAt = new Date().toISOString();
    const entries = await loadLedgerEntries(ctx, args.dealRoomId);
    const reportId = await insertReport(ctx, {
      dealRoomId: args.dealRoomId,
      reportType: "post_close",
      generatedAt,
      entries,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "reconciliation_report_generated",
      entityType: "reconciliationReports",
      entityId: reportId,
      details: JSON.stringify({
        reportType: "post_close",
        dealRoomId: args.dealRoomId,
      }),
      timestamp: generatedAt,
    });

    return reportId;
  },
});

export const recordActualClosing = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    actualAmount: v.number(),
    sourceDocument: v.optional(v.string()),
  },
  returns: v.id("reconciliationReports"),
  handler: async () => {
    throw new Error(
      "recordActualClosing uses the legacy single-total API and is intentionally disabled after the fee-ledger rollup migration. Write actual bucket ledger entries instead, then call generatePostCloseReport.",
    );
  },
});

export const generateMonthlyReport = mutation({
  args: { reportMonth: v.string() },
  returns: v.array(v.id("reconciliationReports")),
  handler: async (ctx, args) => {
    const user = await requireRole(ctx, "broker");

    if (!/^\d{4}-\d{2}$/.test(args.reportMonth)) {
      throw new Error("reportMonth must be in YYYY-MM format");
    }

    const dealRooms = await ctx.db.query("dealRooms").collect();
    const matchingRooms = dealRooms.filter(
      (dealRoom) =>
        dealRoom.status === "closed" &&
        dealRoom.updatedAt.startsWith(args.reportMonth),
    );
    const generatedAt = new Date().toISOString();
    const reportIds: Id<"reconciliationReports">[] = [];

    for (const dealRoom of matchingRooms) {
      const reportId = await insertReport(ctx, {
        dealRoomId: dealRoom._id,
        reportType: "monthly",
        generatedAt,
        reportMonth: args.reportMonth,
        entries: await loadLedgerEntries(ctx, dealRoom._id),
      });

      reportIds.push(reportId);
      await ctx.db.insert("auditLog", {
        userId: user._id,
        action: "reconciliation_report_generated",
        entityType: "reconciliationReports",
        entityId: reportId,
        details: JSON.stringify({
          reportType: "monthly",
          reportMonth: args.reportMonth,
          dealRoomId: dealRoom._id,
        }),
        timestamp: generatedAt,
      });
    }

    return reportIds;
  },
});

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

    if (!report) {
      throw new Error("Reconciliation report not found");
    }

    const reviewedAt = new Date().toISOString();
    await ctx.db.patch(args.reportId, {
      reviewStatus: args.reviewStatus,
      reviewedBy: user._id,
      reviewedAt,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "reconciliation_discrepancy_reviewed",
      entityType: "reconciliationReports",
      entityId: args.reportId,
      details: JSON.stringify({
        previousStatus: report.reviewStatus,
        reviewStatus: args.reviewStatus,
        notes: args.notes,
      }),
      timestamp: reviewedAt,
    });

    return null;
  },
});

export const generatePostCloseReportInternal = internalMutation({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.id("reconciliationReports"),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);

    if (!dealRoom) {
      throw new Error("Deal room not found");
    }

    const generatedAt = new Date().toISOString();
    const reportId = await insertReport(ctx, {
      dealRoomId: args.dealRoomId,
      reportType: "post_close",
      generatedAt,
      entries: await loadLedgerEntries(ctx, args.dealRoomId),
    });

    await ctx.db.insert("auditLog", {
      action: "reconciliation_report_generated",
      entityType: "reconciliationReports",
      entityId: reportId,
      details: JSON.stringify({
        reportType: "post_close",
        dealRoomId: args.dealRoomId,
        internal: true,
      }),
      timestamp: generatedAt,
    });

    return reportId;
  },
});
