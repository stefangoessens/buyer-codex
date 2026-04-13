"use client";

import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/admin/AdminShell";
import { formatConsoleTimestamp } from "@/lib/admin/format";
import {
  getIntelligenceOverviewReference,
  type AlertStatus,
  type IntelligenceOverview,
} from "@/lib/intelligence/api";

export default function IntelligenceMonitoringPage() {
  const overview = useQuery(getIntelligenceOverviewReference, {
    windowDays: 30,
    propertyLimit: 12,
  }) as IntelligenceOverview | undefined;

  return (
    <AdminShell>
      <div className="space-y-8">
        <AdminPageHeader
          eyebrow="Intelligence"
          title="Quality and drift monitor"
          description="Typed monitoring for deterministic intake, Browser Use recovery, dossier completeness, source conflicts, and freshness."
        />

        {overview === undefined ? (
          <AdminEmptyState
            title="Loading intelligence monitor…"
            description="Aggregating extraction health, completeness, and drift signals."
          />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <SummaryCard
                label="Deterministic success"
                value={formatPercent(overview.summary.deterministicSuccessRate)}
                hint={`${overview.window.days}-day window`}
              />
              <SummaryCard
                label="Dossier completeness"
                value={formatPercent(overview.summary.overallCompletenessScore)}
                hint={`${overview.summary.propertiesReviewed} dossiers reviewed`}
              />
              <SummaryCard
                label="Parser/schema drift"
                value={formatPercent(overview.summary.parserSchemaRate)}
                hint="Worst active drift indicator"
              />
              <SummaryCard
                label="Cross-source conflict"
                value={formatPercent(overview.summary.crossSourceConflictRate)}
                hint="Highest pairwise disagreement"
              />
              <SummaryCard
                label="Stale or missing"
                value={formatPercent(overview.summary.staleOrMissingRate)}
                hint="Across monitored intelligence sources"
              />
              <SummaryCard
                label="Updated"
                value={formatConsoleTimestamp(overview.generatedAt)}
                hint={`Window start ${formatConsoleTimestamp(overview.window.start)}`}
              />
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900">Alert thresholds</h2>
                  <p className="text-sm text-neutral-500">
                    Material regressions are flagged off explicit review thresholds rather than ad hoc judgement.
                  </p>
                </div>
                <div className="text-xs text-neutral-500">
                  Window: {formatConsoleTimestamp(overview.window.start)} to{" "}
                  {formatConsoleTimestamp(overview.window.end)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {overview.alerts.map((alert) => (
                  <div
                    key={alert.key}
                    className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{alert.label}</p>
                        <p className="text-xs text-neutral-500">{alert.note}</p>
                      </div>
                      <StatusBadge status={alert.status} />
                    </div>
                    <div className="mt-3 text-sm text-neutral-700">
                      Current value:{" "}
                      <span className="font-medium">
                        {alert.value === null ? "Unavailable" : formatPercent(alert.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel
                title="Extraction health by source/path"
                description="Primary intake, Browser Use recovery, and aggregated enrichment sources stay separated so fallback success cannot hide primary-path decay."
              >
                <DataTable
                  columns={["Path", "Source", "Success", "Failure", "Pending", "Drift / failures"]}
                  rows={overview.extractionHealth.map((row) => [
                    formatPath(row.path),
                    row.source,
                    `${row.succeeded}/${row.total}`,
                    formatPercent(row.failureRate),
                    String(row.pending),
                    compactSignals(row.driftSignals, row.topFailureCodes),
                  ])}
                />
              </Panel>

              <Panel
                title="Parser/schema drift indicators"
                description="These indicators isolate structural degradation before it becomes a buyer-visible outage."
              >
                <DataTable
                  columns={["Indicator", "Count", "Window", "Rate"]}
                  rows={overview.driftIndicators.map((row) => [
                    row.label,
                    String(row.count),
                    String(row.denominator),
                    formatPercent(row.rate),
                  ])}
                />
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel
                title="Completeness by section"
                description="Section scores show where dossier coverage is thinning even when a property still technically resolves."
              >
                <DataTable
                  columns={["Section", "Average", "Below review", "Critical missing"]}
                  rows={overview.completeness.sections.map((section) => [
                    section.label,
                    formatPercent(section.averageScore),
                    String(section.propertiesBelowReviewThreshold),
                    formatPercent(section.criticalMissingRate),
                  ])}
                />
              </Panel>

              <Panel
                title="Freshness and staleness"
                description="Freshness is evaluated against the source TTLs already used by the enrichment scheduler."
              >
                <DataTable
                  columns={["Source", "TTL", "Fresh", "Stale", "Missing", "Gap rate"]}
                  rows={overview.freshness.map((row) => [
                    row.source,
                    `${row.ttlHours}h`,
                    String(row.fresh),
                    String(row.stale),
                    String(row.missing),
                    formatPercent(row.staleRate),
                  ])}
                />
              </Panel>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Panel
                title="Cross-source conflict rate"
                description="Conflict rate is measured pairwise across deterministic, Browser Use, and aggregated baseline inputs."
              >
                <DataTable
                  columns={["Comparison", "Rate", "Conflicts", "Comparable", "Sample fields"]}
                  rows={overview.conflicts.map((row) => [
                    row.label,
                    formatPercent(row.conflictRate),
                    String(row.conflictingFields),
                    String(row.comparableFields),
                    row.sampleFields.join(", ") || "None",
                  ])}
                />
              </Panel>

              <Panel
                title="Lowest-completeness dossiers"
                description="The bottom dossiers are where review or recovery work should start first."
              >
                <div className="space-y-3">
                  {overview.completeness.lowestProperties.map((property) => (
                    <div
                      key={property.propertyId}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {property.address}
                          </p>
                          <p className="text-xs text-neutral-500">
                            {property.canonicalId} · {property.sourcePlatform} · updated{" "}
                            {formatConsoleTimestamp(property.updatedAt)}
                          </p>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-medium text-neutral-900">
                          {formatPercent(property.overallScore)}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        {property.sectionsNeedingReview.map((section) => (
                          <span
                            key={section}
                            className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800"
                          >
                            {section}
                          </span>
                        ))}
                        {property.staleSources.map((source) => (
                          <span
                            key={source}
                            className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-800"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-neutral-900">{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-[0.16em] text-neutral-500">
            {columns.map((column) => (
              <th key={column} className="px-0 py-3 pr-4 font-semibold">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-neutral-100 last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${columns[cellIndex]}-${cellIndex}`}
                  className="px-0 py-3 pr-4 align-top text-neutral-700"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const styles: Record<AlertStatus, string> = {
    ok: "bg-emerald-100 text-emerald-800",
    warn: "bg-amber-100 text-amber-800",
    alert: "bg-rose-100 text-rose-800",
    unavailable: "bg-neutral-200 text-neutral-700",
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPath(
  path: "deterministic_intake" | "browser_use_hosted" | "aggregated_baseline",
): string {
  switch (path) {
    case "deterministic_intake":
      return "Deterministic intake";
    case "browser_use_hosted":
      return "Browser Use";
    case "aggregated_baseline":
      return "Aggregated baseline";
  }
}

function compactSignals(
  driftSignals: Array<{ code: string; count: number }>,
  failureCodes: Array<{ code: string; count: number }>,
): string {
  const pieces = [
    ...driftSignals.map((item) => `${item.code} ×${item.count}`),
    ...failureCodes.map((item) => `${item.code} ×${item.count}`),
  ];
  return pieces.length > 0 ? pieces.join(" · ") : "None";
}
