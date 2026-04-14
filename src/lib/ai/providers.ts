import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { requireEnvKeys, webServerEnvSpec } from "@buyer-codex/shared";
import type {
  GatewayProvider,
  GatewayProviderError,
  GatewayProviderId,
  GatewayProviderMap,
  GatewayProviderRequest,
  GatewayResponse,
} from "./types";
import { MODEL_COSTS } from "./types";

// Lazy-init clients — only created when first used
let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function requireAiEnv<
  const TKeys extends readonly (keyof typeof webServerEnvSpec)[],
>(...keys: TKeys) {
  return requireEnvKeys(webServerEnvSpec, keys, process.env);
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const { ANTHROPIC_API_KEY } = requireAiEnv("ANTHROPIC_API_KEY");
    anthropicClient = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const { OPENAI_API_KEY } = requireAiEnv("OPENAI_API_KEY");
    openaiClient = new OpenAI({
      apiKey: OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const costs = MODEL_COSTS[model] ?? { input: 5.0, output: 15.0 };
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;
}

function isRetryableStatus(statusCode: number | undefined): boolean {
  return statusCode === 408 || statusCode === 409 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500);
}

function isRetryableMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rate limit") ||
    normalized.includes("timeout") ||
    normalized.includes("timed out") ||
    normalized.includes("econnreset") ||
    normalized.includes("fetch failed") ||
    normalized.includes("connection") ||
    normalized.includes("overloaded")
  );
}

function providerErrorCode(
  statusCode: number | undefined,
  message: string,
): GatewayProviderError["code"] {
  if (statusCode === 429 || message.toLowerCase().includes("rate limit")) {
    return "rate_limit";
  }
  if (
    statusCode === 408 ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("timed out")
  ) {
    return "timeout";
  }
  return "provider_error";
}

function errorMessageFromUnknown(
  provider: GatewayProviderId,
  error: unknown,
): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }
  return `${provider} provider failed`;
}

function statusCodeFromUnknown(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.status === "number") {
    return record.status;
  }
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }
  return undefined;
}

export function createGatewayProviderError(args: {
  provider: GatewayProviderId;
  code: GatewayProviderError["code"];
  message: string;
  retryable: boolean;
  statusCode?: number;
}): GatewayProviderError {
  const error = new Error(args.message) as GatewayProviderError;
  error.name = "GatewayProviderError";
  error.code = args.code;
  error.provider = args.provider;
  error.retryable = args.retryable;
  error.statusCode = args.statusCode;
  return error;
}

export function isGatewayProviderError(
  error: unknown,
): error is GatewayProviderError {
  return (
    error instanceof Error &&
    "provider" in error &&
    "retryable" in error &&
    typeof (error as GatewayProviderError).provider === "string" &&
    typeof (error as GatewayProviderError).retryable === "boolean"
  );
}

export function normalizeProviderError(
  provider: GatewayProviderId,
  error: unknown,
): GatewayProviderError {
  if (isGatewayProviderError(error)) {
    return error;
  }

  const message = errorMessageFromUnknown(provider, error);
  const statusCode = statusCodeFromUnknown(error);
  return createGatewayProviderError({
    provider,
    code: providerErrorCode(statusCode, message),
    message,
    statusCode,
    retryable: isRetryableStatus(statusCode) || isRetryableMessage(message),
  });
}

async function executeAnthropic(
  request: GatewayProviderRequest,
): Promise<GatewayResponse> {
  try {
    const client = getAnthropicClient();
    const start = Date.now();

    const systemMessages = request.messages.filter((message) => message.role === "system");
    const systemPrompt =
      systemMessages.length > 0
        ? systemMessages.map((message) => message.content).join("\n\n")
        : undefined;
    const chatMessages = request.messages.filter((message) => message.role !== "system");

    const response = await client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: systemPrompt,
      messages: chatMessages.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content,
      })),
    });

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const content =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    return {
      content,
      usage: {
        inputTokens,
        outputTokens,
        model: request.model,
        provider: "anthropic",
        latencyMs,
        estimatedCost: estimateCost(request.model, inputTokens, outputTokens),
        fallbackUsed: false,
      },
    };
  } catch (error) {
    throw normalizeProviderError("anthropic", error);
  }
}

async function executeOpenAI(
  request: GatewayProviderRequest,
): Promise<GatewayResponse> {
  try {
    const client = getOpenAIClient();
    const start = Date.now();

    const response = await client.chat.completions.create({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    });

    const latencyMs = Date.now() - start;
    const inputTokens = response.usage?.prompt_tokens ?? 0;
    const outputTokens = response.usage?.completion_tokens ?? 0;
    const content = response.choices[0]?.message?.content ?? "";

    return {
      content,
      usage: {
        inputTokens,
        outputTokens,
        model: request.model,
        provider: "openai",
        latencyMs,
        estimatedCost: estimateCost(request.model, inputTokens, outputTokens),
        fallbackUsed: false,
      },
    };
  } catch (error) {
    throw normalizeProviderError("openai", error);
  }
}

export const anthropicProvider: GatewayProvider = {
  id: "anthropic",
  execute: executeAnthropic,
};

export const openaiProvider: GatewayProvider = {
  id: "openai",
  execute: executeOpenAI,
};

export const DEFAULT_GATEWAY_PROVIDERS = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
} satisfies GatewayProviderMap;
