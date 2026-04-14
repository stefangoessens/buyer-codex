import type { LeverageInput, LeverageSignal, LeverageOutput } from "./types";
import {
  buildDeterministicEngineExecution,
  DETERMINISTIC_ENGINE_MODEL_IDS,
} from "./runtime";

const MOTIVATED_PHRASES = [
  "must sell",
  "bring all offers",
  "priced to sell",
  "as-is",
  "estate sale",
  "relocating",
  "price improvement",
  "seller motivated",
  "make an offer",
  "price reduced",
  "below market",
];

export function detectMotivatedLanguage(
  description?: string,
): LeverageSignal | null {
  if (!description) return null;

  const lower = description.toLowerCase();
  const found = MOTIVATED_PHRASES.filter((phrase) => lower.includes(phrase));
  if (found.length === 0) return null;

  return {
    name: "motivated_seller_language",
    value: found.length,
    marketReference: 0,
    delta: found.length,
    confidence: round2(clamp(0.6 + found.length * 0.08, 0, 0.9)),
    citation: "Listing description analysis",
    direction: "bullish",
    explanation: `Description includes motivated-seller language: ${found.join(", ")}.`,
  };
}

export function detectDomPressure(
  dom: number,
  neighborhoodMedian?: number,
): LeverageSignal | null {
  if (!Number.isFinite(dom) || !neighborhoodMedian || neighborhoodMedian <= 0) {
    return null;
  }

  const delta = round1(dom - neighborhoodMedian);
  const pct = round1((delta / neighborhoodMedian) * 100);
  return {
    name: "days_on_market_pressure",
    value: dom,
    marketReference: neighborhoodMedian,
    delta,
    confidence: 0.86,
    citation: "Listing DOM vs neighborhood median DOM",
    direction: delta > 7 ? "bullish" : delta < -7 ? "bearish" : "neutral",
    explanation: `Listing has been on market ${dom} days versus a neighborhood median of ${round1(neighborhoodMedian)} days (${signed(pct)}%).`,
  };
}

export function detectPriceReductions(
  reductions?: Array<{ amount: number; date: string }>,
  neighborhoodMedianPriceCutFrequency?: number,
  neighborhoodMedianSaleToListRatio?: number,
): LeverageSignal | null {
  if (!reductions || reductions.length === 0) return null;

  const referenceCount = referenceReductionCount(
    neighborhoodMedianPriceCutFrequency,
    neighborhoodMedianSaleToListRatio,
  );
  const count = reductions.length;
  const delta = round1(count - referenceCount);

  return {
    name: "price_cut_count",
    value: count,
    marketReference: referenceCount,
    delta,
    confidence: 0.84,
    citation: "Listing reduction history vs neighborhood markdown norm",
    direction: delta > 0.25 ? "bullish" : delta < -0.25 ? "bearish" : "neutral",
    explanation: `Listing shows ${count} price cut${count === 1 ? "" : "s"} versus an estimated neighborhood norm of ${referenceCount.toFixed(1)} cuts.`,
  };
}

export function detectPriceReductionAmount(
  listPrice: number,
  reductions?: Array<{ amount: number; date: string }>,
  neighborhoodMedianReductionPct?: number,
  neighborhoodMedianSaleToListRatio?: number,
): LeverageSignal | null {
  if (!reductions || reductions.length === 0 || !Number.isFinite(listPrice) || listPrice <= 0) {
    return null;
  }

  const totalReduction = reductions.reduce((sum, reduction) => sum + reduction.amount, 0);
  const markdownPct = round2((totalReduction / listPrice) * 100);
  const referencePct = referenceMarkdownPct(
    neighborhoodMedianReductionPct,
    neighborhoodMedianSaleToListRatio,
  );
  const delta = round2(markdownPct - referencePct);

  return {
    name: "price_cut_total",
    value: markdownPct,
    marketReference: referencePct,
    delta,
    confidence: 0.88,
    citation: "Listing markdown vs neighborhood sale-to-list norm",
    direction: delta > 0.4 ? "bullish" : delta < -0.4 ? "bearish" : "neutral",
    explanation: `Listing markdown totals $${Math.round(totalReduction).toLocaleString()} (${markdownPct.toFixed(2)}%) versus an estimated local markdown norm of ${referencePct.toFixed(2)}%.`,
  };
}

export function detectPriceVsMarket(
  listPrice: number,
  sqft: number,
  neighborhoodMedianPsf?: number,
): LeverageSignal | null {
  if (!Number.isFinite(listPrice) || listPrice <= 0 || !Number.isFinite(sqft) || sqft <= 0) {
    return null;
  }
  if (!neighborhoodMedianPsf || neighborhoodMedianPsf <= 0) return null;

  const listingPsf = round1(listPrice / sqft);
  const delta = round1(listingPsf - neighborhoodMedianPsf);
  const pct = round1((delta / neighborhoodMedianPsf) * 100);

  return {
    name: "price_vs_market",
    value: listingPsf,
    marketReference: round1(neighborhoodMedianPsf),
    delta,
    confidence: 0.82,
    citation: "Listing $/sqft vs neighborhood median $/sqft",
    direction: pct < -3 ? "bullish" : pct > 5 ? "bearish" : "neutral",
    explanation: `Listing asks $${listingPsf.toFixed(1)}/sqft versus a neighborhood median of $${round1(neighborhoodMedianPsf).toFixed(1)}/sqft (${signed(pct)}%).`,
  };
}

export function detectListingTrajectory(
  input: LeverageInput,
): LeverageSignal | null {
  const flags: string[] = [];
  if (input.wasRelisted) flags.push("relisted");
  if (input.wasWithdrawn) flags.push("withdrawn and returned");
  if (input.wasPendingFellThrough) flags.push("fell out of pending");
  if (flags.length === 0) return null;

  return {
    name: "listing_trajectory",
    value: flags.length,
    marketReference: 0,
    delta: flags.length,
    confidence: 0.76,
    citation: "Listing history trajectory analysis",
    direction: "bullish",
    explanation: `Listing trajectory shows pressure events: ${flags.join(", ")}.`,
  };
}

export function detectListingAgeVsVelocity(
  daysOnMarket: number,
  salesVelocity?: number,
  inventoryCount?: number,
): LeverageSignal | null {
  if (!Number.isFinite(daysOnMarket) || daysOnMarket < 0) return null;
  if (!salesVelocity || salesVelocity <= 0 || !inventoryCount || inventoryCount <= 0) {
    return null;
  }

  const absorptionDays = round1(inventoryCount / salesVelocity);
  const delta = round1(daysOnMarket - absorptionDays);
  const pct = round1((delta / absorptionDays) * 100);

  return {
    name: "listing_age",
    value: daysOnMarket,
    marketReference: absorptionDays,
    delta,
    confidence: 0.8,
    citation: "Listing age vs neighborhood absorption pace",
    direction: delta > 7 ? "bullish" : delta < -7 ? "bearish" : "neutral",
    explanation: `Listing age is ${daysOnMarket} days versus an estimated ${absorptionDays.toFixed(1)}-day absorption pace from neighborhood inventory and sales velocity (${signed(pct)}%).`,
  };
}

export function detectListingAgentDom(
  listingAgentAvgDom?: number,
  neighborhoodMedianDom?: number,
): LeverageSignal | null {
  if (
    !listingAgentAvgDom ||
    listingAgentAvgDom <= 0 ||
    !neighborhoodMedianDom ||
    neighborhoodMedianDom <= 0
  ) {
    return null;
  }

  const delta = round1(listingAgentAvgDom - neighborhoodMedianDom);
  const pct = round1((delta / neighborhoodMedianDom) * 100);

  return {
    name: "agent_avg_dom",
    value: round1(listingAgentAvgDom),
    marketReference: round1(neighborhoodMedianDom),
    delta,
    confidence: 0.72,
    citation: "Listing agent average DOM vs neighborhood median DOM",
    direction: delta > 5 ? "bullish" : delta < -5 ? "bearish" : "neutral",
    explanation: `Listing agent averages ${round1(listingAgentAvgDom).toFixed(1)} days on market versus a neighborhood median of ${round1(neighborhoodMedianDom).toFixed(1)} (${signed(pct)}%).`,
  };
}

export function detectListingAgentSaleToList(
  listingAgentAvgSaleToList?: number,
  neighborhoodMedianSaleToListRatio?: number,
): LeverageSignal | null {
  if (
    !listingAgentAvgSaleToList ||
    listingAgentAvgSaleToList <= 0 ||
    !neighborhoodMedianSaleToListRatio ||
    neighborhoodMedianSaleToListRatio <= 0
  ) {
    return null;
  }

  const value = round2(listingAgentAvgSaleToList * 100);
  const marketReference = round2(neighborhoodMedianSaleToListRatio * 100);
  const delta = round2(value - marketReference);

  return {
    name: "agent_sale_to_list",
    value,
    marketReference,
    delta,
    confidence: 0.74,
    citation: "Listing agent sale-to-list ratio vs neighborhood sale-to-list median",
    direction: delta < -0.5 ? "bullish" : delta > 0.5 ? "bearish" : "neutral",
    explanation: `Listing agent closes at ${value.toFixed(2)}% of list on median versus a neighborhood median of ${marketReference.toFixed(2)}%.`,
  };
}

export function detectListingAgentPriceCutFrequency(
  listingAgentPriceCutFrequency?: number,
  neighborhoodMedianPriceCutFrequency?: number,
  neighborhoodMedianSaleToListRatio?: number,
): LeverageSignal | null {
  if (
    typeof listingAgentPriceCutFrequency !== "number" ||
    listingAgentPriceCutFrequency < 0
  ) {
    return null;
  }

  const reference =
    typeof neighborhoodMedianPriceCutFrequency === "number"
      ? neighborhoodMedianPriceCutFrequency
      : derivedPriceCutFrequency(neighborhoodMedianSaleToListRatio);
  if (typeof reference !== "number") return null;

  const value = round2(listingAgentPriceCutFrequency * 100);
  const marketReference = round2(reference * 100);
  const delta = round2(value - marketReference);

  return {
    name: "agent_price_cut_frequency",
    value,
    marketReference,
    delta,
    confidence: 0.68,
    citation: "Listing agent price-cut frequency vs local markdown baseline",
    direction: delta > 4 ? "bullish" : delta < -4 ? "bearish" : "neutral",
    explanation: `Listing agent cuts price on ${value.toFixed(2)}% of listings versus an estimated local baseline of ${marketReference.toFixed(2)}%.`,
  };
}

export function detectSellerEquity(
  sellerEquityPct?: number,
): LeverageSignal | null {
  if (
    typeof sellerEquityPct !== "number" ||
    !Number.isFinite(sellerEquityPct) ||
    sellerEquityPct <= 0
  ) {
    return null;
  }

  const marketReference = 35;
  const delta = round2(sellerEquityPct - marketReference);

  return {
    name: "seller_equity",
    value: round2(sellerEquityPct),
    marketReference,
    delta,
    confidence: 0.62,
    citation: "Seller equity estimate",
    direction: delta > 10 ? "bullish" : delta < -10 ? "bearish" : "neutral",
    explanation: `Estimated seller equity is ${round2(sellerEquityPct).toFixed(2)}% versus a 35.00% baseline cushion.`,
  };
}

export function detectOccupancyPressure(
  occupancyStatus?: LeverageInput["occupancyStatus"],
): LeverageSignal | null {
  if (!occupancyStatus || occupancyStatus === "owner_occupied") return null;

  if (occupancyStatus === "vacant") {
    return {
      name: "occupancy_pressure",
      value: 1,
      marketReference: 0,
      delta: 1,
      confidence: 0.72,
      citation: "Occupancy status",
      direction: "bullish",
      explanation: "Property appears vacant, which can increase carrying-cost pressure and seller willingness to negotiate.",
    };
  }

  return {
    name: "occupancy_pressure",
    value: 0.5,
    marketReference: 0,
    delta: 0.5,
    confidence: 0.6,
    citation: "Occupancy status",
    direction: "bullish",
    explanation: "Property appears tenant-occupied, which can create turnover friction and some negotiating pressure.",
  };
}

export function detectMarketTemperature(
  trajectory?: LeverageInput["neighborhoodMarketTrajectory"],
): LeverageSignal | null {
  if (!trajectory) return null;

  if (trajectory === "falling") {
    return {
      name: "market_temperature",
      value: 1,
      marketReference: 0,
      delta: 1,
      confidence: 0.78,
      citation: "Neighborhood market trajectory",
      direction: "bullish",
      explanation: "Neighborhood market trajectory is falling, which typically increases seller pressure versus a flat market.",
    };
  }

  if (trajectory === "rising") {
    return {
      name: "market_temperature",
      value: -1,
      marketReference: 0,
      delta: -1,
      confidence: 0.78,
      citation: "Neighborhood market trajectory",
      direction: "bearish",
      explanation: "Neighborhood market trajectory is rising, which usually reduces seller pressure versus a flat market.",
    };
  }

  return {
    name: "market_temperature",
    value: 0,
    marketReference: 0,
    delta: 0,
    confidence: 0.7,
    citation: "Neighborhood market trajectory",
    direction: "neutral",
    explanation: "Neighborhood market trajectory is flat, which keeps leverage close to balanced.",
  };
}

export function computeLeverageScore(signals: LeverageSignal[]): number {
  if (signals.length === 0) return 50;

  let score = 50;
  for (const signal of signals) {
    if (signal.direction === "neutral") continue;
    const sign = signal.direction === "bullish" ? 1 : -1;
    score += sign * scoreContribution(signal);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function analyzeLeverage(input: LeverageInput): LeverageOutput {
  const signals = compactSignals([
    detectDomPressure(input.daysOnMarket, input.neighborhoodMedianDom),
    detectPriceReductions(
      input.priceReductions,
      input.neighborhoodMedianPriceCutFrequency,
      input.neighborhoodMedianSaleToListRatio,
    ),
    detectPriceReductionAmount(
      input.listPrice,
      input.priceReductions,
      input.neighborhoodMedianReductionPct,
      input.neighborhoodMedianSaleToListRatio,
    ),
    detectMotivatedLanguage(input.description),
    detectPriceVsMarket(
      input.listPrice,
      input.sqft,
      input.neighborhoodMedianPsf,
    ),
    detectListingTrajectory(input),
    detectListingAgeVsVelocity(
      input.daysOnMarket,
      input.neighborhoodSalesVelocity,
      input.neighborhoodInventoryCount,
    ),
    detectListingAgentDom(
      input.listingAgentAvgDom,
      input.neighborhoodMedianDom,
    ),
    detectListingAgentSaleToList(
      input.listingAgentAvgSaleToList,
      input.neighborhoodMedianSaleToListRatio,
    ),
    detectListingAgentPriceCutFrequency(
      input.listingAgentPriceCutFrequency,
      input.neighborhoodMedianPriceCutFrequency,
      input.neighborhoodMedianSaleToListRatio,
    ),
    detectSellerEquity(input.sellerEquityPct),
    detectOccupancyPressure(input.occupancyStatus),
    detectMarketTemperature(input.neighborhoodMarketTrajectory),
  ]);

  const score = computeLeverageScore(signals);
  const overallConfidence =
    signals.length > 0
      ? round2(
          signals.reduce((sum, signal) => sum + signal.confidence, 0) /
            signals.length,
        )
      : 0.5;
  const rationale = buildRationale(signals);

  return {
    score,
    signals,
    overallConfidence,
    signalCount: signals.length,
    summary: buildSummary(score, signals.length, rationale),
    rationale,
  };
}

export function collectLeverageCitations(output: LeverageOutput): string[] {
  return output.signals.map((signal) => signal.citation);
}

export function evaluateLeverageAnalysis(input: LeverageInput) {
  const output = analyzeLeverage(input);
  return buildDeterministicEngineExecution({
    output,
    confidence: output.overallConfidence,
    citations: collectLeverageCitations(output),
    modelId: DETERMINISTIC_ENGINE_MODEL_IDS.leverage,
  });
}

function compactSignals(
  signals: Array<LeverageSignal | null>,
): LeverageSignal[] {
  return signals.filter((signal): signal is LeverageSignal => signal !== null);
}

function referenceMarkdownPct(
  neighborhoodMedianReductionPct?: number,
  neighborhoodMedianSaleToListRatio?: number,
): number {
  if (
    typeof neighborhoodMedianReductionPct === "number" &&
    Number.isFinite(neighborhoodMedianReductionPct) &&
    neighborhoodMedianReductionPct >= 0
  ) {
    return round2(neighborhoodMedianReductionPct);
  }
  if (
    typeof neighborhoodMedianSaleToListRatio !== "number" ||
    !Number.isFinite(neighborhoodMedianSaleToListRatio) ||
    neighborhoodMedianSaleToListRatio <= 0
  ) {
    return 0;
  }
  return round2(Math.max((1 - neighborhoodMedianSaleToListRatio) * 100, 0));
}

function referenceReductionCount(
  neighborhoodMedianPriceCutFrequency?: number,
  neighborhoodMedianSaleToListRatio?: number,
): number {
  if (
    typeof neighborhoodMedianPriceCutFrequency === "number" &&
    Number.isFinite(neighborhoodMedianPriceCutFrequency) &&
    neighborhoodMedianPriceCutFrequency >= 0
  ) {
    return round1(clamp(neighborhoodMedianPriceCutFrequency * 3, 0, 3));
  }
  const markdownPct = referenceMarkdownPct(undefined, neighborhoodMedianSaleToListRatio);
  return round1(clamp(markdownPct / 2, 0, 3));
}

function derivedPriceCutFrequency(
  neighborhoodMedianSaleToListRatio?: number,
): number | undefined {
  if (
    typeof neighborhoodMedianSaleToListRatio !== "number" ||
    !Number.isFinite(neighborhoodMedianSaleToListRatio) ||
    neighborhoodMedianSaleToListRatio <= 0
  ) {
    return undefined;
  }

  return round2(clamp((1 - neighborhoodMedianSaleToListRatio) * 12, 0.05, 0.6));
}

function scoreContribution(signal: LeverageSignal): number {
  const denominator = scoreDenominator(signal);
  const magnitude = Math.min(Math.abs(signal.delta) / denominator, 1);
  return round2(magnitude * signal.confidence * 12);
}

function scoreDenominator(signal: LeverageSignal): number {
  switch (signal.name) {
    case "days_on_market_pressure":
    case "listing_age":
    case "agent_avg_dom":
      return 21;
    case "price_cut_count":
    case "listing_trajectory":
    case "motivated_seller_language":
      return 2;
    case "price_cut_total":
      return 2.5;
    case "agent_sale_to_list":
      return 1.5;
    case "agent_price_cut_frequency":
      return 10;
    case "seller_equity":
      return 25;
    case "occupancy_pressure":
    case "market_temperature":
      return 1;
    case "price_vs_market": {
      if (typeof signal.marketReference !== "number" || signal.marketReference <= 0) {
        return 20;
      }
      return signal.marketReference * 0.05;
    }
    default:
      return 10;
  }
}

function buildRationale(signals: LeverageSignal[]): string[] {
  return [...signals]
    .filter((signal) => signal.direction !== "neutral")
    .sort((a, b) => {
      const contributionDelta = scoreContribution(b) - scoreContribution(a);
      if (contributionDelta !== 0) return contributionDelta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 4)
    .map((signal) => signal.explanation ?? signal.name);
}

function buildSummary(
  score: number,
  signalCount: number,
  rationale: string[],
): string {
  if (signalCount === 0) {
    return "Leverage is neutral because no seller-pressure signals were available.";
  }

  const posture =
    score >= 70
      ? "Seller pressure looks elevated."
      : score >= 56
        ? "Seller pressure is modestly elevated."
        : score >= 45
          ? "Leverage looks balanced."
          : "Seller leverage looks firmer than buyer leverage.";

  const lead = rationale[0];
  return lead ? `${posture} ${lead}` : posture;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}
