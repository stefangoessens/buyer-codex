import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/product/ScoreBadge";
import { type DashboardDealRow } from "@/lib/dashboard/deal-index";
import { formatDealRoomActivity } from "@/lib/dealroom/dashboard-types";

interface DealRoomCardProps {
  row: DashboardDealRow;
  now: string;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

export function DealRoomCard({ row, now }: DealRoomCardProps) {
  const statusLabel = projectStatusLabel(row);

  return (
    <Link
      href={`/dealroom/${row.dealRoomId}/offer`}
      className="group block"
    >
      <Card className="h-full overflow-hidden p-0 transition-all hover:border-primary-300 hover:shadow-md">
        <div className="relative aspect-video bg-neutral-100">
          {row.primaryPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.primaryPhotoUrl}
              alt={row.addressLine}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-neutral-100 px-4 text-center text-xs text-neutral-400">
              {row.detailState === "loading"
                ? "Property photo loading"
                : "Photo unavailable"}
            </div>
          )}
          {row.score !== null && (
            <div className="absolute right-3 top-3">
              <ScoreBadge score={row.score} maxScore={10} size="sm" />
            </div>
          )}
        </div>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              {statusLabel}
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-neutral-900">
              {row.addressLine}
            </p>
            {row.detailState !== "complete" && (
              <p className="mt-1 text-xs text-neutral-500">
                {describeDetailState(row)}
              </p>
            )}
          </div>
          <p className="text-lg font-bold text-primary-700">
            {row.listPrice === null
              ? "Price pending"
              : currencyFormatter.format(row.listPrice)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>{formatMetric(row.beds, "bd", false)}</span>
            <span className="text-neutral-300">·</span>
            <span>{formatMetric(row.baths, "ba", true)}</span>
            <span className="text-neutral-300">·</span>
            <span>{formatSqft(row.sqft)}</span>
          </div>
          <p className="text-xs text-neutral-400">
            {formatDealRoomActivity(row.updatedAt, now)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function projectStatusLabel(row: DashboardDealRow): string {
  switch (row.status) {
    case "closed":
      return "Closed";
    case "withdrawn":
      return "Withdrawn";
    case "under_contract":
      return "Under contract";
    case "closing":
      return "Closing";
    case "offer_prep":
      return "Offer prep";
    case "offer_sent":
      return "Offer sent";
    case "tour_scheduled":
      return "Tour scheduled";
    case "intake":
      return "Intake";
    case "analysis":
      return "Analysis";
  }
}

function describeDetailState(row: DashboardDealRow): string {
  if (row.detailState === "loading") {
    return "Property details are still loading.";
  }

  return `Missing ${row.missingFields.map(formatMissingFieldLabel).join(", ")}.`;
}

function formatMissingFieldLabel(field: DashboardDealRow["missingFields"][number]): string {
  switch (field) {
    case "listPrice":
      return "price";
    case "beds":
      return "beds";
    case "baths":
      return "baths";
    case "sqft":
      return "sqft";
    case "primaryPhoto":
      return "photo";
  }
}

function formatMetric(
  value: number | null,
  suffix: string,
  allowFraction: boolean,
): string {
  if (value === null) {
    return `${suffix} pending`;
  }

  const formatted = allowFraction ? String(value) : numberFormatter.format(value);
  return `${formatted} ${suffix}`;
}

function formatSqft(value: number | null): string {
  if (value === null) return "sqft pending";
  return `${numberFormatter.format(value)} sqft`;
}
