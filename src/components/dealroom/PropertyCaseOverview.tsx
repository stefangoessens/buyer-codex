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
  buildBuyerSafeSummaryText,
  trackAdvisoryBrokerAdjudicationOpened,
  trackAdvisoryConfidenceDetailsExpanded,
  trackAdvisoryMemoViewed,
  trackAdvisoryNextBestActionClicked,
  trackAdvisoryRecommendationFeedback,
  trackAdvisoryRecommendationViewed,
  trackAdvisorySourceTraceOpened,
  trackAdvisorySummaryCopied,
  trackAdvisorySummaryShared,
} from "@/lib/dealroom/advisoryTelemetry";
import { isConfigured } from "@/lib/env";
import type { PropertyCaseOverviewSurface } from "@/lib/dealroom/property-case-overview";
import { trackDealRoomUnlocked } from "@/lib/intake/pasteLinkFunnel";
import { cn } from "@/lib/utils";
import { previewPropertyCaseOverview } from "./preview-data";

interface PropertyCaseOverviewProps {
  dealRoomId: Id<"dealRooms">;
}

interface RejectSourceInput {
  citationId: string;
  reasonCategory: BrokerOverrideReasonCategory;
  reasonDetail?: string;
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
  const approveOutput = useMutation(api.aiEngineOutputs.approveOutput);
  const rejectOutput = useMutation(api.aiEngineOutputs.rejectOutput);
  const overview = useQuery(api.dealRoomCaseOverview.getOverview, {
    dealRoomId,
  }) as PropertyCaseOverviewSurface | null | undefined;

  useEffect(() => {
    if (!overview) return;
    if (trackedDealRoomId.current === overview.dealRoomId) return;

    trackedDealRoomId.current = overview.dealRoomId;
    trackDealRoomUnlocked({
      dealRoomId: overview.dealRoomId,
      propertyId: overview.propertyId,
    });
  }, [overview]);

  if (overview === undefined) {
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
      telemetryEnabled
      onApproveSource={async (citationId) => {
        await approveOutput({
          outputId: citationId as Id<"aiEngineOutputs">,
        });
      }}
      onRejectSource={async ({ citationId, reasonCategory, reasonDetail }) => {
        await rejectOutput({
          outputId: citationId as Id<"aiEngineOutputs">,
          dealRoomId,
          surface: "deal_room_overview",
          reasonCategory,
          reasonDetail: reasonDetail?.trim() || undefined,
        });
      }}
    />
  );
}

function PropertyCaseOverviewBody({
  overview,
  telemetryEnabled = false,
  onApproveSource,
  onRejectSource,
}: {
  overview: PropertyCaseOverviewSurface;
  telemetryEnabled?: boolean;
  onApproveSource?: (citationId: string) => Promise<void>;
  onRejectSource?: (input: RejectSourceInput) => Promise<void>;
}) {
  const memoViewKey = useRef<string | null>(null);
  const recommendationViewKey = useRef<string | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string | null>(null);
  const [feedbackDecision, setFeedbackDecision] = useState<
    "accepted" | "dismissed" | "deferred" | null
  >(null);
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const summaryText = buildBuyerSafeSummaryText(overview);
  const memoState = overview.artifacts.memo;
  const recommendationState = overview.artifacts.recommendation;
  const summaryState = overview.artifacts.summary;

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

  function handleRecommendationFeedback(
    decision: "accepted" | "dismissed" | "deferred",
  ) {
    setFeedbackDecision(decision);
    if (telemetryEnabled) {
      trackAdvisoryRecommendationFeedback(overview, decision);
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
                    {overview.headerDescription}
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
                Buyer-safe summary
              </p>
              <p className="text-sm leading-6 text-neutral-600">
                {summaryState.description}
              </p>
              {summaryState.kind !== "ready" ? (
                <p className="text-xs font-medium text-neutral-500">
                  {summaryState.recoveryDescription}
                </p>
              ) : null}
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
              {summaryStatus ? (
                <p className="text-xs font-medium text-neutral-500">
                  {summaryStatus}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {(overview.keyTakeaways.length > 0 || memoState.kind !== "ready") && (
        <section className="grid gap-4 xl:grid-cols-3">
          {memoState.kind !== "ready" ? (
            <Card className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)] xl:col-span-3">
              <CardContent className="pt-6">
                <EmptyStateCard
                  title={memoState.title}
                  description={`${memoState.description} ${memoState.recoveryDescription}`}
                />
              </CardContent>
            </Card>
          ) : null}
          {overview.keyTakeaways.map((takeaway) => (
            <Card
              key={`${takeaway.title}-${takeaway.body}`}
              className="rounded-[24px] border-neutral-200/80 bg-white shadow-[0_14px_32px_-28px_rgba(3,14,29,0.09)]"
            >
              <CardHeader className="gap-3 pb-0">
                <CardDescription className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  {takeaway.title}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-6 text-neutral-700">
                {takeaway.body}
              </CardContent>
            </Card>
          ))}
        </section>
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
              <CardTitle>Recommended action</CardTitle>
              <CardDescription>
                Offer guidance is only shown when it is tied back to the case.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overview.action && !recommendationState.withholdOutput ? (
                <div className="space-y-5">
                  <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_28px_56px_-38px_rgba(3,14,29,0.45)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      {overview.action.guardrailState === "softened"
                        ? "Illustrative opener"
                        : "Suggested opener"}
                    </p>
                    <p className="mt-3 text-3xl font-semibold">
                      {overview.action.openingPriceLabel}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ConfidenceBadge tone={confidenceToneFromAction(overview.action.confidence)}>
                        {overview.action.confidenceLabel}
                      </ConfidenceBadge>
                      <RiskBadge risk={overview.action.riskLevel}>
                        {overview.action.riskLabel}
                      </RiskBadge>
                      {overview.action.guardrailState !== "can_say" && (
                        <Badge className="bg-white/10 text-white">
                          {overview.action.guardrailLabel}
                        </Badge>
                      )}
                    </div>
                    {overview.action.guardrailState !== "can_say" && (
                      <p className="mt-4 text-sm leading-6 text-white/78">
                        {overview.action.guardrailExplanation}
                      </p>
                    )}
                  </div>

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

                  <div className="rounded-xl border border-dashed border-neutral-200 p-3">
                    <p className="text-sm font-semibold text-neutral-900">
                      How are you using this recommendation?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant={
                          feedbackDecision === "accepted" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleRecommendationFeedback("accepted")}
                      >
                        Using it
                      </Button>
                      <Button
                        variant={
                          feedbackDecision === "deferred" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleRecommendationFeedback("deferred")}
                      >
                        Not yet
                      </Button>
                      <Button
                        variant={
                          feedbackDecision === "dismissed" ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => handleRecommendationFeedback("dismissed")}
                      >
                        Not useful
                      </Button>
                    </div>
                    {feedbackDecision ? (
                      <p className="mt-3 text-xs font-medium text-neutral-500">
                        Saved as a calibration signal for this recommendation.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <EmptyStateCard
                  title={recommendationState.title}
                  description={`${recommendationState.description} ${recommendationState.recoveryDescription}`}
                />
              )}
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
                  onApproveSource={onApproveSource}
                  onRejectSource={onRejectSource}
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
                  {source.generatedAtLabel && (
                    <>
                      <span className="text-neutral-300">•</span>
                      <span>{source.generatedAtLabel}</span>
                    </>
                  )}
                </div>
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
  onApproveSource,
  onRejectSource,
  onSourceTraceClick,
}: {
  overview: Extract<PropertyCaseOverviewSurface, { variant: "internal" }>;
  telemetryEnabled: boolean;
  onApproveSource?: (citationId: string) => Promise<void>;
  onRejectSource?: (input: RejectSourceInput) => Promise<void>;
  onSourceTraceClick: (
    citationId: string,
    trigger: "claim_link" | "broker_adjudication",
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rejectCategoryById, setRejectCategoryById] = useState<
    Record<string, BrokerOverrideReasonCategory>
  >({});
  const [rejectDetailById, setRejectDetailById] = useState<Record<string, string>>(
    {},
  );
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function handleApprove(citationId: string) {
    if (!onApproveSource) return;
    setSubmittingById((current) => ({ ...current, [citationId]: true }));
    setErrorById((current) => ({ ...current, [citationId]: "" }));

    try {
      await onApproveSource(citationId);
    } catch {
      setErrorById((current) => ({
        ...current,
        [citationId]: "Approval failed. Try again.",
      }));
    } finally {
      setSubmittingById((current) => ({ ...current, [citationId]: false }));
    }
  }

  async function handleReject(citationId: string) {
    if (!onRejectSource) return;
    const reasonCategory =
      rejectCategoryById[citationId] ?? "unsupported_evidence";

    setSubmittingById((current) => ({ ...current, [citationId]: true }));
    setErrorById((current) => ({ ...current, [citationId]: "" }));

    try {
      await onRejectSource({
        citationId,
        reasonCategory,
        reasonDetail: rejectDetailById[citationId],
      });
    } catch {
      setErrorById((current) => ({
        ...current,
        [citationId]: "Override failed. Try again.",
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
          label="Approved"
          value={String(overview.internal.adjudicationSummary.approvedCount)}
        />
        <MetricTile
          label="Rejected"
          value={String(overview.internal.adjudicationSummary.rejectedCount)}
        />
      </div>

      <div className="mt-4 space-y-4">
        {overview.internal.adjudicationItems.length > 0 ? (
          overview.internal.adjudicationItems.map((item) => {
            const isSubmitting = submittingById[item.citationId] === true;
            const selectedReason =
              rejectCategoryById[item.citationId] ?? "unsupported_evidence";

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

                {(onApproveSource || onRejectSource) && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={isSubmitting || !onApproveSource}
                        onClick={() => handleApprove(item.citationId)}
                      >
                        Approve source
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isSubmitting || !onRejectSource}
                        onClick={() => handleReject(item.citationId)}
                      >
                        Override source
                      </Button>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr]">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Reason category
                        <select
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={selectedReason}
                          onChange={(event) =>
                            setRejectCategoryById((current) => ({
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

                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                        Detail (optional)
                        <textarea
                          className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                          value={rejectDetailById[item.citationId] ?? ""}
                          onChange={(event) =>
                            setRejectDetailById((current) => ({
                              ...current,
                              [item.citationId]: event.target.value,
                            }))
                          }
                          placeholder="Add optional broker context for this override."
                        />
                      </label>
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
