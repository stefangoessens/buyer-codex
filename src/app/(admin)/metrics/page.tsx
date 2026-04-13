"use client";

import { use, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { KpiDateRangePicker } from "@/components/admin/KpiDateRangePicker";
import { KpiMetricTile, type KpiMetricValue } from "@/components/admin/KpiMetricTile";
import {
  KPI_CATALOG,
  KPI_CATEGORIES,
  KPI_CATEGORY_LABELS,
  type KpiCategory,
  type KpiMetricDef,
} from "@/lib/admin/kpiCatalog";
import {
  formatRangeLabel,
  parseRangeFromSearchParams,
  type DateRange,
} from "@/lib/admin/dateRange";
import { formatConsoleTimestamp } from "@/lib/admin/format";

interface MetricsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default function MetricsIndexPage({ searchParams }: MetricsPageProps) {
  const resolved = use(searchParams);
  return (
    <AdminShell>
      <MetricsContent searchParams={resolved} />
    </AdminShell>
  );
}

interface MetricsContentProps {
  searchParams: Record<string, string | string[] | undefined>;
}

interface DashboardResponse {
  range: { start: string; end: string };
  previousRange: { start: string; end: string };
  metrics: Array<{
    key: string;
    label: string;
    category: KpiCategory;
    unit: string;
    direction: "higher_better" | "lower_better" | "neutral";
    value: number | null;
    previousValue: number | null;
    source: "snapshot" | "computed" | "unavailable";
  }>;
  latestSnapshotAt: string | null;
}

interface IntakeReliabilityReportResponse {
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
  sources: Array<{
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
  }>;
  failureModes: Array<{
    mode: string;
    count: number;
    retryableCount: number;
  }>;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatDurationMs(value: number | null): string {
  if (value === null) return "—";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

function MetricsContent({ searchParams }: MetricsContentProps) {
  // The client renders metric tiles from the backend payload only.
  // No metric math lives in this component.
  const range: DateRange = useMemo(
    () => parseRangeFromSearchParams(searchParams, new Date()),
    [searchParams],
  );

  const dashboard = useQuery(api.kpiDashboard.getDashboard, {
    range: { start: range.start, end: range.end },
  }) as DashboardResponse | undefined;
  const intakeReliability = useQuery(api.kpiDashboard.getIntakeReliabilityReport, {
    range: { start: range.start, end: range.end },
  }) as IntakeReliabilityReportResponse | undefined;

  const byCategory = useMemo(() => {
    if (!dashboard) return null;
    const index = new Map<string, (typeof dashboard.metrics)[number]>();
    for (const m of dashboard.metrics) index.set(m.key, m);
    return KPI_CATEGORIES.map((category) => ({
      category,
      label: KPI_CATEGORY_LABELS[category],
      metrics: KPI_CATALOG.filter((m: KpiMetricDef) => m.category === category).map(
        (def: KpiMetricDef) => {
          const row = index.get(def.key);
          const value: KpiMetricValue = row
            ? {
                key: row.key,
                label: row.label,
                value: row.value,
                previousValue: row.previousValue,
                source: row.source,
              }
            : {
                key: def.key,
                label: def.label,
                value: null,
                previousValue: null,
                source: "unavailable",
              };
          return { def, value };
        },
      ),
    }));
  }, [dashboard]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Metrics"
        title="KPI dashboard"
        description={
          dashboard
            ? `${formatRangeLabel(range)} — ${dashboard.metrics.length} metrics, all computed by the backend.`
            : "Backend-computed funnel, engagement, ops, and AI metrics."
        }
      />
      <KpiDateRangePicker range={range} />
      {dashboard === undefined ? (
        <AdminEmptyState
          title="Loading dashboard…"
          description="Aggregating funnel and ops metrics for the selected range."
        />
      ) : dashboard.metrics.length === 0 ? (
        <AdminEmptyState
          title="No metrics available"
          description="The catalog is empty. Check convex/kpiDashboard.ts."
        />
      ) : (
        <>
          {byCategory
            ? byCategory.map((section) => (
                <section key={section.category} className="mb-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {section.metrics.map(({ def, value }) => (
                      <KpiMetricTile
                        key={def.key}
                        metric={def}
                        value={value as KpiMetricValue}
                      />
                    ))}
                  </div>
                </section>
              ))
            : null}
          <div className="mt-4 text-xs text-neutral-500">
            Latest snapshot computed:{" "}
            {dashboard.latestSnapshotAt
              ? formatConsoleTimestamp(dashboard.latestSnapshotAt)
              : "No snapshots yet — all values computed on demand."}
          </div>

          {intakeReliability ? (
            <section className="mt-10 space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                  Intake reliability
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                  Source-by-source coverage for the front door. This report keeps
                  Zillow, Redfin, Realtor.com, manual address, and any future
                  sources visible alongside failure modes and recovery pressure.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiMetricTile
                  metric={{
                    key: "intake.total_attempts",
                    label: "Total intake attempts",
                    category: "funnel",
                    unit: "count",
                    description: "All tracked intake attempts in the selected range.",
                    direction: "higher_better",
                  }}
                  value={{
                    key: "intake.total_attempts",
                    label: "Total intake attempts",
                    value: intakeReliability.totals.totalAttempts,
                    previousValue: null,
                    source: "computed",
                  }}
                />
                <KpiMetricTile
                  metric={{
                    key: "intake.retryable_failures",
                    label: "Retryable failures",
                    category: "funnel",
                    unit: "count",
                    description: "Attempts that still have a recovery path.",
                    direction: "lower_better",
                  }}
                  value={{
                    key: "intake.retryable_failures",
                    label: "Retryable failures",
                    value: intakeReliability.totals.retryableFailureCount,
                    previousValue: null,
                    source: "computed",
                  }}
                />
                <KpiMetricTile
                  metric={{
                    key: "intake.median_teaser",
                    label: "P50 teaser",
                    category: "funnel",
                    unit: "duration_ms",
                    description: "Median time from intake submission to teaser.",
                    direction: "lower_better",
                  }}
                  value={{
                    key: "intake.median_teaser",
                    label: "P50 teaser",
                    value: intakeReliability.totals.medianTimeToTeaserMs,
                    previousValue: null,
                    source: "computed",
                  }}
                />
                <KpiMetricTile
                  metric={{
                    key: "intake.median_dossier",
                    label: "P50 dossier",
                    category: "funnel",
                    unit: "duration_ms",
                    description: "Median time from intake submission to dossier-ready state.",
                    direction: "lower_better",
                  }}
                  value={{
                    key: "intake.median_dossier",
                    label: "P50 dossier",
                    value: intakeReliability.totals.medianTimeToDossierMs,
                    previousValue: null,
                    source: "computed",
                  }}
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3">Attempts</th>
                      <th className="px-4 py-3">Usable</th>
                      <th className="px-4 py-3">Failure</th>
                      <th className="px-4 py-3">Partial</th>
                      <th className="px-4 py-3">P50 teaser</th>
                      <th className="px-4 py-3">P50 dossier</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {intakeReliability.sources.map((source) => (
                      <tr key={source.sourcePlatform}>
                        <td className="px-4 py-3 font-medium text-neutral-900">
                          {source.sourceLabel}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {source.totalAttempts}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {formatPercent(source.usableRate)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {formatPercent(source.failureRate)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {formatPercent(source.partialRate)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {formatDurationMs(source.medianTimeToTeaserMs)}
                        </td>
                        <td className="px-4 py-3 text-neutral-600">
                          {formatDurationMs(source.medianTimeToDossierMs)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              source.coverageStatus === "healthy"
                                ? "bg-emerald-50 text-emerald-700"
                                : source.coverageStatus === "missing"
                                  ? "bg-neutral-100 text-neutral-600"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {source.coverageStatus === "healthy"
                              ? "Healthy"
                              : source.coverageStatus === "missing"
                                ? "No volume"
                                : "Needs attention"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Failure modes
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {intakeReliability.failureModes.length > 0 ? (
                    intakeReliability.failureModes.map((mode) => (
                      <span
                        key={mode.mode}
                        className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700"
                      >
                        {mode.mode}: {mode.count}
                        {mode.retryableCount > 0
                          ? ` · ${mode.retryableCount} retryable`
                          : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500">
                      No failure modes recorded in this range.
                    </span>
                  )}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
