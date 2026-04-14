import { describe, expect, it } from "vitest";

import {
  attemptTourAssignmentTransition,
  canTransitionTourAssignment,
  isActiveTourAssignment,
} from "@/lib/tours/assignmentStatus";

describe("tour assignment transitions", () => {
  it("allows the canonical pending -> confirmed -> in_progress -> completed path", () => {
    expect(canTransitionTourAssignment("pending", "confirmed")).toBe(true);
    expect(canTransitionTourAssignment("confirmed", "in_progress")).toBe(true);
    expect(canTransitionTourAssignment("in_progress", "completed")).toBe(true);
  });

  it("allows cancellation from active assignment states", () => {
    expect(canTransitionTourAssignment("pending", "canceled")).toBe(true);
    expect(canTransitionTourAssignment("confirmed", "canceled")).toBe(true);
    expect(canTransitionTourAssignment("in_progress", "canceled")).toBe(true);
  });

  it("rejects completed -> confirmed rewinds", () => {
    const result = attemptTourAssignmentTransition("completed", "confirmed");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("illegal_transition");
    }
  });
});

describe("isActiveTourAssignment", () => {
  it("marks only pending, confirmed, and in_progress as active", () => {
    expect(isActiveTourAssignment("pending")).toBe(true);
    expect(isActiveTourAssignment("confirmed")).toBe(true);
    expect(isActiveTourAssignment("in_progress")).toBe(true);
    expect(isActiveTourAssignment("completed")).toBe(false);
    expect(isActiveTourAssignment("canceled")).toBe(false);
  });
});
