export const ADVISORY_GUARDRAIL_STATES = [
  "can_say",
  "softened",
  "review_required",
  "blocked",
] as const;

export type AdvisoryGuardrailState =
  (typeof ADVISORY_GUARDRAIL_STATES)[number];

export const ADVISORY_OUTPUT_CLASSES = [
  "pricing_sensitive",
  "negotiation_sensitive",
  "agreement_legal_adjacent",
  "disclosure_sensitive",
] as const;

export type AdvisoryOutputClass = (typeof ADVISORY_OUTPUT_CLASSES)[number];

export const ADVISORY_APPROVAL_PATHS = [
  "none",
  "broker_review",
  "broker_and_legal_review",
] as const;

export type AdvisoryApprovalPath = (typeof ADVISORY_APPROVAL_PATHS)[number];

export type AdvisoryReviewState = "pending" | "approved" | "rejected";

export interface AdvisoryGuardrailAssessment {
  state: AdvisoryGuardrailState;
  baseState: AdvisoryGuardrailState;
  defaultApprovedState: AdvisoryGuardrailState;
  classes: AdvisoryOutputClass[];
  approvalPath: AdvisoryApprovalPath;
  reasonCodes: string[];
  buyerHeadline: string;
  buyerExplanation: string;
  internalSummary: string;
  auditLabel: string;
}

interface EngineGuardrailArgs {
  engineType: string;
  output?: string | unknown;
  confidence?: number;
  reviewState?: AdvisoryReviewState;
}

interface CopilotQuestionGuardrailArgs {
  question: string;
  intent?: string;
}

type ParsedPricingOutput = {
  overallConfidence?: number;
  reviewFallback?: {
    reviewRequired?: boolean;
    reasons?: string[];
  };
  fairValue?: { value?: number };
  likelyAccepted?: { value?: number };
};

const LOW_CONFIDENCE_REVIEW_THRESHOLD = 0.8;
const NEGOTIATION_REVIEW_THRESHOLD = 0.75;

const AGREEMENT_OR_LEGAL_PATTERN =
  /\b(agreement|contract|binding|breach|legal|attorney|enforceable|terminate|termination|default|addendum|inspection period)\b/i;

const DISCLOSURE_SENSITIVE_PATTERN =
  /\b(disclosure|rebate|commission|compensation|credit|ipc|builder incentive|co-broke|buyer fee)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutputJson<T>(value: string | unknown): T | null {
  if (value === undefined || value === null) return null;

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}

function numberOr(
  candidate: unknown,
  fallback: number,
): number {
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : fallback;
}

export function defaultApprovedGuardrailState(
  baseState: AdvisoryGuardrailState,
): AdvisoryGuardrailState {
  if (baseState === "review_required") {
    return "softened";
  }

  return baseState;
}

export function resolveGuardrailState(args: {
  baseState: AdvisoryGuardrailState;
  reviewState?: AdvisoryReviewState;
}): AdvisoryGuardrailState {
  if (args.reviewState === "rejected") {
    return "blocked";
  }

  if (args.baseState === "review_required") {
    return args.reviewState === "approved"
      ? defaultApprovedGuardrailState(args.baseState)
      : "review_required";
  }

  return args.baseState;
}

function buildPricingAssessment(
  args: EngineGuardrailArgs,
): AdvisoryGuardrailAssessment {
  const parsed = parseOutputJson<ParsedPricingOutput>(args.output);
  const overallConfidence = Math.min(
    numberOr(args.confidence, 1),
    numberOr(parsed?.overallConfidence, numberOr(args.confidence, 1)),
  );
  const reviewFallbackRequired = parsed?.reviewFallback?.reviewRequired === true;
  const fallbackReasons =
    parsed?.reviewFallback?.reasons?.filter(
      (reason): reason is string => typeof reason === "string",
    ) ?? [];

  const reasonCodes = [...fallbackReasons];
  if (overallConfidence < LOW_CONFIDENCE_REVIEW_THRESHOLD) {
    reasonCodes.push("low_confidence");
  }

  const baseState: AdvisoryGuardrailState =
    reviewFallbackRequired || overallConfidence < LOW_CONFIDENCE_REVIEW_THRESHOLD
      ? "review_required"
      : "softened";
  const state = resolveGuardrailState({
    baseState,
    reviewState: args.reviewState,
  });
  const reviewed = args.reviewState === "approved";

  if (state === "review_required") {
    return {
      state,
      baseState,
      defaultApprovedState: defaultApprovedGuardrailState(baseState),
      classes: ["pricing_sensitive"],
      approvalPath: "broker_review",
      reasonCodes,
      buyerHeadline: "Pricing guidance is waiting on broker review",
      buyerExplanation:
        "We hold buyer-specific pricing guidance until a broker confirms the estimate coverage and confidence.",
      internalSummary:
        "Pricing-sensitive output needs broker review before buyer exposure.",
      auditLabel: "pricing_guardrail_review_required",
    };
  }

  return {
    state,
    baseState,
    defaultApprovedState: defaultApprovedGuardrailState(baseState),
    classes: ["pricing_sensitive"],
    approvalPath: state === "softened" ? "none" : "broker_review",
    reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["illustrative_only"],
    buyerHeadline: reviewed
      ? "Broker-reviewed pricing guidance"
      : "Illustrative pricing guidance",
    buyerExplanation:
      "Treat modeled price points as planning ranges, not guaranteed outcomes or commitments.",
    internalSummary: reviewed
      ? "Pricing-sensitive output cleared broker review and remains softened for buyer-safe presentation."
      : "Pricing-sensitive output is limited to illustrative buyer-safe copy.",
    auditLabel: reviewed
      ? "pricing_guardrail_softened_after_review"
      : "pricing_guardrail_softened",
  };
}

function buildNegotiationAssessment(
  args: EngineGuardrailArgs,
): AdvisoryGuardrailAssessment {
  const parsed = parseOutputJson<Record<string, unknown>>(args.output);
  const confidence = numberOr(
    args.confidence,
    numberOr(parsed?.overallConfidence, 0),
  );

  let baseState: AdvisoryGuardrailState = "review_required";
  const reasonCodes = ["broker_review_required"];

  if (args.engineType === "leverage" && confidence >= NEGOTIATION_REVIEW_THRESHOLD) {
    baseState = "softened";
    reasonCodes.push("illustrative_only");
  } else if (confidence < NEGOTIATION_REVIEW_THRESHOLD) {
    reasonCodes.push("low_confidence");
  }

  const state = resolveGuardrailState({
    baseState,
    reviewState: args.reviewState,
  });
  const reviewed = args.reviewState === "approved";

  if (state === "review_required") {
    return {
      state,
      baseState,
      defaultApprovedState: defaultApprovedGuardrailState(baseState),
      classes: ["negotiation_sensitive"],
      approvalPath: "broker_review",
      reasonCodes,
      buyerHeadline: "Negotiation guidance requires broker review",
      buyerExplanation:
        "Buyer-specific negotiation strategy stays out of view until a broker reviews the recommendation.",
      internalSummary:
        "Negotiation-sensitive output is gated behind broker review before buyer exposure.",
      auditLabel: "negotiation_guardrail_review_required",
    };
  }

  return {
    state,
    baseState,
    defaultApprovedState: defaultApprovedGuardrailState(baseState),
    classes: ["negotiation_sensitive"],
    approvalPath: reviewed ? "broker_review" : "none",
    reasonCodes,
    buyerHeadline: reviewed
      ? "Broker-reviewed negotiation guidance"
      : "Illustrative negotiation guidance",
    buyerExplanation:
      "Use negotiation signals to frame the broker conversation, not as a standalone instruction set.",
    internalSummary: reviewed
      ? "Negotiation-sensitive output was approved for softened buyer-facing presentation."
      : "Negotiation-sensitive output remains softened and non-committal.",
    auditLabel: reviewed
      ? "negotiation_guardrail_softened_after_review"
      : "negotiation_guardrail_softened",
  };
}

function buildBlockedAssessment(
  outputClass: AdvisoryOutputClass,
  reviewState: AdvisoryReviewState | undefined,
  args: {
    buyerHeadline: string;
    buyerExplanation: string;
    internalSummary: string;
    auditLabel: string;
    reasonCodes: string[];
  },
): AdvisoryGuardrailAssessment {
  return {
    state: resolveGuardrailState({
      baseState: "blocked",
      reviewState,
    }),
    baseState: "blocked",
    defaultApprovedState: "blocked",
    classes: [outputClass],
    approvalPath: "broker_and_legal_review",
    reasonCodes: args.reasonCodes,
    buyerHeadline: args.buyerHeadline,
    buyerExplanation: args.buyerExplanation,
    internalSummary: args.internalSummary,
    auditLabel: args.auditLabel,
  };
}

function buildDefaultAssessment(
  args: EngineGuardrailArgs,
): AdvisoryGuardrailAssessment {
  return {
    state: resolveGuardrailState({
      baseState: "can_say",
      reviewState: args.reviewState,
    }),
    baseState: "can_say",
    defaultApprovedState: "can_say",
    classes: [],
    approvalPath: "none",
    reasonCodes: [],
    buyerHeadline: "Buyer-safe guidance",
    buyerExplanation: "This output cleared the default buyer-safe guardrail.",
    internalSummary: "No advisory guardrail escalation was required.",
    auditLabel: "guardrail_clear",
  };
}

export function assessEngineOutputGuardrail(
  args: EngineGuardrailArgs,
): AdvisoryGuardrailAssessment {
  switch (args.engineType) {
    case "pricing":
      return buildPricingAssessment(args);
    case "offer":
    case "leverage":
      return buildNegotiationAssessment(args);
    case "agreement":
      return buildBlockedAssessment("agreement_legal_adjacent", args.reviewState, {
        buyerHeadline: "Agreement interpretation is not shown here",
        buyerExplanation:
          "Agreement or legal-adjacent guidance must go through broker or legal review before buyer exposure.",
        internalSummary:
          "Agreement or legal-adjacent output is blocked pending broker and legal review.",
        auditLabel: "agreement_guardrail_blocked",
        reasonCodes: ["legal_adjacent"],
      });
    default:
      return buildDefaultAssessment(args);
  }
}

export function assessCopilotQuestionGuardrail(
  args: CopilotQuestionGuardrailArgs,
): AdvisoryGuardrailAssessment | null {
  const normalized = args.question.trim();
  if (normalized.length === 0) return null;

  if (AGREEMENT_OR_LEGAL_PATTERN.test(normalized)) {
    return buildBlockedAssessment("agreement_legal_adjacent", undefined, {
      buyerHeadline: "Agreement and legal interpretation is blocked in chat",
      buyerExplanation:
        "Ask your broker to review the agreement or disclosure directly. This chat does not interpret legal meaning.",
      internalSummary:
        "Copilot question tripped the agreement/legal-adjacent guardrail.",
      auditLabel: "copilot_agreement_guardrail_blocked",
      reasonCodes: ["legal_adjacent_question"],
    });
  }

  if (DISCLOSURE_SENSITIVE_PATTERN.test(normalized)) {
    return {
      state: "review_required",
      baseState: "review_required",
      defaultApprovedState: "softened",
      classes: ["disclosure_sensitive"],
      approvalPath: "broker_review",
      reasonCodes: ["disclosure_sensitive_question"],
      buyerHeadline: "Disclosure-sensitive guidance requires broker review",
      buyerExplanation:
        "Compensation, rebate, credit, or disclosure-specific guidance needs broker review before it is shown directly.",
      internalSummary:
        "Copilot question tripped the disclosure-sensitive guardrail.",
      auditLabel: "copilot_disclosure_guardrail_review_required",
    };
  }

  if (args.intent === "agreement") {
    return buildBlockedAssessment("agreement_legal_adjacent", undefined, {
      buyerHeadline: "Agreement interpretation is blocked in chat",
      buyerExplanation:
        "Agreement questions route to broker or legal review instead of automated buyer-facing advice.",
      internalSummary:
        "Agreement intent is blocked from automated buyer-facing guidance.",
      auditLabel: "copilot_agreement_intent_blocked",
      reasonCodes: ["agreement_intent"],
    });
  }

  return null;
}

export function pickMoreRestrictiveGuardrail(
  left: AdvisoryGuardrailAssessment | null,
  right: AdvisoryGuardrailAssessment | null,
): AdvisoryGuardrailAssessment | null {
  if (!left) return right;
  if (!right) return left;

  const severity = (state: AdvisoryGuardrailState): number =>
    ADVISORY_GUARDRAIL_STATES.indexOf(state);

  return severity(left.state) >= severity(right.state) ? left : right;
}

export function guardrailStateLabel(
  state: AdvisoryGuardrailState,
): string {
  switch (state) {
    case "can_say":
      return "Buyer-safe";
    case "softened":
      return "Softened";
    case "review_required":
      return "Review required";
    case "blocked":
      return "Blocked";
  }
}
