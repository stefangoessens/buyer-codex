import { assessEngineOutputGuardrail } from "@/lib/advisory/guardrails";
import { analyzeLeverage } from "@/lib/ai/engines/leverage";
import { generateOfferScenarios } from "@/lib/ai/engines/offer";
import type {
  LeverageInput,
  LeverageOutput,
  OfferInput,
  OfferOutput,
  OfferScenario,
  PricingOutput,
} from "@/lib/ai/engines/types";

export const OFFER_WHAT_IF_PRICE_CUT_PCT = -0.02;
export const OFFER_WHAT_IF_WAIT_DAYS = 14;

export type OfferWhatIfScenarioKind =
  | "price_change"
  | "timing_change"
  | "uncertainty_resolved";

export type OfferWhatIfUncertaintyKey =
  | "pricing_review"
  | "financing"
  | "appraisal"
  | "insurance";

export interface OfferWhatIfAssumptionChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface OfferWhatIfOutputChange {
  key: string;
  label: string;
  before: string;
  after: string;
}

export interface OfferWhatIfRecommendationView {
  scenarioName: string;
  price: number;
  priceVsListPct: number;
  earnestMoney: number;
  closingDays: number;
  contingencies: string[];
  competitivenessScore: number;
  riskLevel: OfferScenario["riskLevel"];
  explanation: string;
  confidence: number | null;
  guardrailState:
    | "can_say"
    | "softened"
    | "review_required"
    | "blocked"
    | null;
}

export interface OfferWhatIfScenarioView {
  kind: OfferWhatIfScenarioKind;
  title: string;
  kicker: string;
  assumptionLabel: string;
  assumptionValue: string;
  changedAssumptions: OfferWhatIfAssumptionChange[];
  recommendation: OfferWhatIfRecommendationView;
  buyerSummary: {
    headline: string;
    body: string;
  };
  internalSummary: {
    headline: string;
    body: string;
    changedOutputs: OfferWhatIfOutputChange[];
    reviewThresholdCrossed: boolean;
  };
}

export interface OfferWhatIfModel {
  current: {
    title: string;
    body: string;
    recommendation: OfferWhatIfRecommendationView;
  };
  scenarios: OfferWhatIfScenarioView[];
}

export interface BuildOfferWhatIfModelInput {
  offerInput: OfferInput | null;
  offerOutput: OfferOutput | null;
  offerConfidence?: number | null;
  offerReviewState?: "pending" | "approved" | "rejected" | null;
  pricingOutput?: PricingOutput | null;
  leverageInput?: LeverageInput | null;
  leverageOutput?: LeverageOutput | null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function clampOfferIndex(output: OfferOutput): number {
  if (output.scenarios.length === 0) return 0;
  if (!Number.isFinite(output.recommendedIndex)) return 0;
  return Math.min(
    Math.max(Math.trunc(output.recommendedIndex), 0),
    output.scenarios.length - 1,
  );
}

function getRecommendedScenario(output: OfferOutput): OfferScenario | null {
  if (output.scenarios.length === 0) return null;
  return output.scenarios[clampOfferIndex(output)] ?? output.scenarios[0] ?? null;
}

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

function formatDays(days: number): string {
  return `${days} days`;
}

function formatScore(score: number): string {
  return `${score}/100`;
}

function formatRisk(level: OfferScenario["riskLevel"]): string {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)} risk`;
}

function formatSignedMoneyDelta(delta: number): string {
  if (delta === 0) return "no change";
  return `${delta > 0 ? "+" : "-"}${formatMoney(Math.abs(delta))}`;
}

function formatSignedScoreDelta(delta: number): string {
  if (delta === 0) return "no competitiveness change";
  return `${delta > 0 ? "+" : ""}${delta} pts`;
}

function formatContingency(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function boostConfidence(
  current: number | null | undefined,
  bonus: number,
): number | null {
  if (typeof current !== "number" || !Number.isFinite(current)) return null;
  return round2(Math.min(0.99, current + bonus));
}

function mergeConfidence(
  left: number | null | undefined,
  right: number | null | undefined,
): number | null {
  const values = [left, right].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function projectRecommendation(
  output: OfferOutput,
  confidence: number | null | undefined,
  reviewState: "pending" | "approved" | "rejected" | null | undefined,
): OfferWhatIfRecommendationView | null {
  const scenario = getRecommendedScenario(output);
  if (!scenario) return null;

  const guardrail = assessEngineOutputGuardrail({
    engineType: "offer",
    confidence: confidence ?? undefined,
    output,
    reviewState: reviewState ?? undefined,
  });

  return {
    scenarioName: scenario.name,
    price: scenario.price,
    priceVsListPct: scenario.priceVsListPct,
    earnestMoney: scenario.earnestMoney,
    closingDays: scenario.closingDays,
    contingencies: [...scenario.contingencies],
    competitivenessScore: scenario.competitivenessScore,
    riskLevel: scenario.riskLevel,
    explanation: scenario.explanation,
    confidence: confidence ?? null,
    guardrailState: guardrail.state,
  };
}

function replaceRecommendedScenario(
  output: OfferOutput,
  scenario: OfferScenario,
): OfferOutput {
  const scenarios = output.scenarios.map((entry, index) =>
    index === clampOfferIndex(output) ? scenario : entry,
  );
  return {
    ...output,
    scenarios,
  };
}

function buildSharedOutputChanges(args: {
  current: OfferWhatIfRecommendationView;
  next: OfferWhatIfRecommendationView;
  extra?: OfferWhatIfOutputChange[];
}): OfferWhatIfOutputChange[] {
  const changes: OfferWhatIfOutputChange[] = [];

  if (args.current.scenarioName !== args.next.scenarioName) {
    changes.push({
      key: "scenario_name",
      label: "Recommended lane",
      before: args.current.scenarioName,
      after: args.next.scenarioName,
    });
  }

  if (args.current.price !== args.next.price) {
    changes.push({
      key: "offer_price",
      label: "Recommended price",
      before: formatMoney(args.current.price),
      after: formatMoney(args.next.price),
    });
  }

  if (args.current.closingDays !== args.next.closingDays) {
    changes.push({
      key: "closing_days",
      label: "Closing window",
      before: formatDays(args.current.closingDays),
      after: formatDays(args.next.closingDays),
    });
  }

  if (
    args.current.competitivenessScore !== args.next.competitivenessScore
  ) {
    changes.push({
      key: "competitiveness_score",
      label: "Competitiveness",
      before: formatScore(args.current.competitivenessScore),
      after: formatScore(args.next.competitivenessScore),
    });
  }

  if (args.current.riskLevel !== args.next.riskLevel) {
    changes.push({
      key: "risk_level",
      label: "Risk posture",
      before: formatRisk(args.current.riskLevel),
      after: formatRisk(args.next.riskLevel),
    });
  }

  if (args.current.guardrailState !== args.next.guardrailState) {
    changes.push({
      key: "guardrail_state",
      label: "Buyer-safe guardrail",
      before: args.current.guardrailState ?? "unknown",
      after: args.next.guardrailState ?? "unknown",
    });
  }

  return [...changes, ...(args.extra ?? [])];
}

function buildPriceScenario(args: {
  offerInput: OfferInput;
  offerReviewState: "pending" | "approved" | "rejected" | null | undefined;
  current: OfferWhatIfRecommendationView;
  currentConfidence: number | null | undefined;
}): OfferWhatIfScenarioView {
  const nextInput: OfferInput = {
    ...args.offerInput,
    listPrice: Math.round(args.offerInput.listPrice * (1 + OFFER_WHAT_IF_PRICE_CUT_PCT)),
  };
  const nextOutput = generateOfferScenarios(nextInput);
  const recommendation =
    projectRecommendation(
      nextOutput,
      args.currentConfidence,
      args.offerReviewState,
    ) ?? args.current;
  const priceDelta = recommendation.price - args.current.price;

  return {
    kind: "price_change",
    title: "Seller trims the ask",
    kicker: "Price what-if",
    assumptionLabel: "Seller list price",
    assumptionValue: "-2%",
    changedAssumptions: [
      {
        key: "list_price",
        label: "Seller asking price",
        before: formatMoney(args.offerInput.listPrice),
        after: formatMoney(nextInput.listPrice),
      },
    ],
    recommendation,
    buyerSummary: {
      headline:
        priceDelta < 0
          ? "A lower ask gives you more room without changing your posture."
          : "The lower ask does not move the recommendation much.",
      body:
        priceDelta < 0
          ? `The recommendation resets to ${formatMoney(recommendation.price)}, ${formatMoney(Math.abs(priceDelta))} below the current recommendation, while keeping the same general risk posture.`
          : `The recommendation stays close to today at ${formatMoney(recommendation.price)} because the current leverage and fair-value inputs still point to a similar opening lane.`,
    },
    internalSummary: {
      headline: "Re-ran the offer engine with only the list price reduced by 2%.",
      body: `Fair value, leverage score, buyer budget, and competition inputs stayed fixed. This isolates seller price movement from every other recommendation input.`,
      changedOutputs: buildSharedOutputChanges({
        current: args.current,
        next: recommendation,
      }),
      reviewThresholdCrossed:
        args.current.guardrailState !== recommendation.guardrailState,
    },
  };
}

function buildTimingScenario(args: {
  offerInput: OfferInput;
  offerReviewState: "pending" | "approved" | "rejected" | null | undefined;
  current: OfferWhatIfRecommendationView;
  currentConfidence: number | null | undefined;
  leverageInput?: LeverageInput | null;
  leverageOutput?: LeverageOutput | null;
}): OfferWhatIfScenarioView {
  const nextDaysOnMarket =
    (args.leverageInput?.daysOnMarket ?? args.offerInput.daysOnMarket ?? 0) +
    OFFER_WHAT_IF_WAIT_DAYS;
  const nextLeverageInput = args.leverageInput
    ? {
        ...args.leverageInput,
        daysOnMarket: nextDaysOnMarket,
      }
    : null;
  const nextLeverageOutput = nextLeverageInput
    ? analyzeLeverage(nextLeverageInput)
    : null;
  const nextOfferInput: OfferInput = {
    ...args.offerInput,
    daysOnMarket: nextDaysOnMarket,
    leverageScore:
      nextLeverageOutput?.score ?? args.offerInput.leverageScore,
  };
  const nextOutput = generateOfferScenarios(nextOfferInput);
  const nextConfidence = mergeConfidence(
    args.currentConfidence,
    nextLeverageOutput?.overallConfidence,
  );
  const recommendation =
    projectRecommendation(nextOutput, nextConfidence, args.offerReviewState) ??
    args.current;
  const priceDelta = recommendation.price - args.current.price;
  const leverageBefore =
    args.leverageOutput?.score ?? args.offerInput.leverageScore ?? null;
  const leverageAfter =
    nextLeverageOutput?.score ?? args.offerInput.leverageScore ?? null;

  return {
    kind: "timing_change",
    title: "Wait two more weeks",
    kicker: "Timing what-if",
    assumptionLabel: "Delay",
    assumptionValue: "+14 days",
    changedAssumptions: [
      {
        key: "wait_window",
        label: "Buyer wait time",
        before: "Today",
        after: `+${OFFER_WHAT_IF_WAIT_DAYS} days`,
      },
      {
        key: "days_on_market",
        label: "Observed days on market",
        before: formatDays(nextDaysOnMarket - OFFER_WHAT_IF_WAIT_DAYS),
        after: formatDays(nextDaysOnMarket),
      },
    ],
    recommendation,
    buyerSummary: {
      headline:
        priceDelta < 0
          ? "Waiting gives the seller a bit more time pressure."
          : "Waiting does not materially improve the opener.",
      body:
        priceDelta < 0
          ? `With two more weeks on market, the recommendation shifts to ${formatMoney(recommendation.price)}, ${formatMoney(Math.abs(priceDelta))} below today, because the leverage picture improves.`
          : `After a two-week wait, the recommendation stays near ${formatMoney(recommendation.price)}. The extra time on market alone does not create enough leverage to materially improve the opener.`,
    },
    internalSummary: {
      headline: "Recomputed leverage after a 14-day wait, then regenerated offer scenarios.",
      body: `Only the timing inputs changed. The pricing anchor stayed fixed, so any recommendation movement comes from the updated leverage score and days-on-market profile.`,
      changedOutputs: buildSharedOutputChanges({
        current: args.current,
        next: recommendation,
        extra:
          leverageBefore !== leverageAfter &&
          leverageBefore !== null &&
          leverageAfter !== null
            ? [
                {
                  key: "leverage_score",
                  label: "Leverage score",
                  before: formatScore(leverageBefore),
                  after: formatScore(leverageAfter),
                },
              ]
            : [],
      }),
      reviewThresholdCrossed:
        args.current.guardrailState !== recommendation.guardrailState,
    },
  };
}

function pickUncertaintyKey(args: {
  offerInput: OfferInput;
  current: OfferWhatIfRecommendationView;
  pricingOutput?: PricingOutput | null;
}): OfferWhatIfUncertaintyKey {
  const pricingShift = Math.abs(
    (args.pricingOutput?.likelyAccepted?.value ?? args.offerInput.fairValue ?? 0) -
      (args.offerInput.fairValue ?? 0),
  );
  if (args.pricingOutput?.reviewFallback?.reviewRequired && pricingShift >= 2_500) {
    return "pricing_review";
  }
  if (args.current.contingencies.includes("financing")) return "financing";
  if (args.current.contingencies.includes("appraisal")) return "appraisal";
  if (args.current.contingencies.includes("insurance")) return "insurance";
  return "pricing_review";
}

function buildUncertaintyScenario(args: {
  offerInput: OfferInput;
  offerOutput: OfferOutput;
  offerReviewState: "pending" | "approved" | "rejected" | null | undefined;
  current: OfferWhatIfRecommendationView;
  currentConfidence: number | null | undefined;
  pricingOutput?: PricingOutput | null;
}): OfferWhatIfScenarioView {
  const uncertaintyKey = pickUncertaintyKey(args);

  if (uncertaintyKey === "pricing_review") {
    const clarifiedFairValue =
      args.pricingOutput?.likelyAccepted?.value ??
      args.pricingOutput?.fairValue.value ??
      args.offerInput.fairValue ??
      args.current.price;
    const nextInput: OfferInput = {
      ...args.offerInput,
      fairValue: clarifiedFairValue,
    };
    const nextOutput = generateOfferScenarios(nextInput);
    const recommendation =
      projectRecommendation(
        nextOutput,
        boostConfidence(args.currentConfidence, 0.08),
        args.offerReviewState,
      ) ?? args.current;

    return {
      kind: "uncertainty_resolved",
      title: "Pricing is clarified",
      kicker: "Uncertainty what-if",
      assumptionLabel: "Resolved item",
      assumptionValue: "Pricing anchor confirmed",
      changedAssumptions: [
        {
          key: "pricing_anchor",
          label: "Pricing anchor",
          before: args.offerInput.fairValue
            ? formatMoney(args.offerInput.fairValue)
            : "Current anchor unavailable",
          after: formatMoney(clarifiedFairValue),
        },
      ],
      recommendation,
      buyerSummary: {
        headline: "A clearer price anchor tightens the recommendation.",
        body: `If the price question is resolved, the recommendation resets around ${formatMoney(recommendation.price)} with clearer confidence about where the seller is likely to engage.`,
      },
      internalSummary: {
        headline: "Re-ran the offer engine with a clarified pricing anchor.",
        body: `The scenario swaps the current fair-value anchor for the likely-accepted price point after resolving pricing uncertainty. Confidence is bumped to reflect the narrower pricing range.`,
        changedOutputs: buildSharedOutputChanges({
          current: args.current,
          next: recommendation,
        }),
        reviewThresholdCrossed:
          args.current.guardrailState !== recommendation.guardrailState,
      },
    };
  }

  const nextScenario: OfferScenario = {
    name: args.current.scenarioName,
    price: args.current.price,
    priceVsListPct: args.current.priceVsListPct,
    earnestMoney: args.current.earnestMoney,
    closingDays:
      uncertaintyKey === "financing"
        ? Math.max(21, args.current.closingDays - 7)
        : uncertaintyKey === "appraisal"
          ? Math.max(25, args.current.closingDays - 5)
          : Math.max(28, args.current.closingDays - 3),
    contingencies: args.current.contingencies.filter(
      (value) => value !== uncertaintyKey,
    ),
    competitivenessScore: Math.min(
      100,
      args.current.competitivenessScore +
        (uncertaintyKey === "financing"
          ? 8
          : uncertaintyKey === "appraisal"
            ? 6
            : 4),
    ),
    riskLevel: args.current.riskLevel,
    explanation: "",
  };

  nextScenario.explanation =
    uncertaintyKey === "financing"
      ? "With financing fully cleared, the buyer can keep the price posture while removing the financing contingency and closing faster."
      : uncertaintyKey === "appraisal"
        ? "With appraisal support confirmed, the buyer can keep the price posture and remove appraisal friction."
        : "With insurance quotes cleared, the buyer can keep the same general posture and shorten the closing path.";

  const nextOutput = replaceRecommendedScenario(args.offerOutput, nextScenario);
  const recommendation =
    projectRecommendation(
      nextOutput,
      boostConfidence(args.currentConfidence, 0.08),
      args.offerReviewState,
    ) ?? {
      ...args.current,
      explanation: nextScenario.explanation,
    };

  const uncertaintyLabel =
    uncertaintyKey === "financing"
      ? "Financing cleared"
      : uncertaintyKey === "appraisal"
        ? "Appraisal supported"
        : "Insurance cleared";

  return {
    kind: "uncertainty_resolved",
    title: uncertaintyLabel,
    kicker: "Uncertainty what-if",
    assumptionLabel: "Resolved item",
    assumptionValue: uncertaintyLabel,
    changedAssumptions: [
      {
        key: `${uncertaintyKey}_uncertainty`,
        label: `${formatContingency(uncertaintyKey)} uncertainty`,
        before: "Open",
        after: "Resolved",
      },
      {
        key: `${uncertaintyKey}_contingency`,
        label: `${formatContingency(uncertaintyKey)} contingency`,
        before: "Included",
        after: "Removed",
      },
    ],
    recommendation,
    buyerSummary: {
      headline: `Clearing ${formatContingency(uncertaintyKey).toLowerCase()} makes the offer cleaner without needing a higher price.`,
      body: `The recommendation keeps the price near ${formatMoney(recommendation.price)} while shortening the closing path to ${formatDays(recommendation.closingDays)} and removing one major uncertainty.`,
    },
    internalSummary: {
      headline: "Adjusted the current recommendation after resolving one key execution uncertainty.",
      body: `Pricing and leverage stayed fixed. This scenario only changes the recommended offer terms after a single blocker clears.`,
      changedOutputs: buildSharedOutputChanges({
        current: args.current,
        next: recommendation,
      }),
      reviewThresholdCrossed:
        args.current.guardrailState !== recommendation.guardrailState,
    },
  };
}

export function buildOfferWhatIfModel(
  input: BuildOfferWhatIfModelInput,
): OfferWhatIfModel | null {
  if (!input.offerInput || !input.offerOutput) return null;

  const current =
    projectRecommendation(
      input.offerOutput,
      input.offerConfidence,
      input.offerReviewState,
    ) ?? null;
  if (!current) return null;

  return {
    current: {
      title: "Current recommendation",
      body: `Today the offer engine prefers the ${current.scenarioName} lane at ${formatMoney(current.price)} with ${current.contingencies.length === 0 ? "no contingencies" : current.contingencies.map(formatContingency).join(", ")}.`,
      recommendation: current,
    },
    scenarios: [
      buildPriceScenario({
        offerInput: input.offerInput,
        offerReviewState: input.offerReviewState,
        current,
        currentConfidence: input.offerConfidence,
      }),
      buildTimingScenario({
        offerInput: input.offerInput,
        offerReviewState: input.offerReviewState,
        current,
        currentConfidence: input.offerConfidence,
        leverageInput: input.leverageInput,
        leverageOutput: input.leverageOutput,
      }),
      buildUncertaintyScenario({
        offerInput: input.offerInput,
        offerOutput: input.offerOutput,
        offerReviewState: input.offerReviewState,
        current,
        currentConfidence: input.offerConfidence,
        pricingOutput: input.pricingOutput,
      }),
    ],
  };
}
