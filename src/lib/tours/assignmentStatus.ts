export const TOUR_ASSIGNMENT_STATES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "canceled",
] as const;

export type TourAssignmentState = (typeof TOUR_ASSIGNMENT_STATES)[number];

export const ACTIVE_TOUR_ASSIGNMENT_STATES = [
  "pending",
  "confirmed",
  "in_progress",
] as const;

const LEGAL_ASSIGNMENT_TRANSITIONS: Record<
  TourAssignmentState,
  TourAssignmentState[]
> = {
  pending: ["confirmed", "canceled"],
  confirmed: ["in_progress", "canceled"],
  in_progress: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export function isActiveTourAssignment(
  status: TourAssignmentState,
): boolean {
  return (
    ACTIVE_TOUR_ASSIGNMENT_STATES as readonly TourAssignmentState[]
  ).includes(status);
}

export function canTransitionTourAssignment(
  from: TourAssignmentState,
  to: TourAssignmentState,
): boolean {
  return LEGAL_ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function attemptTourAssignmentTransition(
  from: TourAssignmentState,
  to: TourAssignmentState,
):
  | { ok: true; next: TourAssignmentState }
  | { ok: false; code: "illegal_transition"; message: string } {
  if (!canTransitionTourAssignment(from, to)) {
    return {
      ok: false,
      code: "illegal_transition",
      message: `Cannot transition tour assignment from "${from}" to "${to}"`,
    };
  }

  return { ok: true, next: to };
}
