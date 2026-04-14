import type {
  ClaimTopic,
  ComparativeClaim,
  PropertyCase,
} from "@/lib/ai/engines/caseSynthesis";
import {
  RECOMMENDATION_EVIDENCE_SECTION_KEYS,
  type DossierPropertyRecord,
  type DossierSourceRef,
  type DossierSourceCategory,
  type EvidenceGraphNode,
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
  buildAdvisorySurfaceState,
  projectAdvisoryEvidenceSection,
  summarizeAdvisoryEvidence,
  type AdvisorySurfaceState,
} from "@/lib/advisory/surface-state";
import {
  buildStatusBadge,
  type DealStatus,
  type SectionStatus,
  type StatusBadge,
} from "@/lib/dealroom/overview";
import {
  adjudicationActionLabel,
  adjudicationStatusLabel,
  adjudicationVisibilityLabel,
  type AdvisoryAdjudicationAction,
  type AdvisoryAdjudicationHistoryEntry,
  type AdvisoryAdjudicationSnapshot,
  type AdvisoryAdjudicationStatus,
  type AdvisoryAdjudicationVisibility,
} from "@/lib/advisory/adjudication";
import {
  buildLocalMarketReality,
  type InternalLocalMarketRealityView,
  type LocalMarketRealityView,
} from "@/lib/dealroom/local-market-reality";
import type { PropertyMarketContext } from "@/lib/enrichment/types";

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
  adjudication?: AdvisoryAdjudicationSnapshot | null;
  adjudicationHistory?: AdvisoryAdjudicationHistoryEntry[];
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
    "fingerprint" | "replayKey" | "nodes" | "sections"
  > | null;
  marketContext?: PropertyMarketContext | null;
  propertyFacts?: Pick<
    DossierPropertyRecord,
    "daysOnMarket" | "sqftLiving" | "priceReductions" | "updatedAt"
  > | null;
  viewerRole: "buyer" | "broker" | "admin";
}

export interface PropertyCaseTakeaway {
  title: string;
  body: string;
}

export interface DecisionMemoEvidenceHook {
  id: string;
  label: string;
  citationId: string | null;
  sourceAnchorId: string | null;
  nodeId: string | null;
  confidenceLabel: string | null;
  statusLabel: string | null;
  provenance: DossierSourceRef[];
}

export interface DecisionMemoItemView {
  id: string;
  title: string;
  body: string;
  evidence: DecisionMemoEvidenceHook[];
}

export interface DecisionMemoSectionView {
  title: string;
  summary: string;
  items: DecisionMemoItemView[];
}

export interface DecisionMemoRecommendationView {
  verdict:
    | "worth_pursuing"
    | "pursue_with_caution"
    | "wait_for_more_evidence";
  label: string;
  body: string;
  confidenceLabel: string | null;
  riskLabel: string | null;
  openingPriceLabel: string | null;
  evidence: DecisionMemoEvidenceHook[];
}

export interface BuyerSafeDecisionMemoView {
  title: string;
  summary: string;
  upside: DecisionMemoSectionView;
  downside: DecisionMemoSectionView;
  unknowns: DecisionMemoSectionView;
  unresolvedRisks: DecisionMemoSectionView;
  recommendation: DecisionMemoRecommendationView;
}

export interface ClientReadySummarySectionView {
  title: string;
  summary: string;
  items: DecisionMemoItemView[];
}

export interface ClientReadySummaryNextStepView
  extends DecisionMemoItemView {}

export interface ClientReadySummaryArtifact {
  title: string;
  summary: string;
  whatMattersMost: ClientReadySummarySectionView;
  attractive: ClientReadySummarySectionView;
  riskyOrUncertain: ClientReadySummarySectionView;
  recommendation: DecisionMemoRecommendationView;
  nextSteps: {
    title: string;
    summary: string;
    items: ClientReadySummaryNextStepView[];
  };
  renderedText: string;
}

export interface ClientReadySummaryExcludedItem {
  id: string;
  label: string;
  source: "internal_rationale" | "guardrail" | "adjudication";
  reason: string;
  summary: string;
  citationId: string | null;
  sectionKey: RecommendationEvidenceSectionKey | null;
}

export interface ClientReadySummaryDiff {
  summary: string;
  hiddenItems: ClientReadySummaryExcludedItem[];
}

export interface InternalDecisionMemoRationaleSectionView {
  key: RecommendationEvidenceSectionKey;
  title: string;
  summary: string;
  sourceCategories: DossierSourceCategory[];
  reasonCodes: RecommendationConfidenceReasonCode[];
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
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
  reviewedConclusion: string | null;
  buyerExplanation: string | null;
  isBrokerReviewed: boolean;
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
  adjudicationStatus: AdvisoryAdjudicationStatus;
  adjudicationLabel: string;
  visibility: AdvisoryAdjudicationVisibility | null;
  visibilityLabel: string | null;
  reviewedConclusion: string | null;
  buyerExplanation: string | null;
  reviewedByLabel: string | null;
  reviewedAtLabel: string | null;
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
  buyerSafeCount: number;
  internalOnlyCount: number;
  adjustedCount: number;
  overriddenCount: number;
}

export interface PropertyCaseAdjudicationAuditEntry {
  action: AdvisoryAdjudicationAction;
  actionLabel: string;
  status: AdvisoryAdjudicationStatus;
  statusLabel: string;
  visibility: AdvisoryAdjudicationVisibility;
  visibilityLabel: string;
  rationale: string;
  reviewedConclusion: string | null;
  buyerExplanation: string | null;
  internalNotes: string | null;
  actorName: string | null;
  actorId: string;
  actedAt: string;
  actedAtLabel: string;
}

export interface PropertyCaseAdjudicationItem {
  citationId: string;
  engineType: string;
  engineLabel: string;
  reviewState: "pending" | "approved" | "rejected";
  adjudicationStatus: AdvisoryAdjudicationStatus;
  adjudicationLabel: string;
  action: AdvisoryAdjudicationAction | null;
  actionLabel: string | null;
  visibility: AdvisoryAdjudicationVisibility | null;
  visibilityLabel: string | null;
  rationale: string | null;
  reviewedConclusion: string | null;
  buyerExplanation: string | null;
  internalNotes: string | null;
  actorName: string | null;
  actorId: string | null;
  actedAt: string | null;
  actedAtLabel: string | null;
  confidence: number | null;
  confidenceLabel: string;
  generatedAt: string | null;
  generatedAtLabel: string | null;
  linkedClaimCount: number;
  auditTrail: PropertyCaseAdjudicationAuditEntry[];
}

export interface PropertyCaseArtifactStates {
  memo: AdvisorySurfaceState;
  recommendation: AdvisorySurfaceState;
  playbook: AdvisorySurfaceState;
  summary: AdvisorySurfaceState;
}

export interface PropertyCaseAdvisoryVersion {
  synthesisVersion: string | null;
  artifactGeneratedAt: string | null;
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
  advisoryVersion: PropertyCaseAdvisoryVersion;
  confidenceFingerprint: string | null;
  confidenceReplayKey: string | null;
  overallConfidence: number | null;
  overallConfidenceLabel: string;
  overallConfidenceTone: "strong" | "mixed" | "weak";
  coverageStats: PropertyCaseCoverageStats;
  coverageSummary: string;
  headerDescription: string;
  marketReality: LocalMarketRealityView | null;
  decisionMemo: BuyerSafeDecisionMemoView;
  clientReadySummary: ClientReadySummaryArtifact;
  confidenceSections: PropertyCaseConfidenceSectionView[];
  artifacts: PropertyCaseArtifactStates;
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
    marketReality: InternalLocalMarketRealityView | null;
    confidenceSections: InternalPropertyCaseConfidenceSectionView[];
    decisionMemo: {
      rationaleSummary: string;
      sections: InternalDecisionMemoRationaleSectionView[];
    };
    clientReadySummaryDiff: ClientReadySummaryDiff;
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
  const citationById = new Map(
    (input.citations ?? []).map((citation) => [citation.citationId, citation]),
  );
  const marketReality = buildLocalMarketReality({
    listPrice: input.listPrice,
    propertyFacts: input.propertyFacts,
    marketContext: input.marketContext,
  });
  const citationGuardrails = buildCitationGuardrails(input.citations ?? []);
  const offerGuardrail = findOfferGuardrail(input.citations ?? []);
  const claims = (payload?.claims ?? [])
    .filter((claim) => isClaimCoverageAvailable(claim, coverageByKey))
    .map((claim) =>
      projectClaim(
        claim,
        citationGuardrails.get(claim.citation),
        citationById.get(claim.citation),
      ),
    )
    .filter((claim): claim is PropertyCaseClaimView => Boolean(claim));
  const action = buildAction(
    payload,
    claims,
    coverageByKey,
    offerGuardrail,
    (input.citations ?? []).find((citation) => citation.engineType === "offer"),
  );
  const confidenceSections = buildConfidenceSections(input.evidenceGraph?.sections);
  const internalConfidenceSections = isInternal
    ? buildInternalConfidenceSections(input.evidenceGraph?.sections)
    : [];
  const missingStates = buildMissingStates(
    input.coverage,
    payload,
    action,
    offerGuardrail,
  );
  const coverageStats = buildCoverageStats(input.coverage, payload);
  const keyTakeaways = buildTakeaways(claims);
  const memoEvidence = summarizeAdvisoryEvidence([
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.pricing),
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.comps),
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.leverage),
  ]);
  const recommendationEvidence = summarizeAdvisoryEvidence([
    projectAdvisoryEvidenceSection(
      input.evidenceGraph?.sections?.offer_recommendation,
    ),
  ]);
  const summaryEvidence = summarizeAdvisoryEvidence([
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.pricing),
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.comps),
    projectAdvisoryEvidenceSection(input.evidenceGraph?.sections?.leverage),
    projectAdvisoryEvidenceSection(
      input.evidenceGraph?.sections?.offer_recommendation,
    ),
  ]);
  const hasPendingCoverage = input.coverage.some(
    (entry) => entry.status === "pending",
  );
  const artifacts: PropertyCaseArtifactStates = {
    memo: buildAdvisorySurfaceState({
      surface: "memo",
      evidence: memoEvidence,
      isLoading: claims.length === 0 && hasPendingCoverage,
      hasRenderableContent: claims.length > 0 || keyTakeaways.length > 0,
    }),
    recommendation: buildAdvisorySurfaceState({
      surface: "recommendation",
      evidence: recommendationEvidence,
      guardrailState: offerGuardrail?.state,
      isLoading:
        action === null && coverageByKey.get("offer")?.status === "pending",
      hasRenderableContent: action !== null,
    }),
    playbook: buildAdvisorySurfaceState({
      surface: "playbook",
      evidence: recommendationEvidence,
      guardrailState: offerGuardrail?.state,
      isLoading:
        action === null && coverageByKey.get("offer")?.status === "pending",
      hasRenderableContent: action !== null,
    }),
    summary: buildAdvisorySurfaceState({
      surface: "summary",
      evidence: summaryEvidence,
      isLoading: claims.length === 0 && hasPendingCoverage,
      hasRenderableContent: claims.length > 0 || action !== null,
    }),
  };
  const sources = buildSources(payload?.claims ?? [], input.citations ?? []);
  const adjudicationItems = buildAdjudicationItems(
    payload?.claims ?? [],
    input.citations ?? [],
  );
  const adjudicationSummary = summarizeAdjudication(adjudicationItems);
  const viewState = resolveViewState(payload, claims.length, missingStates);
  const decisionMemo = buildDecisionMemo({
    status,
    viewState,
    claims,
    action,
    missingStates,
    confidenceSections,
    recommendationState: artifacts.recommendation,
    evidenceGraph: input.evidenceGraph ?? null,
  });
  const internalDecisionMemo = isInternal
    ? buildInternalDecisionMemo(internalConfidenceSections)
    : null;
  const clientReadySummary = buildClientReadySummary({
    propertyAddress: input.propertyAddress,
    decisionMemo,
    summaryState: artifacts.summary,
    recommendationState: artifacts.recommendation,
    marketReality: marketReality.buyer,
    missingStates,
    confidenceSections,
  });
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
    advisoryVersion: {
      synthesisVersion: payload?.synthesisVersion ?? null,
      artifactGeneratedAt: input.caseRecord?.generatedAt ?? null,
    },
    confidenceFingerprint: input.evidenceGraph?.fingerprint ?? null,
    confidenceReplayKey: input.evidenceGraph?.replayKey ?? null,
    overallConfidence,
    overallConfidenceLabel,
    overallConfidenceTone,
    coverageStats,
    coverageSummary,
    headerDescription,
    marketReality: marketReality.buyer,
    decisionMemo,
    clientReadySummary,
    confidenceSections,
    artifacts,
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

  const guardrails = Array.from(citationGuardrails.entries())
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
    .sort((a, b) => a.engineLabel.localeCompare(b.engineLabel));

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
      marketReality: marketReality.internal,
      confidenceSections: internalConfidenceSections,
      decisionMemo: internalDecisionMemo ?? {
        rationaleSummary:
          "Internal rationale is not available until the evidence sections are built.",
        sections: [],
      },
      clientReadySummaryDiff: buildClientReadySummaryDiff({
        decisionMemo: internalDecisionMemo ?? {
          rationaleSummary:
            "Internal rationale is not available until the evidence sections are built.",
          sections: [],
        },
        adjudicationItems,
        guardrails,
      }),
      guardrails,
    },
  };
}

function projectClaim(
  claim: ComparativeClaim,
  assessment: AdvisoryGuardrailAssessment | undefined,
  citation: PropertyCaseCitationInput | undefined,
): PropertyCaseClaimView | null {
  if (
    assessment?.state === "review_required" ||
    assessment?.state === "blocked"
  ) {
    return null;
  }

  const guardrailState = assessment?.state ?? "can_say";
  const buyerFacingAdjudication = resolveBuyerFacingAdjudication(citation);
  return {
    id: claim.id,
    topic: claim.topic,
    topicLabel: topicLabels[claim.topic],
    narrative: buyerFacingAdjudication?.reviewedConclusion ?? claim.narrative,
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

function buildDecisionMemo(args: {
  status: StatusBadge;
  viewState: PropertyCaseOverviewViewState;
  claims: PropertyCaseClaimView[];
  action: PropertyCaseActionView | null;
  missingStates: PropertyCaseMissingState[];
  confidenceSections: PropertyCaseConfidenceSectionView[];
  recommendationState: AdvisorySurfaceState;
  evidenceGraph: BuildPropertyCaseOverviewInput["evidenceGraph"];
}): BuyerSafeDecisionMemoView {
  const evidenceContext = createDecisionMemoEvidenceContext(args.evidenceGraph);
  const positiveClaims = args.claims
    .filter((claim) => classifyClaimPolarity(claim) === "positive")
    .slice(0, 2)
    .map((claim) => buildClaimDecisionMemoItem(claim, evidenceContext));
  const negativeClaims = args.claims
    .filter((claim) => classifyClaimPolarity(claim) === "negative")
    .slice(0, 2)
    .map((claim) => buildClaimDecisionMemoItem(claim, evidenceContext));

  const upsideItems =
    positiveClaims.length > 0
      ? positiveClaims
      : args.confidenceSections
          .filter((section) => section.strongEvidence.length > 0)
          .slice(0, 2)
          .map((section) =>
            buildSectionDecisionMemoItem(
              section,
              section.title,
              section.buyerHeadline,
              [...section.strongEvidence],
              evidenceContext,
              "supporting",
            ),
          );
  const downsideItems = [
    ...negativeClaims,
    ...args.confidenceSections
      .filter(
        (section) =>
          section.contradictoryEvidence.length > 0 ||
          section.status === "mixed" ||
          section.status === "conflicting_evidence",
      )
      .slice(0, 2)
      .map((section) =>
        buildSectionDecisionMemoItem(
          section,
          section.title,
          section.buyerExplanation,
          [
            ...section.contradictoryEvidence,
            ...section.missingEvidence.slice(0, 1),
          ].filter(Boolean),
          evidenceContext,
          section.contradictoryEvidence.length > 0
            ? "conflicting"
            : "missing",
        ),
      ),
  ].slice(0, 3);
  const unknownItems = [
    ...args.missingStates
      .filter((state) =>
        state.tone === "pending" ||
        state.tone === "missing" ||
        state.tone === "uncertain",
      )
      .slice(0, 3)
      .map((state) => buildMissingStateDecisionMemoItem(state, evidenceContext)),
  ];
  if (unknownItems.length === 0) {
    const missingSection = args.confidenceSections.find(
      (section) => section.missingEvidence.length > 0,
    );
    if (missingSection) {
      unknownItems.push(
        buildSectionDecisionMemoItem(
          missingSection,
          `${missingSection.title} still needs more evidence`,
          missingSection.whatWouldIncreaseConfidence[0] ??
            missingSection.buyerExplanation,
          [...missingSection.missingEvidence],
          evidenceContext,
          "missing",
        ),
      );
    }
  }

  const unresolvedRiskItems = [
    ...args.missingStates
      .filter(
        (state) =>
          state.tone === "review_required" || state.tone === "blocked",
      )
      .map((state) => buildMissingStateDecisionMemoItem(state, evidenceContext)),
  ];
  const riskSection = args.confidenceSections.find((section) => section.key === "risk");
  if (riskSection) {
    unresolvedRiskItems.push(
      buildSectionDecisionMemoItem(
        riskSection,
        riskSection.title,
        riskSection.buyerExplanation,
        [
          ...riskSection.missingEvidence,
          ...riskSection.contradictoryEvidence,
          ...(riskSection.strongEvidence.length > 0 ? [riskSection.strongEvidence[0]] : []),
        ].filter(Boolean),
        evidenceContext,
        riskSection.contradictoryEvidence.length > 0 ? "conflicting" : "supporting",
      ),
    );
  }

  return {
    title: "Why this home / why not this home",
    summary: buildDecisionMemoSummary(args.status, args.viewState, args.missingStates),
    upside: {
      title: "Why this home could be worth pursuing",
      summary:
        upsideItems.length > 0
          ? "These points are carrying the buyer-safe case right now."
          : "No positive signal is strong enough to elevate on its own yet.",
      items: dedupeDecisionMemoItems(upsideItems),
    },
    downside: {
      title: "Why this home may be risky or overpriced",
      summary:
        downsideItems.length > 0
          ? "These are the strongest reasons to stay disciplined instead of treating the home as an obvious yes."
          : "No major downside is currently carrying the case on its own.",
      items: dedupeDecisionMemoItems(downsideItems),
    },
    unknowns: {
      title: "What we still do not know",
      summary:
        unknownItems.length > 0
          ? "These gaps should change how much confidence you place in the memo today."
          : "No major unknown is currently flagged beyond normal diligence.",
      items: dedupeDecisionMemoItems(unknownItems),
    },
    unresolvedRisks: {
      title: "Unresolved risks and review-required items",
      summary:
        unresolvedRiskItems.length > 0
          ? "These issues are visible, but they still need diligence or human review before the case is fully settled."
          : "No unresolved risk is currently escalated beyond standard review.",
      items: dedupeDecisionMemoItems(unresolvedRiskItems),
    },
    recommendation: buildDecisionMemoRecommendation({
      action: args.action,
      recommendationState: args.recommendationState,
      evidenceContext,
      offerSection:
        args.evidenceGraph?.sections?.offer_recommendation ?? null,
      missingStates: args.missingStates,
    }),
  };
}

function buildInternalDecisionMemo(
  sections: InternalPropertyCaseConfidenceSectionView[],
): {
  rationaleSummary: string;
  sections: InternalDecisionMemoRationaleSectionView[];
} {
  return {
    rationaleSummary:
      sections.length > 0
        ? "Internal rationale exposes which dossier sections are carrying the memo, where the trace is thin, and what still needs human review."
        : "Internal rationale will appear once confidence sections are available.",
    sections: sections.map((section) => ({
      key: section.key,
      title: section.title,
      summary: section.internalSummary,
      sourceCategories: [...section.sourceCategories],
      reasonCodes: [...section.reasonCodes],
      supportingNodeIds: [...section.supportingNodeIds],
      missingNodeIds: [...section.missingNodeIds],
      conflictingNodeIds: [...section.conflictingNodeIds],
    })),
  };
}

function buildClientReadySummary(args: {
  propertyAddress: string;
  decisionMemo: BuyerSafeDecisionMemoView;
  summaryState: AdvisorySurfaceState;
  recommendationState: AdvisorySurfaceState;
  marketReality: LocalMarketRealityView | null;
  missingStates: PropertyCaseMissingState[];
  confidenceSections: PropertyCaseConfidenceSectionView[];
}): ClientReadySummaryArtifact {
  const whatMattersMostItems: DecisionMemoItemView[] = [];

  if (args.marketReality) {
    whatMattersMostItems.push({
      id: "client-summary-market-reality",
      title: "Market reality",
      body: `${args.marketReality.position.label}. ${args.marketReality.position.summary}`,
      evidence: [],
    });
  }

  whatMattersMostItems.push(
    ...args.decisionMemo.upside.items.slice(0, 1),
    ...args.decisionMemo.downside.items.slice(0, 1),
    ...args.decisionMemo.unknowns.items.slice(0, 1),
  );

  if (args.summaryState.kind !== "ready") {
    whatMattersMostItems.push({
      id: "client-summary-status",
      title: args.summaryState.title,
      body: `${args.summaryState.description} ${args.summaryState.recoveryDescription}`.trim(),
      evidence: [],
    });
  }

  const attractiveItems = dedupeDecisionMemoItems(
    args.decisionMemo.upside.items,
  ).slice(0, 3);
  const riskyOrUncertainItems = dedupeDecisionMemoItems([
    ...args.decisionMemo.downside.items,
    ...args.decisionMemo.unknowns.items,
    ...args.decisionMemo.unresolvedRisks.items,
  ]).slice(0, 4);
  const nextStepItems = buildClientReadySummaryNextSteps(args);

  const artifactWithoutText = {
    title: "Client-ready summary",
    summary:
      args.summaryState.kind === "ready"
        ? args.decisionMemo.summary
        : `${args.decisionMemo.summary} ${args.summaryState.recoveryDescription}`.trim(),
    whatMattersMost: {
      title: "What matters most",
      summary:
        "Start with the overall case before getting pulled into individual evidence rows.",
      items: dedupeDecisionMemoItems(whatMattersMostItems).slice(0, 3),
    },
    attractive: {
      title: "What looks attractive",
      summary:
        attractiveItems.length > 0
          ? "These are the strongest buyer-safe reasons the property still looks promising."
          : "No single upside is strong enough to headline without caveat right now.",
      items: attractiveItems,
    },
    riskyOrUncertain: {
      title: "What looks risky or uncertain",
      summary:
        riskyOrUncertainItems.length > 0
          ? "These are the biggest reasons to stay disciplined or wait for more proof."
          : "No major unresolved risk is currently carrying the case on its own.",
      items: riskyOrUncertainItems,
    },
    recommendation: args.decisionMemo.recommendation,
    nextSteps: {
      title: "What the buyer should do next",
      summary:
        nextStepItems.length > 0
          ? "The next move should stay consistent with both the recommendation and the current confidence gaps."
          : "No next step is strong enough to recommend until more evidence lands.",
      items: nextStepItems,
    },
    renderedText: "",
  } satisfies Omit<ClientReadySummaryArtifact, "renderedText"> & {
    renderedText: "";
  };

  return {
    ...artifactWithoutText,
    renderedText: renderClientReadySummaryText(
      args.propertyAddress,
      artifactWithoutText,
    ),
  };
}

function buildClientReadySummaryNextSteps(args: {
  decisionMemo: BuyerSafeDecisionMemoView;
  summaryState: AdvisorySurfaceState;
  recommendationState: AdvisorySurfaceState;
  missingStates: PropertyCaseMissingState[];
  confidenceSections: PropertyCaseConfidenceSectionView[];
}): ClientReadySummaryNextStepView[] {
  const steps: ClientReadySummaryNextStepView[] = [];

  if (!args.recommendationState.withholdOutput) {
    steps.push({
      id: "client-summary-step-recommendation",
      title: "Use the current recommendation as the starting point",
      body: args.decisionMemo.recommendation.body,
      evidence: args.decisionMemo.recommendation.evidence,
    });
  } else {
    steps.push({
      id: "client-summary-step-recommendation-state",
      title: args.recommendationState.title,
      body: `${args.recommendationState.description} ${args.recommendationState.recoveryDescription}`.trim(),
      evidence: [],
    });
  }

  for (const section of args.confidenceSections) {
    const guidance = section.whatWouldIncreaseConfidence[0];
    if (!guidance) continue;
    steps.push({
      id: `client-summary-step-${section.key}`,
      title: `Verify ${section.title.toLowerCase()}`,
      body: guidance,
      evidence: buildConfidenceSectionClientSummaryEvidence(section),
    });
    if (steps.length >= 3) break;
  }

  if (
    steps.length < 3 &&
    args.summaryState.kind !== "ready" &&
    args.summaryState.recoveryDescription
  ) {
    steps.push({
      id: "client-summary-step-summary-state",
      title: "Wait for the remaining evidence",
      body: args.summaryState.recoveryDescription,
      evidence: [],
    });
  }

  if (steps.length < 3) {
    for (const state of args.missingStates) {
      const section = missingStateToConfidenceSection(state.engine, args.confidenceSections);
      steps.push({
        id: `client-summary-step-missing-${state.engine}`,
        title: `Resolve ${state.label.toLowerCase()}`,
        body: state.description,
        evidence: section ? buildConfidenceSectionClientSummaryEvidence(section) : [],
      });
      if (steps.length >= 3) break;
    }
  }

  return dedupeDecisionMemoItems(steps).slice(0, 3);
}

function buildConfidenceSectionClientSummaryEvidence(
  section: PropertyCaseConfidenceSectionView,
): DecisionMemoEvidenceHook[] {
  return [
    {
      id: `client-summary-confidence-${section.key}`,
      label: section.title,
      citationId: null,
      sourceAnchorId: null,
      nodeId: null,
      confidenceLabel: section.scoreLabel,
      statusLabel: section.statusLabel,
      provenance: [],
    },
  ];
}

function missingStateToConfidenceSection(
  engine: CoverageEngineKey,
  sections: PropertyCaseConfidenceSectionView[],
): PropertyCaseConfidenceSectionView | undefined {
  const sectionKey: RecommendationEvidenceSectionKey =
    engine === "offer" ? "offer_recommendation" : engine;
  return sections.find((section) => section.key === sectionKey);
}

function buildClientReadySummaryDiff(args: {
  decisionMemo: {
    rationaleSummary: string;
    sections: InternalDecisionMemoRationaleSectionView[];
  };
  adjudicationItems: PropertyCaseAdjudicationItem[];
  guardrails: Array<{
    citationId: string;
    engineLabel: string;
    state: AdvisoryGuardrailState;
    approvalPath: AdvisoryApprovalPath;
    summary: string;
  }>;
}): ClientReadySummaryDiff {
  const hiddenItems: ClientReadySummaryExcludedItem[] = [];

  for (const section of args.decisionMemo.sections) {
    const hiddenCount =
      section.reasonCodes.length +
      section.supportingNodeIds.length +
      section.missingNodeIds.length +
      section.conflictingNodeIds.length;
    if (hiddenCount === 0) continue;
    hiddenItems.push({
      id: `internal-rationale-${section.key}`,
      label: `${section.title} internal rationale`,
      source: "internal_rationale",
      reason:
        "Raw reason codes and evidence-graph identifiers stay internal, even when the buyer-safe summary stays aligned with this section.",
      summary: section.summary,
      citationId: null,
      sectionKey: section.key,
    });
  }

  for (const guardrail of args.guardrails) {
    if (guardrail.state === "can_say") continue;
    hiddenItems.push({
      id: `guardrail-${guardrail.citationId}`,
      label: `${guardrail.engineLabel} guardrail rationale`,
      source: "guardrail",
      reason:
        "Internal guardrail rationale explains the policy path, but the buyer-safe summary only carries the reviewed outcome.",
      summary: guardrail.summary,
      citationId: guardrail.citationId,
      sectionKey: engineTypeToEvidenceSectionKey(guardrail.engineLabel),
    });
  }

  for (const item of args.adjudicationItems) {
    if (item.visibility !== "internal_only" && !item.internalNotes) continue;
    hiddenItems.push({
      id: `adjudication-${item.citationId}`,
      label: `${item.engineLabel} adjudication notes`,
      source: "adjudication",
      reason:
        "Broker-only notes and internal-only visibility never flow into the client-ready summary.",
      summary: item.internalNotes ?? item.rationale ?? item.adjudicationLabel,
      citationId: item.citationId,
      sectionKey: engineTypeToEvidenceSectionKey(item.engineType),
    });
  }

  return {
    summary:
      hiddenItems.length > 0
        ? `The buyer-safe summary stays aligned with the current case while withholding ${hiddenItems.length} internal-only rationale item${hiddenItems.length === 1 ? "" : "s"} by design.`
        : "The buyer-safe summary currently matches the internal memo without additional hidden rationale items.",
    hiddenItems,
  };
}

function renderClientReadySummaryText(
  propertyAddress: string,
  artifact: Omit<ClientReadySummaryArtifact, "renderedText">,
): string {
  const lines = [propertyAddress, artifact.summary];

  appendClientReadySummarySection(lines, artifact.whatMattersMost);
  appendClientReadySummarySection(lines, artifact.attractive);
  appendClientReadySummarySection(lines, artifact.riskyOrUncertain);
  lines.push(
    `${artifact.recommendation.label}: ${artifact.recommendation.body}`,
  );
  if (artifact.recommendation.openingPriceLabel) {
    lines.push(`Recommended opener: ${artifact.recommendation.openingPriceLabel}`);
  }
  if (artifact.recommendation.confidenceLabel) {
    lines.push(`Recommendation confidence: ${artifact.recommendation.confidenceLabel}`);
  }
  if (artifact.recommendation.riskLabel) {
    lines.push(`Recommendation risk: ${artifact.recommendation.riskLabel}`);
  }
  appendClientReadySummarySection(lines, artifact.nextSteps);

  return lines.join("\n");
}

function appendClientReadySummarySection(
  lines: string[],
  section: {
    title: string;
    summary: string;
    items: Array<{ title: string; body: string }>;
  },
): void {
  lines.push(`${section.title}: ${section.summary}`);
  for (const item of section.items) {
    lines.push(`- ${item.title}: ${item.body}`);
  }
}

function engineTypeToEvidenceSectionKey(
  engineType: string,
): RecommendationEvidenceSectionKey | null {
  switch (engineType.toLowerCase()) {
    case "pricing":
      return "pricing";
    case "comps":
    case "comparable sales":
      return "comps";
    case "leverage":
    case "negotiation leverage":
      return "leverage";
    case "offer":
    case "offer strategy":
      return "offer_recommendation";
    default:
      return null;
  }
}

function buildDecisionMemoSummary(
  status: StatusBadge,
  viewState: PropertyCaseOverviewViewState,
  missingStates: PropertyCaseMissingState[],
): string {
  if (viewState === "ready") {
    return `${status.label}. The current memo has enough evidence to show the upside, the downside, and a clear recommendation in one place.`;
  }

  if (viewState === "partial") {
    return `${status.label}. The current memo is usable, but ${missingStates.length} signal${missingStates.length === 1 ? "" : "s"} still change how decisive the case should feel.`;
  }

  return `${status.label}. The memo stays explicit about what is missing instead of pretending the case is settled.`;
}

function classifyClaimPolarity(
  claim: PropertyCaseClaimView,
): "positive" | "negative" | "neutral" {
  switch (claim.topic) {
    case "pricing":
    case "comps":
      return claim.deltaLabel.toLowerCase().includes("below")
        ? "positive"
        : claim.deltaLabel.toLowerCase().includes("above")
          ? "negative"
          : "neutral";
    case "days_on_market":
      return claim.deltaLabel.toLowerCase().includes("above")
        ? "positive"
        : claim.deltaLabel.toLowerCase().includes("below")
          ? "negative"
          : "neutral";
    case "leverage":
    case "offer_recommendation":
      return claim.deltaLabel.toLowerCase().includes("below")
        ? "negative"
        : "positive";
    default:
      return "neutral";
  }
}

function buildClaimDecisionMemoItem(
  claim: PropertyCaseClaimView,
  evidenceContext: DecisionMemoEvidenceContext,
): DecisionMemoItemView {
  return {
    id: `claim-${claim.id}`,
    title: claim.topicLabel,
    body: claim.narrative,
    evidence: buildClaimDecisionMemoEvidence(claim, evidenceContext),
  };
}

function buildSectionDecisionMemoItem(
  section: PropertyCaseConfidenceSectionView,
  title: string,
  body: string,
  labels: string[],
  evidenceContext: DecisionMemoEvidenceContext,
  hookKind: "supporting" | "missing" | "conflicting",
): DecisionMemoItemView {
  return {
    id: `section-${section.key}-${hookKind}`,
    title,
    body,
    evidence: buildSectionDecisionMemoEvidence(
      section.key,
      labels,
      evidenceContext,
      hookKind,
    ),
  };
}

function buildMissingStateDecisionMemoItem(
  state: PropertyCaseMissingState,
  evidenceContext: DecisionMemoEvidenceContext,
): DecisionMemoItemView {
  const sectionKey = coverageKeyToEvidenceSectionKey(state.engine);
  return {
    id: `missing-${state.engine}-${state.tone}`,
    title: state.title,
    body: state.description,
    evidence: buildSectionDecisionMemoEvidence(
      sectionKey,
      [state.label],
      evidenceContext,
      state.tone === "pending" || state.tone === "missing" || state.tone === "uncertain"
        ? "missing"
        : "conflicting",
    ),
  };
}

function buildDecisionMemoRecommendation(args: {
  action: PropertyCaseActionView | null;
  recommendationState: AdvisorySurfaceState;
  evidenceContext: DecisionMemoEvidenceContext;
  offerSection: RecommendationEvidenceSection | null;
  missingStates: PropertyCaseMissingState[];
}): DecisionMemoRecommendationView {
  const offerEvidence = buildSectionDecisionMemoEvidence(
    "offer_recommendation",
    args.offerSection
      ? [
          ...args.offerSection.confidenceInputs.supportLabels,
          ...args.offerSection.confidenceInputs.missingLabels,
        ].filter(Boolean)
      : [],
    args.evidenceContext,
    args.offerSection?.conflictingNodeIds.length ? "conflicting" : "supporting",
  );

  if (args.action && !args.recommendationState.withholdOutput) {
    return {
      verdict:
        args.missingStates.length > 0 || args.action.riskLevel !== "low"
          ? "pursue_with_caution"
          : "worth_pursuing",
      label: "Current recommendation",
      body:
        args.action.reviewedConclusion ??
        `Treat the home as worth pursuing only with a disciplined opener around ${args.action.openingPriceLabel}. ${args.action.guardrailExplanation}`,
      confidenceLabel: args.action.confidenceLabel,
      riskLabel: args.action.riskLabel,
      openingPriceLabel: args.action.openingPriceLabel,
      evidence: offerEvidence,
    };
  }

  return {
    verdict: "wait_for_more_evidence",
    label: "Current recommendation",
    body: `${args.recommendationState.title}. ${args.recommendationState.description} ${args.recommendationState.recoveryDescription}`.trim(),
    confidenceLabel: null,
    riskLabel: null,
    openingPriceLabel: null,
    evidence: offerEvidence,
  };
}

interface DecisionMemoEvidenceContext {
  nodesById: Record<string, EvidenceGraphNode>;
  nodeIdsByCitation: Map<string, string[]>;
  sectionsByKey: Partial<Record<RecommendationEvidenceSectionKey, RecommendationEvidenceSection>>;
}

function createDecisionMemoEvidenceContext(
  evidenceGraph: BuildPropertyCaseOverviewInput["evidenceGraph"],
): DecisionMemoEvidenceContext {
  const nodesById = evidenceGraph?.nodes ?? {};
  const nodeIdsByCitation = new Map<string, string[]>();

  for (const [nodeId, node] of Object.entries(nodesById)) {
    for (const citationId of node.internal?.citations ?? []) {
      nodeIdsByCitation.set(citationId, [
        ...(nodeIdsByCitation.get(citationId) ?? []),
        nodeId,
      ]);
    }
  }

  return {
    nodesById,
    nodeIdsByCitation,
    sectionsByKey: evidenceGraph?.sections ?? {},
  };
}

function buildClaimDecisionMemoEvidence(
  claim: PropertyCaseClaimView,
  evidenceContext: DecisionMemoEvidenceContext,
): DecisionMemoEvidenceHook[] {
  const relatedNodeIds = evidenceContext.nodeIdsByCitation.get(claim.citationId) ?? [];
  const provenance = dedupeDossierSourceRefs(
    relatedNodeIds.flatMap(
      (nodeId) => evidenceContext.nodesById[nodeId]?.internal?.provenance ?? [],
    ),
  );

  return [
    {
      id: `claim-evidence-${claim.id}`,
      label: claim.referenceLine,
      citationId: claim.citationId,
      sourceAnchorId: claim.sourceAnchorId,
      nodeId: relatedNodeIds[0] ?? null,
      confidenceLabel: claim.confidenceLabel,
      statusLabel:
        claim.guardrailState === "can_say" ? null : claim.guardrailLabel,
      provenance,
    },
  ];
}

function buildSectionDecisionMemoEvidence(
  sectionKey: RecommendationEvidenceSectionKey,
  labels: string[],
  evidenceContext: DecisionMemoEvidenceContext,
  hookKind: "supporting" | "missing" | "conflicting",
): DecisionMemoEvidenceHook[] {
  const section = evidenceContext.sectionsByKey[sectionKey];
  if (!section) {
    return labels.map((label, index) => ({
      id: `fallback-${sectionKey}-${hookKind}-${index}`,
      label,
      citationId: null,
      sourceAnchorId: null,
      nodeId: null,
      confidenceLabel: null,
      statusLabel: null,
      provenance: [],
    }));
  }

  const nodeIds =
    hookKind === "supporting"
      ? section.supportingNodeIds
      : hookKind === "missing"
        ? section.missingNodeIds
        : section.conflictingNodeIds;
  const selectedNodeIds = nodeIds.slice(0, Math.max(labels.length, 1));

  return selectedNodeIds.map((nodeId, index) => {
    const node = evidenceContext.nodesById[nodeId];
    const citationId = node?.internal?.citations?.[0] ?? null;
    return {
      id: `${sectionKey}-${hookKind}-${nodeId}`,
      label: labels[index] ?? node?.label ?? section.title,
      citationId,
      sourceAnchorId: citationId ? sourceAnchorId(citationId) : null,
      nodeId,
      confidenceLabel:
        typeof node?.confidence === "number"
          ? `${formatPercent(node.confidence)} node confidence`
          : null,
      statusLabel: evidenceStatusLabel(section.status),
      provenance: dedupeDossierSourceRefs(node?.internal?.provenance ?? []),
    };
  });
}

function dedupeDecisionMemoItems(
  items: DecisionMemoItemView[],
): DecisionMemoItemView[] {
  const seen = new Set<string>();
  const deduped: DecisionMemoItemView[] = [];

  for (const item of items) {
    const key = `${item.title}:${item.body}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function dedupeDossierSourceRefs(refs: DossierSourceRef[]): DossierSourceRef[] {
  const seen = new Set<string>();
  const deduped: DossierSourceRef[] = [];

  for (const ref of refs) {
    const key = `${ref.label}:${ref.category}:${ref.citation ?? ""}:${ref.capturedAt ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ref);
  }

  return deduped;
}

function coverageKeyToEvidenceSectionKey(
  key: CoverageEngineKey,
): RecommendationEvidenceSectionKey {
  switch (key) {
    case "pricing":
      return "pricing";
    case "comps":
      return "comps";
    case "leverage":
      return "leverage";
    case "offer":
      return "offer_recommendation";
  }
}

function buildAction(
  payload: PropertyCase | null,
  claims: PropertyCaseClaimView[],
  coverageByKey: Map<CoverageEngineKey, PropertyCaseCoverageInput>,
  offerGuardrail: AdvisoryGuardrailAssessment | undefined,
  offerCitation: PropertyCaseCitationInput | undefined,
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
  const buyerFacingAdjudication = resolveBuyerFacingAdjudication(offerCitation);

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
      buyerFacingAdjudication?.buyerExplanation ??
      offerGuardrail?.buyerExplanation ??
      "This recommendation cleared the buyer-safe advisory guardrail.",
    reviewedConclusion: buyerFacingAdjudication?.reviewedConclusion ?? null,
    buyerExplanation: buyerFacingAdjudication?.buyerExplanation ?? null,
    isBrokerReviewed: Boolean(buyerFacingAdjudication),
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
      const adjudication = resolveCurrentAdjudication(citation);
      const buyerFacingAdjudication = resolveBuyerFacingAdjudication(citation);
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
        adjudicationStatus: adjudication.status,
        adjudicationLabel: adjudicationStatusLabel(adjudication.status),
        visibility: adjudication.visibility ?? null,
        visibilityLabel: adjudication.visibility
          ? adjudicationVisibilityLabel(adjudication.visibility)
          : null,
        reviewedConclusion: buyerFacingAdjudication?.reviewedConclusion ?? null,
        buyerExplanation: buyerFacingAdjudication?.buyerExplanation ?? null,
        reviewedByLabel: adjudication.actorName ?? null,
        reviewedAtLabel: adjudication.actedAt
          ? formatShortDate(adjudication.actedAt)
          : null,
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
    .map((citation) => {
      const adjudication = resolveCurrentAdjudication(citation);

      return {
        citationId: citation.citationId,
        engineType: citation.engineType,
        engineLabel: humanizeEngineType(citation.engineType),
        reviewState: citation.reviewState,
        adjudicationStatus: adjudication.status,
        adjudicationLabel: adjudicationStatusLabel(adjudication.status),
        action: adjudication.action ?? null,
        actionLabel: adjudication.action
          ? adjudicationActionLabel(adjudication.action)
          : null,
        visibility: adjudication.visibility ?? null,
        visibilityLabel: adjudication.visibility
          ? adjudicationVisibilityLabel(adjudication.visibility)
          : null,
        rationale: adjudication.rationale ?? null,
        reviewedConclusion: adjudication.reviewedConclusion ?? null,
        buyerExplanation: adjudication.buyerExplanation ?? null,
        internalNotes: adjudication.internalNotes ?? null,
        actorName: adjudication.actorName ?? null,
        actorId: adjudication.actorUserId ?? null,
        actedAt: adjudication.actedAt ?? null,
        actedAtLabel: adjudication.actedAt
          ? formatShortDate(adjudication.actedAt)
          : null,
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
        auditTrail: (citation.adjudicationHistory ?? []).map((entry) => ({
          action: entry.action,
          actionLabel: adjudicationActionLabel(entry.action),
          status: entry.status,
          statusLabel: adjudicationStatusLabel(entry.status),
          visibility: entry.visibility,
          visibilityLabel: adjudicationVisibilityLabel(entry.visibility),
          rationale: entry.rationale,
          reviewedConclusion: entry.reviewedConclusion ?? null,
          buyerExplanation: entry.buyerExplanation ?? null,
          internalNotes: entry.internalNotes ?? null,
          actorName: entry.actorName ?? null,
          actorId: entry.actorUserId,
          actedAt: entry.actedAt,
          actedAtLabel: formatShortDate(entry.actedAt),
        })),
      };
    })
    .sort((a, b) => {
      if (a.adjudicationStatus === b.adjudicationStatus) {
        return a.engineLabel.localeCompare(b.engineLabel);
      }

      const rank = {
        pending: 0,
        overridden: 1,
        adjusted: 2,
        approved: 3,
      } as const;
      return rank[a.adjudicationStatus] - rank[b.adjudicationStatus];
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
      if (item.visibility === "buyer_safe") summary.buyerSafeCount += 1;
      if (item.visibility === "internal_only") summary.internalOnlyCount += 1;
      if (item.adjudicationStatus === "adjusted") summary.adjustedCount += 1;
      if (item.adjudicationStatus === "overridden") summary.overriddenCount += 1;
      return summary;
    },
    {
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      buyerSafeCount: 0,
      internalOnlyCount: 0,
      adjustedCount: 0,
      overriddenCount: 0,
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

function resolveCurrentAdjudication(
  citation: PropertyCaseCitationInput | undefined,
): (AdvisoryAdjudicationSnapshot & { actorName?: string | null }) | {
  status: AdvisoryAdjudicationStatus;
  action: AdvisoryAdjudicationAction | null;
  visibility: AdvisoryAdjudicationVisibility | null;
  rationale?: string;
  reviewedConclusion?: string;
  buyerExplanation?: string;
  internalNotes?: string;
  actorUserId?: string;
  actorName?: string | null;
  actedAt?: string;
} {
  if (citation?.adjudication) {
    return citation.adjudication;
  }

  if (citation?.reviewState === "approved") {
    return {
      status: "approved",
      action: "approve",
      visibility: "buyer_safe",
    };
  }

  if (citation?.reviewState === "rejected") {
    return {
      status: "overridden",
      action: "override",
      visibility: "internal_only",
    };
  }

  return {
    status: "pending",
    action: null,
    visibility: null,
  };
}

function resolveBuyerFacingAdjudication(
  citation: PropertyCaseCitationInput | undefined,
): AdvisoryAdjudicationSnapshot | undefined {
  if (citation?.adjudication?.visibility !== "buyer_safe") {
    return undefined;
  }

  return citation.adjudication;
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
