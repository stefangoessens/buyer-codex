import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { requireAuth } from "./lib/session";

const sourceListingStatusValidator = v.union(
  v.literal("pending"),
  v.literal("extracted"),
  v.literal("failed"),
  v.literal("merged"),
);

const sourceListingResolutionValidator = v.union(
  v.object({
    status: v.literal("pending_source_listing"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_failed"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.null(),
  }),
  v.object({
    status: v.literal("property_ready"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.id("properties"),
  }),
);

const firstPropertyLinkValidator = v.union(
  v.object({
    status: v.literal("pending_source_listing"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.null(),
    dealRoomId: v.null(),
  }),
  v.object({
    status: v.literal("source_listing_failed"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.null(),
    dealRoomId: v.null(),
  }),
  v.object({
    status: v.literal("deal_room_ready"),
    sourceListingId: v.id("sourceListings"),
    sourceListingStatus: sourceListingStatusValidator,
    propertyId: v.id("properties"),
    dealRoomId: v.id("dealRooms"),
  }),
);

function mapSourceListingStatus(
  sourceListing: Pick<Doc<"sourceListings">, "_id" | "status" | "propertyId">,
):
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      propertyId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      propertyId: null;
    }
  | {
      status: "property_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: Doc<"sourceListings">["status"];
      propertyId: Id<"properties">;
    } {
  if (sourceListing.propertyId) {
    return {
      status: "property_ready" as const,
      sourceListingId: sourceListing._id,
      sourceListingStatus: sourceListing.status,
      propertyId: sourceListing.propertyId,
    };
  }

  if (sourceListing.status === "failed") {
    return {
      status: "source_listing_failed" as const,
      sourceListingId: sourceListing._id,
      sourceListingStatus: sourceListing.status,
      propertyId: null,
    };
  }

  return {
    status: "pending_source_listing" as const,
    sourceListingId: sourceListing._id,
    sourceListingStatus: sourceListing.status,
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
      propertyId: sourceStatus.propertyId,
      dealRoomId,
    };
  },
});
