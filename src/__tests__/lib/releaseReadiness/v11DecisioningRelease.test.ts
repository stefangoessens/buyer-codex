import { describe, expect, it } from "vitest";
import {
  V11_DECISIONING_RELEASE_PLAN,
  getV11DecisioningCutIssueIds,
  getV11DecisioningMustHaveIssueIds,
} from "@/lib/releaseReadiness/v11DecisioningRelease";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

describe("V11_DECISIONING_RELEASE_PLAN", () => {
  it("has a semver version and ISO date stamp", () => {
    expect(V11_DECISIONING_RELEASE_PLAN.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(V11_DECISIONING_RELEASE_PLAN.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("locks the launch to 5-7 must-have capabilities", () => {
    expect(V11_DECISIONING_RELEASE_PLAN.mustHaveCapabilities.length).toBeGreaterThanOrEqual(5);
    expect(V11_DECISIONING_RELEASE_PLAN.mustHaveCapabilities.length).toBeLessThanOrEqual(7);
  });

  it("uses concrete KIN issue ids across must-haves and cuts", () => {
    const issueIdPattern = /^KIN-\d+$/;

    for (const capability of V11_DECISIONING_RELEASE_PLAN.mustHaveCapabilities) {
      expect(capability.name.length).toBeGreaterThan(0);
      expect(capability.summary.length).toBeGreaterThan(0);
      expect(capability.issues.length).toBeGreaterThan(0);
      for (const issue of capability.issues) {
        expect(issue.id).toMatch(issueIdPattern);
        expect(issue.title.length).toBeGreaterThan(0);
      }
    }

    for (const cut of V11_DECISIONING_RELEASE_PLAN.cutToV12) {
      expect(cut.issue.id).toMatch(issueIdPattern);
      expect(cut.reason.length).toBeGreaterThan(0);
      expect(cut.cutTo).toBe("v1.2");
    }
  });

  it("keeps must-have, cut, and validation issue sets disjoint", () => {
    const mustHave = getV11DecisioningMustHaveIssueIds();
    const cut = getV11DecisioningCutIssueIds();
    const validation = V11_DECISIONING_RELEASE_PLAN.preLaunchValidationIssues.map(
      (issue) => issue.id
    );

    expect(unique(mustHave)).toHaveLength(mustHave.length);
    expect(unique(cut)).toHaveLength(cut.length);
    expect(unique(validation)).toHaveLength(validation.length);

    for (const issueId of mustHave) {
      expect(cut).not.toContain(issueId);
      expect(validation).not.toContain(issueId);
    }

    for (const issueId of validation) {
      expect(cut).not.toContain(issueId);
    }
  });

  it("keeps the memo as the only required top-level launch surface", () => {
    expect(V11_DECISIONING_RELEASE_PLAN.primarySurfacePolicy.primarySurface.id).toBe("KIN-1024");

    const supportingIds = V11_DECISIONING_RELEASE_PLAN.primarySurfacePolicy.supportingDrilldowns.map(
      (issue) => issue.id
    );
    const deferredIds = V11_DECISIONING_RELEASE_PLAN.primarySurfacePolicy.deferredPeerSurfaces.map(
      (issue) => issue.id
    );

    for (const issueId of supportingIds) {
      expect(getV11DecisioningMustHaveIssueIds()).toContain(issueId);
    }

    for (const issueId of deferredIds) {
      expect(getV11DecisioningCutIssueIds()).toContain(issueId);
    }
  });

  it("defines a dependency-aware release order", () => {
    const mustHaveOrValidationIds = new Set([
      ...getV11DecisioningMustHaveIssueIds(),
      ...V11_DECISIONING_RELEASE_PLAN.preLaunchValidationIssues.map((issue) => issue.id),
    ]);
    const steps = V11_DECISIONING_RELEASE_PLAN.releaseOrder;

    expect(steps.map((step) => step.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    for (const step of steps) {
      expect(step.objective.length).toBeGreaterThan(0);
      expect(step.completionRule.length).toBeGreaterThan(0);
      for (const dependency of step.dependsOnSteps) {
        expect(dependency).toBeLessThan(step.step);
      }
      for (const issue of step.issues) {
        expect(mustHaveOrValidationIds.has(issue.id)).toBe(true);
      }
    }
  });

  it("defines concrete exit criteria for usefulness, safety, trust, and UX", () => {
    const categories = Object.entries(V11_DECISIONING_RELEASE_PLAN.exitCriteria);
    const knownIssueIds = new Set([
      ...getV11DecisioningMustHaveIssueIds(),
      ...V11_DECISIONING_RELEASE_PLAN.preLaunchValidationIssues.map((issue) => issue.id),
    ]);

    expect(categories.map(([category]) => category)).toEqual([
      "usefulness",
      "safety",
      "trust",
      "ux",
    ]);

    for (const [, criteria] of categories) {
      expect(criteria.length).toBeGreaterThan(0);
      for (const criterion of criteria) {
        expect(criterion.rule.length).toBeGreaterThan(0);
        expect(criterion.failureAction.length).toBeGreaterThan(0);
        expect(criterion.evidenceFromIssues.length).toBeGreaterThan(0);
        for (const issueId of criterion.evidenceFromIssues) {
          expect(knownIssueIds.has(issueId)).toBe(true);
        }
      }
    }
  });

  it("keeps the hard cut rule explicit", () => {
    expect(V11_DECISIONING_RELEASE_PLAN.launchDefinition).toContain("decision memo");
    expect(V11_DECISIONING_RELEASE_PLAN.hardCutRule).toContain("v1.2");
    expect(V11_DECISIONING_RELEASE_PLAN.hardCutRule).toContain("wave-3");
  });
});
