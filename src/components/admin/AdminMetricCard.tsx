import { type ReactNode } from "react";
import { KPICard } from "@/components/product/KPICard";

interface AdminMetricCardProps {
  label: string;
  value: ReactNode;
  delta?: {
    direction: "up" | "down" | "flat";
    text: string;
  };
  helper?: string;
  tone?: "default" | "warning" | "error";
}

/**
 * Reusable metric tile for the console overview and KPI dashboard stubs.
 * Keeps the card size + type scale consistent across routes.
 */
export function AdminMetricCard({
  label,
  value,
  delta,
  helper,
  tone = "default",
}: AdminMetricCardProps) {
  return (
    <KPICard
      label={label}
      value={value}
      description={helper}
      tone={tone === "warning" ? "warning" : tone === "error" ? "error" : "default"}
      trend={delta ? { direction: delta.direction, text: delta.text } : undefined}
    />
  );
}
