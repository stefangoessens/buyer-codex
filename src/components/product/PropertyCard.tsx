import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "./ScoreBadge";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface PropertyCardProps {
  address: string;
  city?: string;
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  score?: number | null;
  imageUrl?: string | null;
  status?: "active" | "pending" | "closed" | "urgent" | "draft";
  statusLabel?: string;
  eyebrow?: string;
  detail?: string;
  activityLabel?: string;
  href?: string;
}

function formatPrice(price: number | null | undefined) {
  if (price == null) {
    return "Price pending";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(n: number | null | undefined) {
  if (n == null) {
    return null;
  }

  return new Intl.NumberFormat("en-US").format(n);
}

function Metric({
  value,
  suffix,
}: {
  value: number | null | undefined;
  suffix: string;
}) {
  if (value == null) {
    return <span className="text-neutral-400">{suffix} pending</span>;
  }

  return (
    <span>
      {formatNumber(value)} {suffix}
    </span>
  );
}

export function PropertyCard({
  address,
  city,
  price,
  beds,
  baths,
  sqft,
  score,
  imageUrl,
  status,
  statusLabel,
  eyebrow,
  detail,
  activityLabel,
  href,
}: PropertyCardProps) {
  const content = (
    <Card className="overflow-hidden rounded-[24px] border-neutral-200/80 bg-white p-0 shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
      <div className="relative aspect-video bg-neutral-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={address}
            className={cn(
              "h-full w-full object-cover transition-transform",
              href && "group-hover:scale-[1.03]",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-neutral-400">
            Photo unavailable
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-neutral-950/22 via-neutral-950/6 to-transparent" />
        {score != null && (
          <div className="absolute top-3 right-3">
            <ScoreBadge score={score} maxScore={10} size="sm" />
          </div>
        )}
      </div>
      <CardContent className="space-y-3.5 p-4">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {eyebrow}
            </p>
          ) : null}
          <p className="line-clamp-2 text-base font-semibold tracking-[-0.03em] text-neutral-900">
            {address}
          </p>
          {(city || detail) ? (
            <p className="text-sm leading-6 text-neutral-500">
              {city}
              {city && detail ? " · " : ""}
              {detail}
            </p>
          ) : null}
        </div>
        <p className="text-[28px] font-semibold tracking-[-0.05em] text-neutral-900">
          {formatPrice(price)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
          <Metric value={beds} suffix="bd" />
          <span className="text-neutral-300">·</span>
          <Metric value={baths} suffix="ba" />
          <span className="text-neutral-300">·</span>
          <Metric value={sqft} suffix="sqft" />
        </div>
        {(status || activityLabel) && (
          <div
            className={cn(
              "flex flex-wrap items-center gap-3 pt-1",
              status && activityLabel ? "justify-between" : "justify-start",
            )}
          >
            {status ? <StatusBadge status={status} label={statusLabel} /> : null}
            {activityLabel ? (
              <p className="text-xs text-neutral-400">{activityLabel}</p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {content}
      </Link>
    );
  }

  return content;
}
