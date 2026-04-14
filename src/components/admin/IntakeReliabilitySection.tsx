"use client";

import { KpiMetricTile } from "./KpiMetricTile";
import {
  formatIntakeReliabilityDuration,
  formatIntakeReliabilityPercent,
  getCoverageStatusBadge,
  type IntakeReliabilityReportResponse,
} from "@/lib/admin/kpiDashboard";

interface IntakeReliabilitySectionProps {
  report: IntakeReliabilityReportResponse;
}

export function IntakeReliabilitySection({
  report,
}: IntakeReliabilitySectionProps) {
  return (
    <section className="mt-10 space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
          Intake reliability
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
          Source-by-source coverage for the front door. This report keeps
          Zillow, Redfin, Realtor.com, manual address, and any future sources
          visible alongside failure modes and recovery pressure.
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
            value: report.totals.totalAttempts,
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
            value: report.totals.retryableFailureCount,
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
            value: report.totals.medianTimeToTeaserMs,
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
            description:
              "Median time from intake submission to dossier-ready state.",
            direction: "lower_better",
          }}
          value={{
            key: "intake.median_dossier",
            label: "P50 dossier",
            value: report.totals.medianTimeToDossierMs,
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
            {report.sources.map((source) => {
              const badge = getCoverageStatusBadge(source.coverageStatus);
              return (
                <tr key={source.sourcePlatform}>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {source.sourceLabel}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {source.totalAttempts}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatIntakeReliabilityPercent(source.usableRate)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatIntakeReliabilityPercent(source.failureRate)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatIntakeReliabilityPercent(source.partialRate)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatIntakeReliabilityDuration(
                      source.medianTimeToTeaserMs,
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatIntakeReliabilityDuration(
                      source.medianTimeToDossierMs,
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Failure modes
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.failureModes.length > 0 ? (
            report.failureModes.map((mode) => (
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
  );
}
