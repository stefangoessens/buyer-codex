import { describe, expect, it } from "vitest";

import {
  summarizePostTourSignals,
  toBuyerVisibleObservation,
  type PostTourObservationEntry,
} from "@/lib/tours/postTourSignals";

function entry(
  overrides: Partial<PostTourObservationEntry> = {},
): PostTourObservationEntry {
  return {
    submittedAt: "2028-05-01T12:00:00.000Z",
    submittedByRole: "buyer",
    sentiment: "mixed",
    concerns: ["pricing", "layout"],
    offerReadiness: "considering",
    ...overrides,
  };
}

describe("toBuyerVisibleObservation", () => {
  it("drops internal-only fields from the buyer projection", () => {
    const result = toBuyerVisibleObservation(
      entry({
        buyerVisibleNote: "Loved the light.",
        internalNote: "Needs broker follow-up.",
        pricingSignal: "below_expectations",
        leverageSignal: "strong",
      }),
    );

    expect(result).toEqual({
      submittedAt: "2028-05-01T12:00:00.000Z",
      submittedByRole: "buyer",
      sentiment: "mixed",
      concerns: ["pricing", "layout"],
      offerReadiness: "considering",
      buyerVisibleNote: "Loved the light.",
    });
  });
});

describe("summarizePostTourSignals", () => {
  it("builds a typed downstream summary without parsing freeform notes", () => {
    const summary = summarizePostTourSignals([
      entry({
        submittedAt: "2028-05-01T12:00:00.000Z",
        sentiment: "negative",
        concerns: ["pricing", "repair budget"],
        offerReadiness: "not_ready",
        buyerVisibleNote: "Kitchen felt tight.",
        internalNote: "Pricing objection looks real.",
        pricingSignal: "above_expectations",
        leverageSignal: "strong",
        actionItems: ["review comps", "call listing agent"],
      }),
      entry({
        submittedAt: "2028-05-02T12:00:00.000Z",
        submittedByRole: "broker",
        sentiment: "mixed",
        concerns: ["pricing", "hoa"],
        offerReadiness: "ready_soon",
        buyerVisibleNote: "Needs HOA review.",
        internalNote: "Buyer may stretch if seller credits closing costs.",
        pricingSignal: "at_expectations",
        leverageSignal: "neutral",
        actionItems: ["review comps", "model seller credit"],
      }),
    ]);

    expect(summary.entryCount).toBe(2);
    expect(summary.lastSubmittedAt).toBe("2028-05-02T12:00:00.000Z");
    expect(summary.latestSentiment).toBe("mixed");
    expect(summary.latestOfferReadiness).toBe("ready_soon");
    expect(summary.concernTags).toEqual(["pricing", "hoa", "repair budget"]);
    expect(summary.buyerVisibleNotes).toEqual([
      "Needs HOA review.",
      "Kitchen felt tight.",
    ]);
    expect(summary.internalNotes).toEqual([
      "Buyer may stretch if seller credits closing costs.",
      "Pricing objection looks real.",
    ]);
    expect(summary.actionItems).toEqual([
      "review comps",
      "model seller credit",
      "call listing agent",
    ]);
    expect(summary.readyNowCount).toBe(0);
    expect(summary.sentimentCounts.negative).toBe(1);
    expect(summary.offerReadinessCounts.ready_soon).toBe(1);
    expect(summary.pricingSignalCounts.above_expectations).toBe(1);
    expect(summary.leverageSignalCounts.strong).toBe(1);
  });

  it("deduplicates concern and action labels while preserving first-seen casing", () => {
    const summary = summarizePostTourSignals([
      entry({
        concerns: ["HOA", "hoa", "  parking  "],
        actionItems: ["Call listing agent", "call listing agent"],
      }),
    ]);

    expect(summary.concernTags).toEqual(["HOA", "parking"]);
    expect(summary.actionItems).toEqual(["Call listing agent"]);
  });
});
