import type { GatewayUsage } from "../types";

export const ENGINE_INPUT_SNAPSHOT_SCHEMA_VERSION = "ai-engine-input.v1";

export const SNAPSHOT_ENGINE_TYPES = [
  "pricing",
  "comps",
  "leverage",
  "offer",
  "cost",
] as const;

export type SnapshotEngineType = (typeof SNAPSHOT_ENGINE_TYPES)[number];

export const DETERMINISTIC_ENGINE_MODEL_IDS = {
  comps: "deterministic-comps-v2",
  leverage: "deterministic-leverage-v2",
  offer: "deterministic-offer-v2",
  cost: "deterministic-cost-v1",
} as const;

export interface EngineInputSnapshotEnvelope<TInput> {
  schemaVersion: typeof ENGINE_INPUT_SNAPSHOT_SCHEMA_VERSION;
  engineType: SnapshotEngineType;
  input: TInput;
}

export interface DeterministicEngineExecution<TOutput> {
  output: TOutput;
  confidence: number;
  citations: string[];
  modelId: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = sortJsonValue(value[key]);
      return acc;
    }, {});
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

export function serializeEngineInputSnapshot<TInput>(
  engineType: SnapshotEngineType,
  input: TInput,
): string {
  const envelope: EngineInputSnapshotEnvelope<TInput> = {
    schemaVersion: ENGINE_INPUT_SNAPSHOT_SCHEMA_VERSION,
    engineType,
    input,
  };
  return stableJsonStringify(envelope);
}

function isSnapshotEnvelope(
  value: unknown,
): value is EngineInputSnapshotEnvelope<unknown> {
  return (
    isPlainObject(value) &&
    value.schemaVersion === ENGINE_INPUT_SNAPSHOT_SCHEMA_VERSION &&
    typeof value.engineType === "string" &&
    "input" in value
  );
}

export function parseEngineInputSnapshot<TInput>(
  snapshot: string,
  expectedEngineType?: SnapshotEngineType,
): TInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot) as unknown;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown parse failure";
    throw new Error(`Invalid historical input snapshot: ${message}`);
  }

  if (!isSnapshotEnvelope(parsed)) {
    return parsed as TInput;
  }

  if (
    expectedEngineType !== undefined &&
    parsed.engineType !== expectedEngineType
  ) {
    throw new Error(
      `Input snapshot expected ${expectedEngineType} but found ${parsed.engineType}`,
    );
  }

  return parsed.input as TInput;
}

export function collectUniqueCitations(
  citations: Iterable<string | null | undefined>,
): string[] {
  const unique = new Set<string>();

  for (const citation of citations) {
    const normalized = citation?.trim();
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

export function buildDeterministicEngineExecution<TOutput>(args: {
  output: TOutput;
  confidence: number;
  citations: Iterable<string | null | undefined>;
  modelId: string;
}): DeterministicEngineExecution<TOutput> {
  return {
    output: args.output,
    confidence: Number(args.confidence.toFixed(2)),
    citations: collectUniqueCitations(args.citations),
    modelId: args.modelId,
  };
}

export function buildUsageBackedExecution<TOutput>(args: {
  output: TOutput;
  confidence: number;
  citations: Iterable<string | null | undefined>;
  usage: GatewayUsage;
}): DeterministicEngineExecution<TOutput> {
  return buildDeterministicEngineExecution({
    output: args.output,
    confidence: args.confidence,
    citations: args.citations,
    modelId: args.usage.model,
  });
}
