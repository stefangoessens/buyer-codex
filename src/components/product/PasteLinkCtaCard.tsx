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
        "overflow-hidden rounded-[28px] border border-neutral-200/80 px-6 py-6 shadow-[0_16px_36px_-30px_rgba(3,14,29,0.09)] sm:px-8 sm:py-8",
        surface === "marketing" ? "bg-white" : "bg-white",
        className,
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-700">
            {eyebrow}
          </p>
          <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-[30px] sm:leading-[1.12]">
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
