import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG, ENGINE_CONFIGS, gateway } from "@/lib/ai/gateway";
import {
  observeGatewayResult,
  summarizeGatewayObservationsByDealRoom,
  summarizeGatewayObservationsByEngine,
} from "@/lib/ai/observability";
import { MODEL_COSTS, type GatewayProvider, type GatewayProviderId } from "@/lib/ai/types";

function mockProvider(
  id: GatewayProviderId,
  implementation: GatewayProvider["execute"],
): GatewayProvider {
  return {
    id,
    execute: vi.fn(implementation),
  };
}

describe("Gateway config", () => {
  it("defaults to Anthropic primary with OpenAI fallback", () => {
    expect(DEFAULT_CONFIG.primaryProvider).toBe("anthropic");
    expect(DEFAULT_CONFIG.fallbackProvider).toBe("openai");
    expect(DEFAULT_CONFIG.primaryModel).toBe("claude-sonnet-4-20250514");
    expect(DEFAULT_CONFIG.fallbackModel).toBe("gpt-4o");
  });

  it("has per-engine config overrides", () => {
    expect(ENGINE_CONFIGS.doc_parser?.timeoutMs).toBe(60000);
    expect(ENGINE_CONFIGS.copilot?.timeoutMs).toBe(15000);
  });
});

describe("MODEL_COSTS", () => {
  it("has cost entries for primary models", () => {
    expect(MODEL_COSTS["claude-sonnet-4-20250514"]).toBeDefined();
    expect(MODEL_COSTS["gpt-4o"]).toBeDefined();
  });

  it("has input and output costs", () => {
    const claude = MODEL_COSTS["claude-sonnet-4-20250514"];
    expect(claude.input).toBeGreaterThan(0);
    expect(claude.output).toBeGreaterThan(0);
    expect(claude.output).toBeGreaterThan(claude.input);
  });
});

describe("gateway failover", () => {
  const request = {
    engineType: "pricing",
    dealRoomId: "deal_123",
    messages: [{ role: "user" as const, content: "hello" }],
    maxTokens: 128,
    temperature: 0,
  };

  it("returns the primary response when Anthropic succeeds", async () => {
    const anthropic = mockProvider("anthropic", async () => ({
      content: "{\"fairValue\": 480000}",
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        model: "claude-sonnet-4-20250514",
        provider: "anthropic",
        latencyMs: 120,
        estimatedCost: 0.0045,
        fallbackUsed: false,
      },
    }));
    const openai = mockProvider("openai", async () => {
      throw new Error("should not be called");
    });

    const result = await gateway(request, { anthropic, openai });

    expect(result.success).toBe(true);
    expect(anthropic.execute).toHaveBeenCalledTimes(1);
    expect(openai.execute).not.toHaveBeenCalled();
    if (result.success) {
      expect(result.data.usage.provider).toBe("anthropic");
      expect(result.data.usage.fallbackUsed).toBe(false);
    }
  });

  it("fails over to OpenAI on retryable transport errors", async () => {
    const anthropic = mockProvider("anthropic", async () => {
      throw new Error("429 rate limit");
    });
    const openai = mockProvider("openai", async () => ({
      content: "{\"fairValue\": 481000}",
      usage: {
        inputTokens: 110,
        outputTokens: 55,
        model: "gpt-4o",
        provider: "openai",
        latencyMs: 180,
        estimatedCost: 0.0032,
        fallbackUsed: false,
      },
    }));

    const result = await gateway(request, { anthropic, openai });

    expect(result.success).toBe(true);
    expect(anthropic.execute).toHaveBeenCalledTimes(2);
    expect(openai.execute).toHaveBeenCalledTimes(1);
    if (result.success) {
      expect(result.data.usage.provider).toBe("openai");
      expect(result.data.usage.fallbackUsed).toBe(true);
    }
  });

  it("uses the prompt-selected model and provider for primary execution", async () => {
    const anthropic = mockProvider("anthropic", async () => {
      throw new Error("should not be called");
    });
    const openai = mockProvider("openai", async (providerRequest) => ({
      content: "classified",
      usage: {
        inputTokens: providerRequest.maxTokens,
        outputTokens: 12,
        model: providerRequest.model,
        provider: "openai",
        latencyMs: 85,
        estimatedCost: 0.001,
        fallbackUsed: false,
      },
    }));

    const result = await gateway(
      {
        engineType: "copilot",
        dealRoomId: "deal_456",
        prompt: {
          promptKey: "classifier",
          version: "v-openai",
          model: "gpt-4o",
        },
        messages: [{ role: "user", content: "What should I offer?" }],
        maxTokens: 64,
      },
      { anthropic, openai },
    );

    expect(result.success).toBe(true);
    expect(anthropic.execute).not.toHaveBeenCalled();
    expect(openai.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        attempt: 1,
        isFallback: false,
        fallbackFrom: null,
        metadata: {
          engineType: "copilot",
          dealRoomId: "deal_456",
          promptKey: "classifier",
          promptVersion: "v-openai",
        },
      }),
    );
  });

  it("returns a combined failure when both providers fail", async () => {
    const anthropic = mockProvider("anthropic", async () => {
      throw new Error("503 upstream");
    });
    const openai = mockProvider("openai", async () => {
      throw new Error("timeout");
    });

    const result = await gateway(request, { anthropic, openai });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("all_providers_failed");
      expect(result.error.message).toContain("Primary (anthropic)");
      expect(result.error.message).toContain("Fallback (openai)");
    }
  });
});

describe("gateway observability", () => {
  it("aggregates cost, latency, and fallback by engine and deal room", () => {
    const observations = [
      observeGatewayResult(
        {
          engineType: "pricing",
          dealRoomId: "deal_a",
          messages: [],
        },
        {
          success: true,
          data: {
            content: "{}",
            usage: {
              inputTokens: 100,
              outputTokens: 25,
              model: "claude-sonnet-4-20250514",
              provider: "anthropic",
              latencyMs: 150,
              estimatedCost: 0.004,
              fallbackUsed: false,
            },
          },
        },
      ),
      observeGatewayResult(
        {
          engineType: "pricing",
          dealRoomId: "deal_a",
          messages: [],
        },
        {
          success: true,
          data: {
            content: "{}",
            usage: {
              inputTokens: 120,
              outputTokens: 30,
              model: "gpt-4o",
              provider: "openai",
              latencyMs: 200,
              estimatedCost: 0.005,
              fallbackUsed: true,
            },
          },
        },
      ),
      observeGatewayResult(
        {
          engineType: "copilot",
          dealRoomId: "deal_b",
          messages: [],
        },
        {
          success: false,
          error: {
            code: "provider_error",
            message: "boom",
            provider: "anthropic",
          },
        },
      ),
    ];

    expect(summarizeGatewayObservationsByEngine(observations)).toEqual([
      expect.objectContaining({
        key: "copilot",
        requestCount: 1,
        successCount: 0,
        errorCount: 1,
        totalEstimatedCost: 0,
      }),
      expect.objectContaining({
        key: "pricing",
        requestCount: 2,
        successCount: 2,
        fallbackCount: 1,
        totalEstimatedCost: 0.009000000000000001,
        totalInputTokens: 220,
        totalOutputTokens: 55,
      }),
    ]);

    expect(summarizeGatewayObservationsByDealRoom(observations)).toEqual([
      expect.objectContaining({
        key: "deal_a",
        requestCount: 2,
        successCount: 2,
        fallbackCount: 1,
      }),
      expect.objectContaining({
        key: "deal_b",
        requestCount: 1,
        successCount: 0,
        errorCount: 1,
      }),
    ]);
  });
});
