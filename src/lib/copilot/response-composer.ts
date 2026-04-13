/**
 * Response composition for the buyer copilot.
 *
 * Takes engine output + a rendered template and produces a short,
 * citation-bearing answer. Pure synchronous helper: LLM calls happen in
 * the convex action layer. This module is unit-testable with no mocks.
 */

import type { CopilotIntent } from "./intents";
import type { CopilotEngineKey } from "./router";
import type {
  AdvisoryApprovalPath,
  AdvisoryGuardrailAssessment,
  AdvisoryGuardrailState,
  AdvisoryOutputClass,
} from "@/lib/advisory/guardrails";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export interface EngineOutputRef {
  engine: CopilotEngineKey;
  engineOutputId?: string;
  modelId?: string;
  generatedAt?: string;
  confidence?: number;
  snippet: string;
  rawOutput?: string;
  reviewState?: "pending" | "approved" | "rejected";
}

export interface ResponseGuardrailMetadata {
  state: AdvisoryGuardrailState;
  classes: AdvisoryOutputClass[];
  approvalPath: AdvisoryApprovalPath;
  reasonCodes: string[];
}

export interface ComposedResponse {
  text: string;
  citations: string[];
  intent: CopilotIntent;
  engine: CopilotEngineKey;
  stubbed: boolean;
  requiresLlm: boolean;
  guardrail?: ResponseGuardrailMetadata;
}

export interface ComposeInput {
  intent: CopilotIntent;
  engine: CopilotEngineKey;
  engineRef: EngineOutputRef | null;
  questionPreview: string;
}

const MISSING_ENGINE_MESSAGES: Record<
  CopilotEngineKey,
  { intentLabel: string; next: string }
> = {
  pricing: {
    intentLabel: "pricing analysis",
    next: "Your broker will run the pricing engine shortly.",
  },
  comps: {
    intentLabel: "comp selection",
    next: "Your broker will run the comps engine shortly.",
  },
  cost: {
    intentLabel: "monthly cost breakdown",
    next: "Your broker will run the cost engine shortly.",
  },
  leverage: {
    intentLabel: "leverage analysis",
    next: "Your broker will run the leverage engine shortly.",
  },
  offer: {
    intentLabel: "offer scenarios",
    next: "Your broker will generate offer scenarios shortly.",
  },
  case_synthesis: {
    intentLabel: "case synthesis",
    next: "Case synthesis is still on the way — ask your broker directly.",
  },
  docs: {
    intentLabel: "document analysis",
    next: "Document parsing is still on the way — ask your broker directly.",
  },
  scheduling: {
    intentLabel: "tour scheduling",
    next: "Scheduling is still on the way — ask your broker directly.",
  },
  agreement: {
    intentLabel: "agreement review",
    next: "Agreement review is still on the way — ask your broker directly.",
  },
  guarded_general: {
    intentLabel: "general reply",
    next: "Ask a question about this property or the buying process.",
  },
};

export function composeStubResponse(input: ComposeInput): ComposedResponse {
  const { intent, engine } = input;
  const { intentLabel, next } = MISSING_ENGINE_MESSAGES[engine];
  return {
    intent,
    engine,
    stubbed: true,
    requiresLlm: false,
    citations: [],
    guardrail: undefined,
    text: `I don't have ${intentLabel} for this property yet. ${next}`,
  };
}

export function composeOffTopicRefusal(question: string): ComposedResponse {
  const hint =
    question.length > 0 && question.length <= 80
      ? " "
      : " I'm scoped to this property and the buying process — ";
  return {
    intent: "other",
    engine: "guarded_general",
    stubbed: true,
    requiresLlm: false,
    citations: [],
    guardrail: undefined,
    text: `I can only help with questions about this property and the buying process.${hint}try asking about pricing, comps, offer terms, or next steps.`,
  };
}

export function composeLlmPrompt(
  input: ComposeInput,
): { requiresLlm: true; preview: ComposedResponse } {
  const { intent, engine, engineRef, questionPreview } = input;
  const citations: string[] = [];
  if (engineRef?.engineOutputId) {
    citations.push(engineRef.engineOutputId);
  }
  const preview: ComposedResponse = {
    intent,
    engine,
    stubbed: false,
    requiresLlm: true,
    citations,
    guardrail: undefined,
    text: `Preparing a grounded answer from the ${engine} engine…`,
  };
  const hasQuestionPreview = questionPreview.length > 0;
  if (hasQuestionPreview && preview.text.length < 160) {
    // no-op: the preview text is a short status line, we expose the
    // full LLM answer once the action returns.
  }
  return { requiresLlm: true, preview };
}

export function composeGroundedAnswer(
  input: ComposeInput,
  llmText: string,
): ComposedResponse {
  const { intent, engine, engineRef } = input;
  const citations: string[] = [];
  if (engineRef?.engineOutputId) {
    citations.push(engineRef.engineOutputId);
  }
  const cleaned = llmText.trim();
  return {
    intent,
    engine,
    stubbed: false,
    requiresLlm: false,
    citations,
    guardrail: undefined,
    text: cleaned.length > 0
      ? cleaned
      : "I received an empty response from the engine — please try rephrasing.",
  };
}

function parseOutputJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function guardrailMetadata(
  assessment: AdvisoryGuardrailAssessment,
): ResponseGuardrailMetadata {
  return {
    state: assessment.state,
    classes: assessment.classes,
    approvalPath: assessment.approvalPath,
    reasonCodes: [...assessment.reasonCodes],
  };
}

function composePricingGuardrailText(
  input: ComposeInput,
  assessment: AdvisoryGuardrailAssessment,
): string {
  if (assessment.state === "review_required" || assessment.state === "blocked") {
    return `${assessment.buyerHeadline}. ${assessment.buyerExplanation}`;
  }

  const parsed = parseOutputJson<{
    fairValue?: { value?: number };
    likelyAccepted?: { value?: number };
  }>(input.engineRef?.rawOutput);
  const fairValue = parsed?.fairValue?.value;
  const likelyAccepted = parsed?.likelyAccepted?.value;
  if (
    typeof fairValue === "number" &&
    Number.isFinite(fairValue) &&
    typeof likelyAccepted === "number" &&
    Number.isFinite(likelyAccepted)
  ) {
    return `${assessment.buyerHeadline}. The current model centers fair value around ${currency.format(fairValue)} and a likely-accepted zone around ${currency.format(likelyAccepted)}. ${assessment.buyerExplanation}`;
  }

  return `${assessment.buyerHeadline}. ${assessment.buyerExplanation}`;
}

function composeOfferGuardrailText(
  assessment: AdvisoryGuardrailAssessment,
): string {
  return `${assessment.buyerHeadline}. ${assessment.buyerExplanation}`;
}

export function composeGuardrailedResponse(
  input: ComposeInput,
  assessment: AdvisoryGuardrailAssessment,
): ComposedResponse {
  const citations: string[] = [];
  if (input.engineRef?.engineOutputId) {
    citations.push(input.engineRef.engineOutputId);
  }

  let text = `${assessment.buyerHeadline}. ${assessment.buyerExplanation}`;
  if (assessment.classes.includes("pricing_sensitive")) {
    text = composePricingGuardrailText(input, assessment);
  } else if (
    assessment.classes.includes("negotiation_sensitive") ||
    assessment.classes.includes("agreement_legal_adjacent") ||
    assessment.classes.includes("disclosure_sensitive")
  ) {
    text = composeOfferGuardrailText(assessment);
  }

  return {
    intent: input.intent,
    engine: input.engine,
    stubbed:
      assessment.state === "review_required" || assessment.state === "blocked",
    requiresLlm: false,
    citations,
    guardrail: guardrailMetadata(assessment),
    text,
  };
}

export function hasEnoughContext(engineRef: EngineOutputRef | null): boolean {
  if (!engineRef) return false;
  if (typeof engineRef.snippet !== "string") return false;
  return engineRef.snippet.trim().length > 0;
}
