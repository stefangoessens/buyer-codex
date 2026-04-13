"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
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
import { isConfigured } from "@/lib/env";
import type { PropertyCaseOverviewSurface } from "@/lib/dealroom/property-case-overview";
import { trackDealRoomUnlocked } from "@/lib/intake/pasteLinkFunnel";
import { cn } from "@/lib/utils";
import { previewPropertyCaseOverview } from "./preview-data";

interface PropertyCaseOverviewProps {
  dealRoomId: Id<"dealRooms">;
}

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

  return <PropertyCaseOverviewBody overview={overview} />;
}

function PropertyCaseOverviewBody({
  overview,
}: {
  overview: PropertyCaseOverviewSurface;
}) {
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Button asChild className="justify-between">
                <Link href={`/dealroom/${overview.dealRoomId}/offer`}>
                  Offer cockpit
                  <span aria-hidden="true">→</span>
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-between">
                <Link href={`/dealroom/${overview.dealRoomId}/close`}>
                  Close dashboard
                  <span aria-hidden="true">→</span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {overview.keyTakeaways.length > 0 && (
        <section className="grid gap-4 xl:grid-cols-3">
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
                      <Badge variant="outline" className="border-neutral-200 bg-white text-neutral-700">
                        {claim.topicLabel}
                      </Badge>
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
                title="No buyer-safe claims yet"
                description="The overview stays empty until we have enough verified evidence to make comparative statements."
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
              {overview.action ? (
                <div className="space-y-5">
                  <div className="rounded-[22px] bg-neutral-950 p-5 text-white shadow-[0_28px_56px_-38px_rgba(3,14,29,0.45)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                      Suggested opener
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
                    </div>
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
                </div>
              ) : (
                <EmptyStateCard
                  title="Action withheld for now"
                  description="A recommended opener will appear once pricing, leverage, and offer signals can support it safely."
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

function MetricTile({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
      <p className={cn("mt-2 text-sm text-white", monospace && "font-mono")}>
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
