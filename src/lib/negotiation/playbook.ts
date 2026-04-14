import {
  assessEngineOutputGuardrail,
  type AdvisoryApprovalPath,
  type AdvisoryGuardrailState,
  type AdvisoryReviewState,
} from "@/lib/advisory/guardrails";
import type { OfferOutput, OfferScenario, PricingOutput, LeverageOutput } from "@/lib/ai/engines/types";
import { pickResolvedMarketContext } from "@/lib/enrichment/marketContext";
import type { ListingAgentProfile, PropertyMarketContext } from "@/lib/enrichment/types";

export const NEGOTIATION_PLAYBOOK_VERSION = "1.0.0";

export type NegotiationPlaybookStatus =
  | "ready"
  | "needs_review"
  | "insufficient_data";

export type NegotiationPlaybookAudience = "buyer_safe" | "internal";

export type NegotiationAskPosture =
  | "anchor_below_list"
  | "market_aligned"
  | "competitive_escalation"
  | "ceiling_hold";

export type NegotiationTimingAngle =
  | "stale_listing"
  | "price_cut_window"
  | "market_softness"
  | "clean_close"
  | "counter_window";

export type NegotiationConcessionKind =
  | "seller_credit"
  | "repair_credit"
  | "closing_speed"
  | "earnest_money"
  | "price_step"
  | "contingency_trim"
  | "broker_review";

export type NegotiationRationaleCode =
  | "pricing_gap"
  | "leverage_score"
  | "market_context"
  | "listing_agent"
  | "buyer_readiness"
  | "scenario_profile"
  | "fallback_shift";

export interface NegotiationPlaybookInputs {
  subject: {
    propertyId: string;
    address: string;
    listPrice: number;
    daysOnMarket?: number;
    wasRelisted?: boolean;
    wasPendingFellThrough?: boolean;
    priceReductions?: Array<{ amount: number; date: string }>;
  };
  pricing?: {
    version?: string;
    confidence?: number;
    reviewState?: AdvisoryReviewState;
    output: PricingOutput;
  };
  leverage?: {
    version?: string;
    confidence?: number;
    reviewState?: AdvisoryReviewState;
    output: LeverageOutput;
  };
  offer?: {
    version?: string;
    confidence?: number;
    reviewState?: AdvisoryReviewState;
    output: OfferOutput;
  };
  marketContext?: PropertyMarketContext | null;
  listingAgent?: Pick<
    ListingAgentProfile,
    "name" | "brokerage" | "avgDaysOnMarket" | "medianListToSellRatio" | "priceCutFrequency"
  > | null;
  buyer: {
    budgetMax?: number;
    financingType?: "cash" | "conventional" | "fha" | "va" | "other";
    preApproved: boolean;
    preApprovalAmount?: number;
    preApprovalExpiry?: string;
    lenderName?: string;
  };
  generatedAt: string;
}

export interface NegotiationPlaybookSourceVersions {
  builderVersion: string;
  pricingVersion?: string;
  leverageVersion?: string;
  offerVersion?: string;
}

export interface NegotiationPlaybookReview {
  state: AdvisoryGuardrailState;
  approvalPath: AdvisoryApprovalPath;
  headline: string;
  message: string;
}

export interface NegotiationConcession {
  kind: NegotiationConcessionKind;
  priority: "primary" | "optional";
  label: string;
  buyerSafeLabel: string;
  detail: string;
  amount?: number;
}

export interface NegotiationRationale {
  code: NegotiationRationaleCode;
  label: string;
  summary: string;
  buyerSafeSummary: string;
}

export interface NegotiationStrategyBranch {
  key: "primary" | "fallback";
  label: string;
  trigger: string;
  scenarioName?: string;
  askPrice?: number;
  askPriceVsListPct?: number;
  earnestMoney?: number;
  closingDays?: number;
  contingencies: string[];
  posture: NegotiationAskPosture;
  timingAngle: NegotiationTimingAngle;
  concessionPlan: NegotiationConcession[];
  rationale: NegotiationRationale[];
}

export interface NegotiationPlaybookBranchView {
  title: string;
  trigger: string;
  askLabel: string | null;
  postureLabel: string;
  timingLabel: string;
  contingencies: string[];
  concessions: string[];
  rationale: string[];
}

interface NegotiationPlaybookViewBase {
  audience: NegotiationPlaybookAudience;
  version: string;
  status: NegotiationPlaybookStatus;
  generatedAt: string;
  sourceVersions: NegotiationPlaybookSourceVersions;
  summary: string;
  review: NegotiationPlaybookReview;
  primary: NegotiationPlaybookBranchView | null;
  fallback: NegotiationPlaybookBranchView | null;
}

export interface BuyerSafeNegotiationPlaybook
  extends NegotiationPlaybookViewBase {
  audience: "buyer_safe";
}

export interface InternalNegotiationPlaybook
  extends NegotiationPlaybookViewBase {
  audience: "internal";
  invalidationConditions: string[];
}

export type NegotiationPlaybookView =
  | BuyerSafeNegotiationPlaybook
  | InternalNegotiationPlaybook;

export interface NegotiationPlaybookBundle {
  version: string;
  status: NegotiationPlaybookStatus;
  generatedAt: string;
  sourceVersions: NegotiationPlaybookSourceVersions;
  review: NegotiationPlaybookReview;
  primary: NegotiationStrategyBranch | null;
  fallback: NegotiationStrategyBranch | null;
  invalidationConditions: string[];
  buyerSafe: BuyerSafeNegotiationPlaybook;
  internal: InternalNegotiationPlaybook;
}

type BuyerStrengthState = {
  budgetTight: boolean;
  canMoveFast: boolean;
  strongFinancing: boolean;
  ceilingAtPrimary: boolean;
  ceilingAtFallback: boolean;
};

type MarketSignal = ReturnType<typeof resolveMarketSignal>;

const REVIEWABLE_STATES = new Set<AdvisoryGuardrailState>([
  "review_required",
  "blocked",
]);

export function buildNegotiationPlaybookBundle(
  input: NegotiationPlaybookInputs,
): NegotiationPlaybookBundle {
  const reviewAssessment = assessEngineOutputGuardrail({
    engineType: "offer",
    output: input.offer?.output,
    confidence: input.offer?.confidence,
    reviewState: input.offer?.reviewState,
  });
  const review: NegotiationPlaybookReview = {
    state: reviewAssessment.state,
    approvalPath: reviewAssessment.approvalPath,
    headline: reviewAssessment.buyerHeadline,
    message: reviewAssessment.buyerExplanation,
  };
  const sourceVersions: NegotiationPlaybookSourceVersions = {
    builderVersion: NEGOTIATION_PLAYBOOK_VERSION,
    pricingVersion: input.pricing?.version,
    leverageVersion: input.leverage?.version,
    offerVersion: input.offer?.version,
  };

  const offerOutput = input.offer?.output;
  const primaryScenario = resolvePrimaryScenario(offerOutput);
  const fallbackScenario = resolveFallbackScenario(offerOutput, primaryScenario);
  const marketSignal = resolveMarketSignal(input.marketContext);
  const buyerStrength = resolveBuyerStrength(input, primaryScenario, fallbackScenario);

  const primary =
    primaryScenario && input.pricing?.output && input.leverage?.output
      ? buildScenarioBranch({
          key: "primary",
          scenario: primaryScenario,
          input,
          marketSignal,
          buyerStrength,
          primaryScenario,
        })
      : null;

  const fallback =
    primary && input.pricing?.output && input.leverage?.output
      ? fallbackScenario
        ? buildScenarioBranch({
            key: "fallback",
          scenario: fallbackScenario,
          input,
          marketSignal,
          buyerStrength,
          primaryScenario: primaryScenario!,
        })
        : buildCeilingHoldBranch({
            input,
            marketSignal,
            buyerStrength,
            primaryScenario: primaryScenario!,
          })
      : null;

  const status = resolveStatus({
    input,
    reviewState: review.state,
    primary,
    fallback,
  });
  const invalidationConditions = buildInvalidationConditions({
    input,
    marketSignal,
    buyerStrength,
    reviewAssessment,
    primary,
    fallback,
  });

  const buyerSafe = buildBuyerSafeView({
    status,
    generatedAt: input.generatedAt,
    sourceVersions,
    reviewAssessment,
    primary,
    fallback,
  });
  const internal = buildInternalView({
    status,
    generatedAt: input.generatedAt,
    sourceVersions,
    reviewAssessment,
    primary,
    fallback,
    invalidationConditions,
    input,
    marketSignal,
  });

  return {
    version: NEGOTIATION_PLAYBOOK_VERSION,
    status,
    generatedAt: input.generatedAt,
    sourceVersions,
    review,
    primary,
    fallback,
    invalidationConditions,
    buyerSafe,
    internal,
  };
}

export function projectNegotiationPlaybookForAudience(
  bundle: NegotiationPlaybookBundle,
  audience: "buyer_safe",
): BuyerSafeNegotiationPlaybook;
export function projectNegotiationPlaybookForAudience(
  bundle: NegotiationPlaybookBundle,
  audience: "internal",
): InternalNegotiationPlaybook;
export function projectNegotiationPlaybookForAudience(
  bundle: NegotiationPlaybookBundle,
  audience: NegotiationPlaybookAudience,
): NegotiationPlaybookView {
  return audience === "buyer_safe" ? bundle.buyerSafe : bundle.internal;
}

function resolveStatus(args: {
  input: NegotiationPlaybookInputs;
  reviewState: AdvisoryGuardrailState;
  primary: NegotiationStrategyBranch | null;
  fallback: NegotiationStrategyBranch | null;
}): NegotiationPlaybookStatus {
  if (!args.input.offer?.output || !args.input.pricing?.output || !args.input.leverage?.output) {
    return "insufficient_data";
  }
  if (!args.primary || !args.fallback) {
    return "insufficient_data";
  }
  if (REVIEWABLE_STATES.has(args.reviewState)) {
    return "needs_review";
  }
  return "ready";
}

function resolvePrimaryScenario(
  offer: OfferOutput | undefined,
): OfferScenario | null {
  if (!offer || offer.scenarios.length === 0) return null;
  const rawIndex = Number.isFinite(offer.recommendedIndex)
    ? Math.trunc(offer.recommendedIndex)
    : 0;
  const index = clamp(rawIndex, 0, offer.scenarios.length - 1);
  return offer.scenarios[index] ?? offer.scenarios[0] ?? null;
}

function resolveFallbackScenario(
  offer: OfferOutput | undefined,
  primary: OfferScenario | null,
): OfferScenario | null {
  if (!offer || offer.scenarios.length === 0 || !primary) return null;
  const primaryIndex = offer.scenarios.findIndex((scenario) => scenario.name === primary.name);
  if (primaryIndex >= 0 && primaryIndex < offer.scenarios.length - 1) {
    return offer.scenarios[primaryIndex + 1] ?? null;
  }
  return null;
}

function resolveMarketSignal(marketContext: PropertyMarketContext | null | undefined) {
  const resolved =
    pickResolvedMarketContext(marketContext, 30) ??
    pickResolvedMarketContext(marketContext, 90);
  const selected = resolved?.selectedContext ?? null;
  return {
    windowDays: resolved?.windowDays ?? null,
    confidence: resolved?.confidence ?? 0,
    geoKind: resolved?.selectedGeoKind ?? null,
    medianDom: selected?.medianDom ?? null,
    medianSaleToListRatio: selected?.medianSaleToListRatio ?? null,
    trajectory: selected?.trajectory ?? null,
    priceReductionFrequency: selected?.priceReductionFrequency ?? null,
    downgradeReasons: resolved?.downgradeReasons ?? [],
  };
}

function resolveBuyerStrength(
  input: NegotiationPlaybookInputs,
  primary: OfferScenario | null,
  fallback: OfferScenario | null,
): BuyerStrengthState {
  const budgetMax = input.buyer.budgetMax ?? input.buyer.preApprovalAmount ?? null;
  const strongestAsk = Math.max(primary?.price ?? 0, fallback?.price ?? 0);
  return {
    budgetTight:
      budgetMax !== null &&
      strongestAsk > 0 &&
      strongestAsk >= budgetMax * 0.98,
    canMoveFast:
      input.buyer.preApproved &&
      (input.buyer.financingType === "cash" ||
        input.buyer.financingType === "conventional"),
    strongFinancing:
      input.buyer.financingType === "cash" ||
      input.buyer.financingType === "conventional",
    ceilingAtPrimary:
      budgetMax !== null && (primary?.price ?? 0) > 0
        ? (primary?.price ?? 0) >= budgetMax * 0.98
        : false,
    ceilingAtFallback:
      budgetMax !== null && (fallback?.price ?? 0) > 0
        ? (fallback?.price ?? 0) >= budgetMax * 0.98
        : false,
  };
}

function buildScenarioBranch(args: {
  key: "primary" | "fallback";
  scenario: OfferScenario;
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
  buyerStrength: BuyerStrengthState;
  primaryScenario: OfferScenario;
}): NegotiationStrategyBranch {
  const timingAngle = resolveTimingAngle(args.input, args.marketSignal, args.buyerStrength);
  const posture = resolveAskPosture(args.scenario, args.input);
  return {
    key: args.key,
    label:
      args.key === "primary"
        ? "Primary strategy"
        : `Fallback if ${args.primaryScenario.name.toLowerCase()} stalls`,
    trigger:
      args.key === "primary"
        ? "Use this as the first live offer posture."
        : buildFallbackTrigger(args.primaryScenario, args.scenario),
    scenarioName: args.scenario.name,
    askPrice: args.scenario.price,
    askPriceVsListPct: args.scenario.priceVsListPct,
    earnestMoney: args.scenario.earnestMoney,
    closingDays: args.scenario.closingDays,
    contingencies: [...args.scenario.contingencies],
    posture,
    timingAngle,
    concessionPlan: buildConcessionPlan({
      key: args.key,
      scenario: args.scenario,
      primaryScenario: args.primaryScenario,
      input: args.input,
      marketSignal: args.marketSignal,
      buyerStrength: args.buyerStrength,
      posture,
    }),
    rationale: buildBranchRationale({
      key: args.key,
      scenario: args.scenario,
      input: args.input,
      marketSignal: args.marketSignal,
      buyerStrength: args.buyerStrength,
      primaryScenario: args.primaryScenario,
    }),
  };
}

function buildCeilingHoldBranch(args: {
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
  buyerStrength: BuyerStrengthState;
  primaryScenario: OfferScenario;
}): NegotiationStrategyBranch {
  return {
    key: "fallback",
    label: "Fallback if the seller pushes past the current ceiling",
    trigger:
      "Do not auto-escalate above this range. Trade timing or credits first, then route any stronger ask back through broker review.",
    scenarioName: args.primaryScenario.name,
    askPrice: args.primaryScenario.price,
    askPriceVsListPct: args.primaryScenario.priceVsListPct,
    earnestMoney: args.primaryScenario.earnestMoney,
    closingDays: args.primaryScenario.closingDays,
    contingencies: [...args.primaryScenario.contingencies],
    posture: "ceiling_hold",
    timingAngle: "counter_window",
    concessionPlan: buildConcessionPlan({
      key: "fallback",
      scenario: args.primaryScenario,
      primaryScenario: args.primaryScenario,
      input: args.input,
      marketSignal: args.marketSignal,
      buyerStrength: args.buyerStrength,
      posture: "ceiling_hold",
    }),
    rationale: buildBranchRationale({
      key: "fallback",
      scenario: args.primaryScenario,
      input: args.input,
      marketSignal: args.marketSignal,
      buyerStrength: args.buyerStrength,
      primaryScenario: args.primaryScenario,
    }),
  };
}

function resolveAskPosture(
  scenario: OfferScenario,
  input: NegotiationPlaybookInputs,
): NegotiationAskPosture {
  const leverageScore = input.leverage?.output.score ?? 50;
  if (scenario.priceVsListPct <= -2 && leverageScore >= 60) {
    return "anchor_below_list";
  }
  if (scenario.competitivenessScore >= 80 || scenario.name === "Competitive") {
    return "competitive_escalation";
  }
  return "market_aligned";
}

function resolveTimingAngle(
  input: NegotiationPlaybookInputs,
  marketSignal: MarketSignal,
  buyerStrength: BuyerStrengthState,
): NegotiationTimingAngle {
  const priceReductionCount = input.subject.priceReductions?.length ?? 0;
  if (priceReductionCount > 0) return "price_cut_window";
  if (
    typeof input.subject.daysOnMarket === "number" &&
    typeof marketSignal.medianDom === "number" &&
    input.subject.daysOnMarket >= Math.max(marketSignal.medianDom + 7, 45)
  ) {
    return "stale_listing";
  }
  if (
    marketSignal.trajectory === "falling" ||
    (typeof marketSignal.medianSaleToListRatio === "number" &&
      marketSignal.medianSaleToListRatio < 0.98)
  ) {
    return "market_softness";
  }
  if (buyerStrength.canMoveFast) return "clean_close";
  return "counter_window";
}

function buildFallbackTrigger(
  primaryScenario: OfferScenario,
  fallbackScenario: OfferScenario,
): string {
  const priceMove = fallbackScenario.price - primaryScenario.price;
  if (priceMove <= 0) {
    return "Use this if the first posture gets no traction but you still want a cleaner second pass.";
  }
  return `If ${primaryScenario.name.toLowerCase()} is rejected or the listing turns more competitive, move up by ${formatCurrency(priceMove)} with cleaner terms.`;
}

function buildConcessionPlan(args: {
  key: "primary" | "fallback";
  scenario: OfferScenario;
  primaryScenario: OfferScenario;
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
  buyerStrength: BuyerStrengthState;
  posture: NegotiationAskPosture;
}): NegotiationConcession[] {
  const concessions: NegotiationConcession[] = [];
  const leverageScore = args.input.leverage?.output.score ?? 50;
  const priceReductionCount = args.input.subject.priceReductions?.length ?? 0;
  const creditFriendly =
    leverageScore >= 60 ||
    priceReductionCount > 0 ||
    (typeof args.input.subject.daysOnMarket === "number" &&
      typeof args.marketSignal.medianDom === "number" &&
      args.input.subject.daysOnMarket > args.marketSignal.medianDom);
  const suggestedCredit = creditFriendly
    ? suggestCreditAmount(args.scenario.price, args.input.buyer.budgetMax)
    : null;

  if (args.key === "fallback" && args.scenario.price > args.primaryScenario.price) {
    concessions.push({
      kind: "price_step",
      priority: "primary",
      label: `Only step price by ${formatCurrency(
        args.scenario.price - args.primaryScenario.price,
      )} if the first branch fails.`,
      buyerSafeLabel:
        "If the first offer does not land, ask your broker whether a modest price move is warranted.",
      detail:
        "Escalate only once the seller signals resistance or multiple-offer pressure.",
      amount: args.scenario.price - args.primaryScenario.price,
    });
  }

  if (suggestedCredit) {
    const preferRepairCredit = priceReductionCount > 0;
    concessions.push({
      kind: preferRepairCredit ? "repair_credit" : "seller_credit",
      priority: args.key === "primary" ? "optional" : "primary",
      label: preferRepairCredit
        ? `Use a repair or closing-cost credit around ${formatCurrency(
            suggestedCredit,
          )} instead of chasing price alone.`
        : `Keep seller-paid closing costs around ${formatCurrency(
            suggestedCredit,
          )} available if price negotiations tighten.`,
      buyerSafeLabel: preferRepairCredit
        ? "Ask your broker whether a repair or closing-cost credit fits this listing."
        : "Ask your broker whether seller-paid closing costs fit this listing.",
      detail:
        "Credits stay easier to justify when leverage is positive, the listing has softened, or the buyer is near their budget ceiling.",
      amount: suggestedCredit,
    });
  }

  if (
    args.buyerStrength.canMoveFast &&
    args.scenario.closingDays > 21 &&
    args.posture !== "ceiling_hold"
  ) {
    concessions.push({
      kind: "closing_speed",
      priority: "optional",
      label: "Offer a faster close instead of overpaying if the seller needs certainty.",
      buyerSafeLabel:
        "A faster close may help more than a bigger price jump if the seller values certainty.",
      detail:
        "Cash and conventional buyers can usually trade timing for acceptance odds more safely than trading pure price.",
    });
  }

  if (
    args.key === "fallback" &&
    args.scenario.contingencies.length < args.primaryScenario.contingencies.length
  ) {
    concessions.push({
      kind: "contingency_trim",
      priority: "optional",
      label: "Only trim contingencies on the broker-reviewed fallback branch.",
      buyerSafeLabel:
        "Let your broker decide whether any contingency change is appropriate on a second pass.",
      detail:
        "Any reduction in contingencies should stay tied to broker review and the buyer's real risk tolerance.",
    });
  }

  if (args.key === "fallback" && args.posture === "ceiling_hold") {
    concessions.push({
      kind: "broker_review",
      priority: "primary",
      label: "Hold the price ceiling and route any stronger ask back through broker review.",
      buyerSafeLabel:
        "If the seller pushes past this range, let your broker decide whether to keep pushing or pause.",
      detail:
        "This file is already at the top of the current ladder, so the next move is a human review call rather than an automated escalation.",
    });
  }

  return concessions.slice(0, 3);
}

function buildBranchRationale(args: {
  key: "primary" | "fallback";
  scenario: OfferScenario;
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
  buyerStrength: BuyerStrengthState;
  primaryScenario: OfferScenario;
}): NegotiationRationale[] {
  const rationale: NegotiationRationale[] = [];
  const pricing = args.input.pricing?.output;
  if (pricing) {
    const fairValueDelta = formatSignedPct(
      percentDelta(pricing.fairValue.value, args.input.subject.listPrice),
    );
    const likelyAcceptedDelta = formatSignedPct(
      percentDelta(pricing.likelyAccepted.value, args.input.subject.listPrice),
    );
    rationale.push({
      code: "pricing_gap",
      label: "Pricing context",
      summary: `Fair value reads ${fairValueDelta} vs list and likely accepted reads ${likelyAcceptedDelta}.`,
      buyerSafeSummary: "Pricing sits below or near list, which supports a measured first ask.",
    });
  }

  const leverage = args.input.leverage?.output;
  if (leverage) {
    rationale.push({
      code: "leverage_score",
      label: "Leverage",
      summary: `Seller leverage scores ${leverage.score}/100 from ${leverage.signals.length} signals.`,
      buyerSafeSummary: "Seller-side leverage is not strong enough to force a fully aggressive ask.",
    });
  }

  if (typeof args.marketSignal.medianDom === "number") {
    rationale.push({
      code: "market_context",
      label: "Market context",
      summary: `${args.marketSignal.windowDays ?? 30}-day ${
        args.marketSignal.geoKind ?? "local"
      } baseline shows ${args.marketSignal.medianDom} median DOM and ${
        args.marketSignal.medianSaleToListRatio !== null
          ? formatRatio(args.marketSignal.medianSaleToListRatio)
          : "an unavailable"
      } sale-to-list ratio.`,
      buyerSafeSummary:
        "Local market tempo suggests the seller may still care about timing and certainty.",
    });
  }

  if (
    args.input.listingAgent &&
    (typeof args.input.listingAgent.priceCutFrequency === "number" ||
      typeof args.input.listingAgent.medianListToSellRatio === "number")
  ) {
    rationale.push({
      code: "listing_agent",
      label: "Listing-agent pattern",
      summary: `${
        args.input.listingAgent.name || "This listing agent"
      } carries ${
        typeof args.input.listingAgent.priceCutFrequency === "number"
          ? `${formatPercent(args.input.listingAgent.priceCutFrequency)} price-cut frequency`
          : "no fresh price-cut read"
      } and ${
        typeof args.input.listingAgent.medianListToSellRatio === "number"
          ? `${formatRatio(args.input.listingAgent.medianListToSellRatio)} median list-to-sell`
          : "no current list-to-sell benchmark"
      }.`,
      buyerSafeSummary:
        "The listing side looks more negotiable than a no-data file, so the broker has room to test terms.",
    });
  }

  rationale.push({
    code: "buyer_readiness",
    label: "Buyer readiness",
    summary: buildBuyerReadinessSummary(args),
    buyerSafeSummary:
      args.buyerStrength.canMoveFast
        ? "Your file looks strong enough to use cleaner timing as a concession if needed."
        : "The buyer file is solid enough to start, but any stronger move should stay deliberate.",
  });

  rationale.push({
    code: args.key === "primary" ? "scenario_profile" : "fallback_shift",
    label: args.key === "primary" ? "Scenario profile" : "Fallback path",
    summary:
      args.key === "primary"
        ? `${args.scenario.name} is the current lead branch at ${formatCurrency(
            args.scenario.price,
          )} with ${args.scenario.contingencies.length} contingency${
            args.scenario.contingencies.length === 1 ? "" : "ies"
          }.`
        : buildFallbackSummary(args.primaryScenario, args.scenario),
    buyerSafeSummary:
      args.key === "primary"
        ? "This is the best balance between savings and win probability right now."
        : "Keep a cleaner second move ready if the first offer does not land.",
  });

  return rationale;
}

function buildBuyerReadinessSummary(args: {
  input: NegotiationPlaybookInputs;
  scenario: OfferScenario;
  buyerStrength: BuyerStrengthState;
}): string {
  if (
    args.input.buyer.preApproved &&
    typeof args.input.buyer.preApprovalAmount === "number" &&
    args.input.buyer.preApprovalAmount >= args.scenario.price
  ) {
    return `Buyer is pre-approved through ${formatCurrency(
      args.input.buyer.preApprovalAmount,
    )}, which covers this branch.`;
  }
  if (args.buyerStrength.budgetTight) {
    return "Buyer is close to the top of their current ceiling, so credits matter more than pure price chasing.";
  }
  if (!args.input.buyer.preApproved) {
    return "Buyer still needs stronger financing confirmation before any aggressive escalation.";
  }
  return "Buyer has enough room to start here, but stronger terms should stay tied to broker review.";
}

function buildFallbackSummary(
  primaryScenario: OfferScenario,
  fallbackScenario: OfferScenario,
): string {
  if (fallbackScenario.price <= primaryScenario.price) {
    return "Fallback holds the current price band and trades terms instead of paying more.";
  }
  return `Fallback steps price by ${formatCurrency(
    fallbackScenario.price - primaryScenario.price,
  )} and cleans up terms if the first branch misses.`;
}

function buildInvalidationConditions(args: {
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
  buyerStrength: BuyerStrengthState;
  reviewAssessment: ReturnType<typeof assessEngineOutputGuardrail>;
  primary: NegotiationStrategyBranch | null;
  fallback: NegotiationStrategyBranch | null;
}): string[] {
  const conditions: string[] = [];
  const pricing = args.input.pricing?.output;
  if (pricing?.reviewFallback?.reviewRequired || (pricing?.estimateSpread ?? 0) >= 0.08) {
    conditions.push(
      "Pricing inputs are still wide or conflicted, so the opening anchor should be rechecked before using it live.",
    );
  }
  const leverage = args.input.leverage?.output;
  if (!leverage || leverage.signals.length < 3 || leverage.overallConfidence < 0.75) {
    conditions.push(
      "Leverage coverage is thin, so seller-pressure assumptions could move once fresher listing signals land.",
    );
  }
  if (!args.marketSignal.windowDays || args.marketSignal.confidence < 0.55) {
    conditions.push(
      "Market context is broad or downgraded, so local timing assumptions should stay provisional.",
    );
  }
  if (!args.input.buyer.preApproved || args.buyerStrength.ceilingAtFallback) {
    conditions.push(
      "Buyer readiness is tight against the current ladder, so any escalation or contingency trim needs broker confirmation first.",
    );
  }
  if (REVIEWABLE_STATES.has(args.reviewAssessment.state)) {
    conditions.push(
      "Negotiation-sensitive language is still under review and should not be shared as direct buyer instruction until cleared.",
    );
  }
  if (
    args.primary &&
    args.fallback &&
    args.primary.askPrice === args.fallback.askPrice &&
    args.fallback.posture === "ceiling_hold"
  ) {
    conditions.push(
      "The fallback ladder is already at its ceiling, so the next move after a pushback is a broker decision rather than an automatic step-up.",
    );
  }
  return conditions;
}

function buildBuyerSafeView(args: {
  status: NegotiationPlaybookStatus;
  generatedAt: string;
  sourceVersions: NegotiationPlaybookSourceVersions;
  reviewAssessment: ReturnType<typeof assessEngineOutputGuardrail>;
  primary: NegotiationStrategyBranch | null;
  fallback: NegotiationStrategyBranch | null;
}): BuyerSafeNegotiationPlaybook {
  const shareable = !REVIEWABLE_STATES.has(args.reviewAssessment.state);
  return {
    audience: "buyer_safe",
    version: NEGOTIATION_PLAYBOOK_VERSION,
    status: args.status,
    generatedAt: args.generatedAt,
    sourceVersions: args.sourceVersions,
    summary:
      shareable && args.primary
        ? buildBuyerSafeSummary(args.primary, args.fallback)
        : args.reviewAssessment.buyerExplanation,
    review: {
      state: args.reviewAssessment.state,
      approvalPath: args.reviewAssessment.approvalPath,
      headline: args.reviewAssessment.buyerHeadline,
      message: args.reviewAssessment.buyerExplanation,
    },
    primary: shareable ? presentBranch(args.primary, "buyer_safe") : null,
    fallback: shareable ? presentBranch(args.fallback, "buyer_safe") : null,
  };
}

function buildInternalView(args: {
  status: NegotiationPlaybookStatus;
  generatedAt: string;
  sourceVersions: NegotiationPlaybookSourceVersions;
  reviewAssessment: ReturnType<typeof assessEngineOutputGuardrail>;
  primary: NegotiationStrategyBranch | null;
  fallback: NegotiationStrategyBranch | null;
  invalidationConditions: string[];
  input: NegotiationPlaybookInputs;
  marketSignal: MarketSignal;
}): InternalNegotiationPlaybook {
  return {
    audience: "internal",
    version: NEGOTIATION_PLAYBOOK_VERSION,
    status: args.status,
    generatedAt: args.generatedAt,
    sourceVersions: args.sourceVersions,
    summary: buildInternalSummary(args.primary, args.fallback, args.input, args.marketSignal),
    review: {
      state: args.reviewAssessment.state,
      approvalPath: args.reviewAssessment.approvalPath,
      headline:
        args.reviewAssessment.state === "blocked"
          ? "Blocked pending broker review"
          : args.reviewAssessment.internalSummary,
      message: args.reviewAssessment.internalSummary,
    },
    primary: presentBranch(args.primary, "internal"),
    fallback: presentBranch(args.fallback, "internal"),
    invalidationConditions: args.invalidationConditions,
  };
}

function buildBuyerSafeSummary(
  primary: NegotiationStrategyBranch,
  fallback: NegotiationStrategyBranch | null,
): string {
  const fallbackPhrase = fallback?.askPrice
    ? `If that does not land, keep ${formatCurrency(fallback.askPrice)} as the next broker-reviewed move.`
    : "If that does not land, let your broker decide the next move.";
  return `Start with ${primary.scenarioName?.toLowerCase() ?? "the current"} strategy around ${
    primary.askPrice ? formatCurrency(primary.askPrice) : "the current range"
  } and keep the first move disciplined. ${fallbackPhrase}`;
}

function buildInternalSummary(
  primary: NegotiationStrategyBranch | null,
  fallback: NegotiationStrategyBranch | null,
  input: NegotiationPlaybookInputs,
  marketSignal: MarketSignal,
): string {
  if (!primary) {
    return "Offer strategy still needs pricing, leverage, and offer inputs before it can render a live negotiation playbook.";
  }
  const parts = [
    `${primary.scenarioName ?? "Primary"} leads at ${formatCurrency(primary.askPrice ?? 0)}.`,
  ];
  if (input.pricing?.output) {
    parts.push(
      `Fair value is ${formatCurrency(input.pricing.output.fairValue.value)} and likely accepted is ${formatCurrency(input.pricing.output.likelyAccepted.value)}.`,
    );
  }
  if (input.leverage?.output) {
    parts.push(`Leverage scores ${input.leverage.output.score}/100.`);
  }
  if (typeof marketSignal.medianDom === "number") {
    parts.push(`Median DOM on the chosen market window is ${marketSignal.medianDom}.`);
  }
  if (fallback?.askPrice && fallback.askPrice !== primary.askPrice) {
    parts.push(`Fallback steps to ${formatCurrency(fallback.askPrice)} if the first branch misses.`);
  } else if (fallback) {
    parts.push("Fallback holds the current ceiling and trades timing or credits instead of more price.");
  }
  return parts.join(" ");
}

function presentBranch(
  branch: NegotiationStrategyBranch | null,
  audience: NegotiationPlaybookAudience,
): NegotiationPlaybookBranchView | null {
  if (!branch) return null;
  return {
    title: branch.label,
    trigger: branch.trigger,
    askLabel:
      typeof branch.askPrice === "number"
        ? `${formatCurrency(branch.askPrice)}${
            typeof branch.askPriceVsListPct === "number"
              ? ` (${formatSignedPct(branch.askPriceVsListPct)} vs list)`
              : ""
          }`
        : null,
    postureLabel: postureLabel(branch.posture, audience),
    timingLabel: timingLabel(branch.timingAngle, audience),
    contingencies: branch.contingencies.map((value) => contingencyLabel(value)),
    concessions: branch.concessionPlan.map((item) =>
      audience === "buyer_safe" ? item.buyerSafeLabel : item.label,
    ),
    rationale: branch.rationale.map((item) =>
      audience === "buyer_safe" ? item.buyerSafeSummary : item.summary,
    ),
  };
}

function postureLabel(
  posture: NegotiationAskPosture,
  audience: NegotiationPlaybookAudience,
): string {
  switch (posture) {
    case "anchor_below_list":
      return audience === "buyer_safe"
        ? "Start below list with room to negotiate."
        : "Anchor below list while the leverage window is open.";
    case "competitive_escalation":
      return audience === "buyer_safe"
        ? "Lead with a stronger, win-focused offer."
        : "Escalate into a more competitive branch.";
    case "ceiling_hold":
      return audience === "buyer_safe"
        ? "Hold this ceiling and let your broker decide the next move."
        : "Hold the current ceiling; do not auto-escalate.";
    default:
      return audience === "buyer_safe"
        ? "Open near current market value."
        : "Anchor near current likely-accepted pricing.";
  }
}

function timingLabel(
  timing: NegotiationTimingAngle,
  audience: NegotiationPlaybookAudience,
): string {
  switch (timing) {
    case "stale_listing":
      return audience === "buyer_safe"
        ? "The listing has been sitting long enough to test seller flexibility."
        : "Use stale DOM versus the local baseline as the timing edge.";
    case "price_cut_window":
      return audience === "buyer_safe"
        ? "Recent price cuts create room to ask for credits or repairs."
        : "Use the price-cut trail to justify credits before chasing price.";
    case "market_softness":
      return audience === "buyer_safe"
        ? "Local market tempo favors patience over panic."
        : "Local sale-to-list and trajectory support a measured ask.";
    case "clean_close":
      return audience === "buyer_safe"
        ? "A cleaner close can matter more than pure price."
        : "Use timing certainty as the next concession before overbidding.";
    default:
      return audience === "buyer_safe"
        ? "Stay responsive if the seller counters."
        : "Keep the next move responsive and routed through broker review.";
  }
}

function contingencyLabel(value: string): string {
  switch (value) {
    case "inspection":
      return "Inspection";
    case "financing":
      return "Financing";
    case "appraisal":
      return "Appraisal";
    case "sale_of_home":
      return "Sale of current home";
    case "title":
      return "Title review";
    case "insurance":
      return "Insurance";
    default:
      return value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function suggestCreditAmount(
  askPrice: number,
  budgetMax: number | undefined,
): number {
  const baseline = Math.max(2_500, Math.round((askPrice * 0.01) / 500) * 500);
  if (!budgetMax || askPrice <= budgetMax) {
    return clamp(baseline, 2_500, 7_500);
  }
  const shortfall = Math.max(askPrice - budgetMax, 0);
  return clamp(Math.round((shortfall + 2_500) / 500) * 500, 2_500, 10_000);
}

function percentDelta(value: number, baseline: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(baseline) || baseline === 0) {
    return 0;
  }
  return Number((((value - baseline) / baseline) * 100).toFixed(1));
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

function formatRatio(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
