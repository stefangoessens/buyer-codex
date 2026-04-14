import { describe, expect, it } from "vitest";
import {
  createGatewayProviderError,
  estimateCost,
  isGatewayProviderError,
  normalizeProviderError,
} from "@/lib/ai/providers";

describe("estimateCost", () => {
  it("uses model-specific pricing when available", () => {
    expect(estimateCost("gpt-4o", 1_000, 500)).toBe(0.0075);
  });

  it("falls back to the default pricing table for unknown models", () => {
    expect(estimateCost("custom-model", 1_000, 500)).toBe(0.0125);
  });
});

describe("normalizeProviderError", () => {
  it("maps 429 responses into retryable rate-limit failures", () => {
    const error = normalizeProviderError("openai", {
      message: "Too many requests",
      status: 429,
    });

    expect(error.code).toBe("rate_limit");
    expect(error.provider).toBe("openai");
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBe(429);
  });

  it("maps timeout-style failures into retryable timeout errors", () => {
    const error = normalizeProviderError(
      "anthropic",
      new Error("request timed out upstream"),
    );

    expect(error.code).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("passes through already-normalized provider errors", () => {
    const original = createGatewayProviderError({
      provider: "anthropic",
      code: "provider_error",
      message: "bad request payload",
      retryable: false,
      statusCode: 400,
    });

    const error = normalizeProviderError("anthropic", original);

    expect(error).toBe(original);
    expect(isGatewayProviderError(error)).toBe(true);
  });
});
