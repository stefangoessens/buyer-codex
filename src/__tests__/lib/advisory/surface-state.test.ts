import { describe, expect, it } from "vitest";
import {
  buildAdvisorySurfaceState,
  summarizeAdvisoryEvidence,
} from "@/lib/advisory/surface-state";

describe("advisory surface state", () => {
  it("distinguishes loading from missing evidence", () => {
    const loading = buildAdvisorySurfaceState({
      surface: "memo",
      isLoading: true,
      hasRenderableContent: false,
    });
    const missing = buildAdvisorySurfaceState({
      surface: "memo",
      evidence: summarizeAdvisoryEvidence([
        {
          status: "waiting_on_evidence",
          confidenceBand: "waiting",
          supportLabels: [],
          missingLabels: ["recent comparable sales"],
          conflictingLabels: [],
          caution: "Still waiting on recent comparable sales.",
          dependsOnInference: false,
        },
      ]),
      hasRenderableContent: false,
    });

    expect(loading.kind).toBe("loading");
    expect(missing.kind).toBe("missing");
  });

  it("holds buyer-safe playbooks behind review-required guardrails", () => {
    const state = buildAdvisorySurfaceState({
      surface: "playbook",
      audience: "buyer_safe",
      evidence: summarizeAdvisoryEvidence([
        {
          status: "supported",
          confidenceBand: "medium",
          supportLabels: ["offer strategy"],
          missingLabels: [],
          conflictingLabels: [],
          caution: null,
          dependsOnInference: true,
        },
      ]),
      guardrailState: "review_required",
      hasRenderableContent: true,
    });

    expect(state.kind).toBe("review_required");
    expect(state.withholdOutput).toBe(true);
  });

  it("keeps internal playbooks visible while still labeling them review-required", () => {
    const state = buildAdvisorySurfaceState({
      surface: "playbook",
      audience: "internal",
      evidence: summarizeAdvisoryEvidence([
        {
          status: "supported",
          confidenceBand: "medium",
          supportLabels: ["offer strategy"],
          missingLabels: [],
          conflictingLabels: [],
          caution: null,
          dependsOnInference: true,
        },
      ]),
      guardrailState: "review_required",
      hasRenderableContent: true,
    });

    expect(state.kind).toBe("review_required");
    expect(state.withholdOutput).toBe(false);
    expect(state.canRenderContent).toBe(true);
  });

  it("treats conflicting memo evidence as visible-but-narrowed", () => {
    const state = buildAdvisorySurfaceState({
      surface: "memo",
      evidence: summarizeAdvisoryEvidence([
        {
          status: "conflicting_evidence",
          confidenceBand: "low",
          supportLabels: ["portal estimates"],
          missingLabels: [],
          conflictingLabels: ["listing history inputs"],
          caution: "Listing history inputs lowered confidence.",
          dependsOnInference: false,
        },
      ]),
      hasRenderableContent: true,
    });

    expect(state.kind).toBe("conflicting");
    expect(state.withholdOutput).toBe(false);
    expect(state.canRenderContent).toBe(true);
  });

  it("marks mixed evidence as partial when grounded content still exists", () => {
    const state = buildAdvisorySurfaceState({
      surface: "summary",
      evidence: summarizeAdvisoryEvidence([
        {
          status: "supported",
          confidenceBand: "medium",
          supportLabels: ["pricing output"],
          missingLabels: [],
          conflictingLabels: [],
          caution: null,
          dependsOnInference: false,
        },
        {
          status: "mixed",
          confidenceBand: "low",
          supportLabels: ["recent comparable sales"],
          missingLabels: ["market context"],
          conflictingLabels: [],
          caution: "Still waiting on market context.",
          dependsOnInference: false,
        },
      ]),
      hasRenderableContent: true,
    });

    expect(state.kind).toBe("partial");
    expect(state.withholdOutput).toBe(false);
  });
});
