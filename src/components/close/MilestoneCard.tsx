// Close dashboard milestone card with urgency pill, workstream badge, and party chip.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CloseDashboardMilestone,
  TrackState,
  Urgency,
} from "@/lib/dealroom/close-dashboard-types";
import { WORKSTREAM_LABELS } from "@/lib/dealroom/close-dashboard-types";
import { cn } from "@/lib/utils";

interface MilestoneCardProps {
  milestone: CloseDashboardMilestone;
  emphasize?: boolean;
}

const urgencyStyles: Record<Urgency, { label: string; className: string }> = {
  overdue: {
    label: "Overdue",
    className: "border-error-200 bg-error-50 text-error-700",
  },
  this_week: {
    label: "This week",
    className: "border-warning-200 bg-warning-50 text-warning-700",
  },
  next_week: {
    label: "Next week",
    className: "border-primary-200 bg-primary-50 text-primary-700",
  },
  later: {
    label: "Later",
    className: "border-neutral-200 bg-neutral-50 text-neutral-600",
  },
  completed: {
    label: "Completed",
    className: "border-success-200 bg-success-50 text-success-700",
  },
};

const trackStyles: Record<TrackState, string> = {
  on_track: "border-success-200 bg-success-50 text-success-700",
  off_track: "border-error-200 bg-error-50 text-error-700",
};

export function MilestoneCard({ milestone, emphasize }: MilestoneCardProps) {
  const urgency = urgencyStyles[milestone.urgency];
  return (
    <Card
      className={cn(
        "transition-all",
        emphasize
          ? "border-primary-300 shadow-md"
          : "border-neutral-200 hover:border-neutral-300",
      )}
    >
      <CardContent className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">
              {milestone.name}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {milestone.buyerSummary}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant="outline"
              className={cn("font-medium", urgency.className)}
            >
              {milestone.urgencyLabel || urgency.label}
            </Badge>
            <Badge
              variant="outline"
              className={cn("font-medium", trackStyles[milestone.trackState])}
            >
              {milestone.trackLabel}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-neutral-200 bg-neutral-50 text-neutral-600"
          >
            {WORKSTREAM_LABELS[milestone.workstream]}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "border-neutral-200",
              milestone.responsibleParty === "buyer"
                ? "bg-accent-50 text-accent-700"
                : "bg-white text-neutral-600",
            )}
          >
            {milestone.ownerLabel}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
