import type { GatewayRequest, GatewayResult } from "./types";

export interface GatewayObservation {
  engineType: string;
  dealRoomId: string | null;
  provider: "anthropic" | "openai" | null;
  model: string | null;
  success: boolean;
  errorCode: string | null;
  latencyMs: number;
  estimatedCost: number;
  inputTokens: number;
  outputTokens: number;
  fallbackUsed: boolean;
}

export interface GatewayAggregate {
  key: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  fallbackCount: number;
  fallbackRate: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  totalEstimatedCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export function observeGatewayResult(
  request: GatewayRequest,
  result: GatewayResult,
): GatewayObservation {
  if (!result.success) {
    const provider =
      result.error.provider === "anthropic" || result.error.provider === "openai"
        ? result.error.provider
        : null;

    return {
      engineType: request.engineType,
      dealRoomId: request.dealRoomId ?? null,
      provider,
      model: null,
      success: false,
      errorCode: result.error.code,
      latencyMs: 0,
      estimatedCost: 0,
      inputTokens: 0,
      outputTokens: 0,
      fallbackUsed: false,
    };
  }

  return {
    engineType: request.engineType,
    dealRoomId: request.dealRoomId ?? null,
    provider: result.data.usage.provider,
    model: result.data.usage.model,
    success: true,
    errorCode: null,
    latencyMs: result.data.usage.latencyMs,
    estimatedCost: result.data.usage.estimatedCost,
    inputTokens: result.data.usage.inputTokens,
    outputTokens: result.data.usage.outputTokens,
    fallbackUsed: result.data.usage.fallbackUsed,
  };
}

function aggregateBy(
  observations: readonly GatewayObservation[],
  keyFor: (observation: GatewayObservation) => string | null,
): GatewayAggregate[] {
  const groups = new Map<string, GatewayAggregate>();

  for (const observation of observations) {
    const key = keyFor(observation);
    if (!key) continue;

    const aggregate = groups.get(key) ?? {
      key,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      fallbackCount: 0,
      fallbackRate: 0,
      totalLatencyMs: 0,
      avgLatencyMs: 0,
      totalEstimatedCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };

    aggregate.requestCount += 1;
    aggregate.successCount += observation.success ? 1 : 0;
    aggregate.errorCount += observation.success ? 0 : 1;
    aggregate.fallbackCount += observation.fallbackUsed ? 1 : 0;
    aggregate.totalLatencyMs += observation.latencyMs;
    aggregate.totalEstimatedCost += observation.estimatedCost;
    aggregate.totalInputTokens += observation.inputTokens;
    aggregate.totalOutputTokens += observation.outputTokens;

    groups.set(key, aggregate);
  }

  return Array.from(groups.values())
    .map((aggregate) => ({
      ...aggregate,
      fallbackRate:
        aggregate.requestCount > 0
          ? Number((aggregate.fallbackCount / aggregate.requestCount).toFixed(4))
          : 0,
      avgLatencyMs:
        aggregate.successCount > 0
          ? Math.round(aggregate.totalLatencyMs / aggregate.successCount)
          : 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function summarizeGatewayObservationsByEngine(
  observations: readonly GatewayObservation[],
): GatewayAggregate[] {
  return aggregateBy(observations, (observation) => observation.engineType);
}

export function summarizeGatewayObservationsByDealRoom(
  observations: readonly GatewayObservation[],
): GatewayAggregate[] {
  return aggregateBy(observations, (observation) => observation.dealRoomId);
}
