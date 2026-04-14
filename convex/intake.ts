import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { getSessionContext } from "./lib/session";
import {
  buildSourceUrlLookupCandidates,
  parseListingUrl,
} from "./lib/listingUrlParser";
import {
  failureModeFromParseCode,
  mergeSourceListingReliability,
  parseSourceListingRawData,
  readSourceListingReliability,
  retryableFromFailureMode,
  statusFromFailureMode,
  type IntakeAttemptStatus,
  type IntakeFailureMode,
} from "../src/lib/intake/reliability";

const sourcePlatformValidator = v.union(
  v.literal("zillow"),
  v.literal("redfin"),
  v.literal("realtor"),
);

const intakeSubmitOutcomeValidator = v.union(
  v.literal("created"),
  v.literal("duplicate"),
);

const intakeChannelValidator = v.union(
  v.literal("hero"),
  v.literal("compact"),
  v.literal("home"),
  v.literal("blog"),
  v.literal("city"),
  v.literal("community"),
  v.literal("newconstruction"),
  v.literal("extension"),
  v.literal("share_import"),
  v.literal("sms"),
  v.literal("manual_address"),
  v.literal("unknown"),
);

const extensionUnsupportedCodeValidator = v.union(
  v.literal("malformed_url"),
  v.literal("missing_listing_id"),
  v.literal("unsupported_url"),
);

const intakeAttemptStatusValidator = v.union(
  v.literal("pending"),
  v.literal("ready"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("unsupported"),
);

const intakeFailureModeValidator = v.union(
  v.literal("unsupported_url"),
  v.literal("malformed_url"),
  v.literal("missing_listing_id"),
  v.literal("parser_failed"),
  v.literal("partial_extraction"),
  v.literal("no_match"),
  v.literal("ambiguous_match"),
  v.literal("low_confidence_match"),
  v.literal("unknown"),
);

const extensionIntakeResultValidator = v.union(
  v.object({
    kind: v.literal("created"),
    authState: v.union(v.literal("signed_in"), v.literal("signed_out")),
    sourceListingId: v.id("sourceListings"),
    attemptId: v.id("intakeAttempts"),
    platform: sourcePlatformValidator,
    listingId: v.string(),
    normalizedUrl: v.string(),
  }),
  v.object({
    kind: v.literal("duplicate"),
    authState: v.union(v.literal("signed_in"), v.literal("signed_out")),
    sourceListingId: v.id("sourceListings"),
    attemptId: v.id("intakeAttempts"),
    platform: sourcePlatformValidator,
    listingId: v.string(),
    normalizedUrl: v.string(),
  }),
  v.object({
    kind: v.literal("unsupported"),
    code: extensionUnsupportedCodeValidator,
    error: v.string(),
    platform: v.optional(sourcePlatformValidator),
  }),
);

async function findExistingSourceListing(
  ctx: MutationCtx,
  rawUrl: string,
  normalizedUrl: string,
) {
  for (const sourceUrl of buildSourceUrlLookupCandidates(rawUrl, normalizedUrl)) {
    const existing = await ctx.db
      .query("sourceListings")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", sourceUrl))
      .first();

    if (existing) {
      return existing;
    }
  }

  return null;
}

function resolveSubmittedAt(submittedAt: string | undefined): string {
  if (submittedAt) {
    const parsed = Date.parse(submittedAt);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function buildSourceListingRawData(args: {
  channel: string;
  rawUrl: string;
  existingRawData?: string;
}) {
  const envelope = parseSourceListingRawData(args.existingRawData);
  envelope.source = args.channel;
  envelope.rawUrl = args.rawUrl;
  return mergeSourceListingReliability(JSON.stringify(envelope), {
    resolutionStatus: "pending",
    updatedAt: new Date().toISOString(),
  });
}

function attemptStatusFromSourceListing(
  sourceListing:
    | {
        propertyId?: string | null;
        status: string;
        rawData?: string;
      }
    | null,
): {
  status: IntakeAttemptStatus;
  failureMode?: IntakeFailureMode;
  retryable?: boolean;
  missingFields?: string[];
} {
  if (!sourceListing) {
    return { status: "pending" };
  }

  if (sourceListing.propertyId) {
    return { status: "ready" };
  }

  const reliability = readSourceListingReliability(sourceListing.rawData);
  if (reliability?.resolutionStatus === "partial") {
    return {
      status: "partial",
      failureMode: reliability.failureMode ?? "partial_extraction",
      retryable: reliability.retryable ?? true,
      missingFields: reliability.missingFields,
    };
  }

  if (
    sourceListing.status === "failed" ||
    reliability?.resolutionStatus === "failed"
  ) {
    return {
      status: "failed",
      failureMode: reliability?.failureMode ?? "unknown",
      retryable: reliability?.retryable ?? true,
      missingFields: reliability?.missingFields,
    };
  }

  return {
    status: "pending",
    failureMode: reliability?.failureMode,
    retryable: reliability?.retryable,
    missingFields: reliability?.missingFields,
  };
}

async function insertAttempt(
  ctx: MutationCtx,
  args: {
    sourceListingId?: Id<"sourceListings">;
    sourcePlatform?: "zillow" | "redfin" | "realtor" | "manual";
    intakeChannel:
      | "hero"
      | "compact"
      | "home"
      | "blog"
      | "city"
      | "community"
      | "newconstruction"
      | "extension"
      | "share_import"
      | "sms"
      | "manual_address"
      | "unknown";
    rawInput: string;
    normalizedInput?: string;
    submittedAt?: string;
    status: IntakeAttemptStatus;
    failureMode?: IntakeFailureMode;
    retryable?: boolean;
    missingFields?: string[];
  },
) {
  return await ctx.db.insert("intakeAttempts", {
    sourceListingId: args.sourceListingId,
    sourcePlatform: args.sourcePlatform,
    intakeChannel: args.intakeChannel,
    rawInput: args.rawInput,
    normalizedInput: args.normalizedInput,
    submittedAt: resolveSubmittedAt(args.submittedAt),
    status: args.status,
    failureMode: args.failureMode,
    retryable: args.retryable,
    missingFields: args.missingFields,
  });
}

async function touchAttemptsForSourceListing(
  ctx: MutationCtx,
  args: {
    sourceListingId: Id<"sourceListings">;
    status: IntakeAttemptStatus;
    failureMode?: IntakeFailureMode;
    retryable?: boolean;
    missingFields?: string[];
  },
) {
  const attempts = await ctx.db
    .query("intakeAttempts")
    .withIndex("by_sourceListingId", (q) => q.eq("sourceListingId", args.sourceListingId))
    .collect();

  const patch: Record<string, unknown> = {
    status: args.status,
  };
  if (args.failureMode !== undefined) patch.failureMode = args.failureMode;
  if (args.retryable !== undefined) patch.retryable = args.retryable;
  if (args.missingFields !== undefined) patch.missingFields = args.missingFields;

  for (const attempt of attempts) {
    await ctx.db.patch(attempt._id, patch);
  }
}

export const recordAttemptFailure = mutation({
  args: {
    url: v.string(),
    source: v.optional(intakeChannelValidator),
    submittedAt: v.optional(v.string()),
  },
  returns: v.id("intakeAttempts"),
  handler: async (ctx, args) => {
    const parsed = parseListingUrl(args.url);
    if (parsed.success) {
      throw new Error("recordAttemptFailure expects a parser failure");
    }

    const failureMode = failureModeFromParseCode(parsed.error.code);
    return await insertAttempt(ctx, {
      sourcePlatform: parsed.error.platform,
      intakeChannel: args.source ?? "unknown",
      rawInput: args.url,
      submittedAt: args.submittedAt,
      status: statusFromFailureMode(failureMode),
      failureMode,
      retryable: retryableFromFailureMode(failureMode),
    });
  },
});

export const markAttemptTeaserViewed = mutation({
  args: {
    attemptId: v.id("intakeAttempts"),
    viewedAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;
    await ctx.db.patch(args.attemptId, {
      teaserViewedAt: resolveSubmittedAt(args.viewedAt),
    });
    return null;
  },
});

export const markAttemptDossierReady = mutation({
  args: {
    attemptId: v.id("intakeAttempts"),
    readyAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;
    await ctx.db.patch(args.attemptId, {
      dossierReadyAt: resolveSubmittedAt(args.readyAt),
      status: attempt.status === "partial" ? "partial" : "ready",
    });
    return null;
  },
});

export const recordSourceListingOutcome = internalMutation({
  args: {
    sourceListingId: v.id("sourceListings"),
    status: intakeAttemptStatusValidator,
    failureMode: v.optional(intakeFailureModeValidator),
    retryable: v.optional(v.boolean()),
    missingFields: v.optional(v.array(v.string())),
    note: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    observedAt: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sourceListing = await ctx.db.get(args.sourceListingId);
    if (!sourceListing) return null;

    const observedAt = resolveSubmittedAt(args.observedAt);
    const nextSourceListingStatus =
      args.status === "ready"
        ? args.propertyId
          ? "merged"
          : "extracted"
        : args.status === "partial"
          ? "extracted"
          : args.status === "failed" || args.status === "unsupported"
            ? "failed"
            : "pending";

    await ctx.db.patch(args.sourceListingId, {
      propertyId: args.propertyId ?? sourceListing.propertyId,
      status: nextSourceListingStatus,
      rawData: mergeSourceListingReliability(sourceListing.rawData, {
        resolutionStatus:
          args.status === "unsupported" ? "failed" : (args.status as Exclude<
            IntakeAttemptStatus,
            "unsupported"
          >),
        failureMode: args.failureMode,
        retryable: args.retryable,
        missingFields: args.missingFields,
        note: args.note,
        updatedAt: observedAt,
      }),
    });

    await touchAttemptsForSourceListing(ctx, {
      sourceListingId: args.sourceListingId,
      status: args.status,
      failureMode: args.failureMode,
      retryable: args.retryable,
      missingFields: args.missingFields,
    });

    return null;
  },
});

/**
 * Submit a listing URL for intake processing.
 * Public mutation — called from the paste-link hero and authenticated app.
 */
export const submitUrl = mutation({
  args: {
    url: v.string(),
    source: v.optional(intakeChannelValidator),
    submittedAt: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      success: v.literal(true),
      outcome: intakeSubmitOutcomeValidator,
      sourceListingId: v.id("sourceListings"),
      attemptId: v.id("intakeAttempts"),
      platform: sourcePlatformValidator,
      listingId: v.string(),
      normalizedUrl: v.string(),
    }),
    v.object({
      success: v.literal(false),
      error: v.string(),
      code: extensionUnsupportedCodeValidator,
    }),
  ),
  handler: async (ctx, args) => {
    const parsed = parseListingUrl(args.url);

    if (!parsed.success) {
      return {
        success: false as const,
        error: parsed.error.message,
        code: parsed.error.code,
      };
    }

    const existing = await findExistingSourceListing(
      ctx,
      parsed.data.rawUrl,
      parsed.data.normalizedUrl,
    );

    if (existing) {
      const attemptResolution = attemptStatusFromSourceListing(existing);
      const attemptId = await insertAttempt(ctx, {
        sourceListingId: existing._id,
        sourcePlatform: parsed.data.platform,
        intakeChannel: args.source ?? "unknown",
        rawInput: parsed.data.rawUrl,
        normalizedInput: parsed.data.normalizedUrl,
        submittedAt: args.submittedAt,
        status: attemptResolution.status,
        failureMode: attemptResolution.failureMode,
        retryable: attemptResolution.retryable,
        missingFields: attemptResolution.missingFields,
      });
      return {
        success: true as const,
        outcome: "duplicate" as const,
        sourceListingId: existing._id,
        attemptId,
        platform: parsed.data.platform,
        listingId: parsed.data.listingId,
        normalizedUrl: parsed.data.normalizedUrl,
      };
    }

    const now = new Date().toISOString();
    const sourceListingId = await ctx.db.insert("sourceListings", {
      sourcePlatform: parsed.data.platform,
      sourceUrl: parsed.data.normalizedUrl,
      rawData: buildSourceListingRawData({
        channel: args.source ?? "unknown",
        rawUrl: parsed.data.rawUrl,
      }),
      extractedAt: now,
      status: "pending",
    });
    const attemptId = await insertAttempt(ctx, {
      sourceListingId,
      sourcePlatform: parsed.data.platform,
      intakeChannel: args.source ?? "unknown",
      rawInput: parsed.data.rawUrl,
      normalizedInput: parsed.data.normalizedUrl,
      submittedAt: args.submittedAt ?? now,
      status: "pending",
    });

    return {
      success: true as const,
      outcome: "created" as const,
      sourceListingId,
      attemptId,
      platform: parsed.data.platform,
      listingId: parsed.data.listingId,
      normalizedUrl: parsed.data.normalizedUrl,
    };
  },
});

/**
 * Extension-specific intake entrypoint.
 *
 * It canonicalizes the raw browser URL on the backend, resolves duplicate vs
 * new intake rows, and reports whether the caller was authenticated when the
 * handoff was made.
 */
export const submitExtensionUrl = mutation({
  args: {
    url: v.string(),
  },
  returns: extensionIntakeResultValidator,
  handler: async (ctx, args) => {
    const parsed = parseListingUrl(args.url);

    if (!parsed.success) {
      return {
        kind: "unsupported" as const,
        code: parsed.error.code,
        error: parsed.error.message,
        platform: parsed.error.platform,
      };
    }

    const session = await getSessionContext(ctx);
    const authState: "signed_in" | "signed_out" =
      session.kind === "authenticated" ? "signed_in" : "signed_out";

    const existing = await findExistingSourceListing(
      ctx,
      parsed.data.rawUrl,
      parsed.data.normalizedUrl,
    );

    if (existing) {
      const attemptResolution = attemptStatusFromSourceListing(existing);
      const attemptId = await insertAttempt(ctx, {
        sourceListingId: existing._id,
        sourcePlatform: parsed.data.platform,
        intakeChannel: "extension",
        rawInput: parsed.data.rawUrl,
        normalizedInput: parsed.data.normalizedUrl,
        status: attemptResolution.status,
        failureMode: attemptResolution.failureMode,
        retryable: attemptResolution.retryable,
        missingFields: attemptResolution.missingFields,
      });
      return {
        kind: "duplicate" as const,
        authState,
        sourceListingId: existing._id,
        attemptId,
        platform: parsed.data.platform,
        listingId: parsed.data.listingId,
        normalizedUrl: parsed.data.normalizedUrl,
      };
    }

    const now = new Date().toISOString();
    const sourceListingId = await ctx.db.insert("sourceListings", {
      sourcePlatform: parsed.data.platform,
      sourceUrl: parsed.data.normalizedUrl,
      rawData: buildSourceListingRawData({
        channel: "extension",
        rawUrl: parsed.data.rawUrl,
      }),
      extractedAt: now,
      status: "pending",
    });
    const attemptId = await insertAttempt(ctx, {
      sourceListingId,
      sourcePlatform: parsed.data.platform,
      intakeChannel: "extension",
      rawInput: parsed.data.rawUrl,
      normalizedInput: parsed.data.normalizedUrl,
      submittedAt: now,
      status: "pending",
    });

    return {
      kind: "created" as const,
      authState,
      sourceListingId,
      attemptId,
      platform: parsed.data.platform,
      listingId: parsed.data.listingId,
      normalizedUrl: parsed.data.normalizedUrl,
    };
  },
});

/**
 * Internal intake — for backend-triggered flows (SMS, share import).
 */
export const processUrl = internalMutation({
  args: {
    url: v.string(),
    source: v.union(
      v.literal("sms"),
      v.literal("share_import"),
      v.literal("manual"),
    ),
  },
  returns: v.union(v.id("sourceListings"), v.null()),
  handler: async (ctx, args) => {
    const parsed = parseListingUrl(args.url);

    if (!parsed.success) {
      return null;
    }

    return await ctx.db.insert("sourceListings", {
      sourcePlatform: parsed.data.platform,
      sourceUrl: parsed.data.normalizedUrl,
      rawData: buildSourceListingRawData({
        channel: args.source === "manual" ? "manual_address" : args.source,
        rawUrl: parsed.data.rawUrl,
      }),
      extractedAt: new Date().toISOString(),
      status: "pending",
    });
  },
});
