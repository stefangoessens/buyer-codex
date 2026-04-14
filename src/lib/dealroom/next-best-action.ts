import type { AdvisoryNextActionTarget } from "@/lib/analyticsEvents/contract";
import type {
  BuyerReadinessBlocker,
  BuyerReadinessSurface,
} from "@/lib/dealroom/buyer-readiness";
import type { PropertyCaseOverviewSurface } from "@/lib/dealroom/property-case-overview";
import type {
  DealRoomRiskSummary,
  RiskSummaryItem,
} from "@/lib/dealroom/risk-summary";

export const PROPERTY_RECOMMENDATION_KINDS = [
  "tour",
  "skip",
  "ask_for_docs",
  "offer_now",
  "wait_and_watch",
  "proceed_with_conditions",
] as const;

export type PropertyRecommendationKind =
  (typeof PROPERTY_RECOMMENDATION_KINDS)[number];

export type PropertyRecommendationReasonSource =
  | "property"
  | "readiness"
  | "risk"
  | "confidence";

export type PropertyRecommendationConditionEffect =
  | "blocks"
  | "warns"
  | "review_required";

export interface PropertyRecommendationReason {
  id: string;
  title: string;
  body: string;
  source: PropertyRecommendationReasonSource;
}

export interface PropertyRecommendationConditionInternal {
  owner?: "buyer" | "broker" | "system";
  severity?: "critical" | "high" | "medium" | "low";
  reasonCode?: string;
  sourceSignals?: string[];
}

export interface PropertyRecommendationCondition {
  id: string;
  title: string;
  summary: string;
  actionLabel: string;
  effect: PropertyRecommendationConditionEffect;
  source: PropertyRecommendationReasonSource;
  internal?: PropertyRecommendationConditionInternal;
}

export interface PropertyRecommendationBuyerCta {
  label: string;
  explanation: string;
  href: string | null;
  target: AdvisoryNextActionTarget | null;
}

export interface PropertyRecommendationBase {
  variant: PropertyCaseOverviewSurface["variant"];
  kind: PropertyRecommendationKind;
  label: string;
  shortRationale: string;
  explanation: string;
  rationale: PropertyRecommendationReason[];
  blockersAndConditions: PropertyRecommendationCondition[];
  whatWouldChange: string[];
  buyerCta: PropertyRecommendationBuyerCta;
}

export interface BuyerSafePropertyRecommendation
  extends PropertyRecommendationBase {
  variant: "buyer_safe";
  internal?: undefined;
}

export interface InternalPropertyRecommendation
  extends PropertyRecommendationBase {
  variant: "internal";
  internal: {
    propertyDirection: "positive" | "caution" | "unclear" | "negative";
    brokerReviewRequired: boolean;
    brokerReviewReasons: string[];
    reasonCodes: string[];
    expandedReasoning: PropertyRecommendationReason[];
  };
}

export type PropertyRecommendation =
  | BuyerSafePropertyRecommendation
  | InternalPropertyRecommendation;

interface BuildPropertyRecommendationInput {
  overview: PropertyCaseOverviewSurface;
  readiness?: BuyerReadinessSurface | null;
  riskSummary?: DealRoomRiskSummary | null;
}

const CONDITION_EFFECT_ORDER: Record<PropertyRecommendationConditionEffect, number> =
  {
    blocks: 0,
    review_required: 1,
    warns: 2,
  };

const READINESS_REASON_CODE_ORDER = [
  "agreement_missing_signed",
  "agreement_upgrade_required",
  "agreement_canceled",
  "agreement_replaced_pending_new",
  "financing_missing_type",
  "financing_missing_preapproval",
  "financing_preapproval_below_price",
  "financing_preapproval_expired",
  "financing_preapproval_expiring",
  "financing_credit_invalid",
  "financing_credit_review_required",
  "confidence_waiting_on_evidence",
  "confidence_conflicting_evidence",
  "confidence_low_offer_support",
  "document_review_required",
  "document_pending",
  "document_unavailable",
  "negotiation_offer_not_live",
  "close_contract_not_executed",
  "close_overdue_milestone",
  "close_milestone_review_required",
] as const;

type ReadinessReasonCode = (typeof READINESS_REASON_CODE_ORDER)[number];

const READINESS_REASON_CODE_SET = new Set<string>(READINESS_REASON_CODE_ORDER);

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizePropertyDirection(
  overview: PropertyCaseOverviewSurface,
  riskSummary?: DealRoomRiskSummary | null,
): {
  direction: "positive" | "caution" | "unclear" | "negative";
  primaryReason: string;
  secondaryReason: string;
  reasons: PropertyRecommendationReason[];
} {
  const confidence = overview.overallConfidence ?? 0;
  const verdict = overview.decisionMemo.recommendation.verdict;
  const highRiskCount =
    riskSummary?.items.filter((item) => item.severity === "high").length ?? 0;
  const downsideCount = overview.decisionMemo.downside.items.length;
  const upsideCount = overview.decisionMemo.upside.items.length;
  const marketPosition = overview.marketReality?.position.code ?? "unavailable";

  if (
    confidence >= 0.72 &&
    highRiskCount > 0 &&
    marketPosition === "overpriced" &&
    downsideCount >= Math.max(2, upsideCount)
  ) {
    return {
      direction: "negative",
      primaryReason:
        "The current evidence is strong enough to treat the home as a weak fit, not just an incomplete case.",
      secondaryReason:
        "High-severity risk and pricing pressure are both pointing against pushing this property forward.",
      reasons: [
        {
          id: "property-negative-case",
          title: "Property case is running negative",
          body: "Pricing pressure and high-severity risk are both leaning against this home.",
          source: "property",
        },
        {
          id: "property-negative-confidence",
          title: "The signal is strong enough to act on",
          body: `The buyer-safe case is already at ${overview.overallConfidenceLabel.toLowerCase()}, so this is not just a sparse-data hold.`,
          source: "confidence",
        },
      ],
    };
  }

  if (verdict === "worth_pursuing" && confidence >= 0.68) {
    return {
      direction: "positive",
      primaryReason:
        "The property looks worth pursuing based on the current buyer-safe evidence.",
      secondaryReason:
        "Pricing, leverage, and the current memo are aligned enough to support a concrete next move.",
      reasons: [
        {
          id: "property-worth-pursuing",
          title: "Buyer-safe case is positive",
          body: overview.decisionMemo.recommendation.body,
          source: "property",
        },
        {
          id: "property-worth-pursuing-confidence",
          title: "Confidence is above the action bar",
          body: `The current case is at ${overview.overallConfidenceLabel.toLowerCase()}.`,
          source: "confidence",
        },
      ],
    };
  }

  if (verdict === "pursue_with_caution" || confidence >= 0.55) {
    return {
      direction: "caution",
      primaryReason:
        "The home still has a path forward, but the current case needs conditions attached to it.",
      secondaryReason:
        "The property case is usable, but it is not clean enough to treat as a simple yes.",
      reasons: [
        {
          id: "property-cautious-verdict",
          title: "The current case is conditional",
          body: overview.decisionMemo.recommendation.body,
          source: "property",
        },
        {
          id: "property-cautious-gaps",
          title: "Open questions still matter",
          body:
            overview.missingStates.length > 0
              ? `${formatCount(overview.missingStates.length, "signal still changes", "signals still change")} how decisive the case should feel.`
              : "The case is visible, but it still carries normal caution flags.",
          source: "confidence",
        },
      ],
    };
  }

  return {
    direction: "unclear",
    primaryReason:
      "The property case is still too incomplete or review-constrained to force a strong move.",
    secondaryReason:
      "This recommendation should stay conservative until the missing evidence lands.",
    reasons: [
      {
        id: "property-unclear-verdict",
        title: "The buyer-safe case is not settled yet",
        body: overview.decisionMemo.recommendation.body,
        source: "confidence",
      },
      {
        id: "property-unclear-gaps",
        title: "Evidence still needs to land",
        body:
          overview.missingStates.length > 0
            ? `${formatCount(overview.missingStates.length, "signal is still open", "signals are still open")} in the current dossier.`
            : "The recommendation layer is still waiting on a cleaner signal before it becomes more prescriptive.",
        source: "confidence",
      },
    ],
  };
}

function buildReadinessConditions(
  readiness?: BuyerReadinessSurface | null,
): PropertyRecommendationCondition[] {
  if (!readiness) return [];

  return readiness.blockers
    .map((blocker): PropertyRecommendationCondition => {
      const effect: PropertyRecommendationConditionEffect =
        blocker.effect === "blocks" ? "blocks" : "warns";

      return {
        id: blocker.id,
        title: blocker.title,
        summary: blocker.summary,
        actionLabel: blocker.buyerAction,
        effect,
        source: "readiness",
        internal: blocker.internal
          ? {
              owner: blocker.internal.owner,
              severity: blocker.internal.severity,
              reasonCode: blocker.internal.reasonCode,
              sourceSignals: blocker.internal.supportingSignals,
            }
          : undefined,
      };
    })
    .sort((left, right) => {
      const effectDiff =
        CONDITION_EFFECT_ORDER[left.effect] - CONDITION_EFFECT_ORDER[right.effect];
      if (effectDiff !== 0) return effectDiff;
      return left.title.localeCompare(right.title);
    });
}

function buildRiskConditions(
  riskSummary?: DealRoomRiskSummary | null,
): PropertyRecommendationCondition[] {
  if (!riskSummary) return [];

  return riskSummary.items
    .filter(
      (item) =>
        item.reviewState === "review_required" || item.severity === "high",
    )
    .map((item): PropertyRecommendationCondition => {
      const effect: PropertyRecommendationConditionEffect =
        item.reviewState === "review_required" ? "review_required" : "warns";

      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        actionLabel:
          item.reviewState === "review_required"
            ? "Wait until this review-required risk is resolved."
            : "Treat this risk as a real constraint before moving faster.",
        effect,
        source: "risk",
        internal: item.internal
          ? {
              reasonCode: item.internal.reviewReason,
              sourceSignals: [
                `Source record ${item.internal.sourceRecordType}:${item.internal.sourceRecordId}`,
              ],
            }
          : undefined,
      };
    })
    .sort((left, right) => {
      const effectDiff =
        CONDITION_EFFECT_ORDER[left.effect] - CONDITION_EFFECT_ORDER[right.effect];
      if (effectDiff !== 0) return effectDiff;
      return left.title.localeCompare(right.title);
    });
}

function buildConfidenceConditions(
  overview: PropertyCaseOverviewSurface,
): PropertyRecommendationCondition[] {
  const conditions: PropertyRecommendationCondition[] = [];

  if (overview.artifacts.recommendation.withholdOutput) {
    conditions.push({
      id: `confidence-${overview.artifacts.recommendation.kind}`,
      title: overview.artifacts.recommendation.title,
      summary: overview.artifacts.recommendation.description,
      actionLabel: overview.artifacts.recommendation.recoveryDescription,
      effect:
        overview.artifacts.recommendation.kind === "review_required"
          ? "review_required"
          : "blocks",
      source: "confidence",
    });
  }

  for (const state of overview.missingStates.slice(0, 2)) {
    conditions.push({
      id: `${state.engine}-${state.tone}`,
      title: state.title,
      summary: state.description,
      actionLabel:
        state.tone === "pending"
          ? "Wait for this signal to clear."
          : state.tone === "missing"
            ? "Backfill this missing evidence."
            : "Resolve the blocker before pushing harder.",
      effect:
        state.tone === "blocked" || state.tone === "review_required"
          ? "blocks"
          : "warns",
      source: "confidence",
    });
  }

  return conditions;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isDocumentCondition(condition: PropertyRecommendationCondition): boolean {
  return (
    condition.id.startsWith("document-") ||
    condition.id.includes("document-") ||
    condition.title.toLowerCase().includes("document") ||
    condition.summary.toLowerCase().includes("document")
  );
}

function isOfferBlockingCondition(condition: PropertyRecommendationCondition): boolean {
  if (condition.source !== "readiness") return false;
  return (
    condition.id.includes("agreement") ||
    condition.id.includes("financing") ||
    condition.id.includes("confidence") ||
    condition.id.includes("negotiation") ||
    condition.id.includes("document")
  );
}

function buildWhatWouldChange(
  overview: PropertyCaseOverviewSurface,
  conditions: PropertyRecommendationCondition[],
): string[] {
  const readinessActions = conditions
    .filter((condition) => condition.source === "readiness")
    .map((condition) => condition.actionLabel);
  const confidenceActions = overview.confidenceSections.flatMap(
    (section) => section.whatWouldIncreaseConfidence,
  );
  const riskActions = conditions
    .filter((condition) => condition.source === "risk")
    .map((condition) => condition.actionLabel);

  return uniqueStrings([...readinessActions, ...confidenceActions, ...riskActions]).slice(
    0,
    4,
  );
}

function buildCta(
  dealRoomId: string,
  kind: PropertyRecommendationKind,
  currentStage: BuyerReadinessSurface["currentStage"] | undefined,
): PropertyRecommendationBuyerCta {
  switch (kind) {
    case "offer_now":
      return {
        label: "Open the offer cockpit",
        explanation:
          "The recommendation is strong enough to move into offer preparation now.",
        href: `/dealroom/${dealRoomId}/offer`,
        target: "offer_cockpit",
      };
    case "proceed_with_conditions":
      if (currentStage === "close") {
        return {
          label: "Open the close dashboard",
          explanation:
            "The next move depends on clearing the listed conditions inside the close workflow.",
          href: `/dealroom/${dealRoomId}/close`,
          target: "close_dashboard",
        };
      }
      return {
        label: "Open the offer cockpit",
        explanation:
          "Use the offer workflow once the listed blockers or conditions are cleared.",
        href: `/dealroom/${dealRoomId}/offer`,
        target: "offer_cockpit",
      };
    case "tour":
      return {
        label: "Clear tour blockers",
        explanation:
          "This home looks worth seeing in person, but touring is only useful once the current blockers are handled.",
        href: null,
        target: null,
      };
    case "ask_for_docs":
      return {
        label: "Review missing diligence",
        explanation:
          "Use the current blockers and conditions to ask for the missing documents or clarifications first.",
        href: null,
        target: null,
      };
    case "skip":
      return {
        label: "Stand down on this property",
        explanation:
          "The current evidence is strong enough that this should stay off the active shortlist unless the facts change materially.",
        href: null,
        target: null,
      };
    case "wait_and_watch":
    default:
      return {
        label: "Keep monitoring the case",
        explanation:
          "The recommendation should stay conservative until more evidence or cleaner review state lands.",
        href: null,
        target: null,
      };
  }
}

function buildExplanation(
  kind: PropertyRecommendationKind,
  propertyDirection: "positive" | "caution" | "unclear" | "negative",
  blockersAndConditions: PropertyRecommendationCondition[],
): string {
  const blockingCount = blockersAndConditions.filter(
    (condition) => condition.effect === "blocks",
  ).length;
  const reviewCount = blockersAndConditions.filter(
    (condition) => condition.effect === "review_required",
  ).length;

  switch (kind) {
    case "offer_now":
      return "The property case is strong enough and the next offer step is clear enough to move now.";
    case "tour":
      return blockingCount > 0
        ? "The home still looks worth seeing, but clear the tour blockers before scheduling it."
        : "The current case points toward seeing the property in person before pushing into an offer.";
    case "ask_for_docs":
      return reviewCount > 0
        ? "The next move should be getting the missing diligence or review-required material clarified first."
        : "The current case is too documentation-sensitive to move faster yet.";
    case "skip":
      return "The evidence is leaning against this property strongly enough that waiting for a better fit is safer than pushing forward.";
    case "proceed_with_conditions":
      return propertyDirection === "positive"
        ? "The property looks actionable, but only if the listed conditions clear first."
        : "There is still a possible path forward, but it should stay conditional instead of feeling like a clean yes.";
    case "wait_and_watch":
    default:
      return "The case is still too incomplete or review-constrained to justify a more aggressive move.";
  }
}

function buildLabel(kind: PropertyRecommendationKind): string {
  switch (kind) {
    case "tour":
      return "Tour it next";
    case "skip":
      return "Skip this property for now";
    case "ask_for_docs":
      return "Ask for docs first";
    case "offer_now":
      return "Prepare an offer now";
    case "wait_and_watch":
      return "Wait and watch";
    case "proceed_with_conditions":
      return "Proceed only if conditions clear";
  }
}

function summarizeReadiness(
  readiness?: BuyerReadinessSurface | null,
): PropertyRecommendationReason[] {
  if (!readiness) {
    return [
      {
        id: "readiness-unavailable",
        title: "Readiness context is not loaded yet",
        body: "The recommendation is falling back to property evidence until readiness state finishes loading.",
        source: "readiness",
      },
    ];
  }

  if (readiness.blockers.length === 0) {
    return [
      {
        id: "readiness-clear",
        title: "No readiness blockers are currently open",
        body: "The buyer side of the workflow is clear enough that the property itself can drive the next move.",
        source: "readiness",
      },
    ];
  }

  return [
    {
      id: "readiness-current-state",
      title: `${readiness.currentStageLabel} is ${readiness.currentStateLabel.toLowerCase()}`,
      body: readiness.buyerSummary.body,
      source: "readiness",
    },
  ];
}

function buildExpandedReasoning(
  propertyReasons: PropertyRecommendationReason[],
  readinessReasons: PropertyRecommendationReason[],
  conditions: PropertyRecommendationCondition[],
): PropertyRecommendationReason[] {
  return [
    ...propertyReasons,
    ...readinessReasons,
    ...conditions.map((condition) => ({
      id: `condition-${condition.id}`,
      title: condition.title,
      body: `${condition.summary} Next move: ${condition.actionLabel}`,
      source: condition.source,
    })),
  ];
}

function collectReasonCodes(
  conditions: PropertyRecommendationCondition[],
): string[] {
  return uniqueStrings(
    conditions.map((condition) => condition.internal?.reasonCode).filter((value) =>
      value ? READINESS_REASON_CODE_SET.has(value) || value.includes("_") : false,
    ),
  );
}

function determineRecommendationKind(args: {
  overview: PropertyCaseOverviewSurface;
  readiness?: BuyerReadinessSurface | null;
  propertyDirection: "positive" | "caution" | "unclear" | "negative";
  conditions: PropertyRecommendationCondition[];
}): PropertyRecommendationKind {
  const stage = args.readiness?.currentStage;
  const offerVisible =
    Boolean(args.overview.action) &&
    !args.overview.artifacts.recommendation.withholdOutput;
  const hasDocumentCondition = args.conditions.some(isDocumentCondition);
  const hasOfferBlockingCondition = args.conditions.some(isOfferBlockingCondition);
  const hasBrokerReviewCondition = args.conditions.some(
    (condition) => condition.effect === "review_required",
  );
  const hasBlockingCondition = args.conditions.some(
    (condition) => condition.effect === "blocks",
  );

  if (args.propertyDirection === "negative") {
    return "skip";
  }

  if (args.propertyDirection === "unclear") {
    return hasDocumentCondition ? "ask_for_docs" : "wait_and_watch";
  }

  if (
    offerVisible &&
    !hasOfferBlockingCondition &&
    !hasBrokerReviewCondition &&
    (stage === "offer" || stage === "negotiate" || stage === "close")
  ) {
    return "offer_now";
  }

  if (hasDocumentCondition) {
    return "ask_for_docs";
  }

  if (hasBlockingCondition || hasBrokerReviewCondition) {
    return "proceed_with_conditions";
  }

  if (stage === "tour" || stage === undefined) {
    return "tour";
  }

  if (offerVisible) {
    return "offer_now";
  }

  return "wait_and_watch";
}

export function buildPropertyRecommendation(
  input: BuildPropertyRecommendationInput,
): PropertyRecommendation {
  const propertyDirection = summarizePropertyDirection(
    input.overview,
    input.riskSummary,
  );
  const readinessReasons = summarizeReadiness(input.readiness);
  const readinessConditions = buildReadinessConditions(input.readiness);
  const riskConditions = buildRiskConditions(input.riskSummary);
  const confidenceConditions = buildConfidenceConditions(input.overview);
  const blockersAndConditions = [
    ...readinessConditions,
    ...riskConditions,
    ...confidenceConditions,
  ]
    .sort((left, right) => {
      const effectDiff =
        CONDITION_EFFECT_ORDER[left.effect] - CONDITION_EFFECT_ORDER[right.effect];
      if (effectDiff !== 0) return effectDiff;
      return left.title.localeCompare(right.title);
    })
    .slice(0, 4);
  const kind = determineRecommendationKind({
    overview: input.overview,
    readiness: input.readiness,
    propertyDirection: propertyDirection.direction,
    conditions: blockersAndConditions,
  });
  const rationale = [
    ...propertyDirection.reasons,
    ...readinessReasons,
  ].slice(0, 3);
  const whatWouldChange = buildWhatWouldChange(
    input.overview,
    blockersAndConditions,
  );
  const buyerCta = buildCta(
    input.overview.dealRoomId,
    kind,
    input.readiness?.currentStage,
  );
  const explanation = buildExplanation(
    kind,
    propertyDirection.direction,
    blockersAndConditions,
  );

  if (input.overview.variant === "buyer_safe") {
    return {
      variant: "buyer_safe",
      kind,
      label: buildLabel(kind),
      shortRationale: propertyDirection.primaryReason,
      explanation,
      rationale,
      blockersAndConditions: blockersAndConditions.map((condition) => ({
        ...condition,
        internal: undefined,
      })),
      whatWouldChange,
      buyerCta,
    };
  }

  const expandedReasoning = buildExpandedReasoning(
    propertyDirection.reasons,
    readinessReasons,
    blockersAndConditions,
  );
  const brokerReviewReasons = uniqueStrings(
    blockersAndConditions
      .filter((condition) => condition.effect === "review_required")
      .map((condition) => condition.title),
  );

  return {
    variant: "internal",
    kind,
    label: buildLabel(kind),
    shortRationale: propertyDirection.primaryReason,
    explanation,
    rationale,
    blockersAndConditions,
    whatWouldChange,
    buyerCta,
    internal: {
      propertyDirection: propertyDirection.direction,
      brokerReviewRequired: brokerReviewReasons.length > 0,
      brokerReviewReasons,
      reasonCodes: collectReasonCodes(blockersAndConditions),
      expandedReasoning,
    },
  };
}
