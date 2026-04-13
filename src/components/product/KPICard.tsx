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
  default: "border-neutral-200 bg-white",
  primary: "border-primary-200 bg-primary-50/45",
  warning: "border-warning-200 bg-warning-50/65",
  error: "border-error-200 bg-error-50/60",
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
    <Card className={cn("gap-3", toneClasses[tone])}>
      <CardContent className={cn(density === "compact" ? "p-4" : "p-6")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 font-semibold tracking-[-0.03em] text-neutral-900",
            density === "compact" ? "text-2xl" : "text-3xl",
          )}
        >
          {value}
        </p>
        {trend && trendLabel ? (
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              trendConfig[trend.direction].className,
            )}
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
