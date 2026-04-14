import { describe, expect, it } from "vitest";
import {
  buildBuyerReadiness,
  type BuyerReadinessInput,
} from "@/lib/dealroom/buyer-readiness";

function buildInput(
  overrides: Partial<BuyerReadinessInput> = {},
): BuyerReadinessInput {
  return {
    dealRoomId: "deal_room_1",
    propertyId: "property_1",
    dealStatus: "analysis",
    generatedAt: "2026-04-13T12:00:00.000Z",
    listPrice: 650_000,
    eligibility: {
      isEligible: false,
      currentAgreementType: "none",
      blockingReasonCode: "no_signed_agreement",
      blockingReasonMessage:
        "No signed agreement found. Sign a Full Representation agreement to make offers.",
      requiredAction: "sign_agreement",
    },
    financing: {
      financingType: "cash",
      preApproved: true,
    },
    lenderValidation: null,
    documents: [],
    confidenceSections: [],
    offer: null,
    contract: null,
    milestones: [],
    ...overrides,
  };
}

describe("buildBuyerReadiness", () => {
  it("keeps buyer-safe output free of internal blocker fields", () => {
    const result = buildBuyerReadiness(buildInput(), { forRole: "buyer" });

    expect(result.variant).toBe("buyer_safe");
    expect(result.currentStage).toBe("tour");
    expect(result.currentState).toBe("blocked");
    expect(result.scopeNote).toContain("does not mean the property itself is good or bad");
    expect(
      result.blockers.find(
        (blocker) =>
          blocker.title === "Sign an agreement before touring or offering",
      )?.title,
    ).toBe(
      "Sign an agreement before touring or offering",
    );
    expect(result.blockers[0]?.internal).toBeUndefined();
  });

  it("treats signed tour pass as tour-ready while keeping offer and negotiate blocked", () => {
    const result = buildBuyerReadiness(
      buildInput({
        eligibility: {
          isEligible: false,
          currentAgreementType: "tour_pass",
          blockingReasonCode: "tour_pass_only_no_full_rep",
          blockingReasonMessage:
            "Tour Pass signed. Upgrade to Full Representation required to make offers.",
          requiredAction: "upgrade_to_full_rep",
        },
      }),
      { forRole: "admin" },
    );

    expect(result.variant).toBe("internal");
    expect(result.checkpoints.find((item) => item.key === "tour")?.state).toBe(
      "ready",
    );
    expect(result.checkpoints.find((item) => item.key === "offer")?.state).toBe(
      "blocked",
    );
    expect(
      result.blockers.find((item) => item.id === "agreement-upgrade-required")
        ?.internal,
    ).toMatchObject({
      owner: "buyer",
      severity: "critical",
      reasonCode: "agreement_upgrade_required",
    });
  });

  it("surfaces lender-credit failures as broker-owned offer blockers", () => {
    const result = buildBuyerReadiness(
      buildInput({
        dealStatus: "offer_prep",
        eligibility: {
          isEligible: true,
          currentAgreementType: "full_representation",
          blockingReasonCode: null,
          blockingReasonMessage: null,
          requiredAction: "none",
        },
        financing: {
          financingType: "conventional",
          preApproved: true,
          preApprovalAmount: 700_000,
        },
        lenderValidation: {
          validationOutcome: "invalid",
          blockingReasonCode: "exceeds_ipc_limit",
          blockingReasonMessage:
            "Projected credits exceed the lender's IPC limit.",
          reviewNotes: null,
        },
      }),
      { forRole: "broker" },
    );

    expect(result.currentStage).toBe("offer");
    expect(result.currentState).toBe("blocked");
    expect(
      result.blockers.find((item) => item.id === "financing-credit-invalid")
        ?.internal,
    ).toMatchObject({
      owner: "broker",
      severity: "high",
      reasonCode: "financing_credit_invalid",
    });
  });

  it("blocks offer readiness when recommendation confidence is waiting on evidence", () => {
    const result = buildBuyerReadiness(
      buildInput({
        dealStatus: "offer_prep",
        eligibility: {
          isEligible: true,
          currentAgreementType: "full_representation",
          blockingReasonCode: null,
          blockingReasonMessage: null,
          requiredAction: "none",
        },
        financing: {
          financingType: "cash",
          preApproved: true,
        },
        confidenceSections: [
          {
            key: "offer_recommendation",
            title: "Offer recommendation",
            status: "waiting_on_evidence",
            band: "waiting",
            score: null,
            missingLabels: ["pricing output", "recent sales"],
            conflictingLabels: [],
            whatWouldIncreaseConfidence: ["Add recent sales coverage"],
          },
        ],
      }),
      { forRole: "admin" },
    );

    const blocker = result.blockers.find(
      (item) => item.id === "confidence-waiting-on-evidence",
    );

    expect(result.checkpoints.find((item) => item.key === "offer")?.state).toBe(
      "blocked",
    );
    expect(blocker?.internal).toMatchObject({
      owner: "system",
      severity: "high",
      reasonCode: "confidence_waiting_on_evidence",
    });
    expect(blocker?.internal?.supportingSignals).toContain("Missing: pricing output");
  });

  it("moves current stage to negotiate and close as workflow state advances", () => {
    const negotiate = buildBuyerReadiness(
      buildInput({
        dealStatus: "offer_sent",
        eligibility: {
          isEligible: true,
          currentAgreementType: "full_representation",
          blockingReasonCode: null,
          blockingReasonMessage: null,
          requiredAction: "none",
        },
        financing: {
          financingType: "cash",
          preApproved: true,
        },
        offer: { latestStatus: "submitted" },
      }),
      { forRole: "buyer" },
    );

    const close = buildBuyerReadiness(
      buildInput({
        dealStatus: "closing",
        eligibility: {
          isEligible: true,
          currentAgreementType: "full_representation",
          blockingReasonCode: null,
          blockingReasonMessage: null,
          requiredAction: "none",
        },
        financing: {
          financingType: "cash",
          preApproved: true,
        },
        offer: { latestStatus: "accepted" },
        contract: { status: "fully_executed" },
        milestones: [
          {
            id: "milestone_1",
            name: "Upload proof of homeowners insurance",
            workstream: "insurance",
            status: "overdue",
            dueDate: "2026-04-10",
            flaggedForReview: false,
          },
        ],
      }),
      { forRole: "admin" },
    );

    expect(negotiate.currentStage).toBe("negotiate");
    expect(negotiate.currentState).toBe("ready");
    expect(close.currentStage).toBe("close");
    expect(close.currentState).toBe("blocked");
    expect(
      close.blockers.find((item) => item.id === "close-overdue-milestone_1")
        ?.internal,
    ).toMatchObject({
      owner: "buyer",
      severity: "high",
      reasonCode: "close_overdue_milestone",
    });
  });
});
