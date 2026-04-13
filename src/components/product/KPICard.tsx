import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: ReactNode;
  trend?: {
    direction: "up" | "down" | "flat";
    percentage?: number;
    text?: string;
  };
  description?: string;
  tone?: "default" | "primary" | "warning" | "error";
  density?: "default" | "compact";
}

const trendConfig = {
  up: { symbol: "\u2191", className: "text-success-500" },
  down: { symbol: "\u2193", className: "text-error-500" },
  flat: { symbol: "\u2192", className: "text-neutral-400" },
} as const;

const toneClasses = {
  default: "border-neutral-200/80 bg-white",
  primary: "border-primary-100 bg-white",
  warning: "border-warning-100 bg-white",
  error: "border-error-100 bg-white",
} as const;

export function KPICard({
  label,
  value,
  trend,
  description,
  tone = "default",
  density = "default",
}: KPICardProps) {
  const trendLabel =
    trend?.text ??
    (trend?.percentage != null ? `${trend.percentage}%` : undefined);

  return (
    <Card
      className={cn(
        "gap-3 rounded-[22px] shadow-[0_12px_28px_-24px_rgba(3,14,29,0.08)]",
        toneClasses[tone],
      )}
    >
      <CardContent className={cn(density === "compact" ? "p-4" : "p-6")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 font-semibold tracking-[-0.04em] text-neutral-900",
            density === "compact" ? "text-2xl" : "text-3xl",
          )}
        >
          {value}
        </p>
        {trend && trendLabel ? (
          <p
            className={cn("mt-2 text-sm font-medium", trendConfig[trend.direction].className)}
          >
            {trendConfig[trend.direction].symbol} {trendLabel}
          </p>
        ) : null}
        {description && (
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
