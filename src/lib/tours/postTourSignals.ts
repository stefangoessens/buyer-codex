export const POST_TOUR_SENTIMENTS = [
  "positive",
  "mixed",
  "negative",
] as const;
export type PostTourSentiment = (typeof POST_TOUR_SENTIMENTS)[number];

export const POST_TOUR_OFFER_READINESS = [
  "not_ready",
  "considering",
  "ready_soon",
  "ready_now",
] as const;
export type PostTourOfferReadiness =
  (typeof POST_TOUR_OFFER_READINESS)[number];

export const POST_TOUR_PRICING_SIGNALS = [
  "below_expectations",
  "at_expectations",
  "above_expectations",
] as const;
export type PostTourPricingSignal =
  (typeof POST_TOUR_PRICING_SIGNALS)[number];

export const POST_TOUR_LEVERAGE_SIGNALS = [
  "strong",
  "neutral",
  "weak",
] as const;
export type PostTourLeverageSignal =
  (typeof POST_TOUR_LEVERAGE_SIGNALS)[number];

export interface PostTourObservationEntry {
  submittedAt: string;
  submittedByRole: "buyer" | "broker" | "admin";
  sentiment: PostTourSentiment;
  concerns: string[];
  offerReadiness: PostTourOfferReadiness;
  buyerVisibleNote?: string;
  internalNote?: string;
  pricingSignal?: PostTourPricingSignal;
  leverageSignal?: PostTourLeverageSignal;
  actionItems?: string[];
}

export interface BuyerVisiblePostTourObservation {
  submittedAt: string;
  submittedByRole: "buyer" | "broker" | "admin";
  sentiment: PostTourSentiment;
  concerns: string[];
  offerReadiness: PostTourOfferReadiness;
  buyerVisibleNote?: string;
}

export interface PostTourSignalSummary {
  entryCount: number;
  lastSubmittedAt?: string;
  latestSentiment?: PostTourSentiment;
  latestOfferReadiness?: PostTourOfferReadiness;
  concernTags: string[];
  buyerVisibleNotes: string[];
  internalNotes: string[];
  actionItems: string[];
  readyNowCount: number;
  sentimentCounts: Record<PostTourSentiment, number>;
  offerReadinessCounts: Record<PostTourOfferReadiness, number>;
  pricingSignalCounts: Record<PostTourPricingSignal, number>;
  leverageSignalCounts: Record<PostTourLeverageSignal, number>;
}

function sortNewestFirst<T extends { submittedAt: string }>(
  entries: T[],
): T[] {
  return [...entries].sort((left, right) =>
    right.submittedAt.localeCompare(left.submittedAt),
  );
}

function normalizeTextArray(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function toBuyerVisibleObservation(
  entry: PostTourObservationEntry,
): BuyerVisiblePostTourObservation {
  return {
    submittedAt: entry.submittedAt,
    submittedByRole: entry.submittedByRole,
    sentiment: entry.sentiment,
    concerns: normalizeTextArray(entry.concerns),
    offerReadiness: entry.offerReadiness,
    buyerVisibleNote: entry.buyerVisibleNote?.trim() || undefined,
  };
}

export function summarizePostTourSignals(
  entries: PostTourObservationEntry[],
): PostTourSignalSummary {
  const ordered = sortNewestFirst(entries);
  const concernSet = new Set<string>();
  const buyerVisibleNotes: string[] = [];
  const internalNotes: string[] = [];
  const actionItems = new Set<string>();

  const sentimentCounts: Record<PostTourSentiment, number> = {
    positive: 0,
    mixed: 0,
    negative: 0,
  };
  const offerReadinessCounts: Record<PostTourOfferReadiness, number> = {
    not_ready: 0,
    considering: 0,
    ready_soon: 0,
    ready_now: 0,
  };
  const pricingSignalCounts: Record<PostTourPricingSignal, number> = {
    below_expectations: 0,
    at_expectations: 0,
    above_expectations: 0,
  };
  const leverageSignalCounts: Record<PostTourLeverageSignal, number> = {
    strong: 0,
    neutral: 0,
    weak: 0,
  };

  for (const entry of ordered) {
    sentimentCounts[entry.sentiment] += 1;
    offerReadinessCounts[entry.offerReadiness] += 1;
    if (entry.pricingSignal) pricingSignalCounts[entry.pricingSignal] += 1;
    if (entry.leverageSignal) leverageSignalCounts[entry.leverageSignal] += 1;

    for (const concern of normalizeTextArray(entry.concerns)) {
      concernSet.add(concern);
    }

    const buyerVisibleNote = entry.buyerVisibleNote?.trim();
    if (buyerVisibleNote) buyerVisibleNotes.push(buyerVisibleNote);

    const internalNote = entry.internalNote?.trim();
    if (internalNote) internalNotes.push(internalNote);

    for (const item of normalizeTextArray(entry.actionItems ?? [])) {
      actionItems.add(item);
    }
  }

  return {
    entryCount: ordered.length,
    lastSubmittedAt: ordered[0]?.submittedAt,
    latestSentiment: ordered[0]?.sentiment,
    latestOfferReadiness: ordered[0]?.offerReadiness,
    concernTags: [...concernSet],
    buyerVisibleNotes,
    internalNotes,
    actionItems: [...actionItems],
    readyNowCount: offerReadinessCounts.ready_now,
    sentimentCounts,
    offerReadinessCounts,
    pricingSignalCounts,
    leverageSignalCounts,
  };
}
