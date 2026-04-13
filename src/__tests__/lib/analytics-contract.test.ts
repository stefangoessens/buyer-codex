import { describe, expect, it } from "vitest";
import {
  ANALYTICS_EVENT_CONTRACT,
  ANALYTICS_EVENT_CONTRACT_CHANGELOG,
  ANALYTICS_EVENT_NAMES,
  CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION,
  serializeAnalyticsEventContract,
} from "@/lib/analyticsEvents/contract";
import type { AnalyticsEventMap } from "@/lib/analytics";

describe("ANALYTICS_EVENT_CONTRACT", () => {
  it("has a semver version string", () => {
    expect(ANALYTICS_EVENT_CONTRACT.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("has an ISO-8601 lastUpdated date", () => {
    expect(ANALYTICS_EVENT_CONTRACT.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps the changelog head in sync with the exported current version", () => {
    const latest = ANALYTICS_EVENT_CONTRACT_CHANGELOG.at(-1);
    expect(latest?.version).toBe(CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION);
    expect(ANALYTICS_EVENT_CONTRACT.version).toBe(
      CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION,
    );
  });

  it("covers the required non-funnel surfaces plus launch events", () => {
    const categories = new Set(
      Object.values(ANALYTICS_EVENT_CONTRACT.events).map((event) => event.category),
    );
    expect(categories).toContain("funnel");
    expect(categories).toContain("dashboard");
    expect(categories).toContain("deal_room");
    expect(categories).toContain("documents");
    expect(categories).toContain("tour");
    expect(categories).toContain("offer");
    expect(categories).toContain("closing");
    expect(categories).toContain("communication");
    expect(categories).toContain("agent_ops");
  });

  it("every event has source, whenFired, semantics, and owner", () => {
    for (const event of Object.values(ANALYTICS_EVENT_CONTRACT.events)) {
      expect(event.source.length).toBeGreaterThan(0);
      expect(event.whenFired.length).toBeGreaterThan(0);
      expect(event.semantics.length).toBeGreaterThan(0);
      expect(event.owner.length).toBeGreaterThan(0);
    }
  });

  it("every event name matches its key", () => {
    for (const [key, event] of Object.entries(ANALYTICS_EVENT_CONTRACT.events)) {
      expect(event.name).toBe(key);
    }
  });

  it("ANALYTICS_EVENT_NAMES mirrors the events map", () => {
    const fromMap = new Set(Object.keys(ANALYTICS_EVENT_CONTRACT.events));
    expect(ANALYTICS_EVENT_NAMES.size).toBe(fromMap.size);
    for (const name of fromMap) {
      expect(ANALYTICS_EVENT_NAMES.has(name as keyof AnalyticsEventMap)).toBe(true);
    }
  });

  it("every contract event exists in AnalyticsEventMap", () => {
    for (const name of Object.keys(ANALYTICS_EVENT_CONTRACT.events)) {
      const sentinel: Partial<Record<keyof AnalyticsEventMap, true>> = {};
      sentinel[name as keyof AnalyticsEventMap] = true;
      expect(sentinel[name as keyof AnalyticsEventMap]).toBe(true);
    }
  });

  it("serializes a reviewable JSON snapshot with the current version", () => {
    const serialized = serializeAnalyticsEventContract();
    const parsed = JSON.parse(serialized) as typeof ANALYTICS_EVENT_CONTRACT;
    expect(parsed.version).toBe(ANALYTICS_EVENT_CONTRACT.version);
    expect(Object.keys(parsed.events)).toEqual(
      Object.keys(ANALYTICS_EVENT_CONTRACT.events),
    );
  });
});
