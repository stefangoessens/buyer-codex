import { describe, expect, it } from "vitest";
import {
  createBuyerOnboardingDraft,
  reviveBuyerOnboardingDraft,
  setBuyerOnboardingAuthState,
  setBuyerOnboardingPropertyStatus,
  validateBuyerOnboardingBasics,
} from "@/lib/onboarding/state";

describe("buyer onboarding state", () => {
  it("moves authenticated drafts into the buyer basics stage", () => {
    const draft = createBuyerOnboardingDraft({
      listingUrl: "https://www.zillow.com/homedetails/example_zpid/",
    });

    const updated = setBuyerOnboardingAuthState(draft, "authenticated");

    expect(updated.authStatus).toBe("authenticated");
    expect(updated.stage).toBe("buyer_basics");
    expect(updated.listingUrl).toBe(draft.listingUrl);
  });

  it("marks the draft completed once the first deal room is ready", () => {
    const draft = createBuyerOnboardingDraft({
      listingUrl: "https://www.redfin.com/FL/Miami/home/example",
    });

    const updated = setBuyerOnboardingPropertyStatus(draft, {
      status: "deal_room_ready",
      propertyId: "prop_123",
      dealRoomId: "deal_123",
    });

    expect(updated.stage).toBe("completed");
    expect(updated.completedAt).toBeTruthy();
    expect(updated.property).toEqual({
      status: "deal_room_ready",
      propertyId: "prop_123",
      dealRoomId: "deal_123",
    });
  });

  it("returns machine-readable validation errors and a typed payload", () => {
    const invalidDraft = createBuyerOnboardingDraft({
      listingUrl: "https://www.realtor.com/example",
    });

    expect(validateBuyerOnboardingBasics(invalidDraft)).toEqual({
      ok: false,
      errors: [
        { code: "required", field: "budgetMax" },
        { code: "required", field: "moveTimeline" },
      ],
    });

    const validDraft = {
      ...invalidDraft,
      buyerBasics: {
        budgetMax: "725000",
        financingType: "conventional" as const,
        moveTimeline: "1_3_months" as const,
        preferredAreas: ["Miami", "Coral Gables", ""],
      },
    };

    expect(validateBuyerOnboardingBasics(validDraft)).toEqual({
      ok: true,
      value: {
        budgetMax: 725000,
        financingType: "conventional",
        moveTimeline: "1_3_months",
        preferredAreas: ["Miami", "Coral Gables"],
      },
    });
  });

  it("revives stored drafts and rejects older versions", () => {
    const draft = createBuyerOnboardingDraft({
      listingUrl: "https://www.zillow.com/homedetails/example_zpid/",
      intakeAttemptId: "attempt_123",
      sourceListingId: "source_123",
    });
    draft.buyerBasics.preferredAreas = ["Miami Beach"];

    const revived = reviveBuyerOnboardingDraft(JSON.stringify(draft));
    expect(revived?.intakeAttemptId).toBe("attempt_123");
    expect(revived?.sourceListingId).toBe("source_123");
    expect(revived?.buyerBasics.preferredAreas).toEqual(["Miami Beach"]);

    const stale = JSON.stringify({ ...draft, version: 0 });
    expect(reviveBuyerOnboardingDraft(stale)).toBeNull();
  });

  it("keeps the draft in first_property when recovery needs a partial source listing follow-up", () => {
    const draft = createBuyerOnboardingDraft({
      listingUrl: "https://www.zillow.com/homedetails/example_zpid/",
    });

    const updated = setBuyerOnboardingPropertyStatus(draft, {
      status: "source_listing_partial",
      propertyId: null,
      dealRoomId: null,
    });

    expect(updated.stage).toBe("first_property");
    expect(updated.completedAt).toBeNull();
    expect(updated.property.status).toBe("source_listing_partial");
  });
});
