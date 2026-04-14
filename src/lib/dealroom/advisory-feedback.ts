export const ADVISORY_FEEDBACK_ARTIFACTS = [
  "memo",
  "recommendation",
  "summary",
] as const;

export type AdvisoryFeedbackArtifact =
  (typeof ADVISORY_FEEDBACK_ARTIFACTS)[number];

export const ADVISORY_FEEDBACK_DIMENSIONS = [
  "usefulness",
  "trust",
  "clarity",
  "actionability",
] as const;

export type AdvisoryFeedbackDimension =
  (typeof ADVISORY_FEEDBACK_DIMENSIONS)[number];

export const ADVISORY_FEEDBACK_SENTIMENTS = [
  "positive",
  "negative",
] as const;

export type AdvisoryFeedbackSentiment =
  (typeof ADVISORY_FEEDBACK_SENTIMENTS)[number];

export const ADVISORY_FEEDBACK_REASON_CODES = [
  "too_vague",
  "missing_context",
  "missing_evidence",
  "hard_to_verify",
  "does_not_fit_my_plan",
  "missing_next_step",
  "too_aggressive",
  "too_conservative",
  "not_relevant",
] as const;

export type AdvisoryFeedbackReasonCode =
  (typeof ADVISORY_FEEDBACK_REASON_CODES)[number];

export interface AdvisoryFeedbackResponse {
  dimension: AdvisoryFeedbackDimension;
  sentiment: AdvisoryFeedbackSentiment;
}

export interface AdvisoryFeedbackSubmission {
  artifact: AdvisoryFeedbackArtifact;
  responses: AdvisoryFeedbackResponse[];
  reasonCodes: AdvisoryFeedbackReasonCode[];
}

export interface AdvisoryFeedbackDimensionControl {
  dimension: AdvisoryFeedbackDimension;
  label: string;
  positiveLabel: string;
  negativeLabel: string;
}

export interface AdvisoryFeedbackReasonOption {
  value: AdvisoryFeedbackReasonCode;
  label: string;
}

const DIMENSION_CONTROLS: AdvisoryFeedbackDimensionControl[] = [
  {
    dimension: "usefulness",
    label: "Usefulness",
    positiveLabel: "Useful",
    negativeLabel: "Not useful",
  },
  {
    dimension: "trust",
    label: "Trust",
    positiveLabel: "Trust it",
    negativeLabel: "Do not trust it",
  },
  {
    dimension: "clarity",
    label: "Clarity",
    positiveLabel: "Clear",
    negativeLabel: "Confusing",
  },
  {
    dimension: "actionability",
    label: "Actionability",
    positiveLabel: "Actionable",
    negativeLabel: "Not actionable",
  },
];

const REASON_LABELS: Record<AdvisoryFeedbackReasonCode, string> = {
  too_vague: "Too vague",
  missing_context: "Missing context",
  missing_evidence: "Missing evidence",
  hard_to_verify: "Hard to verify",
  does_not_fit_my_plan: "Does not fit my plan",
  missing_next_step: "Missing next step",
  too_aggressive: "Too aggressive",
  too_conservative: "Too conservative",
  not_relevant: "Not relevant",
};

const ARTIFACT_REASON_MAP: Record<
  AdvisoryFeedbackArtifact,
  Partial<
    Record<AdvisoryFeedbackDimension, AdvisoryFeedbackReasonCode[]>
  >
> = {
  memo: {
    usefulness: [
      "not_relevant",
      "missing_context",
      "missing_evidence",
      "too_vague",
    ],
    trust: ["missing_evidence", "hard_to_verify", "missing_context"],
    clarity: ["too_vague", "missing_context", "hard_to_verify"],
    actionability: ["missing_next_step", "does_not_fit_my_plan", "not_relevant"],
  },
  recommendation: {
    usefulness: [
      "not_relevant",
      "does_not_fit_my_plan",
      "missing_context",
    ],
    trust: ["missing_evidence", "hard_to_verify", "does_not_fit_my_plan"],
    clarity: ["too_vague", "missing_context", "missing_evidence"],
    actionability: [
      "missing_next_step",
      "too_aggressive",
      "too_conservative",
      "does_not_fit_my_plan",
    ],
  },
  summary: {
    usefulness: [
      "not_relevant",
      "missing_context",
      "missing_evidence",
      "too_vague",
    ],
    trust: ["missing_evidence", "hard_to_verify", "missing_context"],
    clarity: ["too_vague", "missing_context", "hard_to_verify"],
    actionability: ["missing_next_step", "does_not_fit_my_plan", "not_relevant"],
  },
};

export function advisoryFeedbackDimensionControls(): AdvisoryFeedbackDimensionControl[] {
  return DIMENSION_CONTROLS;
}

export function advisoryFeedbackArtifactLabel(
  artifact: AdvisoryFeedbackArtifact,
): string {
  switch (artifact) {
    case "memo":
      return "memo";
    case "recommendation":
      return "recommendation";
    case "summary":
      return "summary";
  }
}

export function advisoryFeedbackPrompt(
  artifact: AdvisoryFeedbackArtifact,
): string {
  switch (artifact) {
    case "memo":
      return "How did this memo land?";
    case "recommendation":
      return "How did this recommendation land?";
    case "summary":
      return "How did this summary land?";
  }
}

export function advisoryFeedbackReasonOptions(
  artifact: AdvisoryFeedbackArtifact,
  responses: AdvisoryFeedbackResponse[],
): AdvisoryFeedbackReasonOption[] {
  const reasonCodes = new Set<AdvisoryFeedbackReasonCode>();

  for (const response of responses) {
    if (response.sentiment !== "negative") continue;
    for (const reason of ARTIFACT_REASON_MAP[artifact][response.dimension] ?? []) {
      reasonCodes.add(reason);
    }
  }

  return Array.from(reasonCodes).map((value) => ({
    value,
    label: REASON_LABELS[value],
  }));
}

export function normalizeAdvisoryFeedbackResponses(
  responses: AdvisoryFeedbackResponse[],
): AdvisoryFeedbackResponse[] {
  const deduped = new Map<
    AdvisoryFeedbackDimension,
    AdvisoryFeedbackSentiment
  >();

  for (const response of responses) {
    deduped.set(response.dimension, response.sentiment);
  }

  return ADVISORY_FEEDBACK_DIMENSIONS.flatMap((dimension) => {
    const sentiment = deduped.get(dimension);
    return sentiment ? [{ dimension, sentiment }] : [];
  });
}

export function normalizeAdvisoryFeedbackReasonCodes(
  artifact: AdvisoryFeedbackArtifact,
  responses: AdvisoryFeedbackResponse[],
  reasonCodes: AdvisoryFeedbackReasonCode[],
): AdvisoryFeedbackReasonCode[] {
  const allowed = new Set(
    advisoryFeedbackReasonOptions(artifact, responses).map((option) => option.value),
  );

  return Array.from(new Set(reasonCodes)).filter((reason) => allowed.has(reason));
}
