"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { LoadingState } from "@/components/product/LoadingState";
import { SurfaceState } from "@/components/product/SurfaceState";
import { StatusBadge } from "@/components/product/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BrokerOverrideReasonCategory } from "@/lib/analyticsEvents/contract";
import {
  buildAdvisoryBuyerFeedbackSubmissionInput,
  buildBuyerSafeSummaryText,
  trackAdvisoryBrokerAdjudicationOpened,
  trackAdvisoryConfidenceDetailsExpanded,
  trackAdvisoryMemoViewed,
  trackAdvisoryNextBestActionClicked,
  trackAdvisoryRecommendationViewed,
  trackAdvisorySourceTraceOpened,
  trackAdvisorySummaryCopied,
  trackAdvisorySummaryShared,
} from "@/lib/dealroom/advisoryTelemetry";
import { isConfigured } from "@/lib/env";
import type { BuyerReadinessSurface } from "@/lib/dealroom/buyer-readiness";
import {
  buildPropertyRecommendation,
  type PropertyRecommendation,
  type PropertyRecommendationCondition,
} from "@/lib/dealroom/next-best-action";
import type {
  DecisionMemoEvidenceHook,
  DecisionMemoSectionView,
  PropertyCaseOverviewSurface,
} from "@/lib/dealroom/property-case-overview";
import type { DealRoomRiskSummary } from "@/lib/dealroom/risk-summary";
import { trackDealRoomUnlocked } from "@/lib/intake/pasteLinkFunnel";
import { cn } from "@/lib/utils";
import type {
  AdvisoryAdjudicationAction,
  AdvisoryAdjudicationVisibility,
} from "@/lib/advisory/adjudication";
import type {
  AdvisoryFeedbackReasonCode,
  AdvisoryFeedbackResponse,
} from "@/lib/dealroom/advisory-feedback";
import { AdvisoryArtifactFeedbackCard } from "./AdvisoryArtifactFeedbackCard";
import { BuyerReadinessCard } from "./BuyerReadinessCard";
import { previewPropertyCaseOverview } from "./preview-data";

interface PropertyCaseOverviewProps {
  dealRoomId: Id<"dealRooms">;
}

interface SubmitSourceAdjudicationInput {
  citationId: string;
  action: AdvisoryAdjudicationAction;
  visibility: AdvisoryAdjudicationVisibility;
  rationale: string;
  reasonCategory?: BrokerOverrideReasonCategory;
  reviewedConclusion?: string;
  buyerExplanation?: string;
  internalNotes?: string;
}

const BROKER_OVERRIDE_REASON_OPTIONS: Array<{
  value: BrokerOverrideReasonCategory;
  label: string;
}> = [
  { value: "unsupported_evidence", label: "Unsupported evidence" },
  { value: "stale_evidence", label: "Stale evidence" },
  { value: "policy_guardrail", label: "Policy guardrail" },
  { value: "market_context_shift", label: "Market context shifted" },
  { value: "human_judgment", label: "Human judgment" },
  { value: "other", label: "Other" },
];

const ADJUDICATION_ACTION_OPTIONS: Array<{
  value: AdvisoryAdjudicationAction;
  label: string;
}> = [
  { value: "approve", label: "Approve as-is" },
  { value: "adjust", label: "Adjust for buyer" },
  { value: "override", label: "Override conclusion" },
];

const ADJUDICATION_VISIBILITY_OPTIONS: Array<{
  value: AdvisoryAdjudicationVisibility;
  label: string;
}> = [
  { value: "buyer_safe", label: "Buyer-safe" },
  { value: "internal_only", label: "Internal only" },
];

export function PropertyCaseOverview({
  dealRoomId,
}: PropertyCaseOverviewProps) {
  if (!isConfigured.convex()) {
    return <PropertyCaseOverviewBody overview={previewPropertyCaseOverview} />;
  }

  return <LivePropertyCaseOverview dealRoomId={dealRoomId} />;
}

function LivePropertyCaseOverview({
  dealRoomId,
}: PropertyCaseOverviewProps) {
  const trackedDealRoomId = useRef<string | null>(null);
  const submitAdjudication = useMutation(api.aiEngineOutputs.submitAdjudication);
  const submitBuyerFeedback = useMutation(
    (api as any).advisoryBuyerFeedback.submit,
  );
  const overview = useQuery(api.dealRoomCaseOverview.getOverview, {
    dealRoomId,
  }) as PropertyCaseOverviewSurface | null | undefined;
  const readiness = useQuery(
    (api as any).dealRoomBuyerReadiness.getReadiness,
    {
      dealRoomId,
    },
  ) as BuyerReadinessSurface | null | undefined;
  const riskSummary = useQuery(
    (api as any).dealRoomRiskSummary.getRiskSummary,
    {
      dealRoomId,
    },
  ) as DealRoomRiskSummary | null | undefined;

  useEffect(() => {
    if (!overview) return;
    if (trackedDealRoomId.current === overview.dealRoomId) return;

    trackedDealRoomId.current = overview.dealRoomId;
    trackDealRoomUnlocked({
      dealRoomId: overview.dealRoomId,
      propertyId: overview.propertyId,
    });
  }, [overview]);

  if (
    overview === undefined ||
    readiness === undefined ||
    riskSummary === undefined
  ) {
    return <LoadingState variant="panel" />;
  }

  if (overview === null) {
    return (
      <SurfaceState
        tone="error"
        title="This deal room overview is not available."
        description="The overview stays hidden until buyer-safe evidence and route data are available."
        className="bg-white"
      />
    );
  }

  return (
    <PropertyCaseOverviewBody
      overview={overview}
      readiness={readiness ?? undefined}
      riskSummary={riskSummary ?? undefined}
      telemetryEnabled
      onSubmitAdjudication={async ({
        citationId,
        action,
        visibility,
        rationale,
        reasonCategory,
        reviewedConclusion,
        buyerExplanation,
        internalNotes,
      }) => {
        await submitAdjudication({
          outputId: citationId as Id<"aiEngineOutputs">,
          dealRoomId,
          surface: "deal_room_overview",
          action,
          visibility,
          rationale: rationale.trim(),
          reasonCategory,
          reviewedConclusion: reviewedConclusion?.trim() || undefined,
          buyerExplanation: buyerExplanation?.trim() || undefined,
          internalNotes: internalNotes?.trim() || undefined,
        });
      }}
      onSubmitBuyerFeedback={async (input) => {
        await submitBuyerFeedback(
          buildAdvisoryBuyerFeedbackSubmissionInput(overview, input),
        );
      }}
    />
  );
}

function PropertyCaseOverviewBody({
  overview,
  readiness,
  riskSummary,
  telemetryEnabled = false,
  onSubmitAdjudication,
  onSubmitBuyerFeedback,
}: {
  overview: PropertyCaseOverviewSurface;
  readiness?: BuyerReadinessSurface | null;
  riskSummary?: DealRoomRiskSummary | null;
  telemetryEnabled?: boolean;
  onSubmitAdjudication?: (input: SubmitSourceAdjudicationInput) => Promise<void>;
  onSubmitBuyerFeedback?: (input: {
    artifact: "memo" | "recommendation" | "summary";
    responses: AdvisoryFeedbackResponse[];
    reasonCodes: AdvisoryFeedbackReasonCode[];
  }) => Promise<void>;
}) {
  const memoViewKey = useRef<string | null>(null);
  const recommendationViewKey = useRef<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const summaryText = buildBuyerSafeSummaryText(overview);
  const decisionMemo = overview.decisionMemo;
  const memoState = overview.artifacts.memo;
  const recommendationState = overview.artifacts.recommendation;
  const summaryState = overview.artifacts.summary;
  const recommendation = buildPropertyRecommendation({
    overview,
    readiness,
    riskSummary,
  });

  useEffect(() => {
    if (!telemetryEnabled) return;

    const nextKey = [
      overview.dealRoomId,
      overview.generatedAt ?? "none",
      overview.viewState,
      overview.viewerRole,
    ].join(":");

    if (memoViewKey.current === nextKey) return;
    memoViewKey.current = nextKey;
    trackAdvisoryMemoViewed(overview);
  }, [
    overview.dealRoomId,
    overview.generatedAt,
    overview.viewState,
    overview.viewerRole,
    telemetryEnabled,
    overview,
  ]);

  useEffect(() => {
    if (
      !telemetryEnabled ||
      !overview.action ||
      overview.artifacts.recommendation.withholdOutput
    ) {
      return;
    }

    const nextKey = [
      overview.dealRoomId,
      overview.generatedAt ?? "none",
      overview.action.openingPrice,
      overview.action.confidence,
    ].join(":");

    if (recommendationViewKey.current === nextKey) return;
    recommendationViewKey.current = nextKey;
    trackAdvisoryRecommendationViewed(overview);
  }, [
    overview.action,
    overview.artifacts.recommendation.withholdOutput,
    overview.dealRoomId,
    overview.generatedAt,
    telemetryEnabled,
    overview,
  ]);

  async function handleCopySummary() {
    try {
      if (
        typeof navigator === "undefined" ||
        typeof navigator.clipboard?.writeText !== "function"
      ) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(summaryText);
      if (telemetryEnabled) {
        trackAdvisorySummaryCopied(overview, summaryText);
      }
      setSummaryStatus("Summary copied");
    } catch {
      setSummaryStatus("Copy failed");
    }
  }

  async function handleShareSummary() {
    if (!canNativeShare || typeof navigator === "undefined") return;

    try {
      await navigator.share({
        title: overview.propertyAddress,
        text: summaryText,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
      if (telemetryEnabled) {
        trackAdvisorySummaryShared(overview, {
          summaryText,
          method: "native_share",
        });
      }
      setSummaryStatus("Summary shared");
    } catch {
      // User-cancelled shares are not analytics-worthy.
    }
  }

  function handleConfidenceToggle(open: boolean) {
    if (open && telemetryEnabled) {
      trackAdvisoryConfidenceDetailsExpanded(overview);
    }
  }

  function handleSourceTraceClick(
    citationId: string,
    trigger: "claim_link" | "broker_adjudication" = "claim_link",
    claimId?: string,
  ) {
    if (!telemetryEnabled) return;

    const source = overview.sources.find((item) => item.citationId === citationId);
    if (!source) return;

    trackAdvisorySourceTraceOpened(overview, {
      source,
      trigger,
      claim: claimId
        ? overview.claims.find((item) => item.id === claimId)
        : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {readiness ? <BuyerReadinessCard readiness={readiness} /> : null}
      <section className="overflow-hidden rounded-[32px] border border-neutral-200/80 bg-white shadow-[0_18px_40px_-34px_rgba(3,14,29,0.1)]">
        <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="relative min-h-[340px] overflow-hidden bg-neutral-950 px-6 py-6 text-white sm:px-8 lg:px-10">
            {overview.photoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={overview.photoUrl}
                  alt={overview.propertyAddress}
                  className="absolute inset-0 h-full w-full object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-950/85 to-primary/55" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.14),_transparent_32%),linear-gradient(135deg,_#0a0a0a,_#1f2937_55%,_#1d4ed8)]" />
            )}

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-white/10 text-white backdrop-blur">
                  Deal room overview
                </Badge>
                <DealStatusToneBadge tone={overview.status.tone}>
                  {overview.status.label}
                </DealStatusToneBadge>
                <ConfidenceBadge tone={overview.overallConfidenceTone}>
                  {overview.overallConfidenceLabel}
                </ConfidenceBadge>
              </div>

              <div className="max-w-2xl space-y-4">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/65">
                    Buyer-safe case
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {overview.propertyAddress}
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/78 sm:text-base">
                    {decisionMemo.summary}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 text-sm text-white/85">
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                    {overview.listPriceLabel}
                  </span>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                    {overview.generatedAtLabel}
                  </span>
                  {overview.status.nextAction && (
                    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur">
                      Next: {overview.status.nextAction}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 bg-white px-6 py-6 sm:px-8 lg:px-9">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
                Coverage
              </p>
              <p className="text-lg font-semibold text-neutral-900">
                {overview.coverageSummary}
              </p>
              <p className="text-sm leading-6 text-neutral-600">
                Claims stay comparative, citations stay visible, and low-confidence
                signals stay out of the buyer-facing narrative.
              </p>
            </div>

            <details
              className="rounded-[20px] border border-neutral-200/80 bg-neutral-50/80 p-4"
              onToggle={(event) =>
                handleConfidenceToggle(
                  (event.currentTarget as HTMLDetailsElement).open,
                )
              }
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900">
                Confidence details
              </summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <MetricTile
                  label="Overall confidence"
                  value={overview.overallConfidenceLabel}
                  light
                />
                <MetricTile
                  label="Available signals"
                  value={String(overview.coverageStats.availableCount)}
                  light
                />
                <MetricTile
                  label="Pending review"
                  value={String(overview.coverageStats.pendingCount)}
                  light
                />
                <MetricTile
                  label="Held back"
                  value={String(
                    overview.coverageStats.uncertainCount +
                      overview.coverageStats.missingCount,
                  )}
                  light
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-neutral-600">
                The memo stays sparse on purpose. Signals that are pending review or
                too weak to trust remain visible as gaps instead of becoming
                unsupported conclusions.
              </p>
            </details>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Button asChild className="justify-between">
                <Link
                  href={`/dealroom/${overview.dealRoomId}/offer`}
                  onClick={() =>
                    telemetryEnabled
                      ? trackAdvisoryNextBestActionClicked(overview, {
                          target: "offer_cockpit",
                          ctaId: "overview_offer_cockpit",
                          nextActionLabel: overview.status.nextAction ?? undefined,
                        })
                      : undefined
                  }
                >
                  Offer cockpit
                  <span aria-hidden="true">→</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link
                  href={`/dealroom/${overview.dealRoomId}/close`}
                  onClick={() =>
                    telemetryEnabled
                      ? trackAdvisoryNextBestActionClicked(overview, {
                          target: "close_dashboard",
                          ctaId: "overview_close_dashboard",
                          nextActionLabel: overview.status.nextAction ?? undefined,
                        })
                      : undefined
                  }
                >
                  Close dashboard
                  <span aria-hidden="true">→</span>
                </Link>
              </Button>
            </div>

            <div className="space-y-3 rounded-[20px] border border-neutral-200/80 bg-white/90 p-4">
              <p className="text-sm font-semibold text-neutral-900">
                Client-ready summary
              </p>
              <p className="text-sm leading-6 text-neutral-600">
                {overview.clientReadySummary.summary}
              </p>
              <p className="text-xs font-medium text-neutral-500">
                Built from the same memo, recommendation, confidence, and
                source-trace layers the deal room already uses.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
        <CardHeader>
          <CardTitle>{decisionMemo.title}</CardTitle>
          <CardDescription>{decisionMemo.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {memoState.kind !== "ready" ? (
            <EmptyStateCard
              title={memoState.title}
              description={`${memoState.description} ${memoState.recoveryDescription}`}
            />
          ) : (
            <>
              <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_24px_52px_-36px_rgba(3,14,29,0.4)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      {decisionMemo.recommendation.label}
                    </p>
                    <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-white">
                      {decisionMemo.recommendation.body}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {decisionMemo.recommendation.confidenceLabel ? (
                      <Badge className="bg-white/10 text-white">
                        {decisionMemo.recommendation.confidenceLabel}
                      </Badge>
                    ) : null}
                    {decisionMemo.recommendation.riskLabel ? (
                      <Badge className="bg-white/10 text-white">
                        {decisionMemo.recommendation.riskLabel}
                      </Badge>
                    ) : null}
                    {decisionMemo.recommendation.openingPriceLabel ? (
                      <Badge className="bg-white/10 text-white">
                        {decisionMemo.recommendation.openingPriceLabel}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <DecisionMemoEvidenceHooks
                  hooks={decisionMemo.recommendation.evidence}
                  tone="dark"
                  onSourceTraceClick={handleSourceTraceClick}
                />
              </div>

              {overview.viewerRole === "buyer" && onSubmitBuyerFeedback ? (
                <AdvisoryArtifactFeedbackCard
                  artifact="memo"
                  onSubmit={onSubmitBuyerFeedback}
                />
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <DecisionMemoSectionCard
                  section={decisionMemo.upside}
                  tone="support"
                  onSourceTraceClick={handleSourceTraceClick}
                />
                <DecisionMemoSectionCard
                  section={decisionMemo.downside}
                  tone="caution"
                  onSourceTraceClick={handleSourceTraceClick}
                />
                <DecisionMemoSectionCard
                  section={decisionMemo.unknowns}
                  tone="unknown"
                  onSourceTraceClick={handleSourceTraceClick}
                />
                <DecisionMemoSectionCard
                  section={decisionMemo.unresolvedRisks}
                  tone="risk"
                  onSourceTraceClick={handleSourceTraceClick}
                />
              </div>

              {overview.variant === "internal" && (
                <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        Internal rationale
                      </p>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                        {overview.internal.decisionMemo.rationaleSummary}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                      Internal only
                    </Badge>
                  </div>
                  <div className="mt-5 grid gap-3 xl:grid-cols-2">
                    {overview.internal.decisionMemo.sections.map((section) => (
                      <article
                        key={section.key}
                        className="rounded-2xl border border-neutral-200 bg-white p-4"
                      >
                        <p className="text-sm font-semibold text-neutral-900">
                          {section.title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-600">
                          {section.summary}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {section.sourceCategories.map((category) => (
                            <Badge
                              key={`${section.key}-${category}`}
                              variant="outline"
                              className="border-neutral-200 bg-neutral-50 text-neutral-700"
                            >
                              {category.replaceAll("_", " ")}
                            </Badge>
                          ))}
                          {section.reasonCodes.map((code) => (
                            <Badge
                              key={`${section.key}-${code}`}
                              variant="outline"
                              className="border-neutral-200 bg-neutral-50 font-mono text-[11px] text-neutral-700"
                            >
                              {code}
                            </Badge>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{overview.clientReadySummary.title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                {overview.clientReadySummary.summary}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopySummary}
                disabled={summaryState.withholdOutput}
              >
                Copy summary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareSummary}
                disabled={!canNativeShare || summaryState.withholdOutput}
              >
                Share summary
              </Button>
            </div>
          </div>
          {summaryState.kind !== "ready" ? (
            <div className="rounded-[18px] border border-warning-200 bg-warning-50/70 px-4 py-3 text-sm leading-6 text-warning-800">
              {summaryState.title}. {summaryState.description}{" "}
              {summaryState.recoveryDescription}
            </div>
          ) : null}
          {summaryStatus ? (
            <p className="text-xs font-medium text-neutral-500">
              {summaryStatus}
            </p>
          ) : null}
          {overview.viewerRole === "buyer" && onSubmitBuyerFeedback ? (
            <AdvisoryArtifactFeedbackCard
              artifact="summary"
              onSubmit={onSubmitBuyerFeedback}
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_24px_52px_-36px_rgba(3,14,29,0.4)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                  {overview.clientReadySummary.recommendation.label}
                </p>
                <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-white">
                  {overview.clientReadySummary.recommendation.body}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {overview.clientReadySummary.recommendation.confidenceLabel ? (
                  <Badge className="bg-white/10 text-white">
                    {overview.clientReadySummary.recommendation.confidenceLabel}
                  </Badge>
                ) : null}
                {overview.clientReadySummary.recommendation.riskLabel ? (
                  <Badge className="bg-white/10 text-white">
                    {overview.clientReadySummary.recommendation.riskLabel}
                  </Badge>
                ) : null}
                {overview.clientReadySummary.recommendation.openingPriceLabel ? (
                  <Badge className="bg-white/10 text-white">
                    {overview.clientReadySummary.recommendation.openingPriceLabel}
                  </Badge>
                ) : null}
              </div>
            </div>
            <DecisionMemoEvidenceHooks
              hooks={overview.clientReadySummary.recommendation.evidence}
              tone="dark"
              onSourceTraceClick={handleSourceTraceClick}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DecisionMemoSectionCard
              section={overview.clientReadySummary.whatMattersMost}
              tone="neutral"
              onSourceTraceClick={handleSourceTraceClick}
            />
            <DecisionMemoSectionCard
              section={overview.clientReadySummary.attractive}
              tone="support"
              onSourceTraceClick={handleSourceTraceClick}
            />
            <DecisionMemoSectionCard
              section={overview.clientReadySummary.riskyOrUncertain}
              tone="risk"
              onSourceTraceClick={handleSourceTraceClick}
            />
            <DecisionMemoSectionCard
              section={overview.clientReadySummary.nextSteps}
              tone="unknown"
              onSourceTraceClick={handleSourceTraceClick}
            />
          </div>

          {overview.variant === "internal" ? (
            <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">
                    Internal-only content intentionally excluded
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
                    {overview.internal.clientReadySummaryDiff.summary}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-neutral-200 bg-white text-neutral-700"
                >
                  Internal only
                </Badge>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {overview.internal.clientReadySummaryDiff.hiddenItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-neutral-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-neutral-600">
                          {item.summary}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-neutral-200 bg-neutral-50 text-neutral-700"
                      >
                        {item.source.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-neutral-500">
                      {item.reason}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {overview.marketReality && (
        <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Neighborhood reality</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-sm leading-6">
                  {overview.marketReality.position.summary}
                </CardDescription>
              </div>
              <MarketPositionBadge tone={overview.marketReality.position.tone}>
                {overview.marketReality.position.label}
              </MarketPositionBadge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                {overview.marketReality.geographyLabel}
              </Badge>
              <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                {overview.marketReality.marketWindowLabel}
              </Badge>
              <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                {overview.marketReality.sampleSizeLabel}
              </Badge>
              <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                {overview.marketReality.freshnessLabel}
              </Badge>
              <Badge variant="outline" className="border-neutral-200 bg-neutral-50 text-neutral-700">
                {overview.marketReality.reliabilityLabel}
              </Badge>
            </div>

            {overview.marketReality.fallbackNotice ? (
              <div className="rounded-[18px] border border-warning-200 bg-warning-50/70 px-4 py-3 text-sm leading-6 text-warning-800">
                {overview.marketReality.fallbackNotice}
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {overview.marketReality.signals.map((signal) => (
              <article
                key={signal.key}
                className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {signal.summary}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent",
                      signal.status === "missing" && "bg-neutral-200 text-neutral-700",
                      signal.status === "available" &&
                        signal.tone === "positive" &&
                        "bg-success-50 text-success-700",
                      signal.status === "available" &&
                        signal.tone === "warning" &&
                        "bg-warning-50 text-warning-700",
                      signal.status === "available" &&
                        signal.tone === "neutral" &&
                        "bg-neutral-200 text-neutral-700",
                    )}
                  >
                    {signal.status === "available" ? "Available" : "Missing"}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {signal.subjectLabel ? (
                    <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                      {signal.subjectLabel}
                    </Badge>
                  ) : null}
                  {signal.baselineLabel ? (
                    <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                      {signal.baselineLabel}
                    </Badge>
                  ) : null}
                  {signal.deltaLabel ? (
                    <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                      {signal.deltaLabel}
                    </Badge>
                  ) : null}
                </div>
              </article>
            ))}
          </CardContent>

          {overview.variant === "internal" && overview.internal.marketReality && (
            <CardContent className="pt-0">
              <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_28px_56px_-38px_rgba(3,14,29,0.45)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Internal baseline detail
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/75">
                      Raw market baseline metadata stays separate from the buyer-safe interpretation.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-white/10 text-white">
                      {overview.internal.marketReality.selectedGeoKind
                        ? `${overview.internal.marketReality.selectedGeoKind.replaceAll("_", " ")}${overview.internal.marketReality.selectedGeoKey ? ` · ${overview.internal.marketReality.selectedGeoKey}` : ""}`
                        : "No selected geography"}
                    </Badge>
                    <Badge className="bg-white/10 text-white">
                      {overview.internal.marketReality.marketWindowDays}-day window
                    </Badge>
                    <Badge className="bg-white/10 text-white">
                      {Math.round(overview.internal.marketReality.confidence * 100)}% confidence
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricTile
                    label="Generated"
                    value={new Date(
                      overview.internal.marketReality.generatedAt,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  />
                  <MetricTile
                    label="Last refreshed"
                    value={
                      overview.internal.marketReality.lastRefreshedAt
                        ? new Date(
                            overview.internal.marketReality.lastRefreshedAt,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "Unavailable"
                    }
                  />
                  <MetricTile
                    label="Source"
                    value={overview.internal.marketReality.sourceLabel ?? "Unavailable"}
                    monospace
                  />
                  <MetricTile
                    label="Downgrades"
                    value={String(
                      overview.internal.marketReality.downgradeReasons.length,
                    )}
                  />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                      Baseline metrics
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {overview.internal.marketReality.baselineMetrics.length > 0 ? (
                        overview.internal.marketReality.baselineMetrics.map((metric) => (
                          <div
                            key={metric.label}
                            className="rounded-xl border border-white/10 bg-white/5 p-3"
                          >
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-sm text-white">{metric.value}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/75">
                          No raw baseline metrics were available.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                      Downgrade reasons
                    </p>
                    {overview.internal.marketReality.downgradeReasons.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-white/78">
                        {overview.internal.marketReality.downgradeReasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-white/75">
                        No fallback downgrade was needed for this market slice.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {overview.confidenceSections.length > 0 && (
        <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
          <CardHeader>
            <CardTitle>Confidence behind the recommendation</CardTitle>
            <CardDescription>
              Each section shows what is well supported, what is missing or contradictory,
              and what would make the recommendation more reliable.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-2">
            {overview.confidenceSections.map((section) => (
              <article
                key={section.key}
                className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {section.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {section.buyerExplanation}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ConfidenceBadge tone={section.tone}>
                      {section.bandLabel}
                    </ConfidenceBadge>
                    <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                      {section.statusLabel}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                    {section.scoreLabel}
                  </Badge>
                  {section.dependsOnInference ? (
                    <Badge variant="outline" className="border-warning-200 bg-warning-50 text-warning-700">
                      Inference-heavy
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <ConfidenceSectionEvidenceList
                    title="Strong evidence"
                    items={section.strongEvidence}
                    emptyState="No strong evidence is carrying this section yet."
                    tone="strong"
                  />
                  <ConfidenceSectionEvidenceList
                    title="Missing evidence"
                    items={section.missingEvidence}
                    emptyState="No major gaps are weakening this section right now."
                    tone="missing"
                  />
                  <ConfidenceSectionEvidenceList
                    title="Contradictory evidence"
                    items={section.contradictoryEvidence}
                    emptyState="No contradictory evidence is currently flagged."
                    tone="contradictory"
                  />
                  <ConfidenceSectionEvidenceList
                    title="What would increase confidence"
                    items={section.whatWouldIncreaseConfidence}
                    emptyState="Keep the current evidence fresh before relying on this section."
                    tone="next_step"
                  />
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
          <CardHeader>
            <CardTitle>Comparative claims</CardTitle>
            <CardDescription>
              Every claim is grounded in a market reference and linked back to
              its source output.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {overview.claims.length > 0 ? (
              overview.claims.map((claim) => (
                <article
                  key={claim.id}
                  className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                          {claim.topicLabel}
                        </Badge>
                        {claim.guardrailState !== "can_say" && (
                          <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                            {claim.guardrailLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-base font-medium leading-7 text-neutral-900">
                        {claim.narrative}
                      </p>
                      <p className="text-sm leading-6 text-neutral-600">
                        {claim.referenceLine}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <DeltaBadge direction={claim.deltaLabel}>
                        {claim.deltaLabel}
                      </DeltaBadge>
                      <ConfidenceBadge tone={claim.confidenceTone}>
                        {claim.confidenceLabel}
                      </ConfidenceBadge>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
                    <a
                      href={`#${claim.sourceAnchorId}`}
                      className="font-medium text-primary transition-colors hover:text-primary/80"
                      onClick={() =>
                        handleSourceTraceClick(claim.citationId, "claim_link", claim.id)
                      }
                    >
                      View source
                    </a>
                    <span className="text-neutral-300">•</span>
                    <span className="font-mono text-xs text-neutral-400">
                      {claim.citationId}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <EmptyStateCard
                title={memoState.title}
                description={`${memoState.description} ${memoState.recoveryDescription}`}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
            <CardHeader>
              <CardTitle>Recommended next step</CardTitle>
              <CardDescription>
                Property evidence, readiness, and risk stay separate until they are explicit enough to drive one next move.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_28px_56px_-38px_rgba(3,14,29,0.45)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Recommendation state
                    </p>
                    <p className="mt-3 text-3xl font-semibold">
                      {recommendation.label}
                    </p>
                  </div>
                  <Badge className={recommendationBadgeClasses(recommendation.kind)}>
                    {recommendation.kind.replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/88">
                  {recommendation.shortRationale}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  {recommendation.explanation}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConfidenceBadge tone={overview.overallConfidenceTone}>
                    {overview.overallConfidenceLabel}
                  </ConfidenceBadge>
                  {overview.marketReality ? (
                    <MarketPositionBadge tone={overview.marketReality.position.tone}>
                      {overview.marketReality.position.label}
                    </MarketPositionBadge>
                  ) : null}
                  {recommendationState.withholdOutput ? (
                    <Badge className="bg-white/10 text-white">
                      {recommendationState.title}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {recommendation.rationale.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-neutral-900">
                    Why this is the next move
                  </p>
                  {recommendation.rationale.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-neutral-200 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                          {item.title}
                        </p>
                        <Badge
                          variant="outline"
                          className="border-neutral-200 bg-neutral-50 text-neutral-600"
                        >
                          {item.source.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {recommendation.blockersAndConditions.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-neutral-900">
                    Blockers and conditions
                  </p>
                  {recommendation.blockersAndConditions.map((condition) => (
                    <div
                      key={condition.id}
                      className={cn(
                        "rounded-2xl border p-4",
                        conditionCardClasses(condition),
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-white/40 bg-white/80 text-neutral-700"
                        >
                          {condition.source.replaceAll("_", " ")}
                        </Badge>
                        <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                          {condition.effect.replaceAll("_", " ")}
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-neutral-900">
                        {condition.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">
                        {condition.summary}
                      </p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-neutral-500">
                        Next move
                      </p>
                      <p className="mt-1 text-sm leading-6 text-neutral-700">
                        {condition.actionLabel}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {recommendation.whatWouldChange.length > 0 && (
                <div className="rounded-xl border border-dashed border-neutral-200 p-4">
                  <p className="text-sm font-semibold text-neutral-900">
                    What would change the recommendation
                  </p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
                    {recommendation.whatWouldChange.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                <p className="text-sm font-semibold text-neutral-900">
                  Buyer-safe CTA
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-700">
                  {recommendation.buyerCta.explanation}
                </p>
                {recommendation.buyerCta.href ? (
                  <Button asChild size="sm" className="mt-4 justify-between">
                    <Link
                      href={recommendation.buyerCta.href}
                      onClick={() =>
                        telemetryEnabled && recommendation.buyerCta.target
                          ? trackAdvisoryNextBestActionClicked(overview, {
                              target: recommendation.buyerCta.target,
                              ctaId: `recommendation_${recommendation.kind}`,
                              nextActionLabel: recommendation.label,
                            })
                          : undefined
                      }
                    >
                      {recommendation.buyerCta.label}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </Button>
                ) : (
                  <p className="mt-4 text-sm font-medium text-neutral-900">
                    {recommendation.buyerCta.label}
                  </p>
                )}
              </div>

              {overview.action && !recommendationState.withholdOutput ? (
                <div className="space-y-3 rounded-[22px] border border-neutral-200 bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        Offer guidance
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-neutral-950">
                        {overview.action.openingPriceLabel}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ConfidenceBadge tone={confidenceToneFromAction(overview.action.confidence)}>
                        {overview.action.confidenceLabel}
                      </ConfidenceBadge>
                      <RiskBadge risk={overview.action.riskLevel}>
                        {overview.action.riskLabel}
                      </RiskBadge>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-neutral-700">
                    {overview.action.reviewedConclusion ??
                      overview.action.buyerExplanation ??
                      overview.action.guardrailExplanation}
                  </p>

                  {overview.action.rationale.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-neutral-900">
                        Why this opening number
                      </p>
                      {overview.action.rationale.map((item) => (
                        <div
                          key={`${item.title}-${item.body}`}
                          className="rounded-xl border border-neutral-200 p-3"
                        >
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                            {item.title}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-neutral-700">
                            {item.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {overview.action.suggestedContingencies.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-neutral-900">
                        Suggested contingencies
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {overview.action.suggestedContingencies.map((contingency) => (
                          <Badge
                            key={contingency}
                            variant="outline"
                            className="border-neutral-200 bg-neutral-50 text-neutral-700"
                          >
                            {contingency}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {overview.viewerRole === "buyer" && onSubmitBuyerFeedback ? (
                    <AdvisoryArtifactFeedbackCard
                      artifact="recommendation"
                      onSubmit={onSubmitBuyerFeedback}
                    />
                  ) : null}
                </div>
              ) : null}

              {recommendation.variant === "internal" ? (
                <details className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
                    Internal expanded reasoning
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricTile
                        label="Property direction"
                        value={recommendation.internal.propertyDirection}
                      />
                      <MetricTile
                        label="Broker review required"
                        value={
                          recommendation.internal.brokerReviewRequired ? "Yes" : "No"
                        }
                      />
                    </div>

                    {recommendation.internal.brokerReviewReasons.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          Broker review reasons
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {recommendation.internal.brokerReviewReasons.map((item) => (
                            <Badge
                              key={item}
                              variant="outline"
                              className="border-neutral-200 bg-white text-neutral-700"
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {recommendation.internal.reasonCodes.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                          Reason codes
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {recommendation.internal.reasonCodes.map((item) => (
                            <Badge
                              key={item}
                              variant="outline"
                              className="border-neutral-200 bg-white font-mono text-[11px] text-neutral-700"
                            >
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {recommendation.internal.expandedReasoning.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-neutral-200 bg-white p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                              {item.title}
                            </p>
                            <Badge
                              variant="outline"
                              className="border-neutral-200 bg-neutral-50 text-neutral-600"
                            >
                              {item.source.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-neutral-700">
                            {item.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ) : null}

              {overview.viewerRole === "buyer" && onSubmitBuyerFeedback ? (
                <AdvisoryArtifactFeedbackCard
                  artifact="recommendation"
                  onSubmit={onSubmitBuyerFeedback}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
            <CardHeader>
              <CardTitle>Missing or uncertain signals</CardTitle>
              <CardDescription>
                Explicit gaps are safer than filler when evidence is incomplete.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {overview.missingStates.length > 0 ? (
                overview.missingStates.map((item) => (
                  <div
                    key={`${item.engine}-${item.tone}`}
                    className={cn(
                      "rounded-2xl border p-4",
                      item.tone === "pending" &&
                        "border-info-200 bg-info-50/70",
                      item.tone === "uncertain" &&
                        "border-warning-200 bg-warning-50/70",
                      item.tone === "missing" &&
                        "border-neutral-200 bg-neutral-50",
                      item.tone === "review_required" &&
                        "border-warning-200 bg-warning-50/70",
                      item.tone === "blocked" &&
                        "border-error-200 bg-error-50/70",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-white/40 bg-white/70 text-neutral-700">
                        {item.label}
                      </Badge>
                      <span className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                        {item.tone}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-neutral-900">
                      {item.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700">
                      {item.description}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyStateCard
                  title="Coverage is complete"
                  description="No buyer-facing signals are currently pending or intentionally withheld."
                />
              )}
            </CardContent>
          </Card>

          {overview.variant === "internal" && (
            <Card className="rounded-[24px] border-neutral-900/80 bg-neutral-950 text-white shadow-[0_30px_68px_-46px_rgba(3,14,29,0.55)]">
              <CardHeader>
                <CardTitle>Internal cache details</CardTitle>
                <CardDescription className="text-white/65">
                  Visible to broker and admin roles only.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm text-white/85">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricTile
                    label="Synthesis version"
                    value={overview.internal.synthesisVersion ?? "Unavailable"}
                  />
                  <MetricTile
                    label="Cache hits"
                    value={String(overview.internal.hitCount)}
                  />
                  <MetricTile
                    label="Input hash"
                    value={overview.internal.inputHash ?? "Unavailable"}
                    monospace
                  />
                  <MetricTile
                    label="Contributing engines"
                    value={String(overview.internal.contributingEngines)}
                  />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Dropped engines
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {overview.internal.droppedEngines.length > 0 ? (
                      overview.internal.droppedEngines.map((engine) => (
                        <Badge
                          key={engine}
                          className="bg-white/10 text-white"
                        >
                          {engine}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-white/75">
                        None
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Advisory guardrails
                  </p>
                  <div className="mt-3 flex flex-col gap-3">
                    {overview.internal.guardrails.length > 0 ? (
                      overview.internal.guardrails.map((guardrail) => (
                        <div
                          key={`${guardrail.citationId}-${guardrail.state}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="bg-white/10 text-white">
                              {guardrail.engineLabel}
                            </Badge>
                            <Badge className="bg-white/10 text-white">
                              {guardrail.state.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/78">
                            {guardrail.summary}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/50">
                            {guardrail.approvalPath.replaceAll("_", " ")}
                          </p>
                        </div>
                      ))
                    ) : (
                      <span className="text-sm text-white/75">
                        No advisory guardrail escalations.
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                    Internal confidence breakdown
                  </p>
                  <div className="mt-3 grid gap-3">
                    {overview.internal.confidenceSections.map((section) => (
                      <div
                        key={section.key}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {section.title}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-white/78">
                              {section.internalSummary}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-white/10 text-white">
                              {section.bandLabel}
                            </Badge>
                            <Badge className="bg-white/10 text-white">
                              {section.statusLabel}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <MetricTile
                            label="Supporting nodes"
                            value={String(section.supportingNodeIds.length)}
                          />
                          <MetricTile
                            label="Missing nodes"
                            value={String(section.missingNodeIds.length)}
                          />
                          <MetricTile
                            label="Conflicting nodes"
                            value={String(section.conflictingNodeIds.length)}
                          />
                        </div>

                        <div className="mt-4 space-y-3">
                          <InternalBadgeList
                            title="Source categories"
                            items={section.sourceCategories.map((item) =>
                              item.replaceAll("_", " "),
                            )}
                            emptyState="No source categories recorded."
                          />
                          <InternalBadgeList
                            title="Reason codes"
                            items={section.reasonCodes}
                            emptyState="No reason codes emitted."
                            monospace
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <BrokerAdjudicationSection
                  overview={overview}
                  telemetryEnabled={telemetryEnabled}
                  onSubmitAdjudication={onSubmitAdjudication}
                  onSourceTraceClick={handleSourceTraceClick}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]">
        <CardHeader>
          <CardTitle>Source coverage</CardTitle>
          <CardDescription>
            Claims point back to the engine outputs that support them.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {overview.sources.length > 0 ? (
            overview.sources.map((source) => (
              <article
                key={source.citationId}
                id={source.anchorId}
                className="rounded-[22px] border border-neutral-200/80 bg-neutral-50/78 p-4 scroll-mt-28"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">
                      {source.engineLabel}
                    </p>
                    <p className="mt-1 font-mono text-xs text-neutral-400">
                      {source.citationId}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-transparent",
                      source.status === "available" &&
                        "bg-success-50 text-success-700",
                      source.status === "pending" &&
                        "bg-warning-50 text-warning-700",
                      source.status === "unavailable" &&
                        "bg-neutral-200 text-neutral-700",
                    )}
                  >
                    {source.status}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-neutral-600">
                  <span>{source.confidenceLabel}</span>
                  <span className="text-neutral-300">•</span>
                  <span>
                    {source.claimCount} linked claim{source.claimCount === 1 ? "" : "s"}
                  </span>
                  <span className="text-neutral-300">•</span>
                  <span>{source.guardrailLabel}</span>
                  <span className="text-neutral-300">•</span>
                  <span>{source.adjudicationLabel}</span>
                  {source.visibilityLabel ? (
                    <>
                      <span className="text-neutral-300">•</span>
                      <span>{source.visibilityLabel}</span>
                    </>
                  ) : null}
                  {source.generatedAtLabel && (
                    <>
                      <span className="text-neutral-300">•</span>
                      <span>{source.generatedAtLabel}</span>
                    </>
                  )}
                </div>
                {source.reviewedConclusion || source.buyerExplanation ? (
                  <div className="mt-4 rounded-2xl border border-neutral-200/80 bg-white p-3 text-sm text-neutral-700">
                    {source.reviewedConclusion ? (
                      <p>
                        <span className="font-semibold text-neutral-900">
                          Reviewed conclusion:
                        </span>{" "}
                        {source.reviewedConclusion}
                      </p>
                    ) : null}
                    {source.buyerExplanation ? (
                      <p className={cn(source.reviewedConclusion ? "mt-2" : "")}>
                        <span className="font-semibold text-neutral-900">
                          Buyer-safe explanation:
                        </span>{" "}
                        {source.buyerExplanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <EmptyStateCard
              title="Sources appear once claims exist"
              description="The source list is generated from the citations attached to each comparative claim."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionMemoSectionCard({
  section,
  tone,
  onSourceTraceClick,
}: {
  section: DecisionMemoSectionView;
  tone: "support" | "caution" | "unknown" | "risk" | "neutral";
  onSourceTraceClick: (
    citationId: string,
    trigger?: "claim_link" | "broker_adjudication",
  ) => void;
}) {
  return (
    <article
      className={cn(
        "rounded-[22px] border p-5",
        tone === "support" && "border-success-200 bg-success-50/60",
        tone === "caution" && "border-warning-200 bg-warning-50/60",
        tone === "unknown" && "border-neutral-200 bg-neutral-50/80",
        tone === "risk" && "border-error-200 bg-error-50/55",
        tone === "neutral" && "border-primary/15 bg-primary/5",
      )}
    >
      <p className="text-sm font-semibold text-neutral-900">{section.title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-600">{section.summary}</p>
      <div className="mt-4 flex flex-col gap-4">
        {section.items.length > 0 ? (
          section.items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/70 bg-white/90 p-4">
              <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700">{item.body}</p>
              <DecisionMemoEvidenceHooks
                hooks={item.evidence}
                onSourceTraceClick={onSourceTraceClick}
              />
            </div>
          ))
        ) : (
          <p className="rounded-2xl border border-white/70 bg-white/90 p-4 text-sm leading-6 text-neutral-600">
            No additional memo evidence is elevated here yet.
          </p>
        )}
      </div>
    </article>
  );
}

function DecisionMemoEvidenceHooks({
  hooks,
  onSourceTraceClick,
  tone = "light",
}: {
  hooks: DecisionMemoEvidenceHook[];
  onSourceTraceClick?: (
    citationId: string,
    trigger?: "claim_link" | "broker_adjudication",
  ) => void;
  tone?: "light" | "dark";
}) {
  if (hooks.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {hooks.map((hook) => (
        <div
          key={hook.id}
          className={cn(
            "rounded-xl border p-3 text-sm",
            tone === "dark"
              ? "border-white/10 bg-white/5 text-white/85"
              : "border-neutral-200 bg-neutral-50/80 text-neutral-700",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(tone === "dark" ? "text-white" : "text-neutral-900")}>
              {hook.label}
            </span>
            {hook.confidenceLabel ? (
              <Badge className={tone === "dark" ? "bg-white/10 text-white" : "bg-white text-neutral-700"}>
                {hook.confidenceLabel}
              </Badge>
            ) : null}
            {hook.statusLabel ? (
              <Badge className={tone === "dark" ? "bg-white/10 text-white" : "bg-white text-neutral-700"}>
                {hook.statusLabel}
              </Badge>
            ) : null}
            {hook.citationId && hook.sourceAnchorId ? (
              <a
                href={`#${hook.sourceAnchorId}`}
                className={cn(
                  "font-medium",
                  tone === "dark" ? "text-white" : "text-primary",
                )}
                onClick={() =>
                  onSourceTraceClick?.(hook.citationId!, "claim_link")
                }
              >
                View source
              </a>
            ) : null}
          </div>
          {hook.provenance.length > 0 ? (
            <p className={cn("mt-2 text-xs leading-5", tone === "dark" ? "text-white/65" : "text-neutral-500")}>
              Provenance:{" "}
              {hook.provenance
                .map((item) =>
                  item.capturedAt ? `${item.label} (${item.capturedAt})` : item.label,
                )
                .join(", ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DealStatusToneBadge({
  tone,
  children,
}: {
  tone: PropertyCaseOverviewSurface["status"]["tone"];
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "border-transparent backdrop-blur",
        tone === "positive" && "bg-success-500/20 text-white",
        tone === "warning" && "bg-warning-500/20 text-white",
        tone === "critical" && "bg-error-500/20 text-white",
        tone === "neutral" && "bg-white/10 text-white",
      )}
    >
      {children}
    </Badge>
  );
}

function ConfidenceBadge({
  tone,
  children,
}: {
  tone: "strong" | "mixed" | "weak";
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        tone === "strong" && "bg-success-50 text-success-700",
        tone === "mixed" && "bg-warning-50 text-warning-700",
        tone === "weak" && "bg-neutral-200 text-neutral-700",
      )}
    >
      {children}
    </Badge>
  );
}

function MarketPositionBadge({
  tone,
  children,
}: {
  tone: "warning" | "positive" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        tone === "positive" && "bg-success-50 text-success-700",
        tone === "warning" && "bg-warning-50 text-warning-700",
        tone === "neutral" && "bg-neutral-200 text-neutral-700",
      )}
    >
      {children}
    </Badge>
  );
}

function DeltaBadge({
  direction,
  children,
}: {
  direction: string;
  children: React.ReactNode;
}) {
  const normalized = direction.toLowerCase();

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent",
        normalized.includes("above") && "bg-warning-50 text-warning-700",
        normalized.includes("below") && "bg-success-50 text-success-700",
        normalized.includes("in line") && "bg-neutral-200 text-neutral-700",
      )}
    >
      {children}
    </Badge>
  );
}

function RiskBadge({
  risk,
  children,
}: {
  risk: "low" | "medium" | "high";
  children: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        "border-transparent",
        risk === "low" && "bg-success-50 text-success-700",
        risk === "medium" && "bg-warning-50 text-warning-700",
        risk === "high" && "bg-error-50 text-error-700",
      )}
    >
      {children}
    </Badge>
  );
}

function recommendationBadgeClasses(kind: PropertyRecommendation["kind"]): string {
  return cn(
    "border-transparent text-white",
    kind === "offer_now" && "bg-success-500/20",
    kind === "tour" && "bg-info-500/20",
    kind === "ask_for_docs" && "bg-warning-500/20",
    kind === "wait_and_watch" && "bg-white/10",
    kind === "proceed_with_conditions" && "bg-warning-500/20",
    kind === "skip" && "bg-error-500/20",
  );
}

function conditionCardClasses(
  condition: PropertyRecommendationCondition,
): string {
  if (condition.effect === "blocks") {
    return "border-error-200 bg-error-50/70";
  }
  if (condition.effect === "review_required") {
    return "border-warning-200 bg-warning-50/70";
  }
  return "border-neutral-200 bg-neutral-50";
}

function ConfidenceSectionEvidenceList({
  title,
  items,
  emptyState,
  tone,
}: {
  title: string;
  items: string[];
  emptyState: string;
  tone: "strong" | "missing" | "contradictory" | "next_step";
}) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-4">
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          tone === "strong" && "text-success-700",
          tone === "missing" && "text-neutral-500",
          tone === "contradictory" && "text-warning-700",
          tone === "next_step" && "text-primary",
        )}
      >
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-neutral-500">{emptyState}</p>
      )}
    </div>
  );
}

function InternalBadgeList({
  title,
  items,
  emptyState,
  monospace = false,
}: {
  title: string;
  items: string[];
  emptyState: string;
  monospace?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        {title}
      </p>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <Badge
              key={`${title}-${item}`}
              className={cn(
                "bg-white/10 text-white",
                monospace && "font-mono text-[11px]",
              )}
            >
              {item}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/70">{emptyState}</p>
      )}
    </div>
  );
}

function BrokerAdjudicationSection({
  overview,
  telemetryEnabled,
  onSubmitAdjudication,
  onSourceTraceClick,
}: {
  overview: Extract<PropertyCaseOverviewSurface, { variant: "internal" }>;
  telemetryEnabled: boolean;
  onSubmitAdjudication?: (input: SubmitSourceAdjudicationInput) => Promise<void>;
  onSourceTraceClick: (
    citationId: string,
    trigger: "claim_link" | "broker_adjudication",
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [actionById, setActionById] = useState<
    Record<string, AdvisoryAdjudicationAction>
  >({});
  const [visibilityById, setVisibilityById] = useState<
    Record<string, AdvisoryAdjudicationVisibility>
  >({});
  const [reasonCategoryById, setReasonCategoryById] = useState<
    Record<string, BrokerOverrideReasonCategory>
  >({});
  const [rationaleById, setRationaleById] = useState<Record<string, string>>({});
  const [reviewedConclusionById, setReviewedConclusionById] = useState<
    Record<string, string>
  >({});
  const [buyerExplanationById, setBuyerExplanationById] = useState<
    Record<string, string>
  >({});
  const [internalNotesById, setInternalNotesById] = useState<Record<string, string>>(
    {},
  );
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function handleSubmit(citationId: string) {
    if (!onSubmitAdjudication) return;
    const action = actionById[citationId] ?? "approve";
    const visibility = visibilityById[citationId] ?? "buyer_safe";
    const rationale = rationaleById[citationId]?.trim() ?? "";
    const reviewedConclusion = reviewedConclusionById[citationId]?.trim();
    const buyerExplanation = buyerExplanationById[citationId]?.trim();
    const internalNotes = internalNotesById[citationId]?.trim();
    const reasonCategory = reasonCategoryById[citationId];

    if (!rationale) {
      setErrorById((current) => ({
        ...current,
        [citationId]: "Rationale is required.",
      }));
      return;
    }

    if (
      visibility === "buyer_safe" &&
      action !== "approve" &&
      !reviewedConclusion &&
      !buyerExplanation
    ) {
      setErrorById((current) => ({
        ...current,
        [citationId]:
          "Buyer-safe adjustments and overrides need reviewed conclusion or buyer-safe explanation.",
      }));
      return;
    }

    setSubmittingById((current) => ({ ...current, [citationId]: true }));
    setErrorById((current) => ({ ...current, [citationId]: "" }));

    try {
      await onSubmitAdjudication({
        citationId,
        action,
        visibility,
        rationale,
        reasonCategory,
        reviewedConclusion,
        buyerExplanation,
        internalNotes,
      });
    } catch {
      setErrorById((current) => ({
        ...current,
        [citationId]: "Adjudication failed. Try again.",
      }));
    } finally {
      setSubmittingById((current) => ({ ...current, [citationId]: false }));
    }
  }

  return (
    <details
      open={open}
      onToggle={(event) => {
        const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(nextOpen);
        if (nextOpen && telemetryEnabled) {
          trackAdvisoryBrokerAdjudicationOpened(overview);
        }
      }}
      className="rounded-[22px] border border-white/10 bg-white/5 p-4"
    >
      <summary className="cursor-pointer list-none text-sm font-semibold text-white">
        Broker adjudication
      </summary>
      <p className="mt-3 text-sm leading-6 text-white/70">
        Review which engine outputs are still pending, inspect linked claims, and
        capture typed override reasons when the memo should not inherit a source as-is.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricTile
          label="Pending"
          value={String(overview.internal.adjudicationSummary.pendingCount)}
        />
        <MetricTile
          label="Buyer-safe"
          value={String(overview.internal.adjudicationSummary.buyerSafeCount)}
        />
        <MetricTile
          label="Internal only"
          value={String(overview.internal.adjudicationSummary.internalOnlyCount)}
        />
      </div>

      <div className="mt-4 space-y-4">
        {overview.internal.adjudicationItems.length > 0 ? (
          overview.internal.adjudicationItems.map((item) => {
            const isSubmitting = submittingById[item.citationId] === true;
            const selectedAction = actionById[item.citationId] ?? "approve";
            const selectedVisibility =
              visibilityById[item.citationId] ??
              item.visibility ??
              "buyer_safe";
            const selectedReason =
              reasonCategoryById[item.citationId] ?? "unsupported_evidence";

            return (
              <div
                key={item.citationId}
                className="rounded-2xl border border-white/10 bg-black/10 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.engineLabel}
                    </p>
                    <p className="mt-1 font-mono text-xs text-white/45">
                      {item.citationId}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "border-transparent",
                      item.reviewState === "approved" &&
                        "bg-success-500/15 text-success-200",
                      item.reviewState === "pending" &&
                        "bg-warning-500/15 text-warning-100",
                      item.reviewState === "rejected" &&
                        "bg-error-500/15 text-error-100",
                    )}
                  >
                    {item.reviewState}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/70">
                  <span>{item.confidenceLabel}</span>
                  <span className="text-white/25">•</span>
                  <span>{item.adjudicationLabel}</span>
                  {item.visibilityLabel ? (
                    <>
                      <span className="text-white/25">•</span>
                      <span>{item.visibilityLabel}</span>
                    </>
                  ) : null}
                  {item.actorName ? (
                    <>
                      <span className="text-white/25">•</span>
                      <span>Last by {item.actorName}</span>
                    </>
                  ) : null}
                  <span>
                    {item.linkedClaimCount} linked claim
                    {item.linkedClaimCount === 1 ? "" : "s"}
                  </span>
                  {item.generatedAtLabel ? (
                    <>
                      <span className="text-white/25">•</span>
                      <span>{item.generatedAtLabel}</span>
                    </>
                  ) : null}
                </div>

                {item.linkedClaimCount > 0 ? (
                  <div className="mt-3">
                    <a
                      href={`#source-${item.citationId.replace(/[^a-zA-Z0-9_-]+/g, "-")}`}
                      className="text-sm font-medium text-white underline decoration-white/30 underline-offset-4"
                      onClick={() =>
                        onSourceTraceClick(item.citationId, "broker_adjudication")
                      }
                    >
                      Open linked source trace
                    </a>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/55">
                    No buyer-visible claim currently references this output.
                  </p>
                )}

                {item.reviewedConclusion || item.buyerExplanation ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                    {item.reviewedConclusion ? (
                      <p>
                        <span className="font-semibold text-white">
                          Reviewed conclusion:
                        </span>{" "}
                        {item.reviewedConclusion}
                      </p>
                    ) : null}
                    {item.buyerExplanation ? (
                      <p className={cn(item.reviewedConclusion ? "mt-2" : "")}>
                        <span className="font-semibold text-white">
                          Buyer-safe explanation:
                        </span>{" "}
                        {item.buyerExplanation}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {item.internalNotes ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3 text-sm text-white/65">
                    <span className="font-semibold text-white">Internal notes:</span>{" "}
                    {item.internalNotes}
                  </div>
                ) : null}

                {item.auditTrail.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
                      Audit trail
                    </p>
                    <div className="mt-3 space-y-3">
                      {item.auditTrail.map((entry, index) => (
                        <div
                          key={`${item.citationId}-${entry.actedAt}-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70"
                        >
                          <p className="font-medium text-white">
                            {entry.actionLabel} • {entry.visibilityLabel}
                          </p>
                          <p className="mt-1 text-white/55">
                            {entry.actorName ?? "Unknown actor"} • {entry.actedAtLabel}
                          </p>
                          <p className="mt-2">{entry.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {onSubmitAdjudication && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Action
                        <select
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={selectedAction}
                          onChange={(event) =>
                            setActionById((current) => ({
                              ...current,
                              [item.citationId]:
                                event.target.value as AdvisoryAdjudicationAction,
                            }))
                          }
                        >
                          {ADJUDICATION_ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Visibility
                        <select
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={selectedVisibility}
                          onChange={(event) =>
                            setVisibilityById((current) => ({
                              ...current,
                              [item.citationId]:
                                event.target.value as AdvisoryAdjudicationVisibility,
                            }))
                          }
                        >
                          {ADJUDICATION_VISIBILITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Reason category
                        <select
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={selectedReason}
                          onChange={(event) =>
                            setReasonCategoryById((current) => ({
                              ...current,
                              [item.citationId]:
                                event.target.value as BrokerOverrideReasonCategory,
                            }))
                          }
                        >
                          {BROKER_OVERRIDE_REASON_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55 sm:col-span-2">
                        Rationale
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={rationaleById[item.citationId] ?? item.rationale ?? ""}
                          onChange={(event) =>
                            setRationaleById((current) => ({
                              ...current,
                              [item.citationId]: event.target.value,
                            }))
                          }
                          placeholder="Why is this the right adjudication for this output?"
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Reviewed conclusion
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={
                            reviewedConclusionById[item.citationId] ??
                            item.reviewedConclusion ??
                            ""
                          }
                          onChange={(event) =>
                            setReviewedConclusionById((current) => ({
                              ...current,
                              [item.citationId]: event.target.value,
                            }))
                          }
                          placeholder="Buyer-facing reviewed conclusion, if this source should change the memo."
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Buyer-safe explanation
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={
                            buyerExplanationById[item.citationId] ??
                            item.buyerExplanation ??
                            ""
                          }
                          onChange={(event) =>
                            setBuyerExplanationById((current) => ({
                              ...current,
                              [item.citationId]: event.target.value,
                            }))
                          }
                          placeholder="Optional buyer-safe explanation kept separate from internal notes."
                        />
                      </label>

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55 sm:col-span-2">
                        Internal notes
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={
                            internalNotesById[item.citationId] ??
                            item.internalNotes ??
                            ""
                          }
                          onChange={(event) =>
                            setInternalNotesById((current) => ({
                              ...current,
                              [item.citationId]: event.target.value,
                            }))
                          }
                          placeholder="Optional internal-only notes for compliance or audit context."
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => handleSubmit(item.citationId)}
                      >
                        Save adjudication
                      </Button>
                    </div>

                    {errorById[item.citationId] ? (
                      <p className="mt-3 text-xs font-medium text-error-200">
                        {errorById[item.citationId]}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-white/65">
            No adjudication rows yet. This rail fills as advisory outputs are
            generated and reviewed.
          </p>
        )}
      </div>
    </details>
  );
}

function MetricTile({
  label,
  value,
  monospace = false,
  light = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
  light?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        light ? "bg-white text-neutral-900" : "bg-white/5",
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.18em]",
          light ? "text-neutral-500" : "text-white/55",
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-sm",
          light ? "text-neutral-900" : "text-white",
          monospace && "font-mono",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/70 p-5 text-sm">
      <p className="font-semibold text-neutral-900">{title}</p>
      <p className="mt-2 leading-6 text-neutral-600">{description}</p>
    </div>
  );
}

function confidenceToneFromAction(confidence: number): "strong" | "mixed" | "weak" {
  if (confidence >= 0.75) return "strong";
  if (confidence >= 0.6) return "mixed";
  return "weak";
}
