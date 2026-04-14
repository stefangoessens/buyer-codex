import type {
  ListingAgentProfile,
  ListingAgentTrackRecord,
  ListingAgentTrackRecordMetric,
  ListingAgentTrackRecordMetricKey,
  PropertyMarketContext,
} from "./types";

const MINIMUM_SOLD_SAMPLES = 8;
const MINIMUM_PRICE_CUT_SAMPLES = 6;
const MINIMUM_TRAJECTORY_SAMPLES = 10;

export function buildListingAgentTrackRecord(args: {
  agent: ListingAgentProfile;
  marketContext?: PropertyMarketContext | null;
}): ListingAgentTrackRecord {
  const benchmarkArea = pickBenchmarkArea(args.marketContext);
  const soldSample = finiteCount(args.agent.soldCount);
  const priceCutSample = inferPriceCutSample(args.agent);
  const baseline = benchmarkArea?.selectedContext ?? null;

  const metrics: ListingAgentTrackRecordMetric[] = [
    buildDomMetric({
      agent: args.agent,
      soldSample,
      baselineValue: baseline?.medianDom,
      baselineSample: baseline?.sampleSize.dom,
      baselineSource: baseline?.provenance,
    }),
    buildAskToSaleMetric({
      agent: args.agent,
      soldSample,
      baselineValue: baseline?.medianSaleToListRatio,
      baselineSample: baseline?.sampleSize.saleToList,
      baselineSource: baseline?.provenance,
    }),
    buildPriceCutMetric({
      agent: args.agent,
      priceCutSample,
      baselineValue: baseline?.priceReductionFrequency,
      baselineSample: baseline?.sampleSize.reduction,
      baselineSource: baseline?.provenance,
    }),
    buildUnavailableMetric({
      key: "price_cut_severity",
      label: "Price-cut severity",
      minimumRequired: MINIMUM_PRICE_CUT_SAMPLES,
      note:
        "Current listing-agent acquisition only carries price-cut frequency, not verified cut-size history.",
    }),
    buildUnavailableMetric({
      key: "relist_rate",
      label: "Relist / withdrawn rate",
      minimumRequired: MINIMUM_TRAJECTORY_SAMPLES,
      note:
        "Current listing-agent acquisition does not yet persist relist, withdrawn, or back-on-market history at the agent level.",
    }),
  ];

  const availableMetrics = metrics
    .filter((metric) => metric.status === "available")
    .map((metric) => metric.key);
  const unavailableMetrics = metrics
    .filter((metric) => metric.status !== "available")
    .map((metric) => metric.key);

  const acquisitionNotes = buildAcquisitionNotes({
    soldSample,
    priceCutSample,
    hasBenchmarkArea: Boolean(benchmarkArea?.selectedContext),
  });

  const confidence = aggregateConfidence(metrics);
  const status =
    availableMetrics.length >= 3 && unavailableMetrics.length === 0
      ? "ready"
      : availableMetrics.length > 0
        ? "narrowed"
        : "insufficient_data";
  const effectiveConfidence =
    status === "insufficient_data" ? Math.min(confidence, 0.54) : confidence;

  return {
    status,
    scope: "individual_agent",
    confidence: effectiveConfidence,
    confidenceLabel:
      effectiveConfidence >= 0.78
        ? "high"
        : effectiveConfidence >= 0.58
          ? "moderate"
          : "low",
    benchmarkArea: benchmarkArea?.selectedContext
      ? {
          geoKind: benchmarkArea.selectedGeoKind ?? benchmarkArea.selectedContext.geoKind,
          geoKey: benchmarkArea.selectedGeoKey ?? benchmarkArea.selectedContext.geoKey,
          windowDays: benchmarkArea.windowDays,
        }
      : null,
    acquisition: {
      viability:
        status === "insufficient_data"
          ? "weak"
          : unavailableMetrics.length > 0
            ? "partial"
            : "viable",
      thresholds: {
        minimumSoldSamples: MINIMUM_SOLD_SAMPLES,
        minimumPriceCutSamples: MINIMUM_PRICE_CUT_SAMPLES,
        minimumTrajectorySamples: MINIMUM_TRAJECTORY_SAMPLES,
      },
      availableMetrics,
      unavailableMetrics,
      notes: acquisitionNotes,
    },
    metrics,
    buyerSafeSummary: buildBuyerSafeSummary(metrics, effectiveConfidence),
    internalSummary: buildInternalSummary({
      agentName: args.agent.name,
      benchmarkArea,
      metrics,
      soldSample,
      priceCutSample,
      confidence: effectiveConfidence,
      status,
    }),
  };
}

function pickBenchmarkArea(marketContext?: PropertyMarketContext | null) {
  if (!marketContext) return null;
  return (
    marketContext.windows.find((window) => window.windowDays === 90 && window.selectedContext) ??
    marketContext.windows.find((window) => window.windowDays === 60 && window.selectedContext) ??
    marketContext.windows.find((window) => window.selectedContext) ??
    null
  );
}

function buildDomMetric(args: {
  agent: ListingAgentProfile;
  soldSample: number;
  baselineValue?: number;
  baselineSample?: number;
  baselineSource?: { source: string; fetchedAt: string };
}): ListingAgentTrackRecordMetric {
  const sampleSize = buildSampleSize({
    agent: args.soldSample,
    baseline: args.baselineSample,
    minimumRequired: MINIMUM_SOLD_SAMPLES,
    estimated: false,
  });
  const agentValue = normalizeMetricValue(args.agent.avgDaysOnMarket);
  const baselineValue = normalizeMetricValue(args.baselineValue);
  const provenance = [
    fieldProvenance(args.agent.provenance.avgDaysOnMarket),
    fieldProvenance(args.baselineSource),
  ].filter(Boolean) as ListingAgentTrackRecordMetric["provenance"];

  if (agentValue == null || baselineValue == null) {
    return unavailableMetric({
      key: "days_on_market",
      label: "Days on market",
      sampleSize,
      provenance,
      note:
        agentValue == null
          ? "No verified agent-level days-on-market sample is available yet."
          : "Area DOM baseline is missing, so the agent result cannot be benchmarked safely.",
    });
  }

  const delta = round2(agentValue - baselineValue);
  const deltaPct = baselineValue > 0 ? round2((delta / baselineValue) * 100) : null;
  const slower = delta > 0;
  const material = Math.abs(deltaPct ?? 0) >= 8;
  const confidence = sampleConfidence(sampleSize, material ? 0.08 : 0);

  return {
    key: "days_on_market",
    label: "Days on market",
    status: sampleSize.viable ? "available" : "weak_signal",
    agentValue,
    baselineValue,
    delta,
    deltaPct,
    sampleSize,
    confidence,
    buyerSafeSummary:
      sampleSize.viable && material
        ? slower
          ? `This agent's listings usually take longer to sell than nearby norms.`
          : `This agent's listings usually move faster than nearby norms.`
        : null,
    internalSummary: `Agent DOM averages ${agentValue.toFixed(1)} days versus ${baselineValue.toFixed(1)} in the selected area baseline (${signedPercent(deltaPct)}).`,
    provenance,
  };
}

function buildAskToSaleMetric(args: {
  agent: ListingAgentProfile;
  soldSample: number;
  baselineValue?: number;
  baselineSample?: number;
  baselineSource?: { source: string; fetchedAt: string };
}): ListingAgentTrackRecordMetric {
  const sampleSize = buildSampleSize({
    agent: args.soldSample,
    baseline: args.baselineSample,
    minimumRequired: MINIMUM_SOLD_SAMPLES,
    estimated: false,
  });
  const agentValue = normalizeMetricValue(args.agent.medianListToSellRatio);
  const baselineValue = normalizeMetricValue(args.baselineValue);
  const provenance = [
    fieldProvenance(args.agent.provenance.medianListToSellRatio),
    fieldProvenance(args.baselineSource),
  ].filter(Boolean) as ListingAgentTrackRecordMetric["provenance"];

  if (agentValue == null || baselineValue == null) {
    return unavailableMetric({
      key: "ask_to_sale_ratio",
      label: "Ask-to-sale ratio",
      sampleSize,
      provenance,
      note:
        agentValue == null
          ? "No verified ask-to-sale sample is available for this agent yet."
          : "Area ask-to-sale baseline is missing, so the discount benchmark cannot be shown safely.",
    });
  }

  const delta = round4(agentValue - baselineValue);
  const deltaPct = baselineValue > 0 ? round2((delta / baselineValue) * 100) : null;
  const acceptsLargerDiscounts = delta < 0;
  const material = Math.abs(delta) >= 0.005;
  const confidence = sampleConfidence(sampleSize, material ? 0.1 : 0);

  return {
    key: "ask_to_sale_ratio",
    label: "Ask-to-sale ratio",
    status: sampleSize.viable ? "available" : "weak_signal",
    agentValue,
    baselineValue,
    delta,
    deltaPct,
    sampleSize,
    confidence,
    buyerSafeSummary:
      sampleSize.viable && material
        ? acceptsLargerDiscounts
          ? "This agent tends to accept larger ask-to-sale discounts than nearby norms."
          : "This agent tends to hold closer to ask than nearby norms."
        : null,
    internalSummary: `Agent median ask-to-sale runs at ${(agentValue * 100).toFixed(2)}% versus ${(baselineValue * 100).toFixed(2)}% for the area baseline (${signedPercent(deltaPct)}).`,
    provenance,
  };
}

function buildPriceCutMetric(args: {
  agent: ListingAgentProfile;
  priceCutSample: number | null;
  baselineValue?: number;
  baselineSample?: number;
  baselineSource?: { source: string; fetchedAt: string };
}): ListingAgentTrackRecordMetric {
  const sampleSize = buildSampleSize({
    agent: args.priceCutSample,
    baseline: args.baselineSample,
    minimumRequired: MINIMUM_PRICE_CUT_SAMPLES,
    estimated: true,
  });
  const agentValue = normalizeMetricValue(args.agent.priceCutFrequency);
  const baselineValue = normalizeMetricValue(args.baselineValue);
  const provenance = [
    fieldProvenance(args.agent.provenance.priceCutFrequency),
    fieldProvenance(args.baselineSource),
  ].filter(Boolean) as ListingAgentTrackRecordMetric["provenance"];

  if (agentValue == null || baselineValue == null) {
    return unavailableMetric({
      key: "price_cut_frequency",
      label: "Price-cut frequency",
      sampleSize,
      provenance,
      note:
        agentValue == null
          ? "Agent-level price-cut frequency is not available yet."
          : "Area price-cut baseline is missing, so the frequency benchmark cannot be trusted.",
    });
  }

  const delta = round4(agentValue - baselineValue);
  const deltaPct = baselineValue > 0 ? round2((delta / baselineValue) * 100) : null;
  const cutsMoreOften = delta > 0;
  const material = Math.abs(delta) >= 0.04;
  const confidence = sampleConfidence(sampleSize, material ? 0.08 : 0, 0.08);

  return {
    key: "price_cut_frequency",
    label: "Price-cut frequency",
    status: sampleSize.viable ? "available" : "weak_signal",
    agentValue,
    baselineValue,
    delta,
    deltaPct,
    sampleSize,
    confidence,
    buyerSafeSummary:
      sampleSize.viable && material
        ? cutsMoreOften
          ? "This agent's listings need price cuts more often than nearby norms."
          : "This agent's listings rarely need price cuts versus nearby norms."
        : null,
    internalSummary: `Agent price-cut frequency runs at ${(agentValue * 100).toFixed(1)}% versus ${(baselineValue * 100).toFixed(1)}% for the area baseline (${signedPercent(deltaPct)}).`,
    provenance,
  };
}

function buildUnavailableMetric(args: {
  key: ListingAgentTrackRecordMetricKey;
  label: string;
  minimumRequired: number;
  note: string;
}): ListingAgentTrackRecordMetric {
  return unavailableMetric({
    key: args.key,
    label: args.label,
    sampleSize: buildSampleSize({
      agent: null,
      baseline: null,
      minimumRequired: args.minimumRequired,
      estimated: false,
    }),
    provenance: [],
    note: args.note,
  });
}

function unavailableMetric(args: {
  key: ListingAgentTrackRecordMetricKey;
  label: string;
  sampleSize: ListingAgentTrackRecordMetric["sampleSize"];
  provenance: ListingAgentTrackRecordMetric["provenance"];
  note: string;
}): ListingAgentTrackRecordMetric {
  return {
    key: args.key,
    label: args.label,
    status: "not_collected",
    agentValue: null,
    baselineValue: null,
    delta: null,
    deltaPct: null,
    sampleSize: args.sampleSize,
    confidence: 0.24,
    buyerSafeSummary: null,
    internalSummary: args.note,
    provenance: args.provenance,
  };
}

function buildBuyerSafeSummary(
  metrics: ListingAgentTrackRecordMetric[],
  confidence: number,
): string {
  const strongCalls = metrics
    .filter(
      (metric) =>
        metric.status === "available" &&
        typeof metric.buyerSafeSummary === "string" &&
        metric.buyerSafeSummary.length > 0,
    )
    .map((metric) => metric.buyerSafeSummary!);

  if (strongCalls.length === 0) {
    return "There is not enough verified listing-agent history yet to make a strong agent-specific negotiation call.";
  }

  const opener =
    confidence >= 0.72
      ? "Listing-agent history adds usable context here."
      : "Listing-agent history is directionally helpful, but still limited.";
  return `${opener} ${joinSentences(strongCalls.slice(0, 3))}`;
}

function buildInternalSummary(args: {
  agentName: string;
  benchmarkArea: ReturnType<typeof pickBenchmarkArea>;
  metrics: ListingAgentTrackRecordMetric[];
  soldSample: number;
  priceCutSample: number | null;
  confidence: number;
  status: ListingAgentTrackRecord["status"];
}): string {
  const available = args.metrics
    .filter((metric) => metric.status === "available")
    .map((metric) => metric.label.toLowerCase());
  const missing = args.metrics
    .filter((metric) => metric.status !== "available")
    .map((metric) => metric.label.toLowerCase());
  const areaLabel = args.benchmarkArea?.selectedContext
    ? `${args.benchmarkArea.selectedContext.geoKind}=${args.benchmarkArea.selectedContext.geoKey} @ ${args.benchmarkArea.windowDays}d`
    : "no area benchmark";

  return [
    `${args.agentName} track record is ${args.status} at ${Math.round(args.confidence * 100)}% confidence.`,
    `Benchmark area: ${areaLabel}.`,
    `Sold sample=${args.soldSample}; price-cut sample=${args.priceCutSample ?? "n/a"}.`,
    available.length > 0
      ? `Available metrics: ${available.join(", ")}.`
      : "No metrics cleared the viability bar.",
    missing.length > 0
      ? `Unavailable or weak metrics: ${missing.join(", ")}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function buildAcquisitionNotes(args: {
  soldSample: number;
  priceCutSample: number | null;
  hasBenchmarkArea: boolean;
}): string[] {
  const notes: string[] = [];

  if (args.soldSample < MINIMUM_SOLD_SAMPLES) {
    notes.push(
      `Only ${args.soldSample} sold listings are available for this agent; DOM and ask-to-sale stay below the preferred ${MINIMUM_SOLD_SAMPLES}-sale floor.`,
    );
  } else {
    notes.push(
      `DOM and ask-to-sale use ${args.soldSample} sold listings, which clears the preferred ${MINIMUM_SOLD_SAMPLES}-sale floor.`,
    );
  }

  if (args.priceCutSample == null) {
    notes.push(
      "Price-cut frequency is estimated from the current agent summary because raw listing-history rows are not persisted yet.",
    );
  } else if (args.priceCutSample < MINIMUM_PRICE_CUT_SAMPLES) {
    notes.push(
      `Only ${args.priceCutSample} listings contribute to price-cut frequency, so markdown behavior remains provisional.`,
    );
  } else {
    notes.push(
      `Price-cut frequency has ${args.priceCutSample} listing observations, enough for a directional benchmark.`,
    );
  }

  if (!args.hasBenchmarkArea) {
    notes.push(
      "Area-relative benchmarking is limited because the selected market baseline is missing.",
    );
  }

  notes.push(
    "Price-cut severity plus relist/withdrawn history stay intentionally hidden until raw listing-history coverage is persisted at the agent level.",
  );

  return notes;
}

function buildSampleSize(args: {
  agent: number | null;
  baseline: number | null | undefined;
  minimumRequired: number;
  estimated: boolean;
}) {
  const agent = finiteCount(args.agent);
  const baseline = finiteCount(args.baseline);
  return {
    agent: agent > 0 ? agent : null,
    baseline: baseline > 0 ? baseline : null,
    minimumRequired: args.minimumRequired,
    viable: agent >= args.minimumRequired && baseline >= Math.max(4, args.minimumRequired - 2),
    estimated: args.estimated,
  };
}

function sampleConfidence(
  sampleSize: ListingAgentTrackRecordMetric["sampleSize"],
  materialityBoost: number,
  estimationPenalty = 0,
) {
  let confidence = 0.42;
  if (sampleSize.viable) {
    confidence += 0.2;
  } else if ((sampleSize.agent ?? 0) > 0) {
    confidence += 0.08;
  }
  if ((sampleSize.baseline ?? 0) >= Math.max(4, sampleSize.minimumRequired - 2)) {
    confidence += 0.12;
  }
  confidence += materialityBoost;
  confidence -= estimationPenalty;
  return round2(clamp(confidence, 0.24, 0.9));
}

function aggregateConfidence(metrics: ListingAgentTrackRecordMetric[]) {
  const usable = metrics.filter((metric) => metric.status !== "not_collected");
  if (usable.length === 0) return 0.28;
  const average =
    usable.reduce((sum, metric) => sum + metric.confidence, 0) / usable.length;
  const missingPenalty =
    metrics.filter((metric) => metric.status === "not_collected").length * 0.04;
  return round2(clamp(average - missingPenalty, 0.24, 0.88));
}

function inferPriceCutSample(agent: ListingAgentProfile) {
  if (typeof agent.recentActivityCount === "number" && agent.recentActivityCount > 0) {
    return Math.round(agent.recentActivityCount);
  }
  if (typeof agent.activeListings === "number" && agent.activeListings > 0) {
    return Math.round(agent.activeListings);
  }
  if (typeof agent.soldCount === "number" && agent.soldCount > 0) {
    return Math.round(agent.soldCount);
  }
  return null;
}

function finiteCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

function normalizeMetricValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fieldProvenance(
  value?: { source: string; fetchedAt: string },
) {
  return value ? { source: value.source, fetchedAt: value.fetchedAt } : null;
}

function joinSentences(values: string[]) {
  return values.join(" ");
}

function signedPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function round4(value: number) {
  return Number(value.toFixed(4));
}
