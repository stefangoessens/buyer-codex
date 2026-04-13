"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { BuyerDashboardState } from "@/lib/dashboard/deal-index-state";
import { KPICard } from "@/components/product/KPICard";
import { LoadingState } from "@/components/product/LoadingState";
import { DealRoomGrid } from "./DealRoomGrid";
import { EmptyDashboardState } from "./EmptyDashboardState";
import { PasteLinkCTA } from "./PasteLinkCTA";

interface BuyerDashboardSurfaceProps {
  now: string;
  state: BuyerDashboardState;
  secondarySurface?: ReactNode;
}

export function BuyerDashboardSurface({
  now,
  state,
  secondarySurface,
}: BuyerDashboardSurfaceProps) {
  return (
    <div className="flex flex-col gap-8">
      <header className="max-w-2xl space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-700">
          Buyer workspace
        </p>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-[2.6rem] sm:leading-[1.02]">
            Keep the next property moving without losing the current one.
          </h1>
          <p className="max-w-xl text-sm leading-6 text-neutral-600 sm:text-base">
            Start a fresh analysis, reopen live deal rooms, and keep the
            dashboard scan path calm enough to route action in one pass.
          </p>
        </div>
      </header>

      <PasteLinkCTA />

      {state.kind === "loading" ? (
        <LoadingState variant="metrics" count={4} />
      ) : (
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {state.summaryBadges.map((badge) => (
            <KPICard
              key={badge.kind}
              label={badge.label}
              value={badge.value}
              density="compact"
              tone={
                badge.tone === "primary"
                  ? "primary"
                  : badge.tone === "warning"
                    ? "warning"
                    : "default"
              }
              description={
                badge.isEmpty ? "Waiting for the first buyer-safe signal." : undefined
              }
            />
          ))}
        </section>
      )}

      {secondarySurface}

      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
              Active deals
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-neutral-900">
              Your live search stack
            </h2>
          </div>
          {state.kind === "ready" && (
            <p className="text-sm text-neutral-500">
              {state.activeDeals.length} active
              {state.recentDeals.length > 0
                ? ` · ${state.recentDeals.length} recently wrapped`
                : ""}
              {state.hasPartialDeals ? " · some details still loading" : ""}
            </p>
          )}
        </div>

        {state.kind === "loading" ? (
          <LoadingState variant="panel" />
        ) : state.kind === "empty" ? (
          <EmptyDashboardState />
        ) : (
          <div className="flex flex-col gap-8">
            {state.activeDeals.length > 0 && (
              <DealRoomGrid rows={state.activeDeals} now={now} />
            )}

            {state.recentDeals.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-500">
                      Recently wrapped
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-neutral-900">
                      Closed or paused in the last cycle
                    </h3>
                  </div>
                </div>
                <DealRoomGrid rows={state.recentDeals} now={now} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function DashboardContextCard() {
  return (
    <Card className="rounded-[24px] border-primary-100/80 bg-[linear-gradient(135deg,rgba(229,241,255,0.82),rgba(255,255,255,0.92)_46%,rgba(230,251,248,0.84))] shadow-[0_28px_64px_-44px_rgba(5,45,91,0.34)]">
      <CardContent className="flex flex-col gap-3 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700">
          Ready to route
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-base font-semibold text-neutral-900">
              Buyer-safe pricing and leverage are synced for the leading offer
              prep case.
            </p>
            <p className="mt-1 text-sm leading-6 text-neutral-600">
              Keep the acquisition CTA above the fold, then use the denser card
              stack below for active negotiations and recently wrapped rooms.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-neutral-600">
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Best score
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">9.2 / 10</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Next clock
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-900">24h</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
