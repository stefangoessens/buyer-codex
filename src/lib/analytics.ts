import posthog from "posthog-js";
import {
  ANALYTICS_EVENT_CONTRACT,
  EVENT_METADATA,
  type AnalyticsEvent,
  type AnalyticsEventCategory as SharedAnalyticsEventCategory,
  type AnalyticsEventMap,
  type AnalyticsEventMetadata as SharedAnalyticsEventMetadata,
  type AnalyticsEventName,
} from "@/lib/analyticsEvents/contract";
import { resolveObservabilityContext } from "@/lib/observability";
import { deepScrubPii } from "@/lib/security/pii-guard";

/**
 * Canonical analytics event catalog for buyer-codex.
 *
 * The full shared contract now lives in
 * `@buyer-codex/shared/analytics-events` so web, backend, and iOS-adjacent
 * tooling consume the same event names, property shapes, and governance
 * metadata. This module keeps the browser-side `track()` helpers thin and
 * typed at the call site.
 */
export type EventCategory = SharedAnalyticsEventCategory;
export type EventMetadata = SharedAnalyticsEventMetadata;

export {
  ANALYTICS_EVENT_CONTRACT,
  EVENT_METADATA,
  type AnalyticsEvent,
  type AnalyticsEventMap,
  type AnalyticsEventName,
};

/**
 * Track an analytics event with typed properties. TypeScript enforces
 * that the properties shape matches the shared contract entry for the
 * event. PII stripping still runs on non-piiSafe events before dispatch.
 */
export function track<K extends AnalyticsEventName>(
  event: K,
  properties: AnalyticsEventMap[K],
): void {
  const metadata = EVENT_METADATA[event];
  const context = resolveObservabilityContext({
    defaultService: "buyer-codex-web",
  });
  const safeProps =
    metadata && !metadata.piiSafe
      ? (deepScrubPii(
          properties as unknown as Record<string, unknown>,
        ) as AnalyticsEventMap[K])
      : properties;
  const payload = {
    ...safeProps,
    analytics_transport: "client",
    app_environment: context.environment,
    app_release: context.release,
    app_service: context.service,
    app_deployment: context.deployment,
  } satisfies Record<string, unknown>;

  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(event, payload);
  }

  if (process.env.NODE_ENV === "development") {
    console.log(`[analytics] ${event}`, payload);
  }
}

/**
 * Track a funnel step with funnel name and position metadata. Adds
 * funnel_name and step_number to the event properties without changing
 * the underlying event contract.
 */
export function trackFunnelStep<K extends AnalyticsEventName>(
  event: K,
  funnelName: string,
  stepNumber: number,
  properties: AnalyticsEventMap[K],
): void {
  track(event, {
    ...properties,
    funnel_name: funnelName,
    step_number: stepNumber,
  } as AnalyticsEventMap[K]);
}

/** Return all event names for a given category. Useful for catalog tooling. */
export function listEventsByCategory(
  category: EventCategory,
): AnalyticsEventName[] {
  return Object.entries(ANALYTICS_EVENT_CONTRACT.events)
    .filter(([, event]) => event.category === category)
    .map(([name]) => name as AnalyticsEventName);
}
