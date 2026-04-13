import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { IntakeFailureState } from "@/components/onboarding/IntakeFailureState";
import { SourceListingRecoveryBanner } from "@/components/onboarding/SourceListingRecoveryBanner";

describe("IntakeFailureState", () => {
  it("renders unsupported URL recovery guidance with the manual fallback slot", () => {
    const html = renderToStaticMarkup(
      <IntakeFailureState
        code="unsupported_url"
        url="https://example.com/listing/123"
      >
        <div>Manual form placeholder</div>
      </IntakeFailureState>,
    );

    expect(html).toContain("This link needs a supported intake path");
    expect(html).toContain("Supported direct import: Zillow, Redfin, Realtor.com.");
    expect(html).toContain("Manual address entry");
    expect(html).toContain("Manual form placeholder");
  });
});

describe("SourceListingRecoveryBanner", () => {
  const baseResolutionId = "source_listing_123" as Id<"sourceListings">;

  it("renders partial extraction guidance with missing fields and a retry CTA", () => {
    const html = renderToStaticMarkup(
      <SourceListingRecoveryBanner
        resolution={{
          status: "source_listing_partial",
          sourceListingId: baseResolutionId,
          sourceListingStatus: "extracted",
          recoveryState: "partial_extraction",
          failureMode: "partial_extraction",
          retryable: true,
          missingFields: ["hoaFee", "taxAnnual"],
          propertyId: null,
        }}
        listingUrl="https://www.zillow.com/homedetails/123_zpid/"
        intakeHref="/intake?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F123_zpid%2F"
      />,
    );

    expect(html).toContain("Partial extraction");
    expect(html).toContain("hoaFee, taxAnnual");
    expect(html).toContain("Retry this listing");
    expect(html).toContain("/intake?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F123_zpid%2F");
  });

  it("renders parser failure recovery copy for retryable failed listings", () => {
    const html = renderToStaticMarkup(
      <SourceListingRecoveryBanner
        resolution={{
          status: "source_listing_failed",
          sourceListingId: baseResolutionId,
          sourceListingStatus: "failed",
          recoveryState: "parser_failed",
          failureMode: "parser_failed",
          retryable: true,
          missingFields: [],
          propertyId: null,
        }}
        listingUrl="https://www.redfin.com/FL/Miami/home/123456"
        intakeHref="/intake?url=https%3A%2F%2Fwww.redfin.com%2FFL%2FMiami%2Fhome%2F123456"
      />,
    );

    expect(html).toContain("Parser recovery failed");
    expect(html).toContain("Retry the listing or switch to manual address entry");
    expect(html).toContain("Retry intake");
  });
});
