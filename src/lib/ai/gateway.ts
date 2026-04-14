import {
  DEFAULT_GATEWAY_PROVIDERS,
  createGatewayProviderError,
  normalizeProviderError,
} from "./providers";
import type {
  GatewayConfig,
  GatewayError,
  GatewayExecutionMetadata,
  GatewayProvider,
  GatewayProviderError,
  GatewayProviderId,
  GatewayProviderMap,
  GatewayProviderRequest,
  GatewayRequest,
  GatewayResponse,
  GatewayResult,
} from "./types";

const DEFAULT_PROVIDER_MODELS: Record<GatewayProviderId, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
};

const DEFAULT_CONFIG: GatewayConfig = {
  primaryProvider: "anthropic",
  fallbackProvider: "openai",
  primaryModel: DEFAULT_PROVIDER_MODELS.anthropic,
  fallbackModel: DEFAULT_PROVIDER_MODELS.openai,
  maxRetries: 1,
  timeoutMs: 30000,
};

/** Per-engine config overrides */
const ENGINE_CONFIGS: Partial<Record<string, Partial<GatewayConfig>>> = {
  copilot: { primaryModel: DEFAULT_PROVIDER_MODELS.anthropic, timeoutMs: 15000 },
  doc_parser: {
    primaryModel: DEFAULT_PROVIDER_MODELS.anthropic,
    timeoutMs: 60000,
  },
};

export type GatewayDependencies = GatewayProviderMap;

interface GatewayExecutionConfig {
  primaryProvider: GatewayProviderId;
  fallbackProvider?: GatewayProviderId;
  primaryModel: string;
  fallbackModel?: string;
  maxRetries: number;
  timeoutMs: number;
}

interface GatewayExecutionTarget {
  provider: GatewayProviderId;
  model: string;
  attempts: number;
  isFallback: boolean;
  fallbackFrom: GatewayProviderId | null;
}

function inferProviderFromModel(model: string | undefined): GatewayProviderId | null {
  if (!model) {
    return null;
  }

  const normalized = model.toLowerCase();
  if (normalized.startsWith("claude")) {
    return "anthropic";
  }
  if (
    normalized.startsWith("gpt") ||
    normalized.startsWith("o1") ||
    normalized.startsWith("o3") ||
    normalized.startsWith("o4")
  ) {
    return "openai";
  }
  return null;
}

function alternateProvider(
  provider: GatewayProviderId,
): GatewayProviderId | undefined {
  return provider === "anthropic" ? "openai" : "anthropic";
}

function resolveGatewayConfig(request: GatewayRequest): GatewayExecutionConfig {
  const engineOverrides = ENGINE_CONFIGS[request.engineType] ?? {};
  const merged = { ...DEFAULT_CONFIG, ...engineOverrides, ...request.config };
  const promptModel = request.prompt?.model;
  const promptProvider = inferProviderFromModel(promptModel);

  const primaryProvider =
    request.config?.primaryProvider ??
    promptProvider ??
    merged.primaryProvider;
  const primaryModel =
    request.config?.primaryModel ??
    (request.config?.primaryProvider ? undefined : promptModel) ??
    merged.primaryModel ??
    DEFAULT_PROVIDER_MODELS[primaryProvider];

  const requestedFallbackProvider =
    request.config?.fallbackProvider ?? merged.fallbackProvider;
  const fallbackProvider =
    requestedFallbackProvider && requestedFallbackProvider !== primaryProvider
      ? requestedFallbackProvider
      : alternateProvider(primaryProvider);
  const fallbackModel = fallbackProvider
    ? request.config?.fallbackModel ??
      (fallbackProvider === merged.fallbackProvider
        ? merged.fallbackModel
        : undefined) ??
      DEFAULT_PROVIDER_MODELS[fallbackProvider]
    : undefined;

  return {
    primaryProvider,
    fallbackProvider,
    primaryModel,
    fallbackModel,
    maxRetries: merged.maxRetries ?? DEFAULT_CONFIG.maxRetries ?? 1,
    timeoutMs: merged.timeoutMs ?? DEFAULT_CONFIG.timeoutMs ?? 30000,
  };
}

function buildExecutionTargets(
  config: GatewayExecutionConfig,
): GatewayExecutionTarget[] {
  const targets: GatewayExecutionTarget[] = [
    {
      provider: config.primaryProvider,
      model: config.primaryModel,
      attempts: config.maxRetries + 1,
      isFallback: false,
      fallbackFrom: null,
    },
  ];

  if (config.fallbackProvider && config.fallbackModel) {
    targets.push({
      provider: config.fallbackProvider,
      model: config.fallbackModel,
      attempts: 1,
      isFallback: true,
      fallbackFrom: config.primaryProvider,
    });
  }

  return targets;
}

function executionMetadata(request: GatewayRequest): GatewayExecutionMetadata {
  return {
    engineType: request.engineType,
    dealRoomId: request.dealRoomId ?? null,
    promptKey: request.prompt?.promptKey ?? null,
    promptVersion: request.prompt?.version ?? null,
  };
}

function buildProviderRequest(args: {
  request: GatewayRequest;
  target: GatewayExecutionTarget;
  attempt: number;
  timeoutMs: number;
}): GatewayProviderRequest {
  return {
    metadata: executionMetadata(args.request),
    messages: args.request.messages,
    model: args.target.model,
    maxTokens: args.request.maxTokens ?? 4096,
    temperature: args.request.temperature ?? 0,
    timeoutMs: args.timeoutMs,
    attempt: args.attempt,
    isFallback: args.target.isFallback,
    fallbackFrom: args.target.fallbackFrom,
  };
}

async function executeWithTimeout(
  provider: GatewayProvider,
  request: GatewayProviderRequest,
): Promise<GatewayResponse> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        createGatewayProviderError({
          provider: provider.id,
          code: "timeout",
          message: `timeout after ${request.timeoutMs}ms`,
          retryable: true,
        }),
      );
    }, request.timeoutMs);
  });

  try {
    return await Promise.race([provider.execute(request), timeoutPromise]);
  } catch (error) {
    throw normalizeProviderError(provider.id, error);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function resolveGatewayDependencies(
  dependencies?: Partial<GatewayDependencies>,
): Promise<GatewayDependencies> {
  return {
    anthropic: dependencies?.anthropic ?? DEFAULT_GATEWAY_PROVIDERS.anthropic,
    openai: dependencies?.openai ?? DEFAULT_GATEWAY_PROVIDERS.openai,
  };
}

function withFallbackUsage(
  response: GatewayResponse,
  isFallback: boolean,
): GatewayResponse {
  return {
    ...response,
    usage: {
      ...response.usage,
      fallbackUsed: isFallback,
    },
  };
}

function providerFailureToGatewayError(
  error: GatewayProviderError,
): GatewayError {
  return {
    code: error.code,
    message: error.message,
    provider: error.provider,
    statusCode: error.statusCode,
  };
}

/**
 * Send a request through the AI gateway.
 * Routes to the prompt- or config-selected primary provider, retries it when
 * allowed, then fails over to the alternate provider.
 * Returns typed result with usage/cost tracking.
 */
export async function gateway(
  request: GatewayRequest,
  dependencies?: Partial<GatewayDependencies>,
): Promise<GatewayResult> {
  const resolvedDependencies = await resolveGatewayDependencies(dependencies);
  const config = resolveGatewayConfig(request);
  const targets = buildExecutionTargets(config);

  let primaryFailure: GatewayProviderError | null = null;
  let fallbackFailure: GatewayProviderError | null = null;

  for (const target of targets) {
    const provider = resolvedDependencies[target.provider];
    let lastError: GatewayProviderError | null = null;

    for (let attempt = 1; attempt <= target.attempts; attempt += 1) {
      const providerRequest = buildProviderRequest({
        request,
        target,
        attempt,
        timeoutMs: config.timeoutMs,
      });

      try {
        const response = await executeWithTimeout(provider, providerRequest);
        return {
          success: true,
          data: withFallbackUsage(response, target.isFallback),
        };
      } catch (error) {
        lastError = normalizeProviderError(target.provider, error);
        if (!lastError.retryable || attempt === target.attempts) {
          break;
        }
      }
    }

    if (target.isFallback) {
      fallbackFailure = lastError;
    } else {
      primaryFailure = lastError;
    }
  }

  if (!fallbackFailure) {
    return {
      success: false,
      error: providerFailureToGatewayError(
        primaryFailure ??
          createGatewayProviderError({
            provider: config.primaryProvider,
            code: "provider_error",
            message: "Gateway execution failed before reaching a provider",
            retryable: false,
          }),
      ),
    };
  }

  return {
    success: false,
    error: {
      code: "all_providers_failed",
      message: `Primary (${config.primaryProvider}): ${primaryFailure?.message ?? "unknown"}. Fallback (${config.fallbackProvider}): ${fallbackFailure.message}`,
    },
  };
}

export { DEFAULT_CONFIG, ENGINE_CONFIGS };
