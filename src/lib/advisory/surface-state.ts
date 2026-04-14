import type {
  EvidenceTraceStatus,
  RecommendationConfidenceBand,
  RecommendationEvidenceSectionKey,
} from "@/lib/dossier/types";
import type { AdvisoryGuardrailState } from "@/lib/advisory/guardrails";

export type AdvisorySurfaceKind =
  | "memo"
  | "recommendation"
  | "playbook"
  | "summary";

export type AdvisorySurfaceAudience = "buyer_safe" | "internal";

export type AdvisorySurfaceStateKind =
  | "loading"
  | "ready"
  | "partial"
  | "missing"
  | "conflicting"
  | "review_required"
  | "blocked";

export type AdvisorySurfaceTone = "neutral" | "info" | "warning" | "critical";

export interface AdvisoryEvidenceSectionInput {
  status: EvidenceTraceStatus;
  confidenceBand: RecommendationConfidenceBand;
  supportLabels: string[];
  missingLabels: string[];
  conflictingLabels: string[];
  caution: string | null;
  dependsOnInference: boolean;
}

export interface AdvisoryEvidenceSummary {
  status: EvidenceTraceStatus;
  confidenceBand: RecommendationConfidenceBand;
  supportLabels: string[];
  missingLabels: string[];
  conflictingLabels: string[];
  caution: string | null;
  dependsOnInference: boolean;
}

export interface AdvisorySurfaceState {
  surface: AdvisorySurfaceKind;
  audience: AdvisorySurfaceAudience;
  kind: AdvisorySurfaceStateKind;
  tone: AdvisorySurfaceTone;
  label: string;
  title: string;
  description: string;
  recoveryTitle: string;
  recoveryDescription: string;
  canRenderContent: boolean;
  withholdOutput: boolean;
}

export type AdvisoryEvidenceInputMap = Partial<
  Record<RecommendationEvidenceSectionKey, AdvisoryEvidenceSectionInput>
>;

interface BuildAdvisorySurfaceStateInput {
  surface: AdvisorySurfaceKind;
  audience?: AdvisorySurfaceAudience;
  isLoading?: boolean;
  evidence?: AdvisoryEvidenceSummary | null;
  guardrailState?: AdvisoryGuardrailState | null;
  hasRenderableContent: boolean;
}

const WAITING_SUMMARY: AdvisoryEvidenceSummary = {
  status: "waiting_on_evidence",
  confidenceBand: "waiting",
  supportLabels: [],
  missingLabels: [],
  conflictingLabels: [],
  caution: null,
  dependsOnInference: false,
};

function uniqueLabels(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function joinLabels(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function surfaceLabel(surface: AdvisorySurfaceKind): string {
  switch (surface) {
    case "memo":
      return "decision memo";
    case "recommendation":
      return "recommendation";
    case "playbook":
      return "negotiation playbook";
    case "summary":
      return "buyer-safe summary";
  }
}

function recoverableEvidenceText(evidence: AdvisoryEvidenceSummary): string {
  if (evidence.conflictingLabels.length > 0) {
    return joinLabels(evidence.conflictingLabels);
  }
  if (evidence.missingLabels.length > 0) {
    return joinLabels(evidence.missingLabels);
  }
  if (evidence.supportLabels.length > 0) {
    return joinLabels(evidence.supportLabels);
  }
  return "verified evidence";
}

export function projectAdvisoryEvidenceSection(
  input: {
    status: EvidenceTraceStatus;
    buyerSummary: {
      supportLabels: string[];
      caution: string | null;
      dependsOnInference: boolean;
    };
    confidenceInputs: {
      band: RecommendationConfidenceBand;
      missingLabels: string[];
      conflictingLabels: string[];
    };
  } | null | undefined,
): AdvisoryEvidenceSectionInput | null {
  if (!input) return null;

  return {
    status: input.status,
    confidenceBand: input.confidenceInputs.band,
    supportLabels: [...input.buyerSummary.supportLabels],
    missingLabels: [...input.confidenceInputs.missingLabels],
    conflictingLabels: [...input.confidenceInputs.conflictingLabels],
    caution: input.buyerSummary.caution,
    dependsOnInference: input.buyerSummary.dependsOnInference,
  };
}

export function summarizeAdvisoryEvidence(
  sections: Array<AdvisoryEvidenceSectionInput | null | undefined>,
): AdvisoryEvidenceSummary {
  const resolved = sections.filter(
    (section): section is AdvisoryEvidenceSectionInput => Boolean(section),
  );

  if (resolved.length === 0) {
    return WAITING_SUMMARY;
  }

  const supportLabels = uniqueLabels(
    resolved.flatMap((section) => section.supportLabels),
  );
  const missingLabels = uniqueLabels(
    resolved.flatMap((section) => section.missingLabels),
  );
  const conflictingLabels = uniqueLabels(
    resolved.flatMap((section) => section.conflictingLabels),
  );
  const caution =
    resolved.find((section) => section.caution)?.caution ??
    (conflictingLabels.length > 0
      ? `${joinLabels(conflictingLabels)} are still in conflict.`
      : missingLabels.length > 0
        ? `Still waiting on ${joinLabels(missingLabels)}.`
        : null);
  const dependsOnInference = resolved.some((section) => section.dependsOnInference);

  let status: EvidenceTraceStatus = "supported";
  if (resolved.some((section) => section.status === "conflicting_evidence")) {
    status = "conflicting_evidence";
  } else if (
    supportLabels.length === 0 &&
    resolved.every((section) => section.status === "waiting_on_evidence")
  ) {
    status = "waiting_on_evidence";
  } else if (
    resolved.some(
      (section) =>
        section.status === "mixed" || section.status === "waiting_on_evidence",
    ) ||
    missingLabels.length > 0
  ) {
    status = "mixed";
  }

  const confidenceBand: RecommendationConfidenceBand =
    status === "waiting_on_evidence"
      ? "waiting"
      : resolved.some((section) => section.confidenceBand === "low")
        ? "low"
        : resolved.some((section) => section.confidenceBand === "medium")
          ? "medium"
          : resolved.some((section) => section.confidenceBand === "waiting")
            ? "medium"
            : "high";

  return {
    status,
    confidenceBand,
    supportLabels,
    missingLabels,
    conflictingLabels,
    caution,
    dependsOnInference,
  };
}

export function buildAdvisorySurfaceState(
  input: BuildAdvisorySurfaceStateInput,
): AdvisorySurfaceState {
  const audience = input.audience ?? "buyer_safe";
  const evidence = input.evidence ?? WAITING_SUMMARY;
  const label = surfaceLabel(input.surface);
  const waitingOn = recoverableEvidenceText(evidence);
  const canShowInternals = audience === "internal";

  if (input.isLoading) {
    return {
      surface: input.surface,
      audience,
      kind: "loading",
      tone: "info",
      label: "Loading",
      title: `Loading ${label}`,
      description: `We are still assembling the verified inputs for this ${label}.`,
      recoveryTitle: "What to do now",
      recoveryDescription:
        "Wait for the current evidence pass to finish, then refresh this surface.",
      canRenderContent: false,
      withholdOutput: true,
    };
  }

  if (input.guardrailState === "blocked") {
    return {
      surface: input.surface,
      audience,
      kind: "blocked",
      tone: "critical",
      label: "Blocked",
      title: `${capitalize(label)} is blocked`,
      description: canShowInternals
        ? `Buyer-safe guardrails blocked this ${label}, so it should not be used without manual override.`
        : `Buyer-safe guardrails blocked this ${label}, so we are not showing it as advice.`,
      recoveryTitle: "Safe next step",
      recoveryDescription: canShowInternals
        ? "Use the evidence trace and adjudication tools before overriding or resurfacing this guidance."
        : "Rely on the grounded evidence already shown and keep strategy decisions with your broker.",
      canRenderContent: canShowInternals && input.hasRenderableContent,
      withholdOutput: !canShowInternals,
    };
  }

  if (input.guardrailState === "review_required") {
    return {
      surface: input.surface,
      audience,
      kind: "review_required",
      tone: "warning",
      label: "Review required",
      title: `${capitalize(label)} is waiting on review`,
      description: canShowInternals
        ? `This ${label} is still pending the required broker review before it becomes buyer-safe.`
        : `We are holding back this ${label} until a broker reviews the current guidance.`,
      recoveryTitle: "Safe next step",
      recoveryDescription: canShowInternals
        ? "Review the underlying evidence and either approve it for buyer-safe use or keep it internal."
        : "Ask your broker for the reviewed version before acting on this surface.",
      canRenderContent: canShowInternals && input.hasRenderableContent,
      withholdOutput: !canShowInternals,
    };
  }

  if (evidence.status === "conflicting_evidence") {
    const withholdOutput =
      input.surface !== "memo" || !input.hasRenderableContent;
    return {
      surface: input.surface,
      audience,
      kind: "conflicting",
      tone: "warning",
      label: "Conflicting evidence",
      title: `${capitalize(label)} is narrowed by conflicting evidence`,
      description: input.hasRenderableContent && input.surface === "memo"
        ? `Some grounded memo content is still visible, but ${waitingOn} conflict enough that the full ${label} should not be treated as settled.`
        : `We are holding back this ${label} because ${waitingOn} disagree in ways that materially change the advice.`,
      recoveryTitle: "Safe next step",
      recoveryDescription: canShowInternals
        ? "Resolve the conflicting sources in the dossier before using this surface as a decision aid."
        : "Wait for the conflicting sources to be reviewed before relying on this guidance.",
      canRenderContent:
        input.hasRenderableContent && input.surface === "memo" && !withholdOutput,
      withholdOutput,
    };
  }

  if (!input.hasRenderableContent) {
    return {
      surface: input.surface,
      audience,
      kind: "missing",
      tone: "neutral",
      label: "Insufficient data",
      title: `${capitalize(label)} is waiting on stronger evidence`,
      description:
        evidence.missingLabels.length > 0
          ? `We are not showing this ${label} yet because we still need ${waitingOn}.`
          : `We are not showing this ${label} yet because the dossier is still too thin to support it safely.`,
      recoveryTitle: "Safe next step",
      recoveryDescription:
        "Refresh the dossier, verify missing documents or local comps, and return once the missing evidence clears.",
      canRenderContent: false,
      withholdOutput: true,
    };
  }

  if (
    evidence.status === "mixed" ||
    evidence.missingLabels.length > 0 ||
    evidence.confidenceBand === "low"
  ) {
    return {
      surface: input.surface,
      audience,
      kind: "partial",
      tone: "info",
      label: "Partial",
      title: `${capitalize(label)} is only partially grounded`,
      description:
        evidence.missingLabels.length > 0
          ? `This ${label} only uses the evidence we trust now. We are still waiting on ${waitingOn}.`
          : `This ${label} is visible, but it still depends on incomplete or inference-heavy evidence.`,
      recoveryTitle: "Safe next step",
      recoveryDescription:
        input.surface === "summary"
          ? "Share only after the remaining evidence clears if you need a fuller buyer-safe summary."
          : "Use the grounded parts, but wait for the remaining evidence before treating this as the final answer.",
      canRenderContent: true,
      withholdOutput: false,
    };
  }

  return {
    surface: input.surface,
    audience,
    kind: "ready",
    tone: "neutral",
    label: "Ready",
    title: `${capitalize(label)} is grounded`,
    description:
      evidence.supportLabels.length > 0
        ? `This ${label} is grounded in ${waitingOn}.`
        : `This ${label} is grounded in the current verified dossier.`,
    recoveryTitle: "What to do now",
    recoveryDescription:
      input.surface === "summary"
        ? "You can copy or share this buyer-safe summary."
        : "You can use this surface as part of the current decision flow.",
    canRenderContent: true,
    withholdOutput: false,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
