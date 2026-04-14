import { hasValue, readEnv, validateEnv, webPublicEnvSpec } from "@buyer-codex/shared";

type EnvSource = Record<string, string | undefined>;

/**
 * Typed public environment variables.
 * These are embedded in the client bundle by Next.js and safe for browser use.
 */
export function readPublicEnv(source: EnvSource = process.env) {
  return readEnv(webPublicEnvSpec, source);
}

export function getPublicEnvIssues(source: EnvSource = process.env) {
  return validateEnv(webPublicEnvSpec, source);
}

export const env = readPublicEnv();

/** Check if a specific integration is configured */
export const isConfigured = {
  convex: () => hasValue(env.NEXT_PUBLIC_CONVEX_URL),
  auth: () =>
    hasValue(env.NEXT_PUBLIC_CONVEX_URL) &&
    hasValue(env.NEXT_PUBLIC_CONVEX_SITE_URL) &&
    hasValue(env.NEXT_PUBLIC_SITE_URL),
  posthog: () => hasValue(env.NEXT_PUBLIC_POSTHOG_KEY),
  sentry: () => hasValue(env.NEXT_PUBLIC_SENTRY_DSN),
} as const;
