// Weekly action plan panel — surfaces the upcoming week's buyer actions + deadlines.
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  WeeklyPlan,
  WeeklyPlanItem,
} from "@/lib/dealroom/close-dashboard-types";
import { cn } from "@/lib/utils";

interface WeeklyPlanPanelProps {
  plan: WeeklyPlan;
}

function Section({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: WeeklyPlanItem[];
  emptyLabel: string;
  tone: "primary" | "warning" | "neutral";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary-700"
      : tone === "warning"
        ? "text-warning-700"
        : "text-neutral-600";
  const trackClass = (trackState: WeeklyPlanItem["trackState"]) =>
    trackState === "off_track"
      ? "border-error-200 bg-error-50 text-error-700"
      : "border-success-200 bg-success-50 text-success-700";
  return (
    <div>
      <p className={cn("text-xs font-semibold uppercase tracking-wide", toneClass)}>
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.milestone.id}`}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <p className="font-medium text-neutral-900">
                {item.milestone.name}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="border-neutral-200 bg-neutral-50 text-neutral-600"
                >
                  {item.ownerLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("font-medium", trackClass(item.trackState))}
                >
                  {item.trackLabel}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                {item.reason} · due {item.milestone.dueDate}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WeeklyPlanPanel({ plan }: WeeklyPlanPanelProps) {
  return (
    <Card className="border-neutral-200">
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-900">
            Weekly plan
          </CardTitle>
          <span className="text-xs text-neutral-500">
            {plan.weekStartDate} → {plan.weekEndDate}
          </span>
        </div>
        <p className="text-sm text-neutral-500">
          {plan.headline} · {plan.summary}
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Section
          title="Your actions"
          items={plan.actionsThisWeek}
          emptyLabel="No buyer actions this week."
          tone="primary"
        />
        <Section
          title="Deadlines"
          items={plan.deadlinesThisWeek}
          emptyLabel="Nothing due this week."
          tone="warning"
        />
        <Section
          title="Waiting on others"
          items={plan.blockedOnOthers}
          emptyLabel="Nothing outstanding from partners."
          tone="neutral"
        />
      </CardContent>
    </Card>
  );
}
