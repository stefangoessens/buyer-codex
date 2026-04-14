export const GATEWAY_PROVIDER_IDS = ["anthropic", "openai"] as const;

export type GatewayProviderId = (typeof GATEWAY_PROVIDER_IDS)[number];

export interface GatewayConfig {
  primaryProvider: GatewayProviderId;
  fallbackProvider?: GatewayProviderId;
  primaryModel: string;
  fallbackModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface GatewayMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GatewayRequest {
  engineType: string;
  dealRoomId?: string;
  prompt?: {
    promptKey: string;
    version: string;
    model?: string;
  };
  messages: GatewayMessage[];
  maxTokens?: number;
  temperature?: number;
  config?: Partial<GatewayConfig>;
}

export interface GatewayExecutionMetadata {
  engineType: string;
  dealRoomId: string | null;
  promptKey: string | null;
  promptVersion: string | null;
}

export interface GatewayProviderRequest {
  metadata: GatewayExecutionMetadata;
  messages: GatewayMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  attempt: number;
  isFallback: boolean;
  fallbackFrom: GatewayProviderId | null;
}

export interface GatewayUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
  provider: GatewayProviderId;
  latencyMs: number;
  estimatedCost: number;
  fallbackUsed: boolean;
}

export interface GatewayResponse {
  content: string;
  usage: GatewayUsage;
}

export interface GatewayError {
  code: "provider_error" | "rate_limit" | "timeout" | "all_providers_failed";
  message: string;
  provider?: string;
  statusCode?: number;
}

export interface GatewayProviderError extends Error, GatewayError {
  provider: GatewayProviderId;
  retryable: boolean;
}

export interface GatewayProvider {
  id: GatewayProviderId;
  execute(request: GatewayProviderRequest): Promise<GatewayResponse>;
}

export type GatewayProviderMap = Record<GatewayProviderId, GatewayProvider>;

export type GatewayResult =
  | { success: true; data: GatewayResponse }
  | { success: false; error: GatewayError };

/** Cost per 1M tokens (approximate) */
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};
