import {
  KPI_CATEGORY_LABELS,
  groupCatalogByCategory,
  type KpiCategory,
} from "./kpiCatalog";

export interface DashboardMetricRow {
  key: string;
  label: string;
  category: KpiCategory;
  unit: string;
  direction: "higher_better" | "lower_better" | "neutral";
  value: number | null;
  previousValue: number | null;
  source: "snapshot" | "computed" | "unavailable";
}

export interface DashboardResponse {
  range: { start: string; end: string };
  previousRange: { start: string; end: string };
  metrics: DashboardMetricRow[];
  latestSnapshotAt: string | null;
}

export interface IntakeReliabilitySourceRow {
  sourcePlatform: string;
  sourceLabel: string;
  totalAttempts: number;
  readyCount: number;
  partialCount: number;
  failedCount: number;
  unsupportedCount: number;
  pendingCount: number;
  retryableFailureCount: number;
  usableRate: number | null;
  failureRate: number | null;
  partialRate: number | null;
  medianTimeToTeaserMs: number | null;
  medianTimeToDossierMs: number | null;
  coverageStatus: "healthy" | "needs_attention" | "missing";
}

export interface IntakeReliabilityReportResponse {
  totals: {
    totalAttempts: number;
    readyCount: number;
    partialCount: number;
    failedCount: number;
    unsupportedCount: number;
    pendingCount: number;
    retryableFailureCount: number;
    usableRate: number | null;
    failureRate: number | null;
    medianTimeToTeaserMs: number | null;
    medianTimeToDossierMs: number | null;
  };
  sources: IntakeReliabilitySourceRow[];
  failureModes: Array<{
    mode: string;
    count: number;
    retryableCount: number;
  }>;
}

export function buildDashboardSections(dashboard: DashboardResponse): Array<{
  category: KpiCategory;
  label: string;
  metrics: Array<{
    key: string;
    label: string;
    category: KpiCategory;
    description: string;
    unit: "count" | "percent" | "duration_ms" | "currency_usd";
    direction: "higher_better" | "lower_better" | "neutral";
    value: number | null;
    previousValue: number | null;
    source: "snapshot" | "computed" | "unavailable";
  }>;
}> {
  const index = new Map(dashboard.metrics.map((metric) => [metric.key, metric]));

  return groupCatalogByCategory().map((section) => ({
    category: section.category,
    label: KPI_CATEGORY_LABELS[section.category],
    metrics: section.metrics.map((def) => {
      const row = index.get(def.key);
      return {
        key: def.key,
        label: def.label,
        category: def.category,
        description: def.description,
        unit: def.unit,
        direction: def.direction,
        value: row?.value ?? null,
        previousValue: row?.previousValue ?? null,
        source: row?.source ?? "unavailable",
      };
    }),
  }));
}

export function formatIntakeReliabilityPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

export function formatIntakeReliabilityDuration(value: number | null): string {
  if (value === null) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export function getCoverageStatusBadge(
  status: IntakeReliabilitySourceRow["coverageStatus"],
): {
  className: string;
  label: string;
} {
  switch (status) {
    case "healthy":
      return {
        className: "bg-emerald-50 text-emerald-700",
        label: "Healthy",
      };
    case "missing":
      return {
        className: "bg-neutral-100 text-neutral-600",
        label: "No volume",
      };
    case "needs_attention":
      return {
        className: "bg-amber-50 text-amber-700",
        label: "Needs attention",
      };
  }
}
