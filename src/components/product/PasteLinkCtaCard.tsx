"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PasteLinkCtaCardProps {
  eyebrow: string;
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  surface?: "marketing" | "product";
  className?: string;
}

export function PasteLinkCtaCard({
  eyebrow,
  title,
  description,
  controls,
  children,
  footer,
  surface = "product",
  className,
}: PasteLinkCtaCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-neutral-200/90 px-6 py-6 shadow-[0_20px_60px_-36px_rgba(5,45,91,0.45)] sm:px-8 sm:py-8",
        surface === "marketing"
          ? "bg-[linear-gradient(135deg,rgba(229,241,255,0.94),rgba(255,255,255,0.98)_48%,rgba(230,251,248,0.96))]"
          : "bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(245,249,255,0.98)_52%,rgba(230,251,248,0.8))]",
        className,
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
            {eyebrow}
          </p>
          <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.02em] text-neutral-900 sm:text-[30px] sm:leading-[1.15]">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
            {description}
          </p>
        </div>

        {controls ? <div>{controls}</div> : null}

        <div>{children}</div>

        {footer ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-500">
            {footer}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
