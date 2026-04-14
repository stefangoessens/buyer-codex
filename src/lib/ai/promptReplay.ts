import type { GatewayRequest, GatewayResult } from "./types";
import {
  executePricingAnalysisWithGateway,
} from "./engines/pricing";
import { evaluateCompsSelection } from "./engines/comps";
import { evaluateLeverageAnalysis } from "./engines/leverage";
import { evaluateOfferScenarios } from "./engines/offer";
import { computeOwnershipCosts } from "./engines/cost";
import type {
  CompsInput,
  CostInput,
  LeverageInput,
  OfferInput,
  PricingInput,
} from "./engines/types";
import {
  buildDeterministicEngineExecution,
  DETERMINISTIC_ENGINE_MODEL_IDS,
  parseEngineInputSnapshot,
} from "./engines/runtime";
import type { PromptRegistryEngineType } from "../../../packages/shared/src/prompt-registry";

export const REPLAYABLE_PROMPT_ENGINE_TYPES = [
  "pricing",
  "comps",
  "leverage",
  "offer",
  "cost",
] as const;

export type ReplayablePromptEngineType =
  (typeof REPLAYABLE_PROMPT_ENGINE_TYPES)[number];

export interface ReplayPromptDefinition {
  engineType: ReplayablePromptEngineType;
  promptKey: string;
  version: string;
  prompt: string;
  systemPrompt?: string;
  model: string;
}

export interface ReplayExecutionResult {
  engineType: ReplayablePromptEngineType;
  promptKey: string;
  promptVersion: string;
  modelId: string;
  confidence: number;
  citations: string[];
  outputSnapshot: string;
}

export interface ReplayComparisonSummary {
  identical: boolean;
  changedPaths: string[];
  addedPaths: string[];
  removedPaths: string[];
  changedPathCount: number;
  addedPathCount: number;
  removedPathCount: number;
}

export type GatewayInvoker = (
  request: GatewayRequest,
) => Promise<GatewayResult>;

export function isReplayablePromptEngineType(
  engineType: PromptRegistryEngineType | string,
): engineType is ReplayablePromptEngineType {
  return REPLAYABLE_PROMPT_ENGINE_TYPES.includes(
    engineType as ReplayablePromptEngineType,
  );
}

export async function replayPromptExecution(args: {
  prompt: ReplayPromptDefinition;
  inputSnapshot: string;
  invokeGateway: GatewayInvoker;
}): Promise<ReplayExecutionResult> {
  const { prompt } = args;

  switch (prompt.engineType) {
    case "pricing": {
      const input = parseEngineInputSnapshot<PricingInput>(
        args.inputSnapshot,
        "pricing",
      );
      const { execution } = await executePricingAnalysisWithGateway({
        input,
        promptTemplate: prompt.prompt,
        systemPrompt: prompt.systemPrompt,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        promptModel: prompt.model,
        invokeGateway: args.invokeGateway,
      });

      return {
        engineType: prompt.engineType,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        modelId: execution.modelId,
        confidence: execution.confidence,
        citations: execution.citations,
        outputSnapshot: JSON.stringify(execution.output),
      };
    }
    case "comps": {
      const input = parseEngineInputSnapshot<{
        subject: CompsInput["subject"];
        candidates: CompsInput["candidates"];
      }>(args.inputSnapshot, "comps");
      const execution = evaluateCompsSelection(input);

      return {
        engineType: prompt.engineType,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        modelId: execution.modelId,
        confidence: execution.confidence,
        citations: execution.citations,
        outputSnapshot: JSON.stringify(execution.output),
      };
    }
    case "leverage": {
      const input = parseEngineInputSnapshot<LeverageInput>(
        args.inputSnapshot,
        "leverage",
      );
      const execution = evaluateLeverageAnalysis(input);

      return {
        engineType: prompt.engineType,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        modelId: execution.modelId,
        confidence: execution.confidence,
        citations: execution.citations,
        outputSnapshot: JSON.stringify(execution.output),
      };
    }
    case "offer": {
      const input = parseEngineInputSnapshot<OfferInput>(
        args.inputSnapshot,
        "offer",
      );
      const execution = evaluateOfferScenarios(input);

      return {
        engineType: prompt.engineType,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        modelId: execution.modelId,
        confidence: execution.confidence,
        citations: execution.citations,
        outputSnapshot: JSON.stringify(execution.output),
      };
    }
    case "cost": {
      const input = parseEngineInputSnapshot<CostInput>(
        args.inputSnapshot,
        "cost",
      );
      const replayed = computeOwnershipCosts(input);
      const execution = buildDeterministicEngineExecution({
        output: replayed,
        confidence: 0.75,
        citations: replayed.lineItems
          .filter((lineItem) => lineItem.source === "fact")
          .map((lineItem) => lineItem.label),
        modelId: DETERMINISTIC_ENGINE_MODEL_IDS.cost,
      });

      return {
        engineType: prompt.engineType,
        promptKey: prompt.promptKey,
        promptVersion: prompt.version,
        modelId: execution.modelId,
        confidence: execution.confidence,
        citations: execution.citations,
        outputSnapshot: JSON.stringify(execution.output),
      };
    }
  }
}

function parseStructuredSnapshot(snapshot: string): unknown {
  try {
    return JSON.parse(snapshot);
  } catch {
    return snapshot;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareValues(
  baseline: unknown,
  replay: unknown,
  path: string,
  changedPaths: Set<string>,
  addedPaths: Set<string>,
  removedPaths: Set<string>,
) {
  const currentPath = path || "$";

  if (Array.isArray(baseline) && Array.isArray(replay)) {
    const limit = Math.max(baseline.length, replay.length);
    for (let index = 0; index < limit; index += 1) {
      const nextPath = `${currentPath}[${index}]`;
      if (index >= baseline.length) {
        addedPaths.add(nextPath);
        continue;
      }
      if (index >= replay.length) {
        removedPaths.add(nextPath);
        continue;
      }
      compareValues(
        baseline[index],
        replay[index],
        nextPath,
        changedPaths,
        addedPaths,
        removedPaths,
      );
    }
    return;
  }

  if (isPlainObject(baseline) && isPlainObject(replay)) {
    const keys = new Set([
      ...Object.keys(baseline),
      ...Object.keys(replay),
    ]);
    for (const key of keys) {
      const nextPath = currentPath === "$" ? key : `${currentPath}.${key}`;
      if (!(key in baseline)) {
        addedPaths.add(nextPath);
        continue;
      }
      if (!(key in replay)) {
        removedPaths.add(nextPath);
        continue;
      }
      compareValues(
        baseline[key],
        replay[key],
        nextPath,
        changedPaths,
        addedPaths,
        removedPaths,
      );
    }
    return;
  }

  if (!Object.is(baseline, replay)) {
    changedPaths.add(currentPath);
  }
}

export function compareReplaySnapshots(
  baselineSnapshot: string,
  replaySnapshot: string,
): ReplayComparisonSummary {
  const baseline = parseStructuredSnapshot(baselineSnapshot);
  const replay = parseStructuredSnapshot(replaySnapshot);

  const changedPaths = new Set<string>();
  const addedPaths = new Set<string>();
  const removedPaths = new Set<string>();

  compareValues(
    baseline,
    replay,
    "",
    changedPaths,
    addedPaths,
    removedPaths,
  );

  return {
    identical:
      changedPaths.size === 0 &&
      addedPaths.size === 0 &&
      removedPaths.size === 0,
    changedPaths: [...changedPaths].sort(),
    addedPaths: [...addedPaths].sort(),
    removedPaths: [...removedPaths].sort(),
    changedPathCount: changedPaths.size,
    addedPathCount: addedPaths.size,
    removedPathCount: removedPaths.size,
  };
}
