import React from "react";
import { PropertyCard } from "@/components/product/PropertyCard";
import { type DashboardDealRow } from "@/lib/dashboard/deal-index";
import { formatDealRoomActivity } from "@/lib/dealroom/dashboard-types";

interface DealRoomCardProps {
  row: DashboardDealRow;
  now: string;
}

export function DealRoomCard({ row, now }: DealRoomCardProps) {
  return (
    <PropertyCard
      href={`/dealroom/${row.dealRoomId}`}
      eyebrow={projectStatusLabel(row)}
      address={row.addressLine}
      detail={row.detailState !== "complete" ? describeDetailState(row) : undefined}
      price={row.listPrice}
      beds={row.beds}
      baths={row.baths}
      sqft={row.sqft}
      score={row.score}
      imageUrl={row.primaryPhotoUrl}
      activityLabel={formatDealRoomActivity(row.updatedAt, now)}
    />
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
