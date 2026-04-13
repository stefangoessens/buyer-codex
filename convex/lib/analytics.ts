import type {
  AnalyticsEventMap,
  AnalyticsEventName,
} from "../../packages/shared/src/analytics-events";

export async function trackPosthogEvent<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
  distinctId: string,
): Promise<boolean> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const apiHost =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${apiHost.replace(/\/$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          analytics_transport: "server",
          app_service: "buyer-codex-convex",
          app_environment:
            process.env.CONVEX_ENVIRONMENT ?? process.env.NODE_ENV ?? "unknown",
          app_release:
            process.env.SENTRY_RELEASE ??
            process.env.RAILWAY_GIT_COMMIT_SHA ??
            process.env.SOURCE_VERSION ??
            "0.0.0",
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
