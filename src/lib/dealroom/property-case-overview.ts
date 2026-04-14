import type {
  ClaimTopic,
  ComparativeClaim,
  PropertyCase,
} from "@/lib/ai/engines/caseSynthesis";
import {
  RECOMMENDATION_EVIDENCE_SECTION_KEYS,
  type DossierSourceCategory,
  type PropertyEvidenceGraph,
  type RecommendationConfidenceBand,
  type RecommendationConfidenceReasonCode,
  type RecommendationEvidenceSection,
  type RecommendationEvidenceSectionKey,
} from "@/lib/dossier/types";
import {
  assessEngineOutputGuardrail,
  guardrailStateLabel,
  type AdvisoryApprovalPath,
  type AdvisoryGuardrailAssessment,
  type AdvisoryGuardrailState,
} from "@/lib/advisory/guardrails";
import {
  buildStatusBadge,
  type DealStatus,
  type SectionStatus,
  type StatusBadge,
} from "@/lib/dealroom/overview";

export type CoverageEngineKey = "pricing" | "comps" | "leverage" | "offer";
export type PropertyCaseOverviewVariant = "buyer_safe" | "internal";
export type PropertyCaseOverviewViewState = "ready" | "partial" | "empty";
export type PropertyCaseOverviewViewerRole = "buyer" | "broker" | "admin";

export interface PropertyCaseCoverageInput {
  key: CoverageEngineKey;
  status: SectionStatus;
  reason?: string;
  confidence?: number;
}

export interface PropertyCaseCitationInput {
  citationId: string;
  engineType: string;
  confidence?: number;
  generatedAt?: string;
  reviewState?: "pending" | "approved" | "rejected";
}

export interface BuildPropertyCaseOverviewInput {
  dealRoomId: string;
  propertyId: string;
  propertyAddress: string;
  listPrice: number | null;
  photoUrl: string | null;
  dealStatus: DealStatus;
  caseRecord:
    | {
        generatedAt: string;
        hitCount: number;
        payload: PropertyCase | null;
      }
    | null;
  coverage: PropertyCaseCoverageInput[];
  citations?: PropertyCaseCitationInput[];
  evidenceGraph?: Pick<
    PropertyEvidenceGraph,
    "fingerprint" | "replayKey" | "sections"
  > | null;
  viewerRole: "buyer" | "broker" | "admin";
}

export interface PropertyCaseTakeaway {
  title: string;
  body: string;
}

export interface PropertyCaseClaimView {
  id: string;
  topic: ClaimTopic;
  topicLabel: string;
  narrative: string;
  deltaLabel: string;
  referenceLine: string;
  confidence: number;
  confidenceLabel: string;
  confidenceTone: "strong" | "mixed" | "weak";
  citationId: string;
  sourceAnchorId: string;
  guardrailState: AdvisoryGuardrailState;
  guardrailLabel: string;
}

export interface PropertyCaseActionView {
  openingPrice: number;
  openingPriceLabel: string;
  confidence: number;
  confidenceLabel: string;
  riskLevel: "low" | "medium" | "high";
  riskLabel: string;
  suggestedContingencies: string[];
  rationale: PropertyCaseTakeaway[];
  guardrailState: AdvisoryGuardrailState;
  guardrailLabel: string;
  guardrailExplanation: string;
}

export interface PropertyCaseConfidenceSectionView {
  key: RecommendationEvidenceSectionKey;
  title: string;
  band: RecommendationConfidenceBand;
  bandLabel: string;
  score: number | null;
  scoreLabel: string;
  tone: "strong" | "mixed" | "weak";
  status: RecommendationEvidenceSection["status"];
  statusLabel: string;
  buyerHeadline: string;
  buyerExplanation: string;
  strongEvidence: string[];
  missingEvidence: string[];
  contradictoryEvidence: string[];
  whatWouldIncreaseConfidence: string[];
  dependsOnInference: boolean;
}

export interface InternalPropertyCaseConfidenceSectionView
  extends PropertyCaseConfidenceSectionView {
  internalSummary: string;
  sourceCategories: DossierSourceCategory[];
  reasonCodes: RecommendationConfidenceReasonCode[];
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
}

export interface PropertyCaseMissingState {
  engine: CoverageEngineKey;
  label: string;
  tone: "pending" | "uncertain" | "missing" | "review_required" | "blocked";
  title: string;
  description: string;
}

export interface PropertyCaseSourceView {
  citationId: string;
  anchorId: string;
  engineType: string | null;
  engineLabel: string;
  status: "available" | "pending" | "unavailable";
  reviewState: "pending" | "approved" | "rejected" | null;
  confidenceLabel: string;
  generatedAtLabel: string | null;
  claimCount: number;
  guardrailState: AdvisoryGuardrailState;
  guardrailLabel: string;
  approvalPath: AdvisoryApprovalPath;
}

export interface PropertyCaseCoverageStats {
  availableCount: number;
  pendingCount: number;
  uncertainCount: number;
  missingCount: number;
}

export interface PropertyCaseAdjudicationSummary {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

export interface PropertyCaseAdjudicationItem {
  citationId: string;
  engineType: string;
  engineLabel: string;
  reviewState: "pending" | "approved" | "rejected";
  confidence: number | null;
  confidenceLabel: string;
  generatedAt: string | null;
  generatedAtLabel: string | null;
  linkedClaimCount: number;
}

interface PropertyCaseOverviewBase {
  variant: PropertyCaseOverviewVariant;
  viewerRole: PropertyCaseOverviewViewerRole;
  dealRoomId: string;
  propertyId: string;
  propertyAddress: string;
  listPrice: number | null;
  listPriceLabel: string;
  photoUrl: string | null;
  status: StatusBadge;
  viewState: PropertyCaseOverviewViewState;
  generatedAt: string | null;
  generatedAtLabel: string;
  confidenceFingerprint: string | null;
  confidenceReplayKey: string | null;
  overallConfidence: number | null;
  overallConfidenceLabel: string;
  overallConfidenceTone: "strong" | "mixed" | "weak";
  coverageStats: PropertyCaseCoverageStats;
  coverageSummary: string;
  headerDescription: string;
  confidenceSections: PropertyCaseConfidenceSectionView[];
  claims: PropertyCaseClaimView[];
  keyTakeaways: PropertyCaseTakeaway[];
  action: PropertyCaseActionView | null;
  missingStates: PropertyCaseMissingState[];
  sources: PropertyCaseSourceView[];
}

export interface BuyerSafePropertyCaseOverview
  extends PropertyCaseOverviewBase {
  variant: "buyer_safe";
  viewerRole: "buyer";
  internal?: undefined;
}

export interface InternalPropertyCaseOverview
  extends PropertyCaseOverviewBase {
  variant: "internal";
  viewerRole: "broker" | "admin";
  internal: {
    inputHash: string | null;
    synthesisVersion: string | null;
    contributingEngines: number;
    droppedEngines: string[];
    hitCount: number;
    adjudicationSummary: PropertyCaseAdjudicationSummary;
    adjudicationItems: PropertyCaseAdjudicationItem[];
    confidenceSections: InternalPropertyCaseConfidenceSectionView[];
    guardrails: Array<{
      citationId: string;
      engineLabel: string;
      state: AdvisoryGuardrailState;
      approvalPath: AdvisoryApprovalPath;
      summary: string;
    }>;
  };
}

export type PropertyCaseOverviewSurface =
  | BuyerSafePropertyCaseOverview
  | InternalPropertyCaseOverview;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const engineLabels: Record<CoverageEngineKey, string> = {
  pricing: "Pricing",
  comps: "Comparable sales",
  leverage: "Negotiation leverage",
  offer: "Offer strategy",
};

const topicLabels: Record<ClaimTopic, string> = {
  pricing: "Pricing",
  comps: "Comparable sales",
  days_on_market: "Time on market",
  leverage: "Negotiation leverage",
  offer_recommendation: "Offer recommendation",
};

export function buildPropertyCaseOverview(
  input: BuildPropertyCaseOverviewInput,
): PropertyCaseOverviewSurface {
  const isInternal = input.viewerRole === "broker" || input.viewerRole === "admin";
  const status = buildStatusBadge(input.dealStatus);
  const payload = input.caseRecord?.payload ?? null;
  const coverageByKey = new Map(
    input.coverage.map((entry) => [entry.key, entry]),
  );
  const citationGuardrails = buildCitationGuardrails(input.citations ?? []);
  const offerGuardrail = findOfferGuardrail(input.citations ?? []);
  const claims = (payload?.claims ?? [])
    .filter((claim) => isClaimCoverageAvailable(claim, coverageByKey))
    .map((claim) => projectClaim(claim, citationGuardrails.get(claim.citation)))
    .filter((claim): claim is PropertyCaseClaimView => Boolean(claim));
  const confidenceSections = buildConfidenceSections(input.evidenceGraph?.sections);
  const internalConfidenceSections = isInternal
    ? buildInternalConfidenceSections(input.evidenceGraph?.sections)
    : [];
  const action = buildAction(payload, claims, coverageByKey, offerGuardrail);
  const missingStates = buildMissingStates(
    input.coverage,
    payload,
    action,
    offerGuardrail,
  );
  const coverageStats = buildCoverageStats(input.coverage, payload);
  const keyTakeaways = buildTakeaways(claims);
  const sources = buildSources(payload?.claims ?? [], input.citations ?? []);
  const adjudicationItems = buildAdjudicationItems(
    payload?.claims ?? [],
    input.citations ?? [],
  );
  const adjudicationSummary = summarizeAdjudication(adjudicationItems);
  const viewState = resolveViewState(payload, claims.length, missingStates);
  const overallConfidence = payload ? payload.overallConfidence : null;
  const overallConfidenceLabel =
    overallConfidence === null
      ? "No buyer-safe case yet"
      : `${formatPercent(overallConfidence)} confidence`;
  const overallConfidenceTone =
    overallConfidence === null ? "weak" : confidenceTone(overallConfidence);
  const coverageSummary = buildCoverageSummary(payload, claims.length, missingStates);
  const headerDescription = buildHeaderDescription(
    viewState,
    status,
    payload,
    missingStates,
  );

  const base: PropertyCaseOverviewBase = {
    variant: isInternal ? "internal" : "buyer_safe",
    viewerRole: input.viewerRole,
    dealRoomId: input.dealRoomId,
    propertyId: input.propertyId,
    propertyAddress: input.propertyAddress,
    listPrice: input.listPrice,
    listPriceLabel:
      input.listPrice === null
        ? "List price pending"
        : currencyFormatter.format(input.listPrice),
    photoUrl: input.photoUrl,
    status,
    viewState,
    generatedAt: input.caseRecord?.generatedAt ?? null,
    generatedAtLabel: input.caseRecord?.generatedAt
      ? `Updated ${formatShortDate(input.caseRecord.generatedAt)}`
      : "Awaiting first synthesis",
    confidenceFingerprint: input.evidenceGraph?.fingerprint ?? null,
    confidenceReplayKey: input.evidenceGraph?.replayKey ?? null,
    overallConfidence,
    overallConfidenceLabel,
    overallConfidenceTone,
    coverageStats,
    coverageSummary,
    headerDescription,
    confidenceSections,
    claims,
    keyTakeaways,
    action,
    missingStates,
    sources,
  };

  if (!isInternal) {
    return {
      ...base,
      variant: "buyer_safe",
      viewerRole: "buyer",
    };
  }

  return {
    ...base,
    variant: "internal",
    viewerRole: input.viewerRole as "broker" | "admin",
    internal: {
      inputHash: payload?.inputHash ?? null,
      synthesisVersion: payload?.synthesisVersion ?? null,
      contributingEngines: payload?.contributingEngines ?? 0,
      droppedEngines: [...(payload?.droppedEngines ?? [])],
      hitCount: input.caseRecord?.hitCount ?? 0,
      adjudicationSummary,
      adjudicationItems,
      confidenceSections: internalConfidenceSections,
      guardrails: Array.from(citationGuardrails.entries())
        .map(([citationId, assessment]) => ({
          citationId,
          engineLabel: humanizeEngineType(
            input.citations?.find((citation) => citation.citationId === citationId)
              ?.engineType,
          ),
          state: assessment.state,
          approvalPath: assessment.approvalPath,
          summary: assessment.internalSummary,
        }))
        .sort((a, b) => a.engineLabel.localeCompare(b.engineLabel)),
    },
  };
}

function projectClaim(
  claim: ComparativeClaim,
  assessment: AdvisoryGuardrailAssessment | undefined,
): PropertyCaseClaimView | null {
  if (
    assessment?.state === "review_required" ||
    assessment?.state === "blocked"
  ) {
    return null;
  }

  const guardrailState = assessment?.state ?? "can_say";
  return {
    id: claim.id,
    topic: claim.topic,
    topicLabel: topicLabels[claim.topic],
    narrative: claim.narrative,
    deltaLabel:
      claim.direction === "at"
        ? `In line with ${claim.marketReferenceLabel}`
        : `${formatDeltaPercent(claim.deltaPct)} ${claim.direction} ${claim.marketReferenceLabel}`,
    referenceLine: `${formatValue(claim.value, claim.unit)} vs ${formatValue(
      claim.marketReference,
      claim.unit,
    )} ${claim.marketReferenceLabel}`,
    confidence: claim.confidence,
    confidenceLabel: `${formatPercent(claim.confidence)} confidence`,
    confidenceTone: confidenceTone(claim.confidence),
    citationId: claim.citation,
    sourceAnchorId: sourceAnchorId(claim.citation),
    guardrailState,
    guardrailLabel: guardrailStateLabel(guardrailState),
  };
}

function buildTakeaways(claims: PropertyCaseClaimView[]): PropertyCaseTakeaway[] {
  return claims.slice(0, 3).map((claim) => ({
    title: topicLabels[claim.topic],
    body: claim.narrative,
  }));
}

function buildAction(
  payload: PropertyCase | null,
  claims: PropertyCaseClaimView[],
  coverageByKey: Map<CoverageEngineKey, PropertyCaseCoverageInput>,
  offerGuardrail: AdvisoryGuardrailAssessment | undefined,
): PropertyCaseActionView | null {
  if (!payload?.recommendedAction) return null;
  if (coverageByKey.get("offer")?.status !== "available") return null;
  if (
    offerGuardrail?.state === "review_required" ||
    offerGuardrail?.state === "blocked"
  ) {
    return null;
  }

  const rationale = payload.recommendedAction.rationaleClaimIds
    .map((id) => claims.find((claim) => claim.id === id))
    .filter((claim): claim is PropertyCaseClaimView => Boolean(claim))
    .map((claim) => ({
      title: claim.topicLabel,
      body: claim.narrative,
    }));

  return {
    openingPrice: payload.recommendedAction.openingPrice,
    openingPriceLabel: currencyFormatter.format(
      payload.recommendedAction.openingPrice,
    ),
    confidence: payload.recommendedAction.confidence,
    confidenceLabel: `${formatPercent(payload.recommendedAction.confidence)} action confidence`,
    riskLevel: payload.recommendedAction.riskLevel,
    riskLabel: `${capitalize(payload.recommendedAction.riskLevel)} risk`,
    suggestedContingencies: [...payload.recommendedAction.suggestedContingencies],
    rationale,
    guardrailState: offerGuardrail?.state ?? "can_say",
    guardrailLabel: guardrailStateLabel(offerGuardrail?.state ?? "can_say"),
    guardrailExplanation:
      offerGuardrail?.buyerExplanation ??
      "This recommendation cleared the buyer-safe advisory guardrail.",
  };
}

function buildMissingStates(
  coverage: PropertyCaseCoverageInput[],
  payload: PropertyCase | null,
  action: PropertyCaseActionView | null,
  offerGuardrail: AdvisoryGuardrailAssessment | undefined,
): PropertyCaseMissingState[] {
  const dropped = new Set(payload?.droppedEngines ?? []);
  const states: PropertyCaseMissingState[] = [];

  for (const entry of coverage) {
    if (dropped.has(entry.key)) {
      states.push({
        engine: entry.key,
        label: engineLabels[entry.key],
        tone: "uncertain",
        title: `${engineLabels[entry.key]} held back`,
        description:
          "This signal did not clear the confidence bar, so it stays out of the buyer-safe case instead of being guessed.",
      });
      continue;
    }

    if (entry.status === "pending") {
      states.push({
        engine: entry.key,
        label: engineLabels[entry.key],
        tone: "pending",
        title: `${engineLabels[entry.key]} is still being reviewed`,
        description:
          entry.reason ??
          "The upstream analysis is still running or waiting on review.",
      });
      continue;
    }

    if (entry.status === "unavailable") {
      states.push({
        engine: entry.key,
        label: engineLabels[entry.key],
        tone: "missing",
        title: `${engineLabels[entry.key]} is not available yet`,
        description:
          entry.reason ??
          "We do not have enough verified data to show this signal yet.",
      });
    }
  }

  if (
    payload?.recommendedAction &&
    !action &&
    offerGuardrail &&
    (offerGuardrail.state === "review_required" ||
      offerGuardrail.state === "blocked")
  ) {
    states.push({
      engine: "offer",
      label: engineLabels.offer,
      tone:
        offerGuardrail.state === "blocked" ? "blocked" : "review_required",
      title:
        offerGuardrail.state === "blocked"
          ? "Offer guidance is blocked"
          : "Offer guidance is waiting on broker review",
      description: offerGuardrail.buyerExplanation,
    });
  }

  return states;
}

function buildCoverageStats(
  coverage: PropertyCaseCoverageInput[],
  payload: PropertyCase | null,
): PropertyCaseCoverageStats {
  const dropped = new Set(payload?.droppedEngines ?? []);
  const stats: PropertyCaseCoverageStats = {
    availableCount: 0,
    pendingCount: 0,
    uncertainCount: 0,
    missingCount: 0,
  };

  for (const entry of coverage) {
    if (dropped.has(entry.key)) {
      stats.uncertainCount += 1;
      continue;
    }

    if (entry.status === "available") {
      stats.availableCount += 1;
      continue;
    }

    if (entry.status === "pending") {
      stats.pendingCount += 1;
      continue;
    }

    stats.missingCount += 1;
  }

  return stats;
}

function buildSources(
  claims: ComparativeClaim[],
  citations: PropertyCaseCitationInput[],
): PropertyCaseSourceView[] {
  const byCitation = new Map<string, PropertyCaseCitationInput>();
  for (const citation of citations) {
    byCitation.set(citation.citationId, citation);
  }

  const claimsByCitation = new Map<string, number>();
  for (const claim of claims) {
    claimsByCitation.set(
      claim.citation,
      (claimsByCitation.get(claim.citation) ?? 0) + 1,
    );
  }

  return Array.from(claimsByCitation.entries())
    .map(([citationId, claimCount]) => {
      const citation = byCitation.get(citationId);
      const guardrail = assessEngineOutputGuardrail({
        engineType: citation?.engineType ?? "other",
        confidence: citation?.confidence,
        reviewState: citation?.reviewState,
      });
      const status: PropertyCaseSourceView["status"] =
        !citation
          ? "unavailable"
          : citation.reviewState === "pending"
          ? "pending"
          : citation.reviewState === "rejected"
            ? "unavailable"
            : "available";

      return {
        citationId,
        anchorId: sourceAnchorId(citationId),
        engineType: citation?.engineType ?? null,
        engineLabel: humanizeEngineType(citation?.engineType),
        status,
        reviewState: citation?.reviewState ?? null,
        confidenceLabel:
          typeof citation?.confidence === "number"
            ? `${formatPercent(citation.confidence)} source confidence`
            : "Confidence unavailable",
        generatedAtLabel: citation?.generatedAt
          ? formatShortDate(citation.generatedAt)
          : null,
        claimCount,
        guardrailState: guardrail.state,
        guardrailLabel: guardrailStateLabel(guardrail.state),
        approvalPath: guardrail.approvalPath,
      };
    })
    .sort((a, b) => a.engineLabel.localeCompare(b.engineLabel));
}

function buildAdjudicationItems(
  claims: ComparativeClaim[],
  citations: PropertyCaseCitationInput[],
): PropertyCaseAdjudicationItem[] {
  const linkedClaimsByCitation = new Map<string, number>();
  for (const claim of claims) {
    linkedClaimsByCitation.set(
      claim.citation,
      (linkedClaimsByCitation.get(claim.citation) ?? 0) + 1,
    );
  }

  return citations
    .filter(
      (
        citation,
      ): citation is PropertyCaseCitationInput & {
        reviewState: "pending" | "approved" | "rejected";
      } => citation.reviewState != null,
    )
    .map((citation) => ({
      citationId: citation.citationId,
      engineType: citation.engineType,
      engineLabel: humanizeEngineType(citation.engineType),
      reviewState: citation.reviewState,
      confidence:
        typeof citation.confidence === "number" ? citation.confidence : null,
      confidenceLabel:
        typeof citation.confidence === "number"
          ? `${formatPercent(citation.confidence)} source confidence`
          : "Confidence unavailable",
      generatedAt: citation.generatedAt ?? null,
      generatedAtLabel: citation.generatedAt
        ? formatShortDate(citation.generatedAt)
        : null,
      linkedClaimCount: linkedClaimsByCitation.get(citation.citationId) ?? 0,
    }))
    .sort((a, b) => {
      if (a.reviewState === b.reviewState) {
        return a.engineLabel.localeCompare(b.engineLabel);
      }

      const rank = { pending: 0, rejected: 1, approved: 2 } as const;
      return rank[a.reviewState] - rank[b.reviewState];
    });
}

function buildConfidenceSections(
  sections: PropertyEvidenceGraph["sections"] | undefined,
): PropertyCaseConfidenceSectionView[] {
  if (!sections) return [];

  return RECOMMENDATION_EVIDENCE_SECTION_KEYS.map((key) =>
    projectConfidenceSection(sections[key]),
  );
}

function buildInternalConfidenceSections(
  sections: PropertyEvidenceGraph["sections"] | undefined,
): InternalPropertyCaseConfidenceSectionView[] {
  if (!sections) return [];

  return RECOMMENDATION_EVIDENCE_SECTION_KEYS.map((key) => {
    const section = sections[key];
    const base = projectConfidenceSection(section);
    return {
      ...base,
      internalSummary:
        section.internalTrace?.summary ??
        `${section.title} confidence derived without an internal trace summary.`,
      sourceCategories: [...section.confidenceInputs.sourceCategories],
      reasonCodes: [
        ...(section.internalTrace?.reasonCodes ??
          section.confidenceInputs.reasonCodes ??
          []),
      ],
      supportingNodeIds: [...section.supportingNodeIds],
      missingNodeIds: [...section.missingNodeIds],
      conflictingNodeIds: [...section.conflictingNodeIds],
    };
  });
}

function projectConfidenceSection(
  section: RecommendationEvidenceSection,
): PropertyCaseConfidenceSectionView {
  return {
    key: section.key,
    title: section.title,
    band: section.confidenceInputs.band,
    bandLabel: confidenceBandLabel(section.confidenceInputs.band),
    score: section.confidenceInputs.score,
    scoreLabel:
      typeof section.confidenceInputs.score === "number"
        ? `${formatPercent(section.confidenceInputs.score)} confidence`
        : confidenceBandEmptyLabel(section.confidenceInputs.band),
    tone: confidenceToneFromBand(section.confidenceInputs.band),
    status: section.status,
    statusLabel: evidenceStatusLabel(section.status),
    buyerHeadline: section.buyerSummary.headline,
    buyerExplanation: buildBuyerConfidenceExplanation(section),
    strongEvidence: [...section.confidenceInputs.supportLabels],
    missingEvidence: [...section.confidenceInputs.missingLabels],
    contradictoryEvidence: [...section.confidenceInputs.conflictingLabels],
    whatWouldIncreaseConfidence: buildConfidenceNextSteps(section),
    dependsOnInference: section.confidenceInputs.dependsOnInference,
  };
}

function summarizeAdjudication(
  items: PropertyCaseAdjudicationItem[],
): PropertyCaseAdjudicationSummary {
  return items.reduce<PropertyCaseAdjudicationSummary>(
    (summary, item) => {
      if (item.reviewState === "pending") summary.pendingCount += 1;
      if (item.reviewState === "approved") summary.approvedCount += 1;
      if (item.reviewState === "rejected") summary.rejectedCount += 1;
      return summary;
    },
    {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    },
  );
}

function resolveViewState(
  payload: PropertyCase | null,
  claimCount: number,
  missingStates: PropertyCaseMissingState[],
): PropertyCaseOverviewViewState {
  if (!payload) {
    return missingStates.some(
      (state) => state.tone === "pending" || state.tone === "uncertain",
    )
      ? "partial"
      : "empty";
  }

  if (claimCount === 0) return "empty";
  if (missingStates.length > 0) return "partial";
  return "ready";
}

function buildCoverageSummary(
  payload: PropertyCase | null,
  claimCount: number,
  missingStates: PropertyCaseMissingState[],
): string {
  if (!payload) {
    return "We are still assembling the first buyer-safe case from pricing, comps, leverage, and offer signals.";
  }

  if (missingStates.length === 0) {
    return `${claimCount} comparative claim${claimCount === 1 ? "" : "s"} backed by ${payload.contributingEngines} engine${payload.contributingEngines === 1 ? "" : "s"}.`;
  }

  return `${claimCount} comparative claim${claimCount === 1 ? "" : "s"} are ready, while ${missingStates.length} signal${missingStates.length === 1 ? " is" : "s are"} still pending or intentionally omitted.`;
}

function buildHeaderDescription(
  viewState: PropertyCaseOverviewViewState,
  status: StatusBadge,
  payload: PropertyCase | null,
  missingStates: PropertyCaseMissingState[],
): string {
  if (viewState === "ready" && payload) {
    return `${status.label}. ${payload.contributingEngines} engines contributed to this buyer-safe case.`;
  }

  if (viewState === "partial" && payload) {
    return `${status.label}. We have a grounded case, but ${missingStates.length} signal${missingStates.length === 1 ? "" : "s"} are still being verified or stayed hidden due to low confidence.`;
  }

  if (viewState === "partial") {
    return `${status.label}. The first case has not landed yet, but upstream analysis is already underway.`;
  }

  return `${status.label}. We only surface a case once the inputs are safe to show, so this view stays explicit about what is still missing.`;
}

function buildCitationGuardrails(
  citations: PropertyCaseCitationInput[],
): Map<string, AdvisoryGuardrailAssessment> {
  return new Map(
    citations.map((citation) => [
      citation.citationId,
      assessEngineOutputGuardrail({
        engineType: citation.engineType,
        confidence: citation.confidence,
        reviewState: citation.reviewState,
      }),
    ]),
  );
}

function findOfferGuardrail(
  citations: PropertyCaseCitationInput[],
): AdvisoryGuardrailAssessment | undefined {
  const offerCitation = citations.find((citation) => citation.engineType === "offer");
  if (!offerCitation) return undefined;

  return assessEngineOutputGuardrail({
    engineType: offerCitation.engineType,
    confidence: offerCitation.confidence,
    reviewState: offerCitation.reviewState,
  });
}

function coverageKeyForClaim(topic: ClaimTopic): CoverageEngineKey {
  switch (topic) {
    case "pricing":
      return "pricing";
    case "comps":
      return "comps";
    case "days_on_market":
    case "leverage":
      return "leverage";
    case "offer_recommendation":
      return "offer";
  }
}

function isClaimCoverageAvailable(
  claim: ComparativeClaim,
  coverageByKey: Map<CoverageEngineKey, PropertyCaseCoverageInput>,
): boolean {
  return coverageByKey.get(coverageKeyForClaim(claim.topic))?.status === "available";
}

function confidenceTone(value: number): "strong" | "mixed" | "weak" {
  if (value >= 0.75) return "strong";
  if (value >= 0.6) return "mixed";
  return "weak";
}

function confidenceToneFromBand(
  band: RecommendationConfidenceBand,
): "strong" | "mixed" | "weak" {
  switch (band) {
    case "high":
      return "strong";
    case "medium":
      return "mixed";
    case "low":
    case "waiting":
      return "weak";
  }
}

function confidenceBandLabel(band: RecommendationConfidenceBand): string {
  switch (band) {
    case "high":
      return "High confidence";
    case "medium":
      return "Moderate confidence";
    case "low":
      return "Low confidence";
    case "waiting":
      return "Waiting on evidence";
  }
}

function confidenceBandEmptyLabel(band: RecommendationConfidenceBand): string {
  switch (band) {
    case "waiting":
      return "Waiting on evidence";
    case "low":
      return "Low confidence";
    case "medium":
      return "Moderate confidence";
    case "high":
      return "High confidence";
  }
}

function evidenceStatusLabel(status: RecommendationEvidenceSection["status"]): string {
  switch (status) {
    case "supported":
      return "Supported";
    case "mixed":
      return "Mixed evidence";
    case "waiting_on_evidence":
      return "Waiting on evidence";
    case "conflicting_evidence":
      return "Conflicting evidence";
  }
}

function buildBuyerConfidenceExplanation(
  section: RecommendationEvidenceSection,
): string {
  const parts = [section.buyerSummary.headline];

  if (section.buyerSummary.caution) {
    parts.push(section.buyerSummary.caution);
  } else if (section.confidenceInputs.dependsOnInference) {
    parts.push("Some of this still depends on inferred signals instead of fully verified records.");
  } else if (section.status === "supported") {
    parts.push("The current evidence is aligned enough to show this in the buyer-safe view.");
  }

  return parts.join(" ");
}

function buildConfidenceNextSteps(
  section: RecommendationEvidenceSection,
): string[] {
  const steps = [
    ...section.confidenceInputs.missingLabels.map(
      (label) => `Add ${label}.`,
    ),
    ...section.confidenceInputs.conflictingLabels.map(
      (label) => `Resolve the conflict around ${label}.`,
    ),
  ];

  if (steps.length === 0 && section.confidenceInputs.dependsOnInference) {
    steps.push("Replace inferred signals with verified source data.");
  }

  if (steps.length === 0 && section.status === "supported") {
    steps.push("Keep the cited evidence fresh before finalizing the decision.");
  }

  return steps.slice(0, 3);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDeltaPercent(value: number): string {
  return `${Math.abs(round1(value))}%`;
}

function formatValue(
  value: number,
  unit: ComparativeClaim["unit"],
): string {
  switch (unit) {
    case "usd":
      return currencyFormatter.format(value);
    case "psf":
      return `${currencyFormatter.format(value)}/sqft`;
    case "days":
      return `${integerFormatter.format(value)} day${value === 1 ? "" : "s"}`;
    case "pct":
      return `${round1(value)}%`;
    case "count":
      return integerFormatter.format(value);
  }
}

function humanizeEngineType(engineType: string | undefined): string {
  if (!engineType) return "Source";
  if (engineType in engineLabels) {
    return engineLabels[engineType as CoverageEngineKey];
  }
  return capitalize(engineType.replaceAll("_", " "));
}

function sourceAnchorId(citationId: string): string {
  return `source-${citationId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

function formatShortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
