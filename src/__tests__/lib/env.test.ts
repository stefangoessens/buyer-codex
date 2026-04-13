import {
  extractionServiceEnvSpec,
  requireEnvKeys,
  resolveDeploymentStage,
  validateEnv,
  webPublicEnvSpec,
  webServerEnvSpec,
} from "@buyer-codex/shared";
import { describe, expect, it } from "vitest";
import { getPublicEnvIssues, readPublicEnv } from "@/lib/env";

describe("environment contracts", () => {
  it("reads typed public env defaults", () => {
    const value = readPublicEnv({
      NEXT_PUBLIC_APP_URL: "https://buyer.example",
    });

    expect(value.NEXT_PUBLIC_APP_URL).toBe("https://buyer.example");
    expect(value.NEXT_PUBLIC_POSTHOG_HOST).toBe("https://us.i.posthog.com");
  });

  it("validates required public env keys", () => {
    const issues = validateEnv(webPublicEnvSpec, {
      NEXT_PUBLIC_APP_URL: "",
    });

    expect(issues).toContainEqual({
      key: "NEXT_PUBLIC_APP_URL",
      message: "NEXT_PUBLIC_APP_URL is required for development runtime.",
    });
  });

  it("reports a clean public env when required keys are present", () => {
    const issues = getPublicEnvIssues({
      NEXT_PUBLIC_APP_URL: "https://buyer.example",
    });

    expect(issues).toEqual([]);
  });

  it("rejects malformed URL-shaped env values", () => {
    const issues = validateEnv(webPublicEnvSpec, {
      NEXT_PUBLIC_APP_URL: "buyer.example",
    });

    expect(issues).toContainEqual({
      key: "NEXT_PUBLIC_APP_URL",
      message: "NEXT_PUBLIC_APP_URL must be a valid absolute URL.",
    });
  });

  it("requires server secrets when a server module asks for them", () => {
    expect(() =>
      requireEnvKeys(webServerEnvSpec, ["OPENAI_API_KEY"], {})
    ).toThrow("Missing required environment variables: OPENAI_API_KEY");
  });

  it("returns server secrets when present", () => {
    const value = requireEnvKeys(
      webServerEnvSpec,
      ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
      {
        ANTHROPIC_API_KEY: "anthropic_test",
        OPENAI_API_KEY: "openai_test",
      },
    );

    expect(value.ANTHROPIC_API_KEY).toBe("anthropic_test");
    expect(value.OPENAI_API_KEY).toBe("openai_test");
  });

  it("rejects unsupported buyer-codex stages", () => {
    const issues = validateEnv(webServerEnvSpec, {
      BUYER_CODEX_ENV: "qa",
    });

    expect(issues).toContainEqual({
      key: "BUYER_CODEX_ENV",
      message: "BUYER_CODEX_ENV must be one of: local, preview, staging, production.",
    });
  });

  it("documents extraction service env defaults through the shared config package", () => {
    const issues = validateEnv(extractionServiceEnvSpec, {
      BUYER_CODEX_ENV: "staging",
      CORS_ORIGINS: "https://web-staging.example",
    });

    expect(issues).toEqual([]);
  });

  it("prefers Railway environment metadata when resolving deployment stages", () => {
    expect(
      resolveDeploymentStage({
        BUYER_CODEX_ENV: "production",
        RAILWAY_ENVIRONMENT_NAME: "preview-pr-123",
      }),
    ).toBe("preview");

    expect(
      resolveDeploymentStage({
        BUYER_CODEX_ENV: "staging",
      }),
    ).toBe("staging");
  });
});
