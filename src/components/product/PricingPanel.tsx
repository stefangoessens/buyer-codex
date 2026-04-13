import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PricingPanelProps {
  eyebrow?: string;
  title: string;
  value?: ReactNode;
  description?: string;
  highlights?: readonly ReactNode[];
  footer?: ReactNode;
  tone?: "default" | "emphasis";
  className?: string;
}

export function PricingPanel({
  eyebrow,
  title,
  value,
  description,
  highlights,
  footer,
  tone = "default",
  className,
}: PricingPanelProps) {
  return (
    <Card
      className={cn(
        "border-neutral-200 shadow-md",
        tone === "emphasis" && "bg-[linear-gradient(160deg,rgba(5,45,91,0.04),rgba(255,255,255,0.98)_42%,rgba(230,251,248,0.7))]",
        className,
      )}
    >
      <CardHeader className="gap-3">
        {eyebrow ? (
          <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
            {eyebrow}
          </CardDescription>
        ) : null}
        <CardTitle className="text-base font-semibold text-neutral-900">
          {title}
        </CardTitle>
        {value ? (
          <div className="text-3xl font-semibold tracking-tight text-neutral-900">
            {value}
          </div>
        ) : null}
        {description ? (
          <CardDescription className="text-sm leading-6 text-neutral-600">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      {highlights?.length || footer ? (
        <CardContent className="space-y-4">
          {highlights?.length ? (
            <div className="space-y-2">
              {highlights.map((highlight, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-700"
                >
                  {highlight}
                </div>
              ))}
            </div>
          ) : null}
          {footer}
        </CardContent>
      ) : null}
    </Card>
  );
}
