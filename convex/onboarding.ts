import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireAuth } from "./lib/session";
import { readSourceListingReliability } from "../src/lib/intake/reliability";

const sourceListingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("extracted"),
  v.literal("failed"),
  v.literal("merged"),
);

const recoveryStateValidator = v.union(
  v.literal("processing"),
  v.literal("review_required"),
  v.literal("partial_extraction"),
  v.literal("parser_failed"),
  v.literal("ready"),
  v.literal("failed_unknown"),
);

const failureModeValidator = v.union(
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

const sourceListingResolutionValidator = v.union(
  v.object({
    status: v.literal("pending_source_listing"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.union(
      v.literal("processing"),
      v.literal("review_required"),
    ),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_partial"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.literal("partial_extraction"),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_failed"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.union(
      v.literal("parser_failed"),
      v.literal("failed_unknown"),
    ),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
  }),
  v.object({
    status: v.literal("property_ready"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.literal("ready"),
    failureMode: v.null(),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.id("properties"),
  }),
);

const firstPropertyLinkValidator = v.union(
  v.object({
    status: v.literal("pending_source_listing"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.union(
      v.literal("processing"),
      v.literal("review_required"),
    ),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
    dealRoomId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_partial"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.literal("partial_extraction"),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
    dealRoomId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_failed"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.union(
      v.literal("parser_failed"),
      v.literal("failed_unknown"),
    ),
    failureMode: v.union(failureModeValidator, v.null()),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.null(),
    dealRoomId: v.null(),
  }),
  v.object({
    status: v.literal("deal_room_ready"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    recoveryState: v.literal("ready"),
    failureMode: v.null(),
    retryable: v.boolean(),
    missingFields: v.array(v.string()),
    propertyId: v.id("properties"),
    dealRoomId: v.id("dealRooms"),
  }),
);

function mapSourceListingStatus(
  sourceListing: Pick<
    Doc<"sourceListings">,
    "_id" | "status" | "propertyId" | "rawData"
  >,
):
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      recoveryState: "processing" | "review_required";
      failureMode:
        | "unsupported_url"
        | "malformed_url"
        | "missing_listing_id"
        | "parser_failed"
        | "partial_extraction"
        | "no_match"
        | "ambiguous_match"
        | "low_confidence_match"
        | "unknown"
        | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "source_listing_partial";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      recoveryState: "partial_extraction";
      failureMode:
        | "unsupported_url"
        | "malformed_url"
        | "missing_listing_id"
        | "parser_failed"
        | "partial_extraction"
        | "no_match"
        | "ambiguous_match"
        | "low_confidence_match"
        | "unknown"
        | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      recoveryState: "parser_failed" | "failed_unknown";
      failureMode:
        | "unsupported_url"
        | "malformed_url"
        | "missing_listing_id"
        | "parser_failed"
        | "partial_extraction"
        | "no_match"
        | "ambiguous_match"
        | "low_confidence_match"
        | "unknown"
        | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "property_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      recoveryState: "ready";
      failureMode: null;
      retryable: boolean;
      missingFields: string[];
      propertyId: Id<"properties">;
    } {
  const reliability = readSourceListingReliability(sourceListing.rawData);
  const failureMode = reliability?.failureMode ?? null;
  const retryable = reliability?.retryable ?? false;
  const missingFields = reliability?.missingFields ?? [];

  if (sourceListing.propertyId) {
    return {
      status: "property_ready" as const,
      sourceListingId: sourceListing._id,
      sourceListingStatus: sourceListing.status,
      recoveryState: "ready" as const,
      failureMode: null,
      retryable: false,
      missingFields,
      propertyId: sourceListing.propertyId,
    };
  }

  if (reliability?.resolutionStatus === "partial") {
    return {
      status: "source_listing_partial" as const,
      sourceListingId: sourceListing._id,
      sourceListingStatus: sourceListing.status,
      recoveryState: "partial_extraction" as const,
      failureMode: failureMode ?? "partial_extraction",
      retryable: reliability?.retryable ?? true,
      missingFields,
      propertyId: null,
    };
  }

  if (
    sourceListing.status === "failed" ||
    reliability?.resolutionStatus === "failed"
  ) {
    return {
      status: "source_listing_failed" as const,
      sourceListingId: sourceListing._id,
      sourceListingStatus: sourceListing.status,
      recoveryState:
        reliability?.failureMode === "parser_failed"
          ? "parser_failed"
          : "failed_unknown",
      failureMode,
      retryable: reliability?.retryable ?? true,
      missingFields,
      propertyId: null,
    };
  }

  return {
    status: "pending_source_listing" as const,
    sourceListingId: sourceListing._id,
    sourceListingStatus: sourceListing.status,
    recoveryState:
      failureMode === "ambiguous_match" || failureMode === "low_confidence_match"
        ? "review_required"
        : "processing",
    failureMode,
    retryable,
    missingFields,
    propertyId: null,
  };
}

/**
 * Resolve the current state of a captured source listing for the
 * authenticated buyer's onboarding flow.
 */
export const getSourceListingStatus = query({
  args: {
    sourceListingId: v.id("sourceListings"),
  },
  returns: sourceListingResolutionValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const sourceListing = await ctx.db.get(args.sourceListingId);
    if (!sourceListing) {
      throw new Error("Source listing not found");
    }

    return mapSourceListingStatus(sourceListing);
  },
});

/**
 * Attach the authenticated buyer to the first pasted property once the
 * source listing has resolved into a canonical property.
 */
export const linkFirstProperty = mutation({
  args: {
    sourceListingId: v.id("sourceListings"),
  },
  returns: firstPropertyLinkValidator,
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const sourceListing = await ctx.db.get(args.sourceListingId);
    if (!sourceListing) {
      throw new Error("Source listing not found");
    }

    const sourceStatus = mapSourceListingStatus(sourceListing);
    if (sourceStatus.status !== "property_ready") {
      return {
        ...sourceStatus,
        dealRoomId: null,
      };
    }

    const dealRoomId = await ctx.runMutation(api.dealRooms.create, {
      propertyId: sourceStatus.propertyId,
    });

    if (!dealRoomId) {
      throw new Error("Could not create a deal room for the authenticated buyer");
    }

    return {
      status: "deal_room_ready" as const,
      sourceListingId: args.sourceListingId,
      sourceListingStatus: sourceListing.status,
      recoveryState: "ready" as const,
      failureMode: null,
      retryable: false,
      missingFields: sourceStatus.missingFields,
      propertyId: sourceStatus.propertyId,
      dealRoomId,
    };
  },
});
