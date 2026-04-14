/**
 * File analysis job pipeline — Convex module (KIN-821).
 *
 * Orchestrates the upload → classify → extract → rule-eval → review
 * lifecycle for buyer/seller documents (seller disclosures, HOA docs,
 * inspection reports, title commitments, surveys). The actual analysis
 * engine is pure in `src/lib/ai/engines/docParser.ts`; this module
 * handles persistence, auth, findings fan-out, and review workflow.
 *
 * Role-based visibility:
 *   - Buyer: their own jobs + buyer-visible finding fields (no internal
 *     notes, no review metadata beyond "review required")
 *   - Broker/admin: everything
 *
 * High-severity findings CANNOT be auto-resolved. A broker must
 * explicitly review and resolve them via `resolveJob`.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  assertAllowedJobTransition,
  buildAnalysisSnapshot,
  deriveJobOutcome,
  serializeAnalysisSnapshot,
} from "./lib/fileAnalysisPipeline";

// ═══ Shared validators ═══

const docTypeValidator = v.union(
  v.literal("unknown"),
  v.literal("seller_disclosure"),
  v.literal("hoa_document"),
  v.literal("inspection_report"),
  v.literal("title_commitment"),
  v.literal("survey"),
  v.literal("other"),
);

const severityValidator = v.union(
  v.literal("info"),
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

const ruleValidator = v.union(
  v.literal("roof_age_insurability"),
  v.literal("hoa_reserves_adequate"),
  v.literal("sirs_inspection_status"),
  v.literal("flood_zone_risk"),
  v.literal("permit_irregularity"),
  v.literal("lien_or_encumbrance"),
);

const analysisDocTypeValidator = v.union(
  v.literal("seller_disclosure"),
  v.literal("hoa_document"),
  v.literal("inspection_report"),
  v.literal("title_commitment"),
  v.literal("survey"),
  v.literal("other"),
);

const citationValidator = v.object({
  pageNumber: v.optional(v.number()),
  lineStart: v.optional(v.number()),
  lineEnd: v.optional(v.number()),
  snippet: v.optional(v.string()),
});

const pageClassificationValidator = v.object({
  pageNumber: v.number(),
  docType: analysisDocTypeValidator,
  confidence: v.number(),
});

const extractedFactsValidator = v.object({
  docType: analysisDocTypeValidator,
  classifierConfidence: v.number(),
  effectiveDate: v.optional(v.string()),
  roofAgeYears: v.optional(v.number()),
  roofReplacementYear: v.optional(v.number()),
  floodZone: v.optional(v.string()),
  knownLeaks: v.optional(v.boolean()),
  priorClaimsCount: v.optional(v.number()),
  permitsDisclosed: v.optional(
    v.union(v.literal("yes"), v.literal("no"), v.literal("unknown")),
  ),
  unpermittedWorkMentioned: v.optional(v.boolean()),
  hoaReserveBalance: v.optional(v.number()),
  hoaAnnualBudget: v.optional(v.number()),
  hoaSpecialAssessments: v.optional(
    v.array(
      v.object({
        amount: v.number(),
        purpose: v.string(),
      }),
    ),
  ),
  hoaReserveStudyDate: v.optional(v.string()),
  buildingYearBuilt: v.optional(v.number()),
  buildingStories: v.optional(v.number()),
  milestoneInspectionDate: v.optional(v.string()),
  sirsCompletedDate: v.optional(v.string()),
  titleExceptions: v.optional(v.array(v.string())),
  lienCount: v.optional(v.number()),
  majorDefectCount: v.optional(v.number()),
  recommendedRepairsCount: v.optional(v.number()),
});

const analysisFindingValidator = v.object({
  rule: ruleValidator,
  severity: severityValidator,
  label: v.string(),
  summary: v.string(),
  confidence: v.number(),
  requiresReview: v.boolean(),
  citation: v.optional(citationValidator),
  observedData: v.optional(v.any()),
});

const analysisResultValidator = v.object({
  docType: analysisDocTypeValidator,
  facts: extractedFactsValidator,
  findings: v.array(analysisFindingValidator),
  overallSeverity: severityValidator,
  overallConfidence: v.number(),
  requiresBrokerReview: v.boolean(),
  plainEnglishSummary: v.string(),
  buyerFacts: v.array(v.string()),
  pageClassifications: v.array(pageClassificationValidator),
  promptKey: v.string(),
  promptVersion: v.string(),
  engineVersion: v.string(),
});

// ═══ Access helpers ═══

async function canReadDealRoom(
  ctx: QueryCtx,
  dealRoomId: Id<"dealRooms">,
): Promise<"buyer" | "broker" | "admin" | null> {
  const user = await requireAuth(ctx);
  const dealRoom = await ctx.db.get(dealRoomId);
  if (!dealRoom) return null;

  if (dealRoom.buyerId === user._id) return "buyer";
  if (user.role === "broker") return "broker";
  if (user.role === "admin") return "admin";
  return null;
}

/** Strip internal-only fields from a job for buyer-facing responses. */
function stripJobForBuyer(job: Doc<"fileAnalysisJobs">): Record<string, unknown> {
  const {
    payload: _payload,
    overallConfidence: _confidence,
    engineVersion: _engineVersion,
    promptKey: _promptKey,
    promptVersion: _promptVersion,
    reviewedBy: _r,
    reviewNotes: _rn,
    errorCount: _ec,
    errorMessage: _em,
    ...buyerVisible
  } = job;
  return buyerVisible;
}

/** Strip internal-only fields from a finding for buyer-facing responses. */
function stripFindingForBuyer(
  finding: Doc<"fileAnalysisFindings">,
): Record<string, unknown> {
  const {
    resolutionNotes: _notes,
    resolvedBy: _by,
    ...buyerVisible
  } = finding;
  return buyerVisible;
}

async function reconcileProjectedFactsForJob(
  ctx: any,
  args: {
    jobId: Id<"fileAnalysisJobs">;
    storageId: Id<"_storage">;
    propertyId: Id<"properties">;
    dealRoomId: Id<"dealRooms">;
    factProjections: ReturnType<typeof buildAnalysisSnapshot>["factProjections"];
    now: string;
  },
): Promise<void> {
  if (args.factProjections.length === 0) return;

  const existingFacts = await ctx.db
    .query("fileFacts")
    .withIndex("by_storageId", (q: any) => q.eq("storageId", args.storageId))
    .collect();

  for (const projection of args.factProjections) {
    for (const existing of existingFacts) {
      if (
        existing.factSlug === projection.factSlug &&
        existing.reviewStatus !== "superseded"
      ) {
        await ctx.db.patch(existing._id, {
          reviewStatus: "superseded",
          reviewedBy: existing.reviewedBy ?? "system:file_analysis",
          reviewedAt: args.now,
          updatedAt: args.now,
        });
      }
    }

    await ctx.db.insert("fileFacts", {
      factSlug: projection.factSlug,
      storageId: args.storageId,
      propertyId: args.propertyId,
      dealRoomId: args.dealRoomId,
      analysisRunId: args.jobId,
      valueKind: projection.valueKind,
      valueNumeric:
        projection.valueKind === "numeric"
          ? projection.valueNumeric
          : undefined,
      valueNumericUnit:
        projection.valueKind === "numeric"
          ? projection.valueNumericUnit
          : undefined,
      valueText: projection.valueKind === "text" ? projection.valueText : undefined,
      valueDate: projection.valueKind === "date" ? projection.valueDate : undefined,
      valueBoolean:
        projection.valueKind === "boolean" ? projection.valueBoolean : undefined,
      valueEnum: projection.valueKind === "enum" ? projection.valueEnum : undefined,
      valueEnumAllowed:
        projection.valueKind === "enum"
          ? projection.valueEnumAllowed
          : undefined,
      confidence: projection.confidence,
      reviewStatus: "needsReview",
      internalOnly: projection.internalOnly,
      createdAt: args.now,
      updatedAt: args.now,
    });
  }
}

// ═══ Queries ═══

/** List all jobs for a deal room. Access-gated. */
export const listByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const access = await canReadDealRoom(ctx, args.dealRoomId);
    if (!access) return [];

    const jobs = await ctx.db
      .query("fileAnalysisJobs")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
    const sorted = jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return access === "buyer" ? sorted.map(stripJobForBuyer) : sorted;
  },
});

/** Get a single job with its findings, access-filtered. */
export const getWithFindings = query({
  args: { jobId: v.id("fileAnalysisJobs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return null;
    const access = await canReadDealRoom(ctx, job.dealRoomId);
    if (!access) return null;

    const findings = await ctx.db
      .query("fileAnalysisFindings")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (access === "buyer") {
      const buyerVisibleFindings =
        job.status === "completed" || job.status === "resolved"
          ? findings.map(stripFindingForBuyer)
          : [];
      return {
        job: stripJobForBuyer(job),
        findings: buyerVisibleFindings,
      };
    }
    return { job, findings };
  },
});

/** Ops review queue — findings that require broker review, by severity. */
export const listReviewQueue = query({
  args: { severity: v.optional(severityValidator) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") return [];

    const flagged = await ctx.db
      .query("fileAnalysisFindings")
      .withIndex("by_requiresReview_and_severity", (q) =>
        q.eq("requiresReview", true),
      )
      .collect();

    const unresolved = flagged.filter((f) => f.resolvedAt === undefined);
    const filtered = args.severity
      ? unresolved.filter((f) => f.severity === args.severity)
      : unresolved;

    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

// ═══ Mutations ═══

/**
 * Enqueue a new analysis job. Buyer or broker can submit; the job starts
 * in `queued` state and is picked up by a background action that runs
 * the engine and calls `recordAnalysisResult`.
 */
export const enqueueJob = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    fileStorageId: v.id("_storage"),
    fileName: v.string(),
  },
  returns: v.id("fileAnalysisJobs"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) throw new Error("Deal room not found");
    if (
      dealRoom.buyerId !== user._id &&
      user.role !== "broker" &&
      user.role !== "admin"
    ) {
      throw new Error("Not authorized to enqueue analysis jobs for this deal room");
    }

    const now = new Date().toISOString();
    const id = await ctx.db.insert("fileAnalysisJobs", {
      dealRoomId: args.dealRoomId,
      propertyId: dealRoom.propertyId,
      fileStorageId: args.fileStorageId,
      fileName: args.fileName,
      docType: "unknown",
      status: "queued",
      errorCount: 0,
      uploadedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "file_analysis_job_enqueued",
      entityType: "fileAnalysisJobs",
      entityId: id,
      details: JSON.stringify({ fileName: args.fileName }),
      timestamp: now,
    });

    return id;
  },
});

/**
 * Mark a job as running — called by the background worker before it
 * invokes the analysis engine. Internal only.
 */
export const markRunning = internalMutation({
  args: { jobId: v.id("fileAnalysisJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    assertAllowedJobTransition(job.status, "running");
    await ctx.db.patch(args.jobId, {
      status: "running",
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

/**
 * Record the analysis result from the engine. Inserts findings fan-out
 * and transitions the job to `completed` or `review_required`. Internal —
 * called by the worker.
 *
 * Idempotency + safety:
 *   - REJECTS calls unless the job is in `running` state. Prevents a
 *     replayed/internal duplicate call from overwriting a
 *     completed/review_required/resolved job and reopening already-
 *     reviewed work.
 *   - The requiresBrokerReview flag is IGNORED — computed from the
 *     findings payload directly (any finding.requiresReview === true).
 *     This prevents a mismatched caller from marking a job "completed"
 *     when findings still need review.
 */
export const recordAnalysisResult = internalMutation({
  args: {
    jobId: v.id("fileAnalysisJobs"),
    analysis: analysisResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    // Only accept result writes for jobs currently in `running` state.
    // This guards against replayed worker calls after the job has
    // already transitioned to completed/review_required/resolved.
    if (job.status !== "running") {
      throw new Error(
        `Cannot record analysis result on job in status "${job.status}" — only running jobs accept results`,
      );
    }

    const now = new Date().toISOString();
    const snapshot = buildAnalysisSnapshot(args.analysis);
    const { requiresBrokerReview, nextStatus } = deriveJobOutcome(args.analysis);
    assertAllowedJobTransition(job.status, nextStatus);

    await ctx.db.patch(args.jobId, {
      docType: args.analysis.docType,
      status: nextStatus,
      payload: serializeAnalysisSnapshot(snapshot),
      overallSeverity: args.analysis.overallSeverity,
      overallConfidence: args.analysis.overallConfidence,
      requiresBrokerReview,
      engineVersion: args.analysis.engineVersion,
      promptKey: args.analysis.promptKey,
      promptVersion: args.analysis.promptVersion,
      errorMessage: undefined,
      updatedAt: now,
      completedAt: now,
    });

    // Fan out findings so the review queue can index them directly.
    for (const finding of args.analysis.findings) {
      await ctx.db.insert("fileAnalysisFindings", {
        jobId: args.jobId,
        dealRoomId: job.dealRoomId,
        rule: finding.rule,
        severity: finding.severity,
        label: finding.label,
        summary: finding.summary,
        confidence: finding.confidence,
        requiresReview: finding.requiresReview,
        citationPageNumber: finding.citation?.pageNumber,
        citationLineStart: finding.citation?.lineStart,
        citationLineEnd: finding.citation?.lineEnd,
        citationSnippet: finding.citation?.snippet,
        observedDataJson: finding.observedData
          ? JSON.stringify(finding.observedData)
          : undefined,
        createdAt: now,
      });
    }

    await reconcileProjectedFactsForJob(ctx, {
      jobId: args.jobId,
      storageId: job.fileStorageId,
      propertyId: job.propertyId,
      dealRoomId: job.dealRoomId,
      factProjections: snapshot.factProjections,
      now,
    });

    await ctx.db.insert("auditLog", {
      action: `file_analysis_${nextStatus}`,
      entityType: "fileAnalysisJobs",
      entityId: args.jobId,
      details: JSON.stringify({
        docType: args.analysis.docType,
        severity: args.analysis.overallSeverity,
        findingCount: args.analysis.findings.length,
        promptKey: args.analysis.promptKey,
        promptVersion: args.analysis.promptVersion,
        factProjectionCount: snapshot.factProjections.length,
      }),
      timestamp: now,
    });

    return null;
  },
});

/**
 * Record a failure in analysis. Bumps errorCount, stores message, keeps
 * the job queryable for retry. Internal.
 *
 * Same guard as recordAnalysisResult: only accepts failure callbacks
 * for jobs currently in `running` state. Prevents a replayed/duplicate
 * worker failure callback from reopening a completed/review_required/
 * resolved job — which would otherwise corrupt already-reviewed work.
 */
export const recordFailure = internalMutation({
  args: {
    jobId: v.id("fileAnalysisJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    if (job.status !== "running") {
      throw new Error(
        `Cannot record failure on job in status "${job.status}" — only running jobs accept failure callbacks`,
      );
    }

    const now = new Date().toISOString();
    assertAllowedJobTransition(job.status, "failed");
    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
      errorCount: job.errorCount + 1,
      updatedAt: now,
    });

    await ctx.db.insert("auditLog", {
      action: "file_analysis_failed",
      entityType: "fileAnalysisJobs",
      entityId: args.jobId,
      details: JSON.stringify({
        errorMessage: args.errorMessage,
        errorCount: job.errorCount + 1,
      }),
      timestamp: now,
    });

    return null;
  },
});

/**
 * Retry a failed job — resets status to queued so the worker picks it
 * up again. Broker/admin only.
 */
export const retryJob = mutation({
  args: { jobId: v.id("fileAnalysisJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can retry failed jobs");
    }
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    assertAllowedJobTransition(job.status, "queued");
    const now = new Date().toISOString();
    await ctx.db.patch(args.jobId, {
      status: "queued",
      errorMessage: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "file_analysis_retry",
      entityType: "fileAnalysisJobs",
      entityId: args.jobId,
      timestamp: now,
    });
    return null;
  },
});

/**
 * Resolve a review-required job. Broker/admin only. Sets status to
 * "resolved" and allows optional resolution notes. Cannot be called on
 * jobs that aren't in review_required state — this enforces the rule
 * that high-severity findings must go through explicit review.
 */
export const resolveJob = mutation({
  args: {
    jobId: v.id("fileAnalysisJobs"),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers/admins can resolve review jobs");
    }
    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    assertAllowedJobTransition(job.status, "resolved");

    const now = new Date().toISOString();
    await ctx.db.patch(args.jobId, {
      status: "resolved",
      reviewedBy: user._id,
      reviewNotes: args.notes,
      resolvedAt: now,
      updatedAt: now,
    });

    // Mark all findings for this job as resolved.
    const findings = await ctx.db
      .query("fileAnalysisFindings")
      .withIndex("by_jobId", (q) => q.eq("jobId", args.jobId))
      .collect();
    for (const finding of findings) {
      if (finding.resolvedAt === undefined) {
        await ctx.db.patch(finding._id, {
          resolvedAt: now,
          resolvedBy: user._id,
          resolutionNotes: args.notes,
        });
      }
    }

    await ctx.db.insert("auditLog", {
      userId: user._id,
      action: "file_analysis_resolved",
      entityType: "fileAnalysisJobs",
      entityId: args.jobId,
      details: args.notes ? JSON.stringify({ notes: args.notes }) : undefined,
      timestamp: now,
    });

    return null;
  },
});
