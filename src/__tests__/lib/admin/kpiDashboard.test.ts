import { describe, expect, it } from "vitest";
import {
  buildDashboardSections,
  getCoverageStatusBadge,
  type DashboardResponse,
} from "@/lib/admin/kpiDashboard";

function makeDashboard(
  overrides: Partial<DashboardResponse> = {},
): DashboardResponse {
  return {
    range: { start: "2026-04-01", end: "2026-04-30" },
    previousRange: { start: "2026-03-01", end: "2026-03-31" },
    latestSnapshotAt: "2026-04-13T12:00:00.000Z",
    metrics: [
      {
        key: "funnel.visits",
        label: "Unique visits",
        category: "funnel",
        unit: "count",
        direction: "higher_better",
        value: 42,
        previousValue: 30,
        source: "snapshot",
      },
      {
        key: "ops.queue_items_resolved",
        label: "Queue items resolved",
        category: "ops",
        unit: "count",
        direction: "higher_better",
        value: 7,
        previousValue: 4,
        source: "computed",
      },
    ],
    ...overrides,
  };
}

describe("admin/kpiDashboard", () => {
  it("builds sections in catalog order", () => {
    const sections = buildDashboardSections(makeDashboard());
    expect(sections.map((section) => section.category)).toEqual([
      "funnel",
      "engagement",
      "ops",
      "ai",
    ]);
  });

  it("fills in unavailable metrics that are missing from the backend payload", () => {
    const sections = buildDashboardSections(makeDashboard());
    const engagement = sections.find((section) => section.category === "engagement");
    expect(engagement).toBeDefined();
    expect(
      engagement?.metrics.every((metric) => metric.source === "unavailable"),
    ).toBe(true);
  });

  it("preserves backend values for declared metrics", () => {
    const sections = buildDashboardSections(makeDashboard());
    const funnelVisits = sections
      .flatMap((section) => section.metrics)
      .find((metric) => metric.key === "funnel.visits");
    expect(funnelVisits).toMatchObject({
      value: 42,
      previousValue: 30,
      source: "snapshot",
    });
  });

  it("returns coverage badge copy for each intake reliability state", () => {
    expect(getCoverageStatusBadge("healthy")).toEqual({
      className: "bg-emerald-50 text-emerald-700",
      label: "Healthy",
    });
    expect(getCoverageStatusBadge("needs_attention")).toEqual({
      className: "bg-amber-50 text-amber-700",
      label: "Needs attention",
    });
    expect(getCoverageStatusBadge("missing")).toEqual({
      className: "bg-neutral-100 text-neutral-600",
      label: "No volume",
    });
  });
});
