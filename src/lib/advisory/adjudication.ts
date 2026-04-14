export const ADVISORY_ADJUDICATION_ACTIONS = [
  "approve",
  "adjust",
  "override",
] as const;

export type AdvisoryAdjudicationAction =
  (typeof ADVISORY_ADJUDICATION_ACTIONS)[number];

export const ADVISORY_ADJUDICATION_STATUSES = [
  "pending",
  "approved",
  "adjusted",
  "overridden",
] as const;

export type AdvisoryAdjudicationStatus =
  (typeof ADVISORY_ADJUDICATION_STATUSES)[number];

export const ADVISORY_ADJUDICATION_VISIBILITIES = [
  "buyer_safe",
  "internal_only",
] as const;

export type AdvisoryAdjudicationVisibility =
  (typeof ADVISORY_ADJUDICATION_VISIBILITIES)[number];

export type AdvisoryAdjudicationReviewState =
  | "pending"
  | "approved"
  | "rejected";

export interface AdvisoryAdjudicationSnapshot {
  status: AdvisoryAdjudicationStatus;
  action: AdvisoryAdjudicationAction;
  visibility: AdvisoryAdjudicationVisibility;
  rationale: string;
  reasonCategory?: string;
  reviewedConclusion?: string;
  buyerExplanation?: string;
  internalNotes?: string;
  actorUserId: string;
  actorName?: string | null;
  actedAt: string;
}

export interface AdvisoryAdjudicationHistoryEntry
  extends AdvisoryAdjudicationSnapshot {
  reviewStateBefore: AdvisoryAdjudicationReviewState;
  reviewStateAfter: AdvisoryAdjudicationReviewState;
}

export function adjudicationStatusLabel(
  status: AdvisoryAdjudicationStatus,
): string {
  switch (status) {
    case "pending":
      return "Pending review";
    case "approved":
      return "Approved as-is";
    case "adjusted":
      return "Adjusted";
    case "overridden":
      return "Overridden";
  }
}

export function adjudicationVisibilityLabel(
  visibility: AdvisoryAdjudicationVisibility,
): string {
  switch (visibility) {
    case "buyer_safe":
      return "Buyer-safe";
    case "internal_only":
      return "Internal only";
  }
}

export function adjudicationActionLabel(
  action: AdvisoryAdjudicationAction,
): string {
  switch (action) {
    case "approve":
      return "Approve";
    case "adjust":
      return "Adjust";
    case "override":
      return "Override";
  }
}

export function adjudicationReviewStateFromVisibility(
  visibility: AdvisoryAdjudicationVisibility,
): AdvisoryAdjudicationReviewState {
  return visibility === "buyer_safe" ? "approved" : "rejected";
}
