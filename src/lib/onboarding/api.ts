import type { Id } from "../../../convex/_generated/dataModel";
import { makeFunctionReference } from "convex/server";
import type { IntakeFailureMode } from "@/lib/intake/reliability";

export type OnboardingSourceListingStatus =
  | "pending"
  | "extracted"
  | "failed"
  | "merged";

export type OnboardingRecoveryState =
  | "processing"
  | "review_required"
  | "partial_extraction"
  | "parser_failed"
  | "ready"
  | "failed_unknown";

export type SourceListingResolution =
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "processing" | "review_required";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "source_listing_partial";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "partial_extraction";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "parser_failed" | "failed_unknown";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
    }
  | {
      status: "property_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "ready";
      failureMode: null;
      retryable: false;
      missingFields: string[];
      propertyId: Id<"properties">;
    };

export type FirstPropertyLinkResult =
  | {
      status: "pending_source_listing";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "processing" | "review_required";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
      dealRoomId: null;
    }
  | {
      status: "source_listing_partial";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "partial_extraction";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
      dealRoomId: null;
    }
  | {
      status: "source_listing_failed";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "parser_failed" | "failed_unknown";
      failureMode: IntakeFailureMode | null;
      retryable: boolean;
      missingFields: string[];
      propertyId: null;
      dealRoomId: null;
    }
  | {
      status: "deal_room_ready";
      sourceListingId: Id<"sourceListings">;
      sourceListingStatus: OnboardingSourceListingStatus;
      recoveryState: "ready";
      failureMode: null;
      retryable: false;
      missingFields: string[];
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
