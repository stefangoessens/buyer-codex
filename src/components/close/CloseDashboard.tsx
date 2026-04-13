"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import type { CloseDashboardData } from "@/lib/dealroom/close-dashboard-types";
import { cn } from "@/lib/utils";
import { DashboardSection } from "./DashboardSection";
import { MilestoneCard } from "./MilestoneCard";
import { NextStepCard } from "./NextStepCard";
import { WeeklyPlanPanel } from "./WeeklyPlanPanel";
import { WorkstreamGrid } from "./WorkstreamGrid";

interface CloseDashboardProps {
  dealRoomId: Id<"dealRooms">;
}

export function CloseDashboard({ dealRoomId }: CloseDashboardProps) {
  const data = useQuery(api.closeDashboard.getDashboard, { dealRoomId }) as
    | (CloseDashboardData & { viewerLevel: string; contractStatus: string | null })
    | null
    | undefined;

  if (data === undefined) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-500">
          Loading close dashboard…
        </CardContent>
      </Card>
    );
  }

  if (data === null) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-500">
          Close dashboard is not available for this deal room.
        </CardContent>
      </Card>
    );
  }

  const progressPct = Math.round(data.onTrackPct * 100);
  const overallStateClass =
    data.overallState === "off_track"
      ? "border-error-200 bg-error-50 text-error-700"
      : "border-success-200 bg-success-50 text-success-700";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Close dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900">
              {data.propertyAddress}
            </h1>
          </div>
          <span
            className={cn(
              "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
              overallStateClass,
            )}
          >
            {data.overallStateLabel}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-neutral-500">
          <span>
            {data.completedMilestones} of {data.totalMilestones} milestones
            complete
          </span>
          <span className="hidden h-4 w-px bg-neutral-200 md:inline" />
          <span>Progress: {progressPct}%</span>
          {data.overdueMilestones > 0 && (
            <>
              <span className="hidden h-4 w-px bg-neutral-200 md:inline" />
              <span className="text-error-700">
                {data.overdueMilestones} overdue
              </span>
            </>
          )}
        </div>
        {data.byUrgency.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.byUrgency.map((group) => (
              <span
                key={group.urgency}
                className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
              >
                {group.count} {group.label.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </header>

      <NextStepCard
        summary={data.nextStep}
        propertyAddress={data.propertyAddress}
        daysToClose={data.daysToClose}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DashboardSection
          title="What needs your attention"
          subtitle="Buyer-owned milestones due soon or overdue."
          count={data.needsAttention.length}
          tone="attention"
          empty="Nothing for you to do right now."
        >
          {data.needsAttention.map((m) => (
            <MilestoneCard key={m.id} milestone={m} emphasize />
          ))}
        </DashboardSection>
        <DashboardSection
          title="Waiting on others"
          subtitle="Open items owned by lender, title, HOA, or seller."
          count={data.waitingOnOthers.length}
          tone="waiting"
          empty="Nobody else is blocking your close."
        >
          {data.waitingOnOthers.map((m) => (
            <MilestoneCard key={m.id} milestone={m} />
          ))}
        </DashboardSection>
        <DashboardSection
          title="On track"
          subtitle="Confirmed or proceeding on schedule."
          count={data.onTrack.length}
          tone="on_track"
          empty="Nothing in-flight — progress starts soon."
        >
          {data.onTrack.slice(0, 5).map((m) => (
            <MilestoneCard key={m.id} milestone={m} />
          ))}
          {data.onTrack.length > 5 && (
            <p className="text-center text-xs text-neutral-500">
              +{data.onTrack.length - 5} more
            </p>
          )}
        </DashboardSection>
      </div>

      <WeeklyPlanPanel plan={data.weeklyPlan} />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          By workstream
        </h2>
        <WorkstreamGrid groups={data.byWorkstream} />
      </section>
    </div>
  );
}
