export const BUYER_PREFERENCE_MEMORY_STATES = [
  "cold_start",
  "thin_history",
  "evolving",
  "durable",
] as const;

export type BuyerPreferenceMemoryState =
  (typeof BUYER_PREFERENCE_MEMORY_STATES)[number];

export const BUYER_PREFERENCE_SIGNAL_CATEGORIES = [
  "property_type",
  "hoa_burden",
  "flood_risk",
  "price_band",
  "amenity",
  "area",
] as const;

export type BuyerPreferenceSignalCategory =
  (typeof BUYER_PREFERENCE_SIGNAL_CATEGORIES)[number];

export const BUYER_PREFERENCE_SIGNAL_STATUSES = [
  "suppressed",
  "emerging",
  "durable",
  "review",
] as const;

export type BuyerPreferenceSignalStatus =
  (typeof BUYER_PREFERENCE_SIGNAL_STATUSES)[number];

export const BUYER_PREFERENCE_SIGNAL_DIRECTIONS = [
  "prefer",
  "avoid",
] as const;

export type BuyerPreferenceSignalDirection =
  (typeof BUYER_PREFERENCE_SIGNAL_DIRECTIONS)[number];

export const BUYER_PREFERENCE_EVENT_KINDS = [
  "watchlist_saved",
  "tour_feedback",
  "advisory_feedback",
] as const;

export type BuyerPreferenceEventKind =
  (typeof BUYER_PREFERENCE_EVENT_KINDS)[number];

export interface BuyerPreferenceExplicitPreferences {
  preferredAreas: string[];
  propertyTypes: string[];
  mustHaves: string[];
  dealbreakers: string[];
}

export interface BuyerPreferencePropertyInput {
  id: string;
  city?: string | null;
  subdivision?: string | null;
  propertyType?: string | null;
  hoaFee?: number | null;
  floodZone?: string | null;
  listPrice?: number | null;
  pool?: boolean | null;
  waterfrontType?: string | null;
  gatedCommunity?: boolean | null;
}

export interface BuyerPreferenceFeature {
  key: string;
  category: BuyerPreferenceSignalCategory;
  value: string;
  label: string;
  propertyLabel: string;
}

export interface BuyerPreferenceEventInput {
  propertyId: string;
  occurredAt: string;
  eventKind: BuyerPreferenceEventKind;
  sentiment: "positive" | "negative";
  strength: number;
  summary: string;
  features: BuyerPreferenceFeature[];
}

export interface BuyerPreferenceSignalProvenance {
  propertyId: string;
  occurredAt: string;
  eventKind: BuyerPreferenceEventKind;
  sentiment: "positive" | "negative";
  weight: number;
  summary: string;
}

export interface BuyerPreferenceSignalSnapshot {
  key: string;
  category: BuyerPreferenceSignalCategory;
  value: string;
  label: string;
  propertyLabel: string;
  direction: BuyerPreferenceSignalDirection;
  status: BuyerPreferenceSignalStatus;
  confidence: number;
  decayWeight: number;
  netScore: number;
  positiveWeight: number;
  negativeWeight: number;
  distinctPropertyCount: number;
  firstObservedAt: string;
  lastObservedAt: string;
  statusReason: string;
  provenance: BuyerPreferenceSignalProvenance[];
}

export interface BuyerPreferenceHistorySummary {
  state: BuyerPreferenceMemoryState;
  eventCount: number;
  distinctPropertyCount: number;
  lastEventAt: string | null;
  halfLifeDays: number;
  qualifyingSignalCount: number;
}

export interface BuyerPreferenceMemorySnapshot {
  explicitPreferences: BuyerPreferenceExplicitPreferences;
  history: BuyerPreferenceHistorySummary;
  inferredSignals: BuyerPreferenceSignalSnapshot[];
  updatedAt: string;
  modelVersion: string;
}

export interface BuyerPreferenceFitReason {
  source: "explicit" | "inferred";
  kind: "supports" | "conflicts";
  label: string;
  explanation: string;
  confidence?: number;
  status?: BuyerPreferenceSignalStatus;
}

export interface BuyerPreferenceFitView {
  memoryState: BuyerPreferenceMemoryState;
  title: string;
  summary: string;
  score: number | null;
  scoreLabel: string;
  explicitSignals: string[];
  inferredSignals: Array<{
    key: string;
    label: string;
    direction: BuyerPreferenceSignalDirection;
    confidence: number;
    confidenceLabel: string;
    status: BuyerPreferenceSignalStatus;
    statusLabel: string;
    statusReason: string;
    evidenceCount: number;
    lastObservedAt: string;
  }>;
  supportingReasons: BuyerPreferenceFitReason[];
  conflictingReasons: BuyerPreferenceFitReason[];
  shouldInfluenceRecommendations: boolean;
}

type AggregatedSignal = {
  feature: BuyerPreferenceFeature;
  positiveWeight: number;
  negativeWeight: number;
  distinctPropertyIds: Set<string>;
  firstObservedAt: string;
  lastObservedAt: string;
  provenance: BuyerPreferenceSignalProvenance[];
};

export const BUYER_PREFERENCE_MODEL_VERSION = "buyer-fit-v1";
export const BUYER_PREFERENCE_HALF_LIFE_DAYS = 90;
const MIN_DISTINCT_PROPERTIES_FOR_SIGNAL = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function normalizeList(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeLower(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildEmptyExplicitPreferences(
  explicitPreferences?: Partial<BuyerPreferenceExplicitPreferences>,
): BuyerPreferenceExplicitPreferences {
  return {
    preferredAreas: normalizeList(explicitPreferences?.preferredAreas),
    propertyTypes: normalizeList(explicitPreferences?.propertyTypes),
    mustHaves: normalizeList(explicitPreferences?.mustHaves),
    dealbreakers: normalizeList(explicitPreferences?.dealbreakers),
  };
}

function daysBetween(now: string, occurredAt: string): number {
  const nowMs = Date.parse(now);
  const occurredMs = Date.parse(occurredAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(occurredMs)) {
    return 0;
  }
  return Math.max(0, (nowMs - occurredMs) / (1000 * 60 * 60 * 24));
}

function decayMultiplier(now: string, occurredAt: string): number {
  const ageDays = daysBetween(now, occurredAt);
  return Math.pow(0.5, ageDays / BUYER_PREFERENCE_HALF_LIFE_DAYS);
}

function propertyTypeBucket(value?: string | null): {
  value: string;
  label: string;
} | null {
  const normalized = normalizeLower(value ?? "");
  if (!normalized) return null;
  if (normalized.includes("condo")) {
    return { value: "condo", label: "condos" };
  }
  if (normalized.includes("town")) {
    return { value: "townhouse", label: "townhomes" };
  }
  if (
    normalized.includes("single") ||
    normalized.includes("house") ||
    normalized.includes("detached")
  ) {
    return { value: "single_family", label: "single-family homes" };
  }
  if (normalized.includes("multi")) {
    return { value: "multi_family", label: "multi-family homes" };
  }
  return { value: "other", label: value?.trim() ?? "other homes" };
}

function hoaBucket(value?: number | null): {
  value: string;
  label: string;
} {
  const fee = typeof value === "number" ? value : 0;
  if (fee >= 350) {
    return { value: "high", label: "high HOA fees" };
  }
  if (fee > 0) {
    return { value: "low", label: "modest HOA fees" };
  }
  return { value: "none", label: "no HOA fees" };
}

function floodRiskBucket(value?: string | null): {
  value: string;
  label: string;
} | null {
  const normalized = normalizeLower(value ?? "");
  if (!normalized) return null;
  if (normalized.startsWith("x")) {
    return { value: "low", label: "low flood-risk zones" };
  }
  return { value: "high", label: "higher flood-risk zones" };
}

function priceBucket(value?: number | null): {
  value: string;
  label: string;
} | null {
  if (typeof value !== "number" || value <= 0) return null;
  if (value < 350_000) {
    return { value: "entry", label: "entry-price homes" };
  }
  if (value < 750_000) {
    return { value: "mid", label: "mid-price homes" };
  }
  if (value < 1_500_000) {
    return { value: "upscale", label: "upscale homes" };
  }
  return { value: "luxury", label: "luxury homes" };
}

function maybePushFeature(
  features: BuyerPreferenceFeature[],
  feature: BuyerPreferenceFeature | null,
) {
  if (feature) {
    features.push(feature);
  }
}

export function projectBuyerPreferenceFeatures(
  property: BuyerPreferencePropertyInput,
): BuyerPreferenceFeature[] {
  const features: BuyerPreferenceFeature[] = [];
  const propertyType = propertyTypeBucket(property.propertyType);
  const hoa = hoaBucket(property.hoaFee);
  const floodRisk = floodRiskBucket(property.floodZone);
  const price = priceBucket(property.listPrice);
  const city = property.city?.trim();
  const subdivision = property.subdivision?.trim();

  maybePushFeature(
    features,
    propertyType
      ? {
          key: `property_type:${propertyType.value}`,
          category: "property_type",
          value: propertyType.value,
          label: propertyType.label,
          propertyLabel: propertyType.label,
        }
      : null,
  );
  maybePushFeature(features, {
    key: `hoa_burden:${hoa.value}`,
    category: "hoa_burden",
    value: hoa.value,
    label: hoa.label,
    propertyLabel: hoa.label,
  });
  maybePushFeature(
    features,
    floodRisk
      ? {
          key: `flood_risk:${floodRisk.value}`,
          category: "flood_risk",
          value: floodRisk.value,
          label: floodRisk.label,
          propertyLabel: floodRisk.label,
        }
      : null,
  );
  maybePushFeature(
    features,
    price
      ? {
          key: `price_band:${price.value}`,
          category: "price_band",
          value: price.value,
          label: price.label,
          propertyLabel: price.label,
        }
      : null,
  );
  if (property.pool) {
    features.push({
      key: "amenity:pool",
      category: "amenity",
      value: "pool",
      label: "homes with pools",
      propertyLabel: "a pool",
    });
  }
  if (property.waterfrontType) {
    features.push({
      key: "amenity:waterfront",
      category: "amenity",
      value: "waterfront",
      label: "waterfront homes",
      propertyLabel: "waterfront access",
    });
  }
  if (property.gatedCommunity) {
    features.push({
      key: "amenity:gated",
      category: "amenity",
      value: "gated",
      label: "gated communities",
      propertyLabel: "a gated community",
    });
  }
  if (city) {
    features.push({
      key: `area:${normalizeLower(city)}`,
      category: "area",
      value: city,
      label: `${city} homes`,
      propertyLabel: city,
    });
  }
  if (subdivision) {
    features.push({
      key: `area:${normalizeLower(subdivision)}`,
      category: "area",
      value: subdivision,
      label: `${subdivision} homes`,
      propertyLabel: subdivision,
    });
  }

  return features;
}

function statusLabel(status: BuyerPreferenceSignalStatus): string {
  switch (status) {
    case "suppressed":
      return "Suppressed";
    case "emerging":
      return "Emerging";
    case "durable":
      return "Durable";
    case "review":
      return "Needs review";
  }
}

function confidenceLabel(value: number): string {
  if (value >= 0.75) return "High confidence";
  if (value >= 0.5) return "Medium confidence";
  return "Low confidence";
}

function memoryTitle(state: BuyerPreferenceMemoryState): string {
  switch (state) {
    case "cold_start":
      return "No learned fit yet";
    case "thin_history":
      return "Memory is still thin";
    case "evolving":
      return "Fit memory is evolving";
    case "durable":
      return "Fit memory is durable";
  }
}

function buildSignalStatusReason(args: {
  distinctPropertyCount: number;
  totalWeight: number;
  confidence: number;
  conflictRatio: number;
  direction: BuyerPreferenceSignalDirection;
}): string {
  if (args.distinctPropertyCount < MIN_DISTINCT_PROPERTIES_FOR_SIGNAL) {
    return "Only one property is contributing so far.";
  }
  if (args.conflictRatio >= 0.35 && args.totalWeight >= 1.2) {
    return "Recent behavior conflicts enough that the signal needs review.";
  }
  if (args.confidence >= 0.72 && args.distinctPropertyCount >= 3) {
    return `Repeated behavior keeps pointing ${args.direction}.`;
  }
  if (args.confidence >= 0.38) {
    return "There is a directional pattern, but the history is still limited.";
  }
  return "The pattern is too weak to influence recommendations yet.";
}

export function buildBuyerPreferenceMemorySnapshot(args: {
  explicitPreferences?: Partial<BuyerPreferenceExplicitPreferences>;
  events: BuyerPreferenceEventInput[];
  now: string;
}): BuyerPreferenceMemorySnapshot {
  const explicitPreferences = buildEmptyExplicitPreferences(args.explicitPreferences);
  const sortedEvents = [...args.events].sort((left, right) =>
    right.occurredAt.localeCompare(left.occurredAt),
  );
  const signalMap = new Map<string, AggregatedSignal>();

  for (const event of sortedEvents) {
    const weight = event.strength * decayMultiplier(args.now, event.occurredAt);
    for (const feature of event.features) {
      const existing = signalMap.get(feature.key) ?? {
        feature,
        positiveWeight: 0,
        negativeWeight: 0,
        distinctPropertyIds: new Set<string>(),
        firstObservedAt: event.occurredAt,
        lastObservedAt: event.occurredAt,
        provenance: [],
      };

      if (event.sentiment === "positive") {
        existing.positiveWeight += weight;
      } else {
        existing.negativeWeight += weight;
      }
      existing.distinctPropertyIds.add(event.propertyId);
      existing.firstObservedAt =
        event.occurredAt < existing.firstObservedAt
          ? event.occurredAt
          : existing.firstObservedAt;
      existing.lastObservedAt =
        event.occurredAt > existing.lastObservedAt
          ? event.occurredAt
          : existing.lastObservedAt;
      existing.provenance.push({
        propertyId: event.propertyId,
        occurredAt: event.occurredAt,
        eventKind: event.eventKind,
        sentiment: event.sentiment,
        weight: round4(weight),
        summary: event.summary,
      });
      signalMap.set(feature.key, existing);
    }
  }

  const inferredSignals = Array.from(signalMap.values())
    .map((entry): BuyerPreferenceSignalSnapshot => {
      const totalWeight = entry.positiveWeight + entry.negativeWeight;
      const netScore = entry.positiveWeight - entry.negativeWeight;
      const distinctPropertyCount = entry.distinctPropertyIds.size;
      const absNet = Math.abs(netScore);
      const conflictRatio =
        totalWeight === 0
          ? 0
          : Math.min(entry.positiveWeight, entry.negativeWeight) / totalWeight;
      const confidence = clamp(
        (absNet / Math.max(totalWeight, 1)) *
          Math.min(distinctPropertyCount / 3, 1) *
          Math.min(totalWeight / 2.2, 1),
        0,
        1,
      );
      const direction: BuyerPreferenceSignalDirection =
        netScore >= 0 ? "prefer" : "avoid";

      let status: BuyerPreferenceSignalStatus = "suppressed";
      if (
        distinctPropertyCount >= MIN_DISTINCT_PROPERTIES_FOR_SIGNAL &&
        conflictRatio >= 0.35 &&
        totalWeight >= 1.2
      ) {
        status = "review";
      } else if (
        distinctPropertyCount >= 3 &&
        confidence >= 0.72 &&
        totalWeight >= 1.4
      ) {
        status = "durable";
      } else if (
        distinctPropertyCount >= MIN_DISTINCT_PROPERTIES_FOR_SIGNAL &&
        confidence >= 0.38 &&
        totalWeight >= 1
      ) {
        status = "emerging";
      }

      return {
        key: entry.feature.key,
        category: entry.feature.category,
        value: entry.feature.value,
        label: entry.feature.label,
        propertyLabel: entry.feature.propertyLabel,
        direction,
        status,
        confidence: round4(confidence),
        decayWeight: round4(totalWeight),
        netScore: round4(netScore),
        positiveWeight: round4(entry.positiveWeight),
        negativeWeight: round4(entry.negativeWeight),
        distinctPropertyCount,
        firstObservedAt: entry.firstObservedAt,
        lastObservedAt: entry.lastObservedAt,
        statusReason: buildSignalStatusReason({
          distinctPropertyCount,
          totalWeight,
          confidence,
          conflictRatio,
          direction,
        }),
        provenance: entry.provenance
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
          .slice(0, 6),
      };
    })
    .sort((left, right) => {
      const statusRank: Record<BuyerPreferenceSignalStatus, number> = {
        durable: 0,
        emerging: 1,
        review: 2,
        suppressed: 3,
      };
      if (statusRank[left.status] !== statusRank[right.status]) {
        return statusRank[left.status] - statusRank[right.status];
      }
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }
      return right.decayWeight - left.decayWeight;
    });

  const eventCount = sortedEvents.length;
  const distinctPropertyCount = new Set(
    sortedEvents.map((event) => event.propertyId),
  ).size;
  const qualifyingSignalCount = inferredSignals.filter(
    (signal) => signal.status !== "suppressed",
  ).length;

  let state: BuyerPreferenceMemoryState = "cold_start";
  if (eventCount === 0) {
    state = "cold_start";
  } else if (distinctPropertyCount < 2 || qualifyingSignalCount === 0) {
    state = "thin_history";
  } else if (
    qualifyingSignalCount >= 2 ||
    inferredSignals.some((signal) => signal.status === "durable")
  ) {
    state = "durable";
  } else {
    state = "evolving";
  }

  return {
    explicitPreferences,
    history: {
      state,
      eventCount,
      distinctPropertyCount,
      lastEventAt: sortedEvents[0]?.occurredAt ?? null,
      halfLifeDays: BUYER_PREFERENCE_HALF_LIFE_DAYS,
      qualifyingSignalCount,
    },
    inferredSignals,
    updatedAt: args.now,
    modelVersion: BUYER_PREFERENCE_MODEL_VERSION,
  };
}

export function buildEmptyBuyerPreferenceMemory(
  explicitPreferences?: Partial<BuyerPreferenceExplicitPreferences>,
  now?: string,
): BuyerPreferenceMemorySnapshot {
  return buildBuyerPreferenceMemorySnapshot({
    explicitPreferences,
    events: [],
    now: now ?? new Date().toISOString(),
  });
}

function pushReason(
  bucket: BuyerPreferenceFitReason[],
  reason: BuyerPreferenceFitReason,
) {
  if (bucket.some((existing) => existing.label === reason.label)) {
    return;
  }
  bucket.push(reason);
}

function hasTextPreference(
  preferences: string[],
  expectedValues: string[],
): boolean {
  const normalizedPrefs = preferences.map(normalizeLower);
  return expectedValues.some((value) => normalizedPrefs.includes(normalizeLower(value)));
}

function explicitPreferenceReasons(
  snapshot: BuyerPreferenceMemorySnapshot,
  property: BuyerPreferencePropertyInput,
): {
  supporting: BuyerPreferenceFitReason[];
  conflicting: BuyerPreferenceFitReason[];
} {
  const supporting: BuyerPreferenceFitReason[] = [];
  const conflicting: BuyerPreferenceFitReason[] = [];
  const propertyType = propertyTypeBucket(property.propertyType);
  const floodRisk = floodRiskBucket(property.floodZone);
  const hoa = hoaBucket(property.hoaFee);
  const city = property.city?.trim();
  const subdivision = property.subdivision?.trim();

  if (
    propertyType &&
    hasTextPreference(snapshot.explicitPreferences.propertyTypes, [
      propertyType.value,
      propertyType.label,
      property.propertyType ?? "",
    ])
  ) {
    pushReason(supporting, {
      source: "explicit",
      kind: "supports",
      label: "Matches your stated property type",
      explanation: `You explicitly asked for ${propertyType.label}.`,
    });
  }

  if (
    city &&
    hasTextPreference(snapshot.explicitPreferences.preferredAreas, [city])
  ) {
    pushReason(supporting, {
      source: "explicit",
      kind: "supports",
      label: "Matches your preferred area",
      explanation: `${city} is already in your stated search areas.`,
    });
  }

  if (
    subdivision &&
    hasTextPreference(snapshot.explicitPreferences.preferredAreas, [subdivision])
  ) {
    pushReason(supporting, {
      source: "explicit",
      kind: "supports",
      label: "Matches your preferred community",
      explanation: `${subdivision} is already in your stated search areas.`,
    });
  }

  if (
    property.pool &&
    hasTextPreference(snapshot.explicitPreferences.mustHaves, ["pool", "swimming pool"])
  ) {
    pushReason(supporting, {
      source: "explicit",
      kind: "supports",
      label: "Matches an explicit must-have",
      explanation: "You explicitly asked for a pool.",
    });
  }

  if (
    property.gatedCommunity &&
    hasTextPreference(snapshot.explicitPreferences.mustHaves, ["gated", "gated community"])
  ) {
    pushReason(supporting, {
      source: "explicit",
      kind: "supports",
      label: "Matches an explicit must-have",
      explanation: "You explicitly asked for a gated community.",
    });
  }

  if (
    floodRisk?.value === "high" &&
    hasTextPreference(snapshot.explicitPreferences.dealbreakers, ["flood", "high flood risk"])
  ) {
    pushReason(conflicting, {
      source: "explicit",
      kind: "conflicts",
      label: "Conflicts with an explicit dealbreaker",
      explanation: "You explicitly marked flood risk as a dealbreaker.",
    });
  }

  if (
    hoa.value === "high" &&
    hasTextPreference(snapshot.explicitPreferences.dealbreakers, ["hoa", "high hoa", "high hoa fees"])
  ) {
    pushReason(conflicting, {
      source: "explicit",
      kind: "conflicts",
      label: "Conflicts with an explicit dealbreaker",
      explanation: "You explicitly marked heavy HOA fees as a dealbreaker.",
    });
  }

  if (
    propertyType?.value === "condo" &&
    hasTextPreference(snapshot.explicitPreferences.dealbreakers, ["condo", "condos"])
  ) {
    pushReason(conflicting, {
      source: "explicit",
      kind: "conflicts",
      label: "Conflicts with an explicit dealbreaker",
      explanation: "You explicitly marked condos as a dealbreaker.",
    });
  }

  return { supporting, conflicting };
}

export function buildBuyerPreferenceFitView(args: {
  snapshot: BuyerPreferenceMemorySnapshot;
  property: BuyerPreferencePropertyInput;
}): BuyerPreferenceFitView {
  const propertyFeatures = new Map(
    projectBuyerPreferenceFeatures(args.property).map((feature) => [
      feature.key,
      feature,
    ]),
  );
  const inferredSignals = args.snapshot.inferredSignals.filter(
    (signal) => signal.status !== "suppressed",
  );
  const supportingReasons: BuyerPreferenceFitReason[] = [];
  const conflictingReasons: BuyerPreferenceFitReason[] = [];
  let rawScore = 0;

  const explicitReasons = explicitPreferenceReasons(args.snapshot, args.property);
  for (const reason of explicitReasons.supporting) {
    rawScore += 0.45;
    pushReason(supportingReasons, reason);
  }
  for (const reason of explicitReasons.conflicting) {
    rawScore -= 0.55;
    pushReason(conflictingReasons, reason);
  }

  for (const signal of inferredSignals) {
    const feature = propertyFeatures.get(signal.key);
    if (!feature) {
      continue;
    }

    const scoreContribution =
      signal.confidence * (signal.status === "durable" ? 1 : 0.7);
    const explanation =
      signal.direction === "prefer"
        ? `Your recent behavior keeps leaning toward ${feature.label.toLowerCase()}.`
        : `Your recent behavior keeps leaning away from ${feature.label.toLowerCase()}.`;

    if (signal.direction === "prefer") {
      rawScore += scoreContribution;
      pushReason(supportingReasons, {
        source: "inferred",
        kind: "supports",
        label: `Usually prefers ${feature.label.toLowerCase()}`,
        explanation,
        confidence: signal.confidence,
        status: signal.status,
      });
    } else {
      rawScore -= scoreContribution;
      pushReason(conflictingReasons, {
        source: "inferred",
        kind: "conflicts",
        label: `Usually avoids ${feature.label.toLowerCase()}`,
        explanation,
        confidence: signal.confidence,
        status: signal.status,
      });
    }
  }

  const visibleSignalCount = inferredSignals.length;
  const shouldInfluenceRecommendations =
    args.snapshot.history.state === "durable" || visibleSignalCount >= 2;

  let summary = "The recommendation is not using learned behavior yet.";
  let title = memoryTitle(args.snapshot.history.state);
  let score: number | null = null;
  let scoreLabel = "No fit memory yet";

  if (args.snapshot.history.state === "cold_start") {
    summary =
      "This buyer has not generated enough history yet, so recommendations stay on explicit inputs and property evidence only.";
  } else if (args.snapshot.history.state === "thin_history") {
    summary =
      "There is some history, but it is still too thin to treat inferred preferences as durable.";
    score = round4(clamp(rawScore / 2.5, -1, 1));
    scoreLabel = "Weak memory";
  } else {
    score = round4(clamp(rawScore / 2.5, -1, 1));
    if ((score ?? 0) >= 0.3) {
      scoreLabel = "Stronger fit than recent history";
      summary =
        "This property lines up with patterns the buyer has repeatedly favored, so the recommendation can lean into that fit.";
    } else if ((score ?? 0) <= -0.3) {
      scoreLabel = "Repeats patterns usually rejected";
      summary =
        "This property repeats patterns the buyer has usually moved away from, so the recommendation should stay skeptical.";
    } else {
      scoreLabel = "Mixed fit";
      summary =
        "The fit signal is real but mixed, so recommendations should mention the pattern without overcommitting to it.";
    }
  }

  return {
    memoryState: args.snapshot.history.state,
    title,
    summary,
    score,
    scoreLabel,
    explicitSignals: [
      ...args.snapshot.explicitPreferences.propertyTypes,
      ...args.snapshot.explicitPreferences.preferredAreas,
      ...args.snapshot.explicitPreferences.mustHaves.map((value) => `Must have: ${value}`),
      ...args.snapshot.explicitPreferences.dealbreakers.map(
        (value) => `Dealbreaker: ${value}`,
      ),
    ].slice(0, 6),
    inferredSignals: inferredSignals.slice(0, 6).map((signal) => ({
      key: signal.key,
      label: signal.label,
      direction: signal.direction,
      confidence: signal.confidence,
      confidenceLabel: confidenceLabel(signal.confidence),
      status: signal.status,
      statusLabel: statusLabel(signal.status),
      statusReason: signal.statusReason,
      evidenceCount: signal.distinctPropertyCount,
      lastObservedAt: signal.lastObservedAt,
    })),
    supportingReasons: supportingReasons.slice(0, 3),
    conflictingReasons: conflictingReasons.slice(0, 3),
    shouldInfluenceRecommendations,
  };
}
