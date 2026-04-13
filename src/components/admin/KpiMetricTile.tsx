import { KPICard } from "@/components/product/KPICard";
import { computeDelta, formatKpiValue } from "@/lib/admin/kpiFormat";
import type { KpiMetricDef } from "@/lib/admin/kpiCatalog";

export interface KpiMetricValue {
  key: string;
  label: string;
  value: number | null;
  previousValue: number | null;
  source: "snapshot" | "computed" | "unavailable";
}

interface KpiMetricTileProps {
  metric: KpiMetricDef;
  value: KpiMetricValue;
}

/**
 * Single metric tile for the KPI dashboard. Shows current value, delta
 * vs. previous range, and data source (snapshot vs. computed) so ops
 * can tell precomputed rollups from on-demand aggregates.
 */
export function KpiMetricTile({ metric, value }: KpiMetricTileProps) {
  const current = value.value;
  const delta = computeDelta(current, value.previousValue, metric.direction);
  const formatted = formatKpiValue(current, metric.unit);

  return (
    <KPICard
      label={metric.label}
      value={formatted}
      description={`${metric.description} · ${
        value.source === "snapshot"
          ? "Snapshot"
          : value.source === "computed"
            ? "Computed"
            : "No data"
      }`}
      tone={value.source === "unavailable" ? "warning" : "default"}
      trend={{
        direction: delta.direction,
        text: delta.text,
      }}
    />
  );
}
