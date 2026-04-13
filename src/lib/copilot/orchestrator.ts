/**
 * Top-level copilot orchestrator.
 *
 * Pure async function. Dependencies are injected so the orchestrator can
 * be unit-tested offline without hitting Convex, the gateway, or the
 * prompt registry. The convex action layer is the only caller that wires
 * real infrastructure into the deps object.
 */

import {
  classifyIntentRuleBased,
  needsLlmFallback,
  type CopilotIntent,
  type IntentClassification,
} from "./intents";
import {
  composeGuardrailedResponse,
  composeGroundedAnswer,
  composeLlmPrompt,
  composeOffTopicRefusal,
  composeStubResponse,
  hasEnoughContext,
  type ComposedResponse,
  type EngineOutputRef,
} from "./response-composer";
import { isEngineAvailable, routeForIntent } from "./router";
import {
  assessCopilotQuestionGuardrail,
  assessEngineOutputGuardrail,
  pickMoreRestrictiveGuardrail,
} from "@/lib/advisory/guardrails";

export interface OrchestratorDeps {
  /** Classify via LLM when rule-based confidence is below the fallback threshold. */
  llmClassify: (question: string) => Promise<IntentClassification>;
  /** Load the latest engine output relevant to the intent for this property. */
  loadEngineOutput: (
    intent: CopilotIntent,
    propertyId: string,
  ) => Promise<EngineOutputRef | null>;
  /** Generate the final grounded answer from the engine output + prompt. */
  llmRespond: (
    intent: CopilotIntent,
    engineRef: EngineOutputRef,
    question: string,
  ) => Promise<string>;
  /** Generate the guarded "other" response (scope-limited). */
  llmGuardedGeneral?: (question: string, dealContext: string) => Promise<string>;
  /** Clock — injected so tests are deterministic. */
  now?: () => string;
}

export interface OrchestrateInput {
  question: string;
  propertyId: string;
  dealContext: string;
}

export interface OrchestrateResult {
  classification: IntentClassification;
  response: ComposedResponse;
  debug: {
    engineAvailable: boolean;
    ruleIntent: CopilotIntent;
    llmFallback: boolean;
  };
}

function now(deps: OrchestratorDeps): string {
  return (deps.now ?? (() => new Date().toISOString()))();
}

export async function orchestrate(
  input: OrchestrateInput,
  deps: OrchestratorDeps,
): Promise<OrchestrateResult> {
  const ruleClassification = classifyIntentRuleBased(input.question);

  let classification = ruleClassification;
  let llmFallback = false;
  if (needsLlmFallback(ruleClassification)) {
    try {
      const llm = await deps.llmClassify(input.question);
      classification = llm;
      llmFallback = true;
    } catch {
      classification = {
        intent: "other",
        confidence: 0.4,
        method: "fallback",
      };
    }
  }

  const route = routeForIntent(classification.intent);
  const engineAvailable = isEngineAvailable(classification.intent);
  const questionGuardrail = assessCopilotQuestionGuardrail({
    question: input.question,
    intent: classification.intent,
  });
  const debug = {
    engineAvailable,
    ruleIntent: ruleClassification.intent,
    llmFallback,
  };

  // "other" intent: guarded general, never routed to engines.
  if (classification.intent === "other") {
    if (questionGuardrail) {
      return {
        classification,
        response: composeGuardrailedResponse(
          {
            intent: classification.intent,
            engine: "guarded_general",
            engineRef: null,
            questionPreview: input.question.slice(0, 80),
          },
          questionGuardrail,
        ),
        debug,
      };
    }

    if (!deps.llmGuardedGeneral) {
      return {
        classification,
        response: composeOffTopicRefusal(input.question),
        debug,
      };
    }
    try {
      const text = await deps.llmGuardedGeneral(
        input.question,
        input.dealContext,
      );
      const cleaned = text.trim();
      if (cleaned.length === 0) {
        return {
          classification,
          response: composeOffTopicRefusal(input.question),
          debug,
        };
      }
      return {
        classification,
        response: {
          intent: "other",
          engine: "guarded_general",
          stubbed: false,
          requiresLlm: false,
          citations: [],
          text: cleaned,
        },
        debug,
      };
    } catch {
      return {
        classification,
        response: composeOffTopicRefusal(input.question),
        debug,
      };
    }
  }

  if (!engineAvailable) {
    if (questionGuardrail) {
      return {
        classification,
        response: composeGuardrailedResponse(
          {
            intent: classification.intent,
            engine: route.engine,
            engineRef: null,
            questionPreview: input.question.slice(0, 80),
          },
          questionGuardrail,
        ),
        debug,
      };
    }

    return {
      classification,
      response: composeStubResponse({
        intent: classification.intent,
        engine: route.engine,
        engineRef: null,
        questionPreview: input.question.slice(0, 80),
      }),
      debug,
    };
  }

  let engineRef: EngineOutputRef | null;
  try {
    engineRef = await deps.loadEngineOutput(
      classification.intent,
      input.propertyId,
    );
  } catch {
    engineRef = null;
  }

  if (!hasEnoughContext(engineRef)) {
    if (questionGuardrail) {
      return {
        classification,
        response: composeGuardrailedResponse(
          {
            intent: classification.intent,
            engine: route.engine,
            engineRef,
            questionPreview: input.question.slice(0, 80),
          },
          questionGuardrail,
        ),
        debug,
      };
    }

    return {
      classification,
      response: composeStubResponse({
        intent: classification.intent,
        engine: route.engine,
        engineRef: null,
        questionPreview: input.question.slice(0, 80),
      }),
      debug,
    };
  }

  const guardedEngineRef = engineRef!;
  const engineGuardrail = assessEngineOutputGuardrail({
    engineType: route.engine,
    confidence: guardedEngineRef.confidence,
    output: guardedEngineRef.rawOutput,
    reviewState: guardedEngineRef.reviewState,
  });
  const effectiveGuardrail = pickMoreRestrictiveGuardrail(
    questionGuardrail,
    engineGuardrail,
  );
  if (
    effectiveGuardrail &&
    effectiveGuardrail.state !== "can_say" &&
    !(effectiveGuardrail.state === "softened" && route.engine === "comps")
  ) {
    return {
      classification,
      response: composeGuardrailedResponse(
        {
          intent: classification.intent,
          engine: route.engine,
          engineRef: guardedEngineRef,
          questionPreview: input.question.slice(0, 80),
        },
        effectiveGuardrail,
      ),
      debug,
    };
  }

  try {
    // Strip LLM output and return the grounded answer. We do not need the
    // requiresLlm preview path in the orchestrator output — callers get
    // the fully composed response.
    const _preview = composeLlmPrompt({
      intent: classification.intent,
      engine: route.engine,
      engineRef: guardedEngineRef,
      questionPreview: input.question.slice(0, 80),
    });
    void _preview;
    const text = await deps.llmRespond(
      classification.intent,
      guardedEngineRef,
      input.question,
    );
    return {
      classification,
      response: composeGroundedAnswer(
        {
          intent: classification.intent,
          engine: route.engine,
          engineRef: guardedEngineRef,
          questionPreview: input.question.slice(0, 80),
        },
        text,
      ),
      debug,
    };
  } catch {
    return {
      classification,
      response: composeStubResponse({
        intent: classification.intent,
        engine: route.engine,
        engineRef,
        questionPreview: input.question.slice(0, 80),
      }),
      debug,
    };
  }
}

export function summarizeForAudit(result: OrchestrateResult, ts: string) {
  return {
    intent: result.classification.intent,
    confidence: result.classification.confidence,
    method: result.classification.method,
    engine: result.response.engine,
    citationCount: result.response.citations.length,
    stubbed: result.response.stubbed,
    timestamp: ts,
  };
}

export function buildAuditAt(
  result: OrchestrateResult,
  deps: OrchestratorDeps,
) {
  return summarizeForAudit(result, now(deps));
}
