import { describe, expect, it } from "vitest";
import {
  buildBuyerFeeLedgerReadModel,
  isValidCompensationTransition,
  reconcileBuyerFeeLedger,
  rollupBuyerFeeLedgerEntries,
  type BuyerFeeLedgerEntryRecord,
  type CompensationLedgerState,
} from "@/lib/dealroom/ledger";

function makeCompensationState(
  overrides: Partial<CompensationLedgerState<string>> = {},
): CompensationLedgerState<string> {
  return {
    dealRoomId: "deal_1",
    status: "negotiated_in_offer",
    previousStatus: "seller_disclosed_off_mls",
    transitionReason: "Offer includes seller-paid compensation",
    transitionActorId: "user_1",
    lastTransitionAt: "2026-04-13T10:00:00.000Z",
    expectedBuyerFee: 6000,
    sellerPaidAmount: 10000,
    buyerPaidAmount: 0,
    projectedClosingCredit: 4000,
    createdAt: "2026-04-13T09:00:00.000Z",
    updatedAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<BuyerFeeLedgerEntryRecord<string>>,
): BuyerFeeLedgerEntryRecord<string> {
  return {
    id: overrides.id ?? "entry_1",
    dealRoomId: "deal_1",
    bucket: "projected",
    dimension: "expectedBuyerFee",
    amount: 6000,
    description: "Initial expected buyer fee",
    source: "manual",
    lifecycle: {
      dealStatus: "offer_prep",
      offerId: "offer_1",
      offerStatus: "approved",
      contractId: undefined,
      contractStatus: undefined,
      internalReviewState: "approved",
      compensationStatus: "negotiated_in_offer",
    },
    provenance: {
      actorId: "user_1",
      triggeredBy: "test.seed",
      sourceDocument: "pricing-sheet.pdf",
      changedAt: "2026-04-13T10:00:00.000Z",
    },
    createdAt: "2026-04-13T10:00:00.000Z",
    ...overrides,
  };
}

describe("isValidCompensationTransition", () => {
  it("allows forward-only state transitions", () => {
    expect(isValidCompensationTransition("unknown", "seller_disclosed_off_mls")).toBe(true);
    expect(isValidCompensationTransition("seller_disclosed_off_mls", "negotiated_in_offer")).toBe(true);
    expect(isValidCompensationTransition("negotiated_in_offer", "buyer_paid")).toBe(true);
  });

  it("rejects backward and same-state transitions", () => {
    expect(isValidCompensationTransition("buyer_paid", "unknown")).toBe(false);
    expect(isValidCompensationTransition("negotiated_in_offer", "seller_disclosed_off_mls")).toBe(false);
    expect(isValidCompensationTransition("buyer_paid", "buyer_paid")).toBe(false);
  });
});

describe("rollupBuyerFeeLedgerEntries", () => {
  it("computes the four-dimension projected ledger and net broker compensation", () => {
    const entries = [
      makeEntry({
        id: "expected",
        dimension: "expectedBuyerFee",
        amount: 6000,
      }),
      makeEntry({
        id: "seller",
        dimension: "sellerPaidAmount",
        amount: 10000,
      }),
      makeEntry({
        id: "credit",
        dimension: "projectedClosingCredit",
        amount: 4000,
      }),
      makeEntry({
        id: "buyer",
        dimension: "buyerPaidAmount",
        amount: 0,
      }),
    ];

    const result = rollupBuyerFeeLedgerEntries(entries, "projected");
    expect(result).toEqual({
      expectedBuyerFee: 6000,
      sellerPaidAmount: 10000,
      buyerPaidAmount: 0,
      projectedClosingCredit: 4000,
      netBrokerCompensation: 6000,
      fundingGap: 0,
    });
  });

  it("keeps projected and actual buckets isolated", () => {
    const entries = [
      makeEntry({
        id: "projected",
        bucket: "projected",
        dimension: "sellerPaidAmount",
        amount: 9000,
      }),
      makeEntry({
        id: "actual",
        bucket: "actual",
        dimension: "sellerPaidAmount",
        amount: 8500,
      }),
    ];

    expect(rollupBuyerFeeLedgerEntries(entries, "projected").sellerPaidAmount).toBe(9000);
    expect(rollupBuyerFeeLedgerEntries(entries, "actual").sellerPaidAmount).toBe(8500);
  });
});

describe("reconcileBuyerFeeLedger", () => {
  it("flags per-dimension discrepancies above the threshold", () => {
    const expected = {
      expectedBuyerFee: 6000,
      sellerPaidAmount: 10000,
      buyerPaidAmount: 0,
      projectedClosingCredit: 4000,
      netBrokerCompensation: 6000,
      fundingGap: 0,
    };
    const actual = {
      expectedBuyerFee: 6100,
      sellerPaidAmount: 9800,
      buyerPaidAmount: 200,
      projectedClosingCredit: 3900,
      netBrokerCompensation: 6100,
      fundingGap: 0,
    };

    const result = reconcileBuyerFeeLedger(expected, actual, 50);
    expect(result.discrepancyFlag).toBe(true);
    expect(result.discrepancyDimensions).toEqual([
      "expectedBuyerFee",
      "sellerPaidAmount",
      "buyerPaidAmount",
      "projectedClosingCredit",
    ]);
    expect(result.discrepancyAmount).toBe(600);
    expect(result.discrepancyDetails).toContain("Expected Buyer Fee");
  });

  it("returns a clean reconciliation when there is no actual statement yet", () => {
    const expected = {
      expectedBuyerFee: 6000,
      sellerPaidAmount: 10000,
      buyerPaidAmount: 0,
      projectedClosingCredit: 4000,
      netBrokerCompensation: 6000,
      fundingGap: 0,
    };

    const result = reconcileBuyerFeeLedger(expected, null, 50);
    expect(result.actual).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.discrepancyFlag).toBe(false);
  });
});

describe("buildBuyerFeeLedgerReadModel", () => {
  const entries = [
    makeEntry({
      id: "expected",
      dimension: "expectedBuyerFee",
      amount: 6000,
    }),
    makeEntry({
      id: "seller",
      dimension: "sellerPaidAmount",
      amount: 10000,
    }),
    makeEntry({
      id: "credit",
      dimension: "projectedClosingCredit",
      amount: 4000,
    }),
    makeEntry({
      id: "actual-credit",
      bucket: "actual",
      dimension: "projectedClosingCredit",
      amount: 3800,
      createdAt: "2026-04-14T11:00:00.000Z",
    }),
  ];

  it("strips lifecycle and provenance for buyers", () => {
    const result = buildBuyerFeeLedgerReadModel({
      dealRoomId: "deal_1",
      compensation: makeCompensationState(),
      entries,
      forRole: "buyer",
    });

    expect(result.variant).toBe("buyer_safe");
    expect(result.entries[0]).not.toHaveProperty("lifecycle");
    expect(result.entries[0]).not.toHaveProperty("provenance");
    expect(result.actual?.projectedClosingCredit).toBe(3800);
  });

  it("keeps lifecycle and provenance for internal viewers", () => {
    const result = buildBuyerFeeLedgerReadModel({
      dealRoomId: "deal_1",
      compensation: makeCompensationState(),
      entries,
      forRole: "broker",
    });

    expect(result.variant).toBe("internal");
    expect(result.entries[0]).toHaveProperty("lifecycle");
    expect(result.entries[0]).toHaveProperty("provenance");
    expect(result.projected.netBrokerCompensation).toBe(6000);
    expect(result.latestActualAt).toBe("2026-04-14T11:00:00.000Z");
  });
});
