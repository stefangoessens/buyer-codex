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
      eyebrow="Buyer-safe case"
      status={projectStatusTone(row)}
      statusLabel={projectStatusLabel(row)}
      address={row.addressLine}
      detail={describeToplineDetail(row)}
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

function projectStatusTone(row: DashboardDealRow): "active" | "pending" | "closed" | "urgent" | "draft" {
  switch (row.status) {
    case "offer_sent":
    case "closing":
      return "urgent";
    case "offer_prep":
    case "under_contract":
    case "tour_scheduled":
      return "pending";
    case "analysis":
      return "active";
    case "intake":
      return "draft";
    case "closed":
    case "withdrawn":
      return "closed";
  }
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

function describeToplineDetail(row: DashboardDealRow): string | undefined {
  if (row.detailState !== "complete") {
    return describeDetailState(row);
  }

  switch (row.status) {
    case "offer_sent":
      return "Offer delivered and waiting on seller response.";
    case "closing":
      return "Contract accepted and close tasks are in motion.";
    case "under_contract":
      return "Buyer-safe case is locked while contingencies progress.";
    case "offer_prep":
      return "Opening range, comps, and leverage are ready for review.";
    case "tour_scheduled":
      return "Tour timing is set and buyer-safe notes are queued.";
    case "analysis":
      return "Pricing and comparable evidence are still stacking.";
    case "intake":
      return "Importing listing context and building the first case.";
    case "closed":
      return "Closed successfully and archived for reference.";
    case "withdrawn":
      return "Paused or withdrawn from the active pipeline.";
  }
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
