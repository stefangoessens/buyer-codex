import { describe, expect, it } from "vitest";

import { validatePostTourObservationInput } from "@/lib/tours/postTourObservations";

describe("validatePostTourObservationInput", () => {
  it("normalizes buyer-safe submissions", () => {
    const result = validatePostTourObservationInput(
      {
        sentiment: "mixed",
        concerns: ["pricing", " commute ", "pricing"],
        offerReadiness: "considering",
        buyerVisibleNote: "  Loved the yard.  ",
      },
      "buyer",
    );

    expect(result).toEqual({
      ok: true,
      sanitized: {
        sentiment: "mixed",
        concerns: ["pricing", "commute"],
        offerReadiness: "considering",
        buyerVisibleNote: "Loved the yard.",
        internalNote: undefined,
        pricingSignal: undefined,
        leverageSignal: undefined,
        actionItems: undefined,
      },
    });
  });

  it("rejects buyer attempts to set internal-only fields", () => {
    const result = validatePostTourObservationInput(
      {
        sentiment: "negative",
        concerns: ["hoa"],
        offerReadiness: "ready_soon",
        internalNote: "Needs broker follow-up",
      },
      "buyer",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("buyer_internal_fields_disallowed");
    }
  });

  it("requires at least one structured concern", () => {
    const result = validatePostTourObservationInput(
      {
        sentiment: "positive",
        concerns: [" ", ""],
        offerReadiness: "ready_now",
      },
      "broker",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("missing_concern");
    }
  });
});
