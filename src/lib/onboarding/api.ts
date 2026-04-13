import type { Id } from "../../../convex/_generated/dataModel";
import { makeFunctionReference } from "convex/server";

export type OnboardingSourceListingStatus =
  | "pending"
  | "extracted"
  | "failed"
  | "merged";

export type SourceListingResolution =
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: null;
    }
  | {
      status: "property_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: Id<"properties">;
    };

export type FirstPropertyLinkResult =
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: null;
      dealRoomId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: null;
      dealRoomId: null;
    }
  | {
      status: "deal_room_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      propertyId: Id<"properties">;
      dealRoomId: Id<"dealRooms">;
    };

export const getSourceListingStatusReference = makeFunctionReference<
  "query",
  { sourceListingId: Id<"sourceListings"> },
  SourceListingResolution
>("onboarding:getSourceListingStatus");

export const linkFirstPropertyReference = makeFunctionReference<
  "mutation",
  { sourceListingId: Id<"sourceListings"> },
  FirstPropertyLinkResult
>("onboarding:linkFirstProperty");
