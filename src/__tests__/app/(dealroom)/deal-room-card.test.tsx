import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DealRoomCard } from "@/components/dealroom/DealRoomCard";
import type { DashboardDealRow } from "@/lib/dashboard/deal-index";

const baseRow: DashboardDealRow = {
  dealRoomId: "deal_123",
  propertyId: "prop_123",
  category: "active",
  status: "analysis",
  urgencyRank: 5,
  addressLine: "123 Main St, Miami, FL 33131",
  listPrice: 650000,
  beds: 2,
  baths: 2,
  sqft: 1200,
  primaryPhotoUrl: "https://cdn.example.com/photo.jpg",
  score: 7.4,
  scoreSource: "offer_competitiveness",
  accessLevel: "registered",
  updatedAt: "2026-04-01T00:00:00.000Z",
  detailState: "complete",
  missingFields: [],
};

describe("DealRoomCard", () => {
  it("renders the shared score badge and last activity copy", () => {
    const html = renderToStaticMarkup(
      <DealRoomCard row={baseRow} now="2026-04-03T00:00:00.000Z" />,
    );

    expect(html).toContain("7.4");
    expect(html).toContain("/ 10");
    expect(html).toContain("2 days ago");
    expect(html).toContain("Analysis");
  });

  it("omits the score badge when no score is available", () => {
    const html = renderToStaticMarkup(
      <DealRoomCard
        row={{ ...baseRow, score: null, scoreSource: null }}
        now="2026-04-03T00:00:00.000Z"
      />,
    );

    expect(html).not.toContain("/ 10");
  });
});
