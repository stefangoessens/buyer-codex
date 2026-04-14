import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { normalizeBuyerProfileSections } from "./buyerProfile";
import {
  buildBuyerPreferenceMemorySnapshot,
  buildEmptyBuyerPreferenceMemory,
  projectBuyerPreferenceFeatures,
  type BuyerPreferenceEventInput,
  type BuyerPreferenceMemorySnapshot,
  type BuyerPreferencePropertyInput,
} from "../../src/lib/buyerPreferenceMemory";

type PreferenceCtx = Pick<QueryCtx | MutationCtx, "db">;

function toPreferenceProperty(
  property: Doc<"properties">,
): BuyerPreferencePropertyInput {
  return {
    id: String(property._id),
    city: property.address.city,
    subdivision: property.subdivision,
    propertyType: property.propertyType,
    hoaFee: property.hoaFee,
    floodZone: property.floodZone,
    listPrice: property.listPrice,
    pool: property.pool,
    waterfrontType: property.waterfrontType,
    gatedCommunity: property.gatedCommunity,
  };
}

function advisoryFeedbackEvent(
  row: Doc<"advisoryBuyerFeedback">,
  property: Doc<"properties">,
): BuyerPreferenceEventInput | null {
  const positiveCount = row.responses.filter(
    (response) => response.sentiment === "positive",
  ).length;
  const negativeCount = row.responses.filter(
    (response) => response.sentiment === "negative",
  ).length;

  if (positiveCount === negativeCount) {
    return null;
  }

  const hasPlanMismatch = row.reasonCodes.includes("does_not_fit_my_plan");
  const hasRelevanceMiss = row.reasonCodes.includes("not_relevant");
  const isNegative = negativeCount > positiveCount;
  const strength = hasPlanMismatch || hasRelevanceMiss
    ? 0.7
    : isNegative
      ? 0.55
      : 0.4;

  return {
    propertyId: String(row.propertyId),
    occurredAt: row.submittedAt,
    eventKind: "advisory_feedback",
    sentiment: isNegative ? "negative" : "positive",
    strength,
    summary: isNegative
      ? hasPlanMismatch
        ? "Buyer marked the recommendation as not fitting their plan."
        : "Buyer gave negative advisory feedback."
      : "Buyer gave positive advisory feedback.",
    features: projectBuyerPreferenceFeatures(toPreferenceProperty(property)),
  };
}

function buildTourEvents(
  row: Doc<"tourPostObservations">,
  property: Doc<"properties">,
): BuyerPreferenceEventInput[] {
  const propertyInput = toPreferenceProperty(property);
  const features = projectBuyerPreferenceFeatures(propertyInput);
  const events: BuyerPreferenceEventInput[] = [];

  if (row.sentiment === "positive" || row.sentiment === "negative") {
    events.push({
      propertyId: String(row.propertyId),
      occurredAt: row.createdAt,
      eventKind: "tour_feedback",
      sentiment: row.sentiment,
      strength: 0.95,
      summary:
        row.sentiment === "positive"
          ? "Buyer reported a positive post-tour reaction."
          : "Buyer reported a negative post-tour reaction.",
      features,
    });
  }

  if (row.offerReadiness === "ready_now" || row.offerReadiness === "ready_soon") {
    events.push({
      propertyId: String(row.propertyId),
      occurredAt: row.createdAt,
      eventKind: "tour_feedback",
      sentiment: "positive",
      strength: 0.65,
      summary: "Buyer said they were ready to move forward after the tour.",
      features,
    });
  }

  if (row.offerReadiness === "not_ready") {
    events.push({
      propertyId: String(row.propertyId),
      occurredAt: row.createdAt,
      eventKind: "tour_feedback",
      sentiment: "negative",
      strength: 0.7,
      summary: "Buyer said they were not ready to move forward after the tour.",
      features,
    });
  }

  const priceFeatures = features.filter((feature) => feature.category === "price_band");
  if (
    priceFeatures.length > 0 &&
    (row.pricingSignal === "above_expectations" ||
      row.pricingSignal === "below_expectations")
  ) {
    events.push({
      propertyId: String(row.propertyId),
      occurredAt: row.createdAt,
      eventKind: "tour_feedback",
      sentiment:
        row.pricingSignal === "above_expectations" ? "negative" : "positive",
      strength: 0.45,
      summary:
        row.pricingSignal === "above_expectations"
          ? "Buyer felt the price was above expectations."
          : "Buyer felt the price was below expectations.",
      features: priceFeatures,
    });
  }

  return events;
}

function watchlistEvent(
  row: Doc<"watchlistEntries">,
  property: Doc<"properties">,
): BuyerPreferenceEventInput {
  return {
    propertyId: String(row.propertyId),
    occurredAt: row.addedAt,
    eventKind: "watchlist_saved",
    sentiment: "positive",
    strength: 0.55,
    summary: "Buyer saved the property to their watchlist.",
    features: projectBuyerPreferenceFeatures(toPreferenceProperty(property)),
  };
}

async function loadPropertyMap(
  ctx: PreferenceCtx,
  propertyIds: Id<"properties">[],
): Promise<Map<string, Doc<"properties">>> {
  const uniqueIds = Array.from(new Set(propertyIds.map(String))) as Id<"properties">[];
  const docs = await Promise.all(uniqueIds.map((propertyId) => ctx.db.get(propertyId)));
  return new Map(
    docs
      .filter((property): property is Doc<"properties"> => Boolean(property))
      .map((property) => [String(property._id), property]),
  );
}

function fromStoredRow(
  row: Doc<"buyerPreferenceMemories">,
): BuyerPreferenceMemorySnapshot {
  return {
    explicitPreferences: row.explicitPreferences,
    history: {
      ...row.history,
      lastEventAt: row.history.lastEventAt ?? null,
    },
    inferredSignals: row.inferredSignals,
    updatedAt: row.updatedAt,
    modelVersion: row.modelVersion,
  };
}

function toStoredRow(
  buyerId: Id<"users">,
  snapshot: BuyerPreferenceMemorySnapshot,
) {
  return {
    buyerId,
    explicitPreferences: snapshot.explicitPreferences,
    history: {
      ...snapshot.history,
      lastEventAt: snapshot.history.lastEventAt ?? undefined,
    },
    inferredSignals: snapshot.inferredSignals.map((signal) => ({
      ...signal,
      provenance: signal.provenance.map((entry) => ({
        ...entry,
        propertyId: entry.propertyId as Id<"properties">,
      })),
    })),
    updatedAt: snapshot.updatedAt,
    modelVersion: snapshot.modelVersion,
  };
}

async function buildSnapshot(
  ctx: PreferenceCtx,
  buyerId: Id<"users">,
  now: string,
): Promise<BuyerPreferenceMemorySnapshot> {
  const [profile, watchlistRows, tourRows, feedbackRows] = await Promise.all([
    ctx.db
      .query("buyerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", buyerId))
      .unique(),
    ctx.db
      .query("watchlistEntries")
      .withIndex("by_buyerId_and_position", (q) => q.eq("buyerId", buyerId))
      .collect(),
    ctx.db
      .query("tourPostObservations")
      .withIndex("by_buyerId_and_createdAt", (q) => q.eq("buyerId", buyerId))
      .collect(),
    ctx.db
      .query("advisoryBuyerFeedback")
      .withIndex("by_buyerId_and_submittedAt", (q) => q.eq("buyerId", buyerId))
      .collect(),
  ]);

  const propertyMap = await loadPropertyMap(ctx, [
    ...watchlistRows.map((row) => row.propertyId),
    ...tourRows.map((row) => row.propertyId),
    ...feedbackRows.map((row) => row.propertyId),
  ]);

  const events: BuyerPreferenceEventInput[] = [];
  for (const row of watchlistRows) {
    const property = propertyMap.get(String(row.propertyId));
    if (!property) continue;
    events.push(watchlistEvent(row, property));
  }
  for (const row of tourRows) {
    const property = propertyMap.get(String(row.propertyId));
    if (!property) continue;
    events.push(...buildTourEvents(row, property));
  }
  for (const row of feedbackRows) {
    const property = propertyMap.get(String(row.propertyId));
    if (!property) continue;
    const event = advisoryFeedbackEvent(row, property);
    if (event) {
      events.push(event);
    }
  }

  const sections = normalizeBuyerProfileSections(profile);
  return buildBuyerPreferenceMemorySnapshot({
    explicitPreferences: sections.searchPreferences,
    events,
    now,
  });
}

export async function rebuildBuyerPreferenceMemory(
  ctx: MutationCtx,
  buyerId: Id<"users">,
): Promise<BuyerPreferenceMemorySnapshot> {
  const now = new Date().toISOString();
  const snapshot = await buildSnapshot(ctx, buyerId, now);
  const existing = await ctx.db
    .query("buyerPreferenceMemories")
    .withIndex("by_buyerId", (q) => q.eq("buyerId", buyerId))
    .unique();

  const stored = toStoredRow(buyerId, snapshot);
  if (existing) {
    await ctx.db.patch(existing._id, stored);
  } else {
    await ctx.db.insert("buyerPreferenceMemories", stored);
  }

  return snapshot;
}

export async function loadBuyerPreferenceMemorySnapshot(
  ctx: PreferenceCtx,
  buyerId: Id<"users">,
): Promise<BuyerPreferenceMemorySnapshot> {
  const existing = await ctx.db
    .query("buyerPreferenceMemories")
    .withIndex("by_buyerId", (q) => q.eq("buyerId", buyerId))
    .unique();
  if (existing) {
    return fromStoredRow(existing);
  }

  const profile = await ctx.db
    .query("buyerProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", buyerId))
    .unique();
  const sections = normalizeBuyerProfileSections(profile);
  return buildEmptyBuyerPreferenceMemory(sections.searchPreferences);
}

export { toPreferenceProperty as toBuyerPreferencePropertyInput };
