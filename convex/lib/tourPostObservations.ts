import type { Doc, Id } from "../_generated/dataModel";
import {
  summarizePostTourSignals,
  toBuyerVisibleObservation,
  type PostTourObservationEntry,
} from "../../src/lib/tours/postTourSignals";
import {
  validatePostTourObservationInput,
  type PostTourObservationInput,
  type PostTourActorRole,
} from "../../src/lib/tours/postTourObservations";

type PostTourCtx = {
  db: {
    get: (...args: any[]) => Promise<unknown>;
    insert: (...args: any[]) => Promise<unknown>;
    query: (...args: any[]) => any;
  };
};

type AuthUser = {
  _id: Id<"users">;
  role: PostTourActorRole;
};

export async function loadPostTourObservationsForTour(
  ctx: PostTourCtx,
  tourId: Id<"tours">,
): Promise<Array<Doc<"tourPostObservations">>> {
  return (await ctx.db
    .query("tourPostObservations")
    .withIndex("by_tourId_and_createdAt", (q: any) => q.eq("tourId", tourId))
    .collect()) as Array<Doc<"tourPostObservations">>;
}

export function toSignalEntry(
  observation: Doc<"tourPostObservations">,
): PostTourObservationEntry {
  return {
    submittedAt: observation.createdAt,
    submittedByRole: observation.submittedByRole,
    sentiment: observation.sentiment,
    concerns: observation.concerns,
    offerReadiness: observation.offerReadiness,
    buyerVisibleNote: observation.buyerVisibleNote,
    internalNote: observation.internalNote,
    pricingSignal: observation.pricingSignal,
    leverageSignal: observation.leverageSignal,
    actionItems: observation.actionItems,
  };
}

export async function storePostTourObservation(
  ctx: PostTourCtx,
  user: AuthUser,
  tour: Doc<"tours">,
  input: PostTourObservationInput,
): Promise<Id<"tourPostObservations">> {
  if (!tour.tourRequestId) {
    throw new Error(
      "MISSING_TOUR_LINKAGE: Tour must be linked to a tour request before post-tour capture can be stored",
    );
  }

  if (tour.status === "requested") {
    throw new Error(
      "Tour must be at least confirmed before post-tour observations can be stored",
    );
  }

  if (user.role === "buyer" && tour.buyerId !== user._id) {
    throw new Error("Not authorized to submit observations for this tour");
  }

  const validation = validatePostTourObservationInput(input, user.role);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const now = new Date().toISOString();
  return (await ctx.db.insert("tourPostObservations", {
    tourId: tour._id,
    tourRequestId: tour.tourRequestId,
    propertyId: tour.propertyId,
    buyerId: tour.buyerId,
    submittedById: user._id,
    submittedByRole: user.role,
    sentiment: validation.sanitized.sentiment,
    concerns: validation.sanitized.concerns,
    offerReadiness: validation.sanitized.offerReadiness,
    buyerVisibleNote: validation.sanitized.buyerVisibleNote,
    internalNote: validation.sanitized.internalNote,
    pricingSignal: validation.sanitized.pricingSignal,
    leverageSignal: validation.sanitized.leverageSignal,
    actionItems: validation.sanitized.actionItems,
    createdAt: now,
  })) as Id<"tourPostObservations">;
}

export async function getPostTourObservationSummary(
  ctx: PostTourCtx,
  args: {
    tourId?: Id<"tours">;
    tourRequestId?: Id<"tourRequests">;
    propertyId?: Id<"properties">;
  },
): Promise<Record<string, unknown> | null> {
  const selectors = [args.tourId, args.tourRequestId, args.propertyId].filter(Boolean);
  if (selectors.length !== 1) {
    throw new Error("Provide exactly one of tourId, tourRequestId, or propertyId");
  }

  let observations: Array<Doc<"tourPostObservations">>;
  if (args.tourId) {
    observations = await loadPostTourObservationsForTour(ctx, args.tourId);
  } else if (args.tourRequestId) {
    observations = (await ctx.db
      .query("tourPostObservations")
      .withIndex("by_tourRequestId", (q: any) =>
        q.eq("tourRequestId", args.tourRequestId),
      )
      .collect()) as Array<Doc<"tourPostObservations">>;
  } else {
    observations = (await ctx.db
      .query("tourPostObservations")
      .withIndex("by_propertyId", (q: any) => q.eq("propertyId", args.propertyId))
      .collect()) as Array<Doc<"tourPostObservations">>;
  }

  if (observations.length === 0) {
    return null;
  }

  const ordered = observations.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const summary = summarizePostTourSignals(ordered.map(toSignalEntry));
  const latest = ordered[0]!;

  return {
    ...summary,
    tourId: latest.tourId,
    tourRequestId: latest.tourRequestId,
    propertyId: latest.propertyId,
    buyerId: latest.buyerId,
  };
}

export async function listBuyerVisiblePostTourObservations(
  ctx: PostTourCtx,
  tourId: Id<"tours">,
): Promise<unknown[]> {
  const observations = await loadPostTourObservationsForTour(ctx, tourId);
  return observations
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((observation) => toBuyerVisibleObservation(toSignalEntry(observation)));
}

export async function listInternalPostTourObservations(
  ctx: PostTourCtx,
  tourId: Id<"tours">,
): Promise<Array<Doc<"tourPostObservations">>> {
  const observations = await loadPostTourObservationsForTour(ctx, tourId);
  return observations.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}
