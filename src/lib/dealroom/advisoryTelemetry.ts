import { track, type AnalyticsEventMap } from "@/lib/analytics";
import type {
  AdvisoryNextActionTarget,
  AdvisoryRecommendationDecision,
  AdvisorySourceTraceTrigger,
  AdvisorySummaryShareMethod,
  AdvisorySurface,
} from "@/lib/analyticsEvents/contract";
import type {
  PropertyCaseClaimView,
  PropertyCaseOverviewSurface,
  PropertyCaseSourceView,
} from "@/lib/dealroom/property-case-overview";

interface AdvisoryTelemetryBase {
  dealRoomId: string;
  propertyId: string;
  actorRole: PropertyCaseOverviewSurface["viewerRole"];
  surface: AdvisorySurface;
  variant: PropertyCaseOverviewSurface["variant"];
  viewState: PropertyCaseOverviewSurface["viewState"];
  claimCount: number;
  sourceCount: number;
  missingSignalCount: number;
  coverageAvailableCount: number;
  coveragePendingCount: number;
  coverageUncertainCount: number;
  coverageMissingCount: number;
  generatedAt?: string;
  overallConfidence?: number;
  recommendationConfidence?: number;
}

function buildBasePayload(
  overview: PropertyCaseOverviewSurface,
  surface: AdvisorySurface = "deal_room_overview",
): AdvisoryTelemetryBase {
  return {
    dealRoomId: overview.dealRoomId,
    propertyId: overview.propertyId,
    actorRole: overview.viewerRole,
    surface,
    variant: overview.variant,
    viewState: overview.viewState,
    claimCount: overview.claims.length,
    sourceCount: overview.sources.length,
    missingSignalCount: overview.missingStates.length,
    coverageAvailableCount: overview.coverageStats.availableCount,
    coveragePendingCount: overview.coverageStats.pendingCount,
    coverageUncertainCount: overview.coverageStats.uncertainCount,
    coverageMissingCount: overview.coverageStats.missingCount,
    ...(overview.generatedAt ? { generatedAt: overview.generatedAt } : {}),
    ...(typeof overview.overallConfidence === "number"
      ? { overallConfidence: overview.overallConfidence }
      : {}),
    ...(overview.action
      ? { recommendationConfidence: overview.action.confidence }
      : {}),
  };
}

export function buildBuyerSafeSummaryText(
  overview: PropertyCaseOverviewSurface,
): string {
  const strongEvidence = Array.from(
    new Set(overview.confidenceSections.flatMap((section) => section.strongEvidence)),
  ).slice(0, 3);
  const cautionEvidence = Array.from(
    new Set(
      overview.confidenceSections.flatMap((section) => [
        ...section.missingEvidence,
        ...section.contradictoryEvidence,
      ]),
    ),
  ).slice(0, 3);
  const nextSteps = Array.from(
    new Set(
      overview.confidenceSections.flatMap(
        (section) => section.whatWouldIncreaseConfidence,
      ),
    ),
  ).slice(0, 2);
  const lines = [
    `${overview.propertyAddress}`,
    `${overview.status.label}. ${overview.headerDescription}`,
    `Confidence: ${overview.overallConfidenceLabel}.`,
  ];

  if (overview.action) {
    lines.push(
      `Recommended opener: ${overview.action.openingPriceLabel} (${overview.action.confidenceLabel}, ${overview.action.riskLabel.toLowerCase()}).`,
    );
    if (overview.action.reviewedConclusion) {
      lines.push(`Broker-reviewed conclusion: ${overview.action.reviewedConclusion}`);
    } else if (overview.action.buyerExplanation) {
      lines.push(`Broker-reviewed explanation: ${overview.action.buyerExplanation}`);
    }
  } else {
    lines.push("Recommendation: No opener is being surfaced yet.");
  }

  if (overview.keyTakeaways.length > 0) {
    lines.push(
      `Key takeaways: ${overview.keyTakeaways
        .map((takeaway) => `${takeaway.title}: ${takeaway.body}`)
        .join(" ")}`,
    );
  }

  if (strongEvidence.length > 0) {
    lines.push(`Strong evidence: ${strongEvidence.join(", ")}.`);
  }

  if (overview.missingStates.length > 0) {
    lines.push(
      `Still verifying: ${overview.missingStates
        .map((state) => state.label)
        .join(", ")}.`,
    );
  }

  if (cautionEvidence.length > 0) {
    lines.push(`Missing or conflicting evidence: ${cautionEvidence.join(", ")}.`);
  }

  if (nextSteps.length > 0) {
    lines.push(`What would increase confidence: ${nextSteps.join(" ")}`);
  }

  return lines.join("\n");
}

export function buildAdvisoryMemoViewedPayload(
  overview: PropertyCaseOverviewSurface,
): AnalyticsEventMap["advisory_memo_viewed"] {
  return {
    ...buildBasePayload(overview),
    hasRecommendation: overview.action !== null,
  };
}

export function trackAdvisoryMemoViewed(
  overview: PropertyCaseOverviewSurface,
): void {
  track("advisory_memo_viewed", buildAdvisoryMemoViewedPayload(overview));
}

export function buildAdvisoryRecommendationViewedPayload(
  overview: PropertyCaseOverviewSurface,
): AnalyticsEventMap["advisory_recommendation_viewed"] | null {
  if (!overview.action) return null;

  return {
    ...buildBasePayload(overview),
    openingPrice: overview.action.openingPrice,
    recommendationConfidence: overview.action.confidence,
    riskLevel: overview.action.riskLevel,
    suggestedContingencyCount: overview.action.suggestedContingencies.length,
    rationaleCount: overview.action.rationale.length,
  };
}

export function trackAdvisoryRecommendationViewed(
  overview: PropertyCaseOverviewSurface,
): void {
  const payload = buildAdvisoryRecommendationViewedPayload(overview);
  if (!payload) return;
  track("advisory_recommendation_viewed", payload);
}

export function buildAdvisoryNextBestActionPayload(
  overview: PropertyCaseOverviewSurface,
  input: {
    target: AdvisoryNextActionTarget;
    ctaId: string;
    nextActionLabel?: string;
  },
): AnalyticsEventMap["advisory_next_best_action_clicked"] {
  return {
    ...buildBasePayload(overview),
    target: input.target,
    ctaId: input.ctaId,
    ...(input.nextActionLabel ? { nextActionLabel: input.nextActionLabel } : {}),
  };
}

export function trackAdvisoryNextBestActionClicked(
  overview: PropertyCaseOverviewSurface,
  input: {
    target: AdvisoryNextActionTarget;
    ctaId: string;
    nextActionLabel?: string;
  },
): void {
  track(
    "advisory_next_best_action_clicked",
    buildAdvisoryNextBestActionPayload(overview, input),
  );
}

export function buildAdvisoryConfidenceDetailsPayload(
  overview: PropertyCaseOverviewSurface,
): AnalyticsEventMap["advisory_confidence_details_expanded"] {
  return buildBasePayload(overview);
}

export function trackAdvisoryConfidenceDetailsExpanded(
  overview: PropertyCaseOverviewSurface,
): void {
  track(
    "advisory_confidence_details_expanded",
    buildAdvisoryConfidenceDetailsPayload(overview),
  );
}

export function buildAdvisorySourceTraceOpenedPayload(
  overview: PropertyCaseOverviewSurface,
  input: {
    source: PropertyCaseSourceView;
    trigger: AdvisorySourceTraceTrigger;
    claim?: PropertyCaseClaimView;
  },
): AnalyticsEventMap["advisory_source_trace_opened"] {
  return {
    ...buildBasePayload(overview),
    citationId: input.source.citationId,
    engineType: input.source.engineType ?? "unknown",
    linkedClaimCount: input.source.claimCount,
    sourceStatus: input.source.status,
    trigger: input.trigger,
    ...(input.claim ? { claimTopic: input.claim.topic } : {}),
  };
}

export function trackAdvisorySourceTraceOpened(
  overview: PropertyCaseOverviewSurface,
  input: {
    source: PropertyCaseSourceView;
    trigger: AdvisorySourceTraceTrigger;
    claim?: PropertyCaseClaimView;
  },
): void {
  track(
    "advisory_source_trace_opened",
    buildAdvisorySourceTraceOpenedPayload(overview, input),
  );
}

export function buildAdvisoryBrokerAdjudicationOpenedPayload(
  overview: Extract<PropertyCaseOverviewSurface, { variant: "internal" }>,
): AnalyticsEventMap["advisory_broker_adjudication_opened"] {
  return {
    ...buildBasePayload(overview),
    actorRole: overview.viewerRole,
    variant: "internal",
    pendingSourceCount: overview.internal.adjudicationSummary.pendingCount,
    approvedSourceCount: overview.internal.adjudicationSummary.approvedCount,
    rejectedSourceCount: overview.internal.adjudicationSummary.rejectedCount,
  };
}

export function trackAdvisoryBrokerAdjudicationOpened(
  overview: Extract<PropertyCaseOverviewSurface, { variant: "internal" }>,
): void {
  track(
    "advisory_broker_adjudication_opened",
    buildAdvisoryBrokerAdjudicationOpenedPayload(overview),
  );
}

export function buildAdvisorySummaryCopiedPayload(
  overview: PropertyCaseOverviewSurface,
  summaryText: string,
): AnalyticsEventMap["advisory_buyer_safe_summary_copied"] {
  return {
    ...buildBasePayload(overview),
    summaryLength: summaryText.length,
    includesRecommendation: overview.action !== null,
  };
}

export function trackAdvisorySummaryCopied(
  overview: PropertyCaseOverviewSurface,
  summaryText: string,
): void {
  track(
    "advisory_buyer_safe_summary_copied",
    buildAdvisorySummaryCopiedPayload(overview, summaryText),
  );
}

export function buildAdvisorySummarySharedPayload(
  overview: PropertyCaseOverviewSurface,
  input: {
    summaryText: string;
    method: AdvisorySummaryShareMethod;
  },
): AnalyticsEventMap["advisory_buyer_safe_summary_shared"] {
  return {
    ...buildBasePayload(overview),
    method: input.method,
    summaryLength: input.summaryText.length,
    includesRecommendation: overview.action !== null,
  };
}

export function trackAdvisorySummaryShared(
  overview: PropertyCaseOverviewSurface,
  input: {
    summaryText: string;
    method: AdvisorySummaryShareMethod;
  },
): void {
  track(
    "advisory_buyer_safe_summary_shared",
    buildAdvisorySummarySharedPayload(overview, input),
  );
}

export function buildAdvisoryRecommendationFeedbackPayload(
  overview: PropertyCaseOverviewSurface,
  decision: AdvisoryRecommendationDecision,
): AnalyticsEventMap["advisory_recommendation_feedback_recorded"] {
  return {
    ...buildBasePayload(overview),
    decision,
  };
}

export function trackAdvisoryRecommendationFeedback(
  overview: PropertyCaseOverviewSurface,
  decision: AdvisoryRecommendationDecision,
): void {
  track(
    "advisory_recommendation_feedback_recorded",
    buildAdvisoryRecommendationFeedbackPayload(overview, decision),
  );
}
