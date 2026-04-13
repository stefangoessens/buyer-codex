type Wave = "wave-1" | "wave-2" | "wave-3";
type ExitCriterionCategory = "usefulness" | "safety" | "trust" | "ux";

interface ReleaseIssueRef {
  id: `KIN-${number}`;
  title: string;
  wave: Wave;
}

interface MustHaveCapability {
  id: string;
  name: string;
  summary: string;
  issues: readonly ReleaseIssueRef[];
  dependsOn: readonly string[];
  whyItShipsInV11: string;
}

interface ReleaseStep {
  step: number;
  name: string;
  objective: string;
  issues: readonly ReleaseIssueRef[];
  dependsOnSteps: readonly number[];
  completionRule: string;
}

interface DeferredIssue {
  issue: ReleaseIssueRef;
  cutTo: "v1.2";
  reason: string;
  blockedBy?: readonly `KIN-${number}`[];
}

interface ExitCriterion {
  id: string;
  rule: string;
  evidenceFromIssues: readonly `KIN-${number}`[];
  failureAction: string;
}

const KIN_1017 = {
  id: "KIN-1017",
  title: "Re-own agreement, signed-state, and offer-eligibility workflow implementation",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1019 = {
  id: "KIN-1019",
  title: "Make Browser Use hosted extraction a first-class enrichment path, not just fallback",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1020 = {
  id: "KIN-1020",
  title: "Build market context engine for sold comps, avg price per sqft, DOM, and sale-to-list baselines",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1021 = {
  id: "KIN-1021",
  title: "Build property intelligence dossier from listing URL with exhaustive extracted insights",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1022 = {
  id: "KIN-1022",
  title: "buyer-codex / Buyer decisioning and advisory product layer",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1023 = {
  id: "KIN-1023",
  title: "Build decision confidence presentation layer for buyer-facing recommendations",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1024 = {
  id: "KIN-1024",
  title: "Build why-this-home / why-not-this-home decision memo",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1025 = {
  id: "KIN-1025",
  title: "Build next-best-action recommendation engine for property decisions",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1026 = {
  id: "KIN-1026",
  title: "Build buyer readiness score and blocker surface",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1027 = {
  id: "KIN-1027",
  title: "Build neighborhood reality surface on top of market context engine",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1029 = {
  id: "KIN-1029",
  title: "Build counterfactual and what-if reasoning layer for offer timing and pricing",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1030 = {
  id: "KIN-1030",
  title: "Build broker adjudication lane for AI conclusions and buyer-safe overrides",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1032 = {
  id: "KIN-1032",
  title: "Build negotiation playbook surface for offer strategy and fallback paths",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1033 = {
  id: "KIN-1033",
  title: "Build client-ready summary surface from internal property intelligence",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1034 = {
  id: "KIN-1034",
  title: "Build compliance guardrails for AI-generated pricing, negotiation, and legal-adjacent guidance",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1035 = {
  id: "KIN-1035",
  title: "Build evidence graph and source trace for every major property conclusion",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1042 = {
  id: "KIN-1042",
  title: "Instrument decisioning telemetry, interaction analytics, and calibration signals",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1044 = {
  id: "KIN-1044",
  title: "Improve intake reliability, recovery UX, and source-coverage metrics",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1045 = {
  id: "KIN-1045",
  title: "Wire broker overrides into confidence and recommendation recalibration",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1046 = {
  id: "KIN-1046",
  title: "Define deal-room IA and composition for advisory surfaces",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1047 = {
  id: "KIN-1047",
  title: "Define sparse-data, loading, error, and recovery UX for advisory outputs",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1048 = {
  id: "KIN-1048",
  title: "Define v1.1 decisioning release criteria and cut line",
  wave: "wave-1",
} as const satisfies ReleaseIssueRef;

const KIN_1049 = {
  id: "KIN-1049",
  title: "Run advisory usability and comprehension testing with buyers and brokers",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

const KIN_1050 = {
  id: "KIN-1050",
  title: "Define mobile and iOS surfacing for v1.1 decisioning outputs",
  wave: "wave-2",
} as const satisfies ReleaseIssueRef;

export const V11_DECISIONING_RELEASE_PLAN = {
  version: "1.0.0",
  lastUpdated: "2026-04-13",
  release: "v1.1 decisioning",
  ownerIssue: KIN_1048,
  parentIssue: KIN_1022,
  launchDefinition:
    "v1.1 ships one trustworthy web decision memo experience for a single property. The launch is defined by reliable intake, a canonical dossier, visible evidence, buyer-safe confidence, compliance guardrails, broker adjudication, sparse-data UX, and telemetry. It is not a full readiness workflow, negotiation cockpit, counterfactual lab, client-summary packaging, or mobile-parity release.",
  hardCutRule:
    "Only the must-have capabilities in this contract can block v1.1. Every cut item moves to v1.2 unless an existing must-have is explicitly removed one-for-one. wave-3 issues are non-gating for this launch by default.",
  primarySurfacePolicy: {
    primarySurface: KIN_1024,
    supportingDrilldowns: [KIN_1023, KIN_1035, KIN_1030],
    deferredPeerSurfaces: [KIN_1025, KIN_1027, KIN_1029, KIN_1032, KIN_1033],
    platformRule:
      "Ship decisioning on web first. Do not block the web launch on KIN-1050 mobile/iOS parity.",
  },
  mustHaveCapabilities: [
    {
      id: "advisory-shell-contract",
      name: "Coherent advisory IA and imperfect-data UX",
      summary:
        "Lock the page composition and sparse-data rules before feature work multiplies surface area.",
      issues: [KIN_1046, KIN_1047],
      dependsOn: [],
      whyItShipsInV11:
        "Without KIN-1046 and KIN-1047, v1.1 becomes a pile of widgets that overclaims when data is missing or conflicting.",
    },
    {
      id: "intake-to-dossier-foundation",
      name: "Reliable intake and canonical property dossier",
      summary:
        "Turn pasted listing URLs into a typed dossier with market context, recovery UX, and measurable source reliability.",
      issues: [KIN_1044, KIN_1019, KIN_1020, KIN_1021],
      dependsOn: [],
      whyItShipsInV11:
        "The advisory layer is worthless if the front door fails or if downstream systems cannot share one canonical property object.",
    },
    {
      id: "traceable-confidence",
      name: "Evidence graph and buyer-safe confidence explanation",
      summary:
        "Every major conclusion needs visible provenance, uncertainty, and what would change the answer.",
      issues: [KIN_1035, KIN_1023],
      dependsOn: ["intake-to-dossier-foundation"],
      whyItShipsInV11:
        "v1.1 must launch as a defensible advisory product, not an opaque score generator.",
    },
    {
      id: "safety-and-human-review",
      name: "Compliance guardrails and broker adjudication",
      summary:
        "Sensitive outputs are gated, reviewable, and explicitly buyer-safe before they are shown.",
      issues: [KIN_1034, KIN_1030],
      dependsOn: ["intake-to-dossier-foundation"],
      whyItShipsInV11:
        "A launch without typed guardrails or audited review paths creates compliance and trust failures immediately.",
    },
    {
      id: "decision-memo",
      name: "Single top-level why-this-home / why-not-this-home memo",
      summary:
        "Ship one coherent memo artifact as the primary buyer-facing decision surface for v1.1.",
      issues: [KIN_1024],
      dependsOn: [
        "advisory-shell-contract",
        "intake-to-dossier-foundation",
        "traceable-confidence",
        "safety-and-human-review",
      ],
      whyItShipsInV11:
        "KIN-1024 already carries the current recommendation, upside, downside, and unknowns in one artifact, so it is the right cut line for the first launch surface.",
    },
    {
      id: "decisioning-telemetry",
      name: "Typed telemetry for usefulness and trust",
      summary:
        "Measure whether buyers and brokers use, expand, trust, and override the advisory layer.",
      issues: [KIN_1042],
      dependsOn: ["traceable-confidence", "safety-and-human-review", "decision-memo"],
      whyItShipsInV11:
        "Without KIN-1042 the team cannot tell whether the memo, confidence, and review flows are useful enough to keep shipping.",
    },
  ] as const satisfies readonly MustHaveCapability[],
  releaseOrder: [
    {
      step: 1,
      name: "Contract the shell before surface sprawl",
      objective:
        "Define the primary memo-first layout and the loading/conflict/recovery rules that every later surface must obey.",
      issues: [KIN_1046, KIN_1047],
      dependsOnSteps: [],
      completionRule:
        "Memo is designated as the only required top-level decision surface and sparse/conflicting-data behavior is explicit.",
    },
    {
      step: 2,
      name: "Stabilize the front door and canonical substrate",
      objective:
        "Make intake reliable by source, recover gracefully, and assemble one typed dossier plus market context model.",
      issues: [KIN_1044, KIN_1019, KIN_1020, KIN_1021],
      dependsOnSteps: [1],
      completionRule:
        "A pasted property URL reliably resolves to a measurable, replayable dossier with provenance, confidence, and market baselines.",
    },
    {
      step: 3,
      name: "Add visible traceability and output guardrails",
      objective:
        "Build the evidence graph and typed compliance layer before any buyer-facing explanation claims certainty.",
      issues: [KIN_1035, KIN_1034],
      dependsOnSteps: [2],
      completionRule:
        "Every major conclusion has provenance and every sensitive class resolves to can-say, cannot-say, or review-required.",
    },
    {
      step: 4,
      name: "Enable confidence explanation and human review",
      objective:
        "Put buyer-safe confidence language and broker adjudication on top of the evidence and compliance layers.",
      issues: [KIN_1023, KIN_1030],
      dependsOnSteps: [3],
      completionRule:
        "Confidence is explainable in plain language and brokers can audit, adjust, or override sensitive outputs with rationale.",
    },
    {
      step: 5,
      name: "Ship the memo as the v1.1 launch surface",
      objective:
        "Render a single why-this-home / why-not-this-home memo backed by the dossier, confidence, and review state.",
      issues: [KIN_1024],
      dependsOnSteps: [1, 2, 3, 4],
      completionRule:
        "The memo is coherent on the happy path, honest on the imperfect-data path, and clearly separates buyer-safe from internal detail.",
    },
    {
      step: 6,
      name: "Instrument what people actually use and trust",
      objective:
        "Emit typed events for memo usage, confidence drill-downs, source-trace opens, and adjudication actions.",
      issues: [KIN_1042],
      dependsOnSteps: [4, 5],
      completionRule:
        "Launch-critical decisioning interactions are measurable enough to judge usefulness, trust, and override behavior.",
    },
    {
      step: 7,
      name: "Run comprehension validation before broad launch",
      objective:
        "Validate the memo, confidence, and trace surfaces with buyers and brokers before treating the release as launch-ready.",
      issues: [KIN_1049],
      dependsOnSteps: [5, 6],
      completionRule:
        "KIN-1049 produces structured findings with no unresolved critical confusion on the shipped memo-first experience.",
    },
  ] as const satisfies readonly ReleaseStep[],
  preLaunchValidationIssues: [KIN_1049] as const satisfies readonly ReleaseIssueRef[],
  cutToV12: [
    {
      issue: KIN_1025,
      cutTo: "v1.2",
      reason:
        "The memo in KIN-1024 is enough for v1.1. A typed next-best-action engine expands scope into workflow orchestration and prescriptive CTA logic before the core memo is trusted.",
      blockedBy: ["KIN-1026", "KIN-1030", "KIN-1047", "KIN-1023", "KIN-1021", "KIN-1034"],
    },
    {
      issue: KIN_1026,
      cutTo: "v1.2",
      reason:
        "Buyer readiness depends on regulated agreement and signed-state foundations. That is a larger product slice than the first memo-based decisioning launch.",
      blockedBy: [KIN_1017.id],
    },
    {
      issue: KIN_1027,
      cutTo: "v1.2",
      reason:
        "Neighborhood reality is valuable, but v1.1 already consumes KIN-1020 market context inside the memo. A standalone neighborhood surface is additive, not launch-critical.",
      blockedBy: [KIN_1020.id],
    },
    {
      issue: KIN_1029,
      cutTo: "v1.2",
      reason:
        "Counterfactual reasoning should land only after the base memo, evidence, and confidence layers prove understandable and trustworthy in production.",
    },
    {
      issue: KIN_1032,
      cutTo: "v1.2",
      reason:
        "Negotiation playbooks are stronger guidance than the first launch should promise. They should follow once the evidence, guardrail, and memo stack is stable.",
      blockedBy: [KIN_1020.id, KIN_1021.id, KIN_1023.id, KIN_1034.id],
    },
    {
      issue: KIN_1033,
      cutTo: "v1.2",
      reason:
        "A separate client-ready summary is packaging on top of the buyer-safe memo, not a prerequisite for the first decisioning release.",
      blockedBy: [KIN_1024.id, KIN_1030.id, KIN_1034.id],
    },
    {
      issue: KIN_1045,
      cutTo: "v1.2",
      reason:
        "Override-driven recalibration is a post-launch learning loop. v1.1 only needs adjudication capture plus telemetry, not closed-loop tuning.",
      blockedBy: [KIN_1030.id, KIN_1042.id],
    },
    {
      issue: KIN_1050,
      cutTo: "v1.2",
      reason:
        "The decisioning release is web-first. Mobile and iOS parity stay deferred until the memo-first composition proves itself on desktop and web mobile.",
    },
  ] as const satisfies readonly DeferredIssue[],
  exitCriteria: {
    usefulness: [
      {
        id: "memo-is-actionable-without-extra-tabs",
        rule:
          "Every launch property can render the KIN-1024 memo with upside, downside, unknowns, and a current recommendation from typed inputs. v1.1 does not ship if the buyer still has to assemble the case from disconnected widgets.",
        evidenceFromIssues: [KIN_1021.id, KIN_1024.id],
        failureAction:
          "Block launch and simplify the shipped surface back to the memo until the case can be understood in one pass.",
      },
      {
        id: "usage-is-measurable",
        rule:
          "Typed KIN-1042 events exist for memo views, confidence expands, source-trace opens, and adjudication actions so usefulness is measurable on day one.",
        evidenceFromIssues: [KIN_1042.id],
        failureAction:
          "Do not broaden rollout beyond internal and design-partner usage until the missing telemetry is present.",
      },
    ],
    safety: [
      {
        id: "guarded-output-never-bypasses-review",
        rule:
          "Pricing-sensitive, legal-adjacent, and review-required outputs always resolve through KIN-1034 before buyer exposure. There is no direct buyer path around the typed guardrail state.",
        evidenceFromIssues: [KIN_1034.id],
        failureAction:
          "Treat the release as no-go and cut the offending surface or output class immediately.",
      },
      {
        id: "human-review-is-a-first-class-lane",
        rule:
          "Brokers can approve, adjust, or override guarded conclusions through KIN-1030 with rationale and buyer-safe wording, and raw internal notes never leak to the buyer.",
        evidenceFromIssues: [KIN_1030.id, KIN_1034.id],
        failureAction:
          "Keep the affected memo sections internal-only until the adjudication path is in place.",
      },
      {
        id: "imperfect-data-withholds-claims",
        rule:
          "KIN-1047 sparse, loading, conflicting, and review-required states must withhold unsupported claims and point the buyer to a safe next step.",
        evidenceFromIssues: [KIN_1047.id],
        failureAction:
          "Block launch if any shipped surface falls back to generic N/A placeholders or pretends confidence that the dossier does not support.",
      },
    ],
    trust: [
      {
        id: "every-major-conclusion-has-trace-and-confidence",
        rule:
          "Every major memo conclusion exposes KIN-1035 source trace plus KIN-1023 buyer-safe confidence language that distinguishes strong evidence, missing evidence, and inference.",
        evidenceFromIssues: [KIN_1035.id, KIN_1023.id, KIN_1024.id],
        failureAction:
          "Cut the unsupported conclusion from the shipped memo until provenance and confidence are visible.",
      },
      {
        id: "front-door-weakness-is-visible",
        rule:
          "KIN-1044 source-level reliability, failure modes, and time-to-dossier metrics remain visible to the team so silent parser failure cannot masquerade as trustworthy advice.",
        evidenceFromIssues: [KIN_1044.id, KIN_1019.id, KIN_1021.id],
        failureAction:
          "Do not expand traffic sources or property coverage until the weak intake paths are explicitly measurable and recoverable.",
      },
    ],
    ux: [
      {
        id: "memo-first-layout-is-preserved",
        rule:
          "KIN-1046 composition stays memo-first: the decision memo is primary, confidence and source trace are drill-down support, and cut surfaces do not appear as peer top-level sections in v1.1.",
        evidenceFromIssues: [KIN_1046.id, KIN_1024.id, KIN_1023.id, KIN_1035.id],
        failureAction:
          "Remove the extra peer surfaces rather than expanding the IA again inside v1.1.",
      },
      {
        id: "buyers-and-brokers-can-explain-it-back",
        rule:
          "KIN-1049 comprehension validation must produce no unresolved critical confusion on the shipped memo, confidence, and source-trace flows before broad launch.",
        evidenceFromIssues: [KIN_1049.id],
        failureAction:
          "Keep the release in internal or limited rollout until the confusing language, layout, or drill-down behavior is fixed.",
      },
    ],
  } as const satisfies Readonly<Record<ExitCriterionCategory, readonly ExitCriterion[]>>,
} as const;

export function getV11DecisioningMustHaveIssueIds(): string[] {
  return V11_DECISIONING_RELEASE_PLAN.mustHaveCapabilities.flatMap((capability) =>
    capability.issues.map((issue) => issue.id)
  );
}

export function getV11DecisioningCutIssueIds(): string[] {
  return V11_DECISIONING_RELEASE_PLAN.cutToV12.map((entry) => entry.issue.id);
}
