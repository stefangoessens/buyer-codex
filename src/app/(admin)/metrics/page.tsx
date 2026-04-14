"use client";

import { use, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { IntakeReliabilitySection } from "@/components/admin/IntakeReliabilitySection";
import { KpiDateRangePicker } from "@/components/admin/KpiDateRangePicker";
import { KpiMetricTile, type KpiMetricValue } from "@/components/admin/KpiMetricTile";
import {
  buildDashboardSections,
  type DashboardResponse,
  type IntakeReliabilityReportResponse,
} from "@/lib/admin/kpiDashboard";
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

  const sections = useMemo(
    () => (dashboard ? buildDashboardSections(dashboard) : null),
    [dashboard],
  );

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
          {sections
            ? sections.map((section) => (
                <section key={section.category} className="mb-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {section.metrics.map((metric) => (
                      <KpiMetricTile
                        key={metric.key}
                        metric={metric}
                        value={{
                          key: metric.key,
                          label: metric.label,
                          value: metric.value,
                          previousValue: metric.previousValue,
                          source: metric.source,
                        } as KpiMetricValue}
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
            <IntakeReliabilitySection report={intakeReliability} />
          ) : null}
        </>
      )}
    </>
  );
}
