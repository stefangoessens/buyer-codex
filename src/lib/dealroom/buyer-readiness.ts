import type { DealStatus } from "@/lib/dealroom/overview";
import type { FinancingType, ValidationOutcome } from "@/lib/dealroom/lender-credit-validate";

export const BUYER_READINESS_CHECKPOINTS = [
  "tour",
  "offer",
  "negotiate",
  "close",
] as const;

export type BuyerReadinessCheckpointKey =
  (typeof BUYER_READINESS_CHECKPOINTS)[number];

export type BuyerReadinessState = "ready" | "needs_attention" | "blocked";
export type BuyerReadinessVariant = "buyer_safe" | "internal";
export type BuyerReadinessBlockerEffect = "blocks" | "warns";
export type BuyerReadinessBlockerOwner = "buyer" | "broker" | "system";
export type BuyerReadinessBlockerSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low";

export type BuyerReadinessReasonCode =
  | "agreement_missing_signed"
  | "agreement_upgrade_required"
  | "agreement_canceled"
  | "agreement_replaced_pending_new"
  | "financing_missing_type"
  | "financing_missing_preapproval"
  | "financing_preapproval_below_price"
  | "financing_preapproval_expired"
  | "financing_preapproval_expiring"
  | "financing_credit_invalid"
  | "financing_credit_review_required"
  | "confidence_waiting_on_evidence"
  | "confidence_conflicting_evidence"
  | "confidence_low_offer_support"
  | "document_review_required"
  | "document_pending"
  | "document_unavailable"
  | "negotiation_offer_not_live"
  | "close_contract_not_executed"
  | "close_overdue_milestone"
  | "close_milestone_review_required";

export interface BuyerReadinessEligibilityInput {
  isEligible: boolean;
  currentAgreementType: "none" | "tour_pass" | "full_representation";
  blockingReasonCode?:
    | "no_signed_agreement"
    | "tour_pass_only_no_full_rep"
    | "agreement_canceled"
    | "agreement_replaced_pending_new"
    | "buyer_not_found"
    | "not_authenticated"
    | null;
  blockingReasonMessage?: string | null;
  requiredAction: "none" | "sign_agreement" | "upgrade_to_full_rep";
}

export interface BuyerReadinessFinancingProfileInput {
  financingType?: FinancingType;
  preApproved: boolean;
  preApprovalAmount?: number;
  preApprovalExpiry?: string;
  lenderName?: string;
}

export interface BuyerReadinessLenderValidationInput {
  validationOutcome: ValidationOutcome;
  blockingReasonCode?: string | null;
  blockingReasonMessage?: string | null;
  reviewNotes?: string | null;
}

export interface BuyerReadinessDocumentInput {
  id: string;
  documentType:
    | "seller_disclosure"
    | "hoa_doc"
    | "hoa_document"
    | "inspection_report"
    | "title_commitment"
    | "survey"
    | "appraisal"
    | "loan_estimate"
    | "purchase_contract"
    | "other";
  status:
    | "available"
    | "pending"
    | "partial"
    | "review_required"
    | "unavailable";
  headline: string;
  reason?: string | null;
  severity: "info" | "low" | "medium" | "high" | "critical";
  reviewNotes?: string | null;
}

export interface BuyerReadinessConfidenceSectionInput {
  key: "pricing" | "comps" | "leverage" | "risk" | "offer_recommendation";
  title: string;
  status:
    | "supported"
    | "mixed"
    | "waiting_on_evidence"
    | "conflicting_evidence";
  band: "high" | "medium" | "low" | "waiting";
  score: number | null;
  missingLabels: string[];
  conflictingLabels: string[];
  whatWouldIncreaseConfidence: string[];
}

export interface BuyerReadinessContractInput {
  status:
    | "pending_signatures"
    | "fully_executed"
    | "amended"
    | "terminated"
    | null;
}

export interface BuyerReadinessMilestoneInput {
  id: string;
  name: string;
  workstream:
    | "inspection"
    | "financing"
    | "appraisal"
    | "title"
    | "insurance"
    | "escrow"
    | "hoa"
    | "walkthrough"
    | "closing"
    | "other";
  status: "pending" | "completed" | "overdue" | "needs_review";
  dueDate: string;
  flaggedForReview: boolean;
  reviewReason?:
    | "low_confidence"
    | "ambiguous_date"
    | "missing_required"
    | "date_in_past"
    | "manual_flag";
}

export interface BuyerReadinessOfferInput {
  latestStatus?:
    | "draft"
    | "pending_review"
    | "approved"
    | "submitted"
    | "countered"
    | "accepted"
    | "rejected"
    | "withdrawn"
    | "expired"
    | null;
}

export interface BuyerReadinessInput {
  dealRoomId: string;
  propertyId: string;
  dealStatus: DealStatus;
  generatedAt: string;
  listPrice?: number | null;
  eligibility: BuyerReadinessEligibilityInput;
  financing: BuyerReadinessFinancingProfileInput;
  lenderValidation?: BuyerReadinessLenderValidationInput | null;
  documents: BuyerReadinessDocumentInput[];
  confidenceSections: BuyerReadinessConfidenceSectionInput[];
  offer?: BuyerReadinessOfferInput | null;
  contract?: BuyerReadinessContractInput | null;
  milestones: BuyerReadinessMilestoneInput[];
}

export interface BuyerReadinessCheckpoint {
  key: BuyerReadinessCheckpointKey;
  label: string;
  state: BuyerReadinessState;
  stateLabel: string;
  summary: string;
  blockerIds: string[];
}

export interface BuyerReadinessBlocker {
  id: string;
  title: string;
  summary: string;
  buyerAction: string;
  effect: BuyerReadinessBlockerEffect;
  checkpoints: BuyerReadinessCheckpointKey[];
  internal?: {
    owner: BuyerReadinessBlockerOwner;
    severity: BuyerReadinessBlockerSeverity;
    reasonCode: BuyerReadinessReasonCode;
    remediation: string;
    supportingSignals: string[];
  };
}

export interface BuyerReadinessSummary {
  headline: string;
  body: string;
  nextSteps: string[];
}

interface BuyerReadinessBase {
  dealRoomId: string;
  propertyId: string;
  generatedAt: string;
  variant: BuyerReadinessVariant;
  currentStage: BuyerReadinessCheckpointKey;
  currentStageLabel: string;
  currentState: BuyerReadinessState;
  currentStateLabel: string;
  checkpoints: BuyerReadinessCheckpoint[];
  blockers: BuyerReadinessBlocker[];
  buyerSummary: BuyerReadinessSummary;
  scopeNote: string;
}

export interface BuyerSafeBuyerReadiness extends BuyerReadinessBase {
  variant: "buyer_safe";
  internal?: undefined;
}

export interface InternalBuyerReadiness extends BuyerReadinessBase {
  variant: "internal";
  internal: {
    blockerCounts: {
      buyer: number;
      broker: number;
      system: number;
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
}

export type BuyerReadinessSurface =
  | BuyerSafeBuyerReadiness
  | InternalBuyerReadiness;

const CHECKPOINT_LABELS: Record<BuyerReadinessCheckpointKey, string> = {
  tour: "Tour",
  offer: "Offer",
  negotiate: "Negotiate",
  close: "Close",
};

const STATE_LABELS: Record<BuyerReadinessState, string> = {
  ready: "Ready",
  needs_attention: "Needs attention",
  blocked: "Blocked",
};

const SEVERITY_ORDER: Record<BuyerReadinessBlockerSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SCOPE_NOTE =
  "Readiness tracks what is still preventing action on this property. It does not mean the property itself is good or bad.";

const BUYER_MILESTONE_KEYWORDS = [
  "buyer",
  "sign",
  "review",
  "select",
  "pay",
  "deposit",
  "upload",
  "submit",
  "insurance",
  "walkthrough",
];

export function buildBuyerReadiness(
  input: BuyerReadinessInput,
  options: { forRole: "buyer" | "broker" | "admin" } = { forRole: "buyer" },
): BuyerReadinessSurface {
  const blockers: BuyerReadinessBlocker[] = [
    ...buildAgreementBlockers(input.eligibility),
    ...buildFinancingBlockers(input),
    ...buildConfidenceBlockers(input.confidenceSections),
    ...buildDocumentBlockers(input.documents),
    ...buildNegotiationBlockers(input.offer),
    ...buildCloseBlockers(input.contract, input.milestones),
  ].sort(compareBlockers);

  const currentStage = mapDealStatusToStage(input.dealStatus);
  const checkpoints = BUYER_READINESS_CHECKPOINTS.map((checkpoint) =>
    buildCheckpoint(checkpoint, blockers),
  );
  const currentCheckpoint =
    checkpoints.find((checkpoint) => checkpoint.key === currentStage) ??
    checkpoints[0];

  const base: BuyerSafeBuyerReadiness = {
    dealRoomId: input.dealRoomId,
    propertyId: input.propertyId,
    generatedAt: input.generatedAt,
    variant: "buyer_safe",
    currentStage,
    currentStageLabel: CHECKPOINT_LABELS[currentStage],
    currentState: currentCheckpoint.state,
    currentStateLabel: currentCheckpoint.stateLabel,
    checkpoints,
    blockers:
      options.forRole === "buyer"
        ? blockers.map(stripInternalBlockerFields)
        : blockers,
    buyerSummary: buildBuyerSummary(currentCheckpoint, blockers),
    scopeNote: SCOPE_NOTE,
  };

  if (options.forRole === "buyer") {
    return base;
  }

  return {
    ...base,
    variant: "internal",
    internal: {
      blockerCounts: countInternalBlockers(blockers),
    },
  };
}

function buildAgreementBlockers(
  eligibility: BuyerReadinessEligibilityInput,
): BuyerReadinessBlocker[] {
  if (eligibility.isEligible) {
    return [];
  }

  switch (eligibility.blockingReasonCode) {
    case "tour_pass_only_no_full_rep":
      return [
        createBlocker({
          id: "agreement-upgrade-required",
          title: "Upgrade to full representation before offering",
          summary:
            eligibility.blockingReasonMessage ??
            "A signed Tour Pass covers tours, but a signed full-representation agreement is still required before you can make or negotiate an offer.",
          buyerAction: "Review and sign the full-representation agreement.",
          effect: "blocks",
          checkpoints: ["offer", "negotiate"],
          owner: "buyer",
          severity: "critical",
          reasonCode: "agreement_upgrade_required",
          remediation:
            "Generate or resend the full-representation agreement and confirm signature capture completed.",
          supportingSignals: ["Signed Tour Pass present without a signed full-representation agreement."],
        }),
      ];
    case "agreement_canceled":
      return [
        createBlocker({
          id: "agreement-canceled",
          title: "Buyer agreement is no longer active",
          summary:
            eligibility.blockingReasonMessage ??
            "The prior agreement was canceled, so tours and offers should stay paused until a new agreement is active.",
          buyerAction: "Sign a new agreement for this deal room.",
          effect: "blocks",
          checkpoints: ["tour", "offer", "negotiate"],
          owner: "buyer",
          severity: "critical",
          reasonCode: "agreement_canceled",
          remediation:
            "Confirm the cancellation was intentional, then issue a replacement agreement tied to this deal room.",
          supportingSignals: ["Eligibility state resolved to agreement_canceled."],
        }),
      ];
    case "agreement_replaced_pending_new":
      return [
        createBlocker({
          id: "agreement-replaced-pending-new",
          title: "Replacement agreement still needs to be signed",
          summary:
            eligibility.blockingReasonMessage ??
            "The prior agreement was replaced, but the successor agreement is not signed yet.",
          buyerAction: "Sign the replacement agreement.",
          effect: "blocks",
          checkpoints: ["tour", "offer", "negotiate"],
          owner: "buyer",
          severity: "critical",
          reasonCode: "agreement_replaced_pending_new",
          remediation:
            "Check the successor agreement status and re-send signature request if it stalled.",
          supportingSignals: ["Agreement supersession completed without an active signed successor."],
        }),
      ];
    case "no_signed_agreement":
    case "buyer_not_found":
    case "not_authenticated":
    default:
      if (eligibility.currentAgreementType === "tour_pass") {
        return [];
      }
      return [
        createBlocker({
          id: "agreement-missing-signed",
          title: "Sign an agreement before touring or offering",
          summary:
            eligibility.blockingReasonMessage ??
            "There is no signed buyer agreement on file for this deal room yet.",
          buyerAction: "Sign the tour or representation agreement for this property.",
          effect: "blocks",
          checkpoints: ["tour", "offer", "negotiate"],
          owner: "buyer",
          severity: "critical",
          reasonCode: "agreement_missing_signed",
          remediation:
            "Issue the correct agreement type for this deal room and verify signature capture succeeded.",
          supportingSignals: ["Eligibility state resolved to no signed agreement."],
        }),
      ];
  }
}

function buildFinancingBlockers(
  input: BuyerReadinessInput,
): BuyerReadinessBlocker[] {
  const blockers: BuyerReadinessBlocker[] = [];
  const isCash = input.financing.financingType === "cash";
  const offerCheckpoints: BuyerReadinessCheckpointKey[] = [
    "offer",
    "negotiate",
    "close",
  ];

  if (!isCash && !input.financing.financingType) {
    blockers.push(
      createBlocker({
        id: "financing-missing-type",
        title: "Select how you are financing this purchase",
        summary:
          "We still need a financing type before we can clear offer and close readiness.",
        buyerAction: "Add your financing type so we can validate the next steps.",
        effect: "blocks",
        checkpoints: offerCheckpoints,
        owner: "buyer",
        severity: "high",
        reasonCode: "financing_missing_type",
        remediation:
          "Collect the buyer's financing type so lender-credit rules and close blockers can be evaluated correctly.",
        supportingSignals: ["Buyer financing type is missing."],
      }),
    );
  }

  if (!isCash && !input.financing.preApproved) {
    blockers.push(
      createBlocker({
        id: "financing-missing-preapproval",
        title: "Pre-approval is still missing",
        summary:
          "You can keep researching the property, but financing is not ready enough to move cleanly into an offer.",
        buyerAction: "Upload or confirm an active pre-approval.",
        effect: "blocks",
        checkpoints: offerCheckpoints,
        owner: "buyer",
        severity: "high",
        reasonCode: "financing_missing_preapproval",
        remediation:
          "Request a current pre-approval amount and lender contact, then sync it into the buyer profile.",
        supportingSignals: ["Buyer profile preApproved flag is false."],
      }),
    );
  }

  if (
    !isCash &&
    typeof input.listPrice === "number" &&
    typeof input.financing.preApprovalAmount === "number" &&
    input.financing.preApprovalAmount < input.listPrice
  ) {
    blockers.push(
      createBlocker({
        id: "financing-preapproval-below-price",
        title: "Pre-approval does not cover the current list price",
        summary:
          "The recorded pre-approval amount is below the current property price, so offer readiness is still constrained.",
        buyerAction: "Raise the pre-approval or confirm a different financing plan.",
        effect: "blocks",
        checkpoints: offerCheckpoints,
        owner: "buyer",
        severity: "high",
        reasonCode: "financing_preapproval_below_price",
        remediation:
          "Confirm whether the stored pre-approval is stale or incomplete before advancing offer preparation.",
        supportingSignals: [
          `Pre-approval amount ${formatMoney(input.financing.preApprovalAmount)} is below list price ${formatMoney(input.listPrice)}.`,
        ],
      }),
    );
  }

  const expiryState = classifyPreApprovalExpiry(input.financing.preApprovalExpiry);
  if (expiryState === "expired") {
    blockers.push(
      createBlocker({
        id: "financing-preapproval-expired",
        title: "Pre-approval has expired",
        summary:
          "Your lender letter is past its usable date, so financing is not ready for a confident offer or close.",
        buyerAction: "Request an updated pre-approval letter from your lender.",
        effect: "blocks",
        checkpoints: offerCheckpoints,
        owner: "buyer",
        severity: "high",
        reasonCode: "financing_preapproval_expired",
        remediation:
          "Refresh the lender letter and update the stored expiry date before using financing-dependent recommendations.",
        supportingSignals: [`Pre-approval expiry ${input.financing.preApprovalExpiry} is in the past.`],
      }),
    );
  } else if (expiryState === "expiring") {
    blockers.push(
      createBlocker({
        id: "financing-preapproval-expiring",
        title: "Pre-approval is about to expire",
        summary:
          "Financing is still usable, but the pre-approval date is close enough that it should be refreshed before the next step slips.",
        buyerAction: "Refresh the pre-approval before it expires.",
        effect: "warns",
        checkpoints: offerCheckpoints,
        owner: "buyer",
        severity: "medium",
        reasonCode: "financing_preapproval_expiring",
        remediation:
          "Warn the team before the stored pre-approval date lapses and re-request updated lender paperwork.",
        supportingSignals: [`Pre-approval expiry ${input.financing.preApprovalExpiry} is within 14 days.`],
      }),
    );
  }

  if (input.lenderValidation?.validationOutcome === "invalid") {
    blockers.push(
      createBlocker({
        id: "financing-credit-invalid",
        title: "Current credit structure exceeds lender limits",
        summary:
          input.lenderValidation.blockingReasonMessage ??
          "Projected credits exceed the lender's current limits.",
        buyerAction: "Wait for the broker to restructure credits before you rely on this offer path.",
        effect: "blocks",
        checkpoints: offerCheckpoints,
        owner: "broker",
        severity: "high",
        reasonCode: "financing_credit_invalid",
        remediation:
          "Adjust projected credits or financing assumptions until the lender validation clears.",
        supportingSignals: [
          input.lenderValidation.blockingReasonCode ?? "lender validation invalid",
        ],
      }),
    );
  } else if (input.lenderValidation?.validationOutcome === "review_required") {
    blockers.push(
      createBlocker({
        id: "financing-credit-review-required",
        title: "Lender credit limits still need broker review",
        summary:
          input.lenderValidation.blockingReasonMessage ??
          "The financing structure is close enough to lender limits that a broker still needs to verify it.",
        buyerAction: "Wait for broker confirmation before treating the current credits as cleared.",
        effect: "warns",
        checkpoints: offerCheckpoints,
        owner: "broker",
        severity: "medium",
        reasonCode: "financing_credit_review_required",
        remediation:
          input.lenderValidation.reviewNotes?.trim() ||
          "Review the lender-credit validation notes and resolve the edge case before approval.",
        supportingSignals: [
          input.lenderValidation.blockingReasonCode ?? "lender validation review_required",
        ],
      }),
    );
  }

  return blockers;
}

function buildConfidenceBlockers(
  sections: BuyerReadinessConfidenceSectionInput[],
): BuyerReadinessBlocker[] {
  const offerSection = sections.find((section) => section.key === "offer_recommendation");
  if (!offerSection) return [];

  const supportingSignals = [
    ...offerSection.missingLabels.map((label) => `Missing: ${label}`),
    ...offerSection.conflictingLabels.map((label) => `Conflicting: ${label}`),
  ];

  if (
    offerSection.status === "waiting_on_evidence" ||
    offerSection.band === "waiting"
  ) {
    return [
      createBlocker({
        id: "confidence-waiting-on-evidence",
        title: "Offer readiness is still waiting on core evidence",
        summary:
          "The recommendation layer does not yet have enough verified pricing, comps, or leverage evidence to clear a trustworthy offer path.",
        buyerAction: "Wait for the missing evidence to clear before relying on the offer recommendation.",
        effect: "blocks",
        checkpoints: ["offer", "negotiate"],
        owner: "system",
        severity: "high",
        reasonCode: "confidence_waiting_on_evidence",
        remediation:
          offerSection.whatWouldIncreaseConfidence[0] ??
          "Backfill the missing dossier sections and rerun the recommendation pipeline.",
        supportingSignals:
          supportingSignals.length > 0
            ? supportingSignals
            : ["Offer recommendation evidence section is waiting on evidence."],
      }),
    ];
  }

  if (offerSection.status === "conflicting_evidence") {
    return [
      createBlocker({
        id: "confidence-conflicting-evidence",
        title: "Offer inputs conflict and need review",
        summary:
          "The evidence feeding the offer recommendation disagrees, so readiness should stay blocked until the conflict is resolved.",
        buyerAction: "Wait for the team to resolve the conflicting evidence.",
        effect: "blocks",
        checkpoints: ["offer", "negotiate"],
        owner: "system",
        severity: "high",
        reasonCode: "confidence_conflicting_evidence",
        remediation:
          offerSection.whatWouldIncreaseConfidence[0] ??
          "Inspect the conflicting dossier inputs and reconcile the contradictory sources.",
        supportingSignals:
          supportingSignals.length > 0
            ? supportingSignals
            : ["Offer recommendation evidence section has conflicting evidence."],
      }),
    ];
  }

  if (offerSection.band === "low") {
    return [
      createBlocker({
        id: "confidence-low-offer-support",
        title: "Offer confidence is still thin",
        summary:
          "We can see a path forward, but the offer recommendation is still low-confidence enough that it should not be treated as fully ready.",
        buyerAction: "Use the recommendation cautiously until more evidence lands.",
        effect: "warns",
        checkpoints: ["offer", "negotiate"],
        owner: "system",
        severity: "medium",
        reasonCode: "confidence_low_offer_support",
        remediation:
          offerSection.whatWouldIncreaseConfidence[0] ??
          "Raise recommendation confidence before presenting the offer path as fully ready.",
        supportingSignals:
          supportingSignals.length > 0
            ? supportingSignals
            : ["Offer recommendation confidence band is low."],
      }),
    ];
  }

  return [];
}

function buildDocumentBlockers(
  documents: BuyerReadinessDocumentInput[],
): BuyerReadinessBlocker[] {
  return documents.flatMap((document) => {
    const checkpoints = mapDocumentToCheckpoints(document.documentType);
    if (checkpoints.length === 0 || document.status === "available") {
      return [];
    }

    if (document.status === "review_required") {
      return [
        createBlocker({
          id: `document-review-${document.id}`,
          title: `${documentLabel(document.documentType)} needs review`,
          summary:
            document.reason ??
            "This document is still in broker review and is not ready to clear the related step.",
          buyerAction: "Wait for broker review to clear this document.",
          effect: "blocks",
          checkpoints,
          owner: "broker",
          severity:
            document.severity === "critical" || document.severity === "high"
              ? "high"
              : "medium",
          reasonCode: "document_review_required",
          remediation:
            document.reviewNotes?.trim() ||
            "Review the extracted document findings and resolve the outstanding issues.",
          supportingSignals: [document.headline],
        }),
      ];
    }

    if (document.status === "unavailable") {
      return [
        createBlocker({
          id: `document-unavailable-${document.id}`,
          title: `${documentLabel(document.documentType)} is unavailable`,
          summary:
            document.reason ??
            "We do not have a usable document analysis for this step yet.",
          buyerAction: "Upload or refresh the document before relying on this step.",
          effect: "blocks",
          checkpoints,
          owner: "buyer",
          severity: "high",
          reasonCode: "document_unavailable",
          remediation:
            "Request a clean source file or rerun the document analysis so the downstream workflow is not blocked on missing evidence.",
          supportingSignals: [document.headline],
        }),
      ];
    }

    return [
      createBlocker({
        id: `document-pending-${document.id}`,
        title: `${documentLabel(document.documentType)} is still processing`,
        summary:
          document.reason ??
          "This document has started processing but is not fully cleared yet.",
        buyerAction: "Wait for the document run to finish before treating this step as fully ready.",
        effect: "warns",
        checkpoints,
        owner: "system",
        severity: "low",
        reasonCode: "document_pending",
        remediation:
          "Finish the file-analysis job and verify the final summary propagated into the readiness read model.",
        supportingSignals: [document.headline],
      }),
    ];
  });
}

function buildNegotiationBlockers(
  offer: BuyerReadinessOfferInput | null | undefined,
): BuyerReadinessBlocker[] {
  if (
    offer?.latestStatus === "submitted" ||
    offer?.latestStatus === "countered" ||
    offer?.latestStatus === "accepted"
  ) {
    return [];
  }

  return [
    createBlocker({
      id: "negotiation-offer-not-live",
      title: "No live offer is in play yet",
      summary:
        "Negotiation readiness stays blocked until an offer has actually been submitted or countered.",
      buyerAction: "Submit an offer before expecting a negotiation state.",
      effect: "blocks",
      checkpoints: ["negotiate"],
      owner: "buyer",
      severity: "medium",
      reasonCode: "negotiation_offer_not_live",
      remediation:
        "Keep negotiation surfaces dormant until the offer lifecycle reaches submitted or countered.",
      supportingSignals: [
        `Latest offer status: ${offer?.latestStatus ?? "none"}`,
      ],
    }),
  ];
}

function buildCloseBlockers(
  contract: BuyerReadinessContractInput | null | undefined,
  milestones: BuyerReadinessMilestoneInput[],
): BuyerReadinessBlocker[] {
  const blockers: BuyerReadinessBlocker[] = [];

  if (contract?.status !== "fully_executed") {
    blockers.push(
      createBlocker({
        id: "close-contract-not-executed",
        title: "Contract still needs signatures",
        summary:
          "Close readiness starts only after the deal is fully executed. The contract is still waiting to clear that state.",
        buyerAction: "Complete signatures and confirm the executed contract is back.",
        effect: "blocks",
        checkpoints: ["close"],
        owner: "broker",
        severity: "critical",
        reasonCode: "close_contract_not_executed",
        remediation:
          "Track the signature workflow until the contract lifecycle is fully_executed before exposing close-ready state.",
        supportingSignals: [`Contract status: ${contract?.status ?? "none"}`],
      }),
    );
  }

  for (const milestone of milestones) {
    if (milestone.status === "completed") continue;

    const owner = inferMilestoneOwner(milestone);
    if (milestone.status === "overdue") {
      blockers.push(
        createBlocker({
          id: `close-overdue-${milestone.id}`,
          title: `${milestone.name} is overdue`,
          summary:
            `The close workflow is off track until "${milestone.name}" is resolved.`,
          buyerAction:
            owner === "buyer"
              ? `Resolve "${milestone.name}" to keep closing on track.`
              : `Wait for the team to resolve "${milestone.name}".`,
          effect: "blocks",
          checkpoints: ["close"],
          owner,
          severity: "high",
          reasonCode: "close_overdue_milestone",
          remediation:
            `Review the overdue ${milestone.workstream} milestone and clear the missing dependency immediately.`,
          supportingSignals: [
            `Due date: ${milestone.dueDate}`,
            `Workstream: ${milestone.workstream}`,
          ],
        }),
      );
      continue;
    }

    if (milestone.status === "needs_review" || milestone.flaggedForReview) {
      blockers.push(
        createBlocker({
          id: `close-review-${milestone.id}`,
          title: `${milestone.name} needs review`,
          summary:
            `Close readiness is still waiting on review for "${milestone.name}".`,
          buyerAction:
            owner === "buyer"
              ? `Stay ready to respond if "${milestone.name}" needs your input.`
              : `Wait for the team to finish reviewing "${milestone.name}".`,
          effect: "warns",
          checkpoints: ["close"],
          owner,
          severity: "medium",
          reasonCode: "close_milestone_review_required",
          remediation:
            `Resolve the milestone review reason (${milestone.reviewReason ?? "manual_flag"}) before marking close ready.`,
          supportingSignals: [
            `Review reason: ${milestone.reviewReason ?? "manual_flag"}`,
            `Workstream: ${milestone.workstream}`,
          ],
        }),
      );
    }
  }

  return blockers;
}

function buildCheckpoint(
  checkpoint: BuyerReadinessCheckpointKey,
  blockers: BuyerReadinessBlocker[],
): BuyerReadinessCheckpoint {
  const scoped = blockers.filter((blocker) => blocker.checkpoints.includes(checkpoint));
  const hasBlocking = scoped.some((blocker) => blocker.effect === "blocks");
  const state: BuyerReadinessState = hasBlocking
    ? "blocked"
    : scoped.length > 0
      ? "needs_attention"
      : "ready";
  return {
    key: checkpoint,
    label: CHECKPOINT_LABELS[checkpoint],
    state,
    stateLabel: STATE_LABELS[state],
    summary: buildCheckpointSummary(checkpoint, state, scoped),
    blockerIds: scoped.map((blocker) => blocker.id),
  };
}

function buildCheckpointSummary(
  checkpoint: BuyerReadinessCheckpointKey,
  state: BuyerReadinessState,
  blockers: BuyerReadinessBlocker[],
): string {
  if (state === "ready") {
    return `${CHECKPOINT_LABELS[checkpoint]} readiness is clear right now.`;
  }

  const first = blockers[0];
  if (!first) {
    return `${CHECKPOINT_LABELS[checkpoint]} readiness still needs attention.`;
  }

  if (state === "blocked") {
    return `${CHECKPOINT_LABELS[checkpoint]} is blocked by ${blockers.length} item${blockers.length === 1 ? "" : "s"}; start with ${first.title.toLowerCase()}.`;
  }

  return `${CHECKPOINT_LABELS[checkpoint]} has ${blockers.length} item${blockers.length === 1 ? "" : "s"} to clear; start with ${first.title.toLowerCase()}.`;
}

function buildBuyerSummary(
  currentCheckpoint: BuyerReadinessCheckpoint,
  blockers: BuyerReadinessBlocker[],
): BuyerReadinessSummary {
  const scoped = blockers.filter((blocker) =>
    blocker.checkpoints.includes(currentCheckpoint.key),
  );
  const nextSteps = Array.from(
    new Set(scoped.map((blocker) => blocker.buyerAction).filter(Boolean)),
  ).slice(0, 3);

  if (currentCheckpoint.state === "ready") {
    return {
      headline: `Ready to ${currentCheckpoint.label.toLowerCase()}`,
      body: `${currentCheckpoint.label} readiness is clear. Keep moving, and this card will call out anything that changes on the agreement, financing, document, or confidence side.`,
      nextSteps:
        nextSteps.length > 0
          ? nextSteps
          : ["Proceed with the current step while watching for new blockers."],
    };
  }

  const first = scoped[0];
  return {
    headline:
      currentCheckpoint.state === "blocked"
        ? `Not ready to ${currentCheckpoint.label.toLowerCase()} yet`
        : `${currentCheckpoint.label} still needs a few clears`,
    body:
      first?.summary ??
      `${currentCheckpoint.label} is waiting on outstanding readiness blockers.`,
    nextSteps:
      nextSteps.length > 0
        ? nextSteps
        : ["Clear the current blockers before relying on this step."],
  };
}

function stripInternalBlockerFields(
  blocker: BuyerReadinessBlocker,
): BuyerReadinessBlocker {
  return {
    ...blocker,
    internal: undefined,
  };
}

function countInternalBlockers(blockers: BuyerReadinessBlocker[]) {
  return blockers.reduce(
    (counts, blocker) => {
      if (!blocker.internal) return counts;
      counts[blocker.internal.owner] += 1;
      counts[blocker.internal.severity] += 1;
      return counts;
    },
    {
      buyer: 0,
      broker: 0,
      system: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
  );
}

function compareBlockers(
  left: BuyerReadinessBlocker,
  right: BuyerReadinessBlocker,
): number {
  if (left.effect !== right.effect) {
    return left.effect === "blocks" ? -1 : 1;
  }

  const leftSeverity = left.internal?.severity ?? "low";
  const rightSeverity = right.internal?.severity ?? "low";
  if (leftSeverity !== rightSeverity) {
    return SEVERITY_ORDER[leftSeverity] - SEVERITY_ORDER[rightSeverity];
  }

  return left.title.localeCompare(right.title);
}

function mapDealStatusToStage(status: DealStatus): BuyerReadinessCheckpointKey {
  switch (status) {
    case "offer_prep":
      return "offer";
    case "offer_sent":
      return "negotiate";
    case "under_contract":
    case "closing":
    case "closed":
      return "close";
    case "intake":
    case "analysis":
    case "tour_scheduled":
    case "withdrawn":
    default:
      return "tour";
  }
}

function createBlocker(args: {
  id: string;
  title: string;
  summary: string;
  buyerAction: string;
  effect: BuyerReadinessBlockerEffect;
  checkpoints: BuyerReadinessCheckpointKey[];
  owner: BuyerReadinessBlockerOwner;
  severity: BuyerReadinessBlockerSeverity;
  reasonCode: BuyerReadinessReasonCode;
  remediation: string;
  supportingSignals: string[];
}): BuyerReadinessBlocker {
  return {
    id: args.id,
    title: args.title,
    summary: args.summary,
    buyerAction: args.buyerAction,
    effect: args.effect,
    checkpoints: args.checkpoints,
    internal: {
      owner: args.owner,
      severity: args.severity,
      reasonCode: args.reasonCode,
      remediation: args.remediation,
      supportingSignals: args.supportingSignals,
    },
  };
}

function classifyPreApprovalExpiry(
  expiry: string | undefined,
): "clear" | "expiring" | "expired" {
  if (!expiry) return "clear";
  const expiryDate = new Date(`${expiry.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(expiryDate.getTime())) return "clear";

  const now = new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const ms = expiryDate.getTime() - today.getTime();
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 14) return "expiring";
  return "clear";
}

function inferMilestoneOwner(
  milestone: BuyerReadinessMilestoneInput,
): BuyerReadinessBlockerOwner {
  const lower = milestone.name.toLowerCase();
  if (BUYER_MILESTONE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "buyer";
  }

  if (milestone.workstream === "insurance" || milestone.workstream === "walkthrough") {
    return "buyer";
  }

  return "broker";
}

function mapDocumentToCheckpoints(
  documentType: BuyerReadinessDocumentInput["documentType"],
): BuyerReadinessCheckpointKey[] {
  switch (documentType) {
    case "seller_disclosure":
    case "hoa_doc":
    case "hoa_document":
    case "inspection_report":
      return ["negotiate"];
    case "loan_estimate":
      return ["offer", "close"];
    case "title_commitment":
    case "purchase_contract":
    case "survey":
    case "appraisal":
      return ["close"];
    case "other":
    default:
      return [];
  }
}

function documentLabel(
  documentType: BuyerReadinessDocumentInput["documentType"],
): string {
  switch (documentType) {
    case "seller_disclosure":
      return "Seller disclosure";
    case "hoa_doc":
    case "hoa_document":
      return "HOA document";
    case "inspection_report":
      return "Inspection report";
    case "title_commitment":
      return "Title commitment";
    case "survey":
      return "Survey";
    case "appraisal":
      return "Appraisal";
    case "loan_estimate":
      return "Loan estimate";
    case "purchase_contract":
      return "Purchase contract";
    default:
      return "Document";
  }
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
