import type {
  OfferDependencySummary,
  OfferInput,
  OfferOutput,
  OfferScenario,
} from "./types";
import {
  buildDeterministicEngineExecution,
  DETERMINISTIC_ENGINE_MODEL_IDS,
} from "./runtime";

const OFFER_CONTRACT_VERSION = "offer-engine.v2";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Number(value.toFixed(1));
}

function resolveFairValue(input: OfferInput): number | null {
  const pricingFairValue = input.pricing?.fairValue;
  if (typeof pricingFairValue === "number" && pricingFairValue > 0) {
    return pricingFairValue;
  }
  if (typeof input.fairValue === "number" && input.fairValue > 0) {
    return input.fairValue;
  }
  return null;
}

function resolveLeverageScore(input: OfferInput): number | null {
  const leverageScore = input.leverage?.score;
  if (typeof leverageScore === "number" && Number.isFinite(leverageScore)) {
    return leverageScore;
  }
  if (
    typeof input.leverageScore === "number" &&
    Number.isFinite(input.leverageScore)
  ) {
    return input.leverageScore;
  }
  return null;
}

export function buildOfferDependencySummary(
  input: OfferInput,
): OfferDependencySummary {
  const fairValue = resolveFairValue(input);
  const leverageScore = resolveLeverageScore(input);

  return {
    pricing: {
      available: fairValue !== null,
      fairValue,
      reviewRequired: input.pricing?.reviewRequired ?? null,
      sourceOutputId: input.pricing?.sourceOutputId ?? null,
    },
    leverage: {
      available: leverageScore !== null,
      score: leverageScore,
      signalCount:
        input.leverage?.signalCount ?? input.leverage?.signalNames?.length ?? null,
      sourceOutputId: input.leverage?.sourceOutputId ?? null,
    },
  };
}

function buildOfferInputSummary(
  input: OfferInput,
  dependencySummary: OfferDependencySummary,
): string {
  return [
    `List: $${input.listPrice.toLocaleString()}`,
    `Fair value: $${dependencySummary.pricing.fairValue?.toLocaleString() ?? input.listPrice.toLocaleString()}`,
    `Leverage: ${dependencySummary.leverage.score ?? "N/A"}`,
    `DOM: ${input.daysOnMarket ?? "N/A"}`,
  ].join(", ");
}

function computeNetBuyerAdvantagePct(input: OfferInput): number {
  let advantage = 0;
  const leverageScore = resolveLeverageScore(input);

  if (leverageScore !== null) {
    advantage += (leverageScore - 50) * 0.1;
  }

  if (typeof input.daysOnMarket === "number") {
    if (input.daysOnMarket > 60) {
      advantage += Math.min((input.daysOnMarket - 60) * 0.05, 3);
    } else if (input.daysOnMarket < 14) {
      advantage -= Math.min((14 - input.daysOnMarket) * 0.08, 1.2);
    }
  }

  if (input.competingOffers && input.competingOffers > 0) {
    advantage -= Math.min(input.competingOffers * 1.5, 6);
  }

  if (input.sellerMotivated) {
    advantage += 1.2;
  }

  if (input.isNewConstruction) {
    advantage += 0.7;
  }

  if (input.pricing?.reviewRequired) {
    advantage -= 0.6;
  }

  return clamp(advantage, -6, 6);
}

function computeCompetitiveness(args: {
  priceVsListPct: number;
  contingencies: string[];
  closingDays: number;
}): number {
  let competitiveness = 50;
  competitiveness += args.priceVsListPct * 3;
  competitiveness -= args.contingencies.length * 8;
  competitiveness += (45 - args.closingDays) * 0.5;
  return Math.round(clamp(competitiveness, 0, 100));
}

function buildScenario(args: {
  name: string;
  listPrice: number;
  pricePct: number;
  earnestPct: number;
  closingDays: number;
  contingencies: string[];
  riskLevel: OfferScenario["riskLevel"];
  explanation: string;
}): OfferScenario {
  const price = Math.round(args.listPrice * args.pricePct);
  const priceVsListPct = round1((args.pricePct - 1) * 100);
  const earnestMoney = Math.round(price * args.earnestPct);

  return {
    name: args.name,
    price,
    priceVsListPct,
    earnestMoney,
    closingDays: args.closingDays,
    contingencies: [...args.contingencies],
    competitivenessScore: computeCompetitiveness({
      priceVsListPct,
      contingencies: args.contingencies,
      closingDays: args.closingDays,
    }),
    riskLevel: args.riskLevel,
    explanation: args.explanation,
  };
}

function capScenarioToBudget(
  scenario: OfferScenario,
  listPrice: number,
  buyerMaxBudget: number,
): OfferScenario {
  if (scenario.price <= buyerMaxBudget) {
    return scenario;
  }

  const earnestRatio = scenario.price > 0 ? scenario.earnestMoney / scenario.price : 0.02;
  const price = buyerMaxBudget;
  const priceVsListPct = round1((price / listPrice - 1) * 100);

  return {
    ...scenario,
    price,
    priceVsListPct,
    earnestMoney: Math.round(price * earnestRatio),
    competitivenessScore: computeCompetitiveness({
      priceVsListPct,
      contingencies: scenario.contingencies,
      closingDays: scenario.closingDays,
    }),
    explanation: `${scenario.explanation} Capped at the buyer's stated budget.`,
  };
}

function computeOfferConfidence(input: OfferInput): number {
  let confidence = 0.56;
  const dependencySummary = buildOfferDependencySummary(input);

  if (dependencySummary.pricing.available) {
    confidence += 0.16;
  }
  if (dependencySummary.leverage.available) {
    confidence += 0.14;
  }
  if (typeof input.daysOnMarket === "number") {
    confidence += 0.04;
  }
  if (typeof input.competingOffers === "number") {
    confidence += 0.04;
  }
  if (dependencySummary.pricing.reviewRequired) {
    confidence -= 0.08;
  }

  return clamp(confidence, 0.45, 0.86);
}

export function collectOfferCitations(input: OfferInput): string[] {
  const citations: string[] = [];

  if (input.pricing?.sourceOutputId) {
    citations.push(input.pricing.sourceOutputId);
  } else if (resolveFairValue(input) !== null) {
    citations.push("pricing_engine");
  }

  if (input.leverage?.sourceOutputId) {
    citations.push(input.leverage.sourceOutputId);
  } else if (resolveLeverageScore(input) !== null) {
    citations.push("leverage_engine");
  }

  if (citations.length === 0) {
    citations.push("listing_context");
  }

  return citations;
}

export function generateOfferScenarios(input: OfferInput): OfferOutput {
  const dependencySummary = buildOfferDependencySummary(input);
  const fairValue = dependencySummary.pricing.fairValue ?? input.listPrice;
  const referencePct = fairValue / Math.max(input.listPrice, 1);
  const buyerAdvantagePct = computeNetBuyerAdvantagePct(input);

  const aggressivePct = clamp(
    referencePct - 0.03 - buyerAdvantagePct / 100,
    0.85,
    1.01,
  );
  const balancedPct = clamp(
    referencePct - buyerAdvantagePct / 220,
    0.9,
    1.03,
  );
  const competitiveFloor = balancedPct + 0.02;
  const competitivePct = clamp(
    Math.max(
      competitiveFloor,
      referencePct + 0.02 - buyerAdvantagePct / 320,
    ),
    competitiveFloor,
    1.05,
  );

  const leverageLead =
    dependencySummary.leverage.score === null
      ? "without a leverage score"
      : `with leverage ${dependencySummary.leverage.score}/100`;
  const fairValueLead = dependencySummary.pricing.reviewRequired
    ? "Pricing still needs broker review"
    : `Fair value anchors near $${fairValue.toLocaleString()}`;

  const aggressive = buildScenario({
    name: "Aggressive",
    listPrice: input.listPrice,
    pricePct: aggressivePct,
    earnestPct: 0.01,
    closingDays: 45,
    contingencies: ["inspection", "financing", "appraisal"],
    riskLevel: "low",
    explanation:
      `${fairValueLead}, so this opens for maximum savings ${leverageLead}. ` +
      "Full contingency protection keeps the downside low, but rejection risk is highest.",
  });

  const balanced = buildScenario({
    name: "Balanced",
    listPrice: input.listPrice,
    pricePct: balancedPct,
    earnestPct: 0.02,
    closingDays: 35,
    contingencies: ["inspection", "financing"],
    riskLevel: "medium",
    explanation:
      `Tracks the fair-value anchor ${leverageLead}. ` +
      "Standard terms keep the bid credible while preserving buyer protections.",
  });

  const competitive = buildScenario({
    name: "Competitive",
    listPrice: input.listPrice,
    pricePct: competitivePct,
    earnestPct: 0.03,
    closingDays: 30,
    contingencies: ["inspection"],
    riskLevel: "high",
    explanation:
      `Leans toward win probability when seller pressure is limited or competition is active ${leverageLead}. ` +
      "Faster timing and thinner contingencies improve acceptance odds, but the buyer gives up negotiating room.",
  });

  let scenarios = [aggressive, balanced, competitive];

  if (
    typeof input.buyerMaxBudget === "number" &&
    Number.isFinite(input.buyerMaxBudget) &&
    input.buyerMaxBudget > 0
  ) {
    scenarios = scenarios.map((scenario) =>
      capScenarioToBudget(scenario, input.listPrice, input.buyerMaxBudget as number),
    );
  }

  const recommendedIndex =
    input.competingOffers && input.competingOffers > 0 ? 2 : 1;

  return {
    scenarios,
    recommendedIndex,
    inputSummary: buildOfferInputSummary(input, dependencySummary),
    refreshable: true,
    contractVersion: OFFER_CONTRACT_VERSION,
    dependencySummary,
  };
}

export function evaluateOfferScenarios(input: OfferInput) {
  const output = generateOfferScenarios(input);
  return buildDeterministicEngineExecution({
    output,
    confidence: computeOfferConfidence(input),
    citations: collectOfferCitations(input),
    modelId: DETERMINISTIC_ENGINE_MODEL_IDS.offer,
  });
}
