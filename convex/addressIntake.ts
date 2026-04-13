/**
 * Manual address intake (KIN-898).
 *
 * Mutations that accept a user-typed address, normalize it server-side,
 * create a sourceListing row, and return an explicit confidence-aware
 * resolution against the existing properties table.
 *
 * This module is deliberately independent of convex/intake.ts so the URL
 * and address intake surfaces can evolve separately.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  normalizeAddress,
  matchAddress,
  resolveAddressMatch,
  type AddressMatchCandidate,
  type AddressMatchFallbackReason,
  type AddressMatchResolution,
  type CanonicalAddress,
  type ScoredAddressMatchCandidate,
} from "./lib/addressMatch";
import {
  mergeSourceListingReliability,
  retryableFromFailureMode,
  type IntakeAttemptStatus,
  type IntakeFailureMode,
} from "../src/lib/intake/reliability";

const canonicalAddressInputValidator = v.object({
  street: v.string(),
  unit: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  county: v.optional(v.string()),
  formatted: v.optional(v.string()),
});

const canonicalAddressValidator = v.object({
  street: v.string(),
  unit: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  zip: v.string(),
  county: v.optional(v.string()),
  formatted: v.string(),
});

const createAddressIntakeArgs = v.object({
  address: v.union(
    canonicalAddressInputValidator,
    v.object({ raw: v.string() }),
  ),
  userId: v.optional(v.id("users")),
});

const matchCandidateReturn = v.object({
  propertyId: v.id("properties"),
  canonical: canonicalAddressValidator,
  score: v.number(),
});

const optionalMatchCandidateReturn = v.union(matchCandidateReturn, v.null());

const createAddressIntakeReturn = v.union(
  v.object({
    status: v.literal("matched"),
    propertyId: v.id("properties"),
    confidence: v.union(
      v.literal("exact"),
      v.literal("high"),
    ),
    score: v.number(),
    intakeId: v.id("sourceListings"),
    canonical: canonicalAddressValidator,
  }),
  v.object({
    status: v.literal("review_required"),
    reason: v.union(
      v.literal("ambiguous_match"),
      v.literal("low_confidence_match"),
    ),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    score: v.number(),
    bestMatch: matchCandidateReturn,
    candidates: v.array(matchCandidateReturn),
    intakeId: v.id("sourceListings"),
    canonical: canonicalAddressValidator,
  }),
  v.object({
    status: v.literal("no_match"),
    reason: v.literal("no_match"),
    confidence: v.literal("none"),
    score: v.number(),
    bestMatch: optionalMatchCandidateReturn,
    intakeId: v.id("sourceListings"),
    canonical: canonicalAddressValidator,
  }),
  v.object({
    status: v.literal("validation_error"),
    errors: v.array(
      v.object({
        code: v.string(),
        message: v.string(),
      }),
    ),
  }),
);

const matchSnapshotValidator = v.object({
  confidence: v.union(
    v.literal("exact"),
    v.literal("high"),
    v.literal("medium"),
    v.literal("low"),
    v.literal("none"),
  ),
  score: v.number(),
  bestMatchId: v.union(v.id("properties"), v.null()),
  ambiguous: v.boolean(),
  resolutionStatus: v.union(
    v.literal("matched"),
    v.literal("review_required"),
    v.literal("no_match"),
  ),
  fallbackReason: v.optional(
    v.union(
      v.literal("ambiguous_match"),
      v.literal("low_confidence_match"),
      v.literal("no_match"),
    ),
  ),
});

/**
 * Build a CanonicalAddress from a stored property document. Properties
 * that were ingested via URL may not have a `formatted` field, so we
 * derive one on the fly.
 */
function propertyToCanonical(property: Doc<"properties">): CanonicalAddress {
  const { address } = property;
  const formatted = address.formatted ?? buildFormatted(address);
  return {
    street: address.street,
    unit: address.unit,
    city: address.city,
    state: address.state,
    zip: address.zip,
    county: address.county,
    formatted,
  };
}

function buildFormatted(address: Doc<"properties">["address"]): string {
  const parts: string[] = [address.street];
  if (address.unit) parts.push(`Unit ${address.unit}`);
  parts.push(address.city);
  parts.push(`${address.state} ${address.zip}`);
  return parts.join(", ");
}

/** Build the sourceUrl placeholder used for manual address intakes. */
function manualSourceUrl(canonical: CanonicalAddress): string {
  return `manual://address/${encodeURIComponent(canonical.formatted)}`;
}

function toMatchCandidateReturn(candidate: ScoredAddressMatchCandidate) {
  return {
    propertyId: candidate.id as Id<"properties">,
    canonical: candidate.canonical,
    score: candidate.score,
  };
}

function resolveSourceListingStatus(
  resolution: AddressMatchResolution,
): "pending" | "extracted" | "failed" | "merged" {
  switch (resolution.status) {
    case "matched":
      return "merged";
    case "review_required":
      return "pending";
    case "no_match":
      return "failed";
  }
}

function buildSourceListingDoc(args: {
  canonical: CanonicalAddress;
  sourceUrl: string;
  extractedAt: string;
  resolution: AddressMatchResolution;
}): Omit<Doc<"sourceListings">, "_id" | "_creationTime"> {
  const { canonical, sourceUrl, extractedAt, resolution } = args;

  return {
    propertyId:
      resolution.status === "matched"
        ? (resolution.bestMatch.id as Id<"properties">)
        : undefined,
    sourcePlatform: "manual",
    sourceUrl,
    rawData: mergeSourceListingReliability(
      JSON.stringify({
        canonical,
        match: {
          confidence: resolution.confidence,
          score: resolution.score,
          bestMatchId: resolution.bestMatch?.id ?? null,
          ambiguous: resolution.ambiguous,
          resolutionStatus: resolution.status,
          fallbackReason:
            "fallbackReason" in resolution ? resolution.fallbackReason : undefined,
        },
      }),
      {
        resolutionStatus:
          resolution.status === "matched"
            ? "ready"
            : resolution.status === "review_required"
              ? "pending"
              : "failed",
        failureMode:
          resolution.status === "matched"
            ? undefined
            : (("fallbackReason" in resolution
                ? resolution.fallbackReason
                : "no_match") as IntakeFailureMode),
        retryable:
          resolution.status === "matched"
            ? undefined
            : retryableFromFailureMode(
                (("fallbackReason" in resolution
                  ? resolution.fallbackReason
                  : "no_match") as IntakeFailureMode),
              ),
        updatedAt: extractedAt,
      },
    ),
    extractedAt,
    status: resolveSourceListingStatus(resolution),
  };
}

function attemptStatusFromResolution(
  resolution: AddressMatchResolution,
): {
  status: IntakeAttemptStatus;
  failureMode?: IntakeFailureMode;
  retryable?: boolean;
} {
  switch (resolution.status) {
    case "matched":
      return { status: "ready" };
    case "review_required":
      return {
        status: "partial",
        failureMode: resolution.fallbackReason as IntakeFailureMode,
        retryable: retryableFromFailureMode(
          resolution.fallbackReason as IntakeFailureMode,
        ),
      };
    case "no_match":
      return {
        status: "failed",
        failureMode: "no_match",
        retryable: true,
      };
  }
}

function buildCreateAddressIntakeResponse(args: {
  intakeId: Id<"sourceListings">;
  canonical: CanonicalAddress;
  resolution: AddressMatchResolution;
}) {
  const { intakeId, canonical, resolution } = args;

  switch (resolution.status) {
    case "matched":
      return {
        status: "matched" as const,
        propertyId: resolution.bestMatch.id as Id<"properties">,
        confidence: resolution.confidence,
        score: resolution.score,
        intakeId,
        canonical,
      };
    case "review_required":
      return {
        status: "review_required" as const,
        reason: resolution.fallbackReason,
        confidence: resolution.confidence,
        score: resolution.score,
        bestMatch: toMatchCandidateReturn(resolution.bestMatch),
        candidates: resolution.candidates.map(toMatchCandidateReturn),
        intakeId,
        canonical,
      };
    case "no_match":
      return {
        status: "no_match" as const,
        reason: resolution.fallbackReason,
        confidence: resolution.confidence,
        score: resolution.score,
        bestMatch: resolution.bestMatch
          ? toMatchCandidateReturn(resolution.bestMatch)
          : null,
        intakeId,
        canonical,
      };
  }
}

/**
 * Submit a manual address for intake. Runs server-side normalization,
 * creates a sourceListing row, searches for candidate properties, and
 * returns a confidence-aware result.
 *
 * Public — runs before auth. If a `userId` is provided it's linked to
 * the audit log entry.
 */
export const createAddressIntake = mutation({
  args: createAddressIntakeArgs,
  returns: createAddressIntakeReturn,
  handler: async (ctx, args) => {
    // Server-side re-validation — never trust client-supplied canonical shapes.
    const normalizationResult = normalizeAddress(args.address);
    if (!normalizationResult.valid) {
      return {
        status: "validation_error" as const,
        errors: normalizationResult.errors.map((error) => ({
          code: error.code,
          message: error.message,
        })),
      };
    }

    const canonical = normalizationResult.canonical;
    const sourceUrl = manualSourceUrl(canonical);
    const now = new Date().toISOString();

    // Query ALL candidate properties in this zip — do not truncate with
    // .take(N) because index order is not similarity order, and a dense
    // zip could exclude the true match from consideration entirely.
    // Zip-scoped collections are bounded enough to scan in full.
    const candidateDocs = await ctx.db
      .query("properties")
      .withIndex("by_zip", (q) => q.eq("zip", canonical.zip.slice(0, 5)))
      .collect();

    const candidates: AddressMatchCandidate[] = candidateDocs.map((doc) => ({
      id: doc._id,
      canonical: propertyToCanonical(doc),
    }));

    const matchResult = matchAddress(canonical, candidates);
    const resolution = resolveAddressMatch(matchResult);

    // If we already have a sourceListing for this manual URL, reuse it —
    // otherwise insert a new one. This keeps re-submission idempotent.
    const existing = await ctx.db
      .query("sourceListings")
      .withIndex("by_sourceUrl", (q) => q.eq("sourceUrl", sourceUrl))
      .first();

    const sourceListingDoc = buildSourceListingDoc({
      canonical,
      sourceUrl,
      extractedAt: now,
      resolution,
    });

    let intakeId: Id<"sourceListings">;
    if (existing) {
      intakeId = existing._id;
      await ctx.db.replace(existing._id, sourceListingDoc);
    } else {
      intakeId = await ctx.db.insert("sourceListings", sourceListingDoc);
    }

    const attempt = attemptStatusFromResolution(resolution);
    await ctx.db.insert("intakeAttempts", {
      sourceListingId: intakeId,
      sourcePlatform: "manual",
      intakeChannel: "manual_address",
      rawInput: canonical.formatted,
      normalizedInput: sourceUrl,
      submittedAt: now,
      status: attempt.status,
      failureMode: attempt.failureMode,
      retryable: attempt.retryable,
    });

    // Audit trail.
    await ctx.db.insert("auditLog", {
      userId: args.userId,
      action: "address_intake_submitted",
      entityType: "sourceListing",
      entityId: intakeId,
      details: JSON.stringify({
        canonicalFormatted: canonical.formatted,
        confidence: resolution.confidence,
        score: resolution.score,
        ambiguous: resolution.ambiguous,
        resolutionStatus: resolution.status,
        fallbackReason:
          "fallbackReason" in resolution ? resolution.fallbackReason : undefined,
        candidateCount: resolution.candidates.length,
      }),
      timestamp: now,
    });

    return buildCreateAddressIntakeResponse({
      intakeId,
      canonical,
      resolution,
    });
  },
});

/**
 * Look up the current state of an address intake request by id. Returns
 * the stored canonical + match snapshot so a follow-up UI can continue
 * the fallback flow.
 */
export const getIntakeStatus = query({
  args: {
    intakeId: v.id("sourceListings"),
  },
  returns: v.union(
    v.null(),
    v.object({
      intakeId: v.id("sourceListings"),
      sourcePlatform: v.string(),
      status: v.string(),
      propertyId: v.optional(v.id("properties")),
      extractedAt: v.string(),
      canonical: v.optional(canonicalAddressValidator),
      match: v.optional(matchSnapshotValidator),
    }),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.intakeId);
    if (!row) return null;

    let canonical: CanonicalAddress | undefined;
    let match:
      | {
          confidence: "exact" | "high" | "medium" | "low" | "none";
          score: number;
          bestMatchId: Id<"properties"> | null;
          ambiguous: boolean;
          resolutionStatus: "matched" | "review_required" | "no_match";
          fallbackReason?: AddressMatchFallbackReason;
        }
      | undefined;
    if (row.rawData) {
      try {
        const parsed = JSON.parse(row.rawData) as {
          canonical?: CanonicalAddress;
          match?: {
            confidence: "exact" | "high" | "medium" | "low" | "none";
            score: number;
            bestMatchId: Id<"properties"> | null;
            ambiguous: boolean;
            resolutionStatus: "matched" | "review_required" | "no_match";
            fallbackReason?: AddressMatchFallbackReason;
          };
        };
        canonical = parsed.canonical;
        match = parsed.match;
      } catch {
        // Ignore malformed rawData — intake will still return basics.
      }
    }

    return {
      intakeId: row._id,
      sourcePlatform: row.sourcePlatform,
      status: row.status,
      propertyId: row.propertyId,
      extractedAt: row.extractedAt,
      canonical,
      match,
    };
  },
});
