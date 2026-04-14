import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  BuyerReadinessBlocker,
  BuyerReadinessCheckpoint,
  BuyerReadinessSurface,
} from "@/lib/dealroom/buyer-readiness";
import { cn } from "@/lib/utils";

const stateBadgeClasses: Record<
  BuyerReadinessCheckpoint["state"],
  string
> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
};

const blockerToneClasses: Record<BuyerReadinessBlocker["effect"], string> = {
  blocks: "border-rose-200/80 bg-rose-50/70",
  warns: "border-amber-200/80 bg-amber-50/70",
};

export function BuyerReadinessCard({
  readiness,
}: {
  readiness: BuyerReadinessSurface;
}) {
  return (
    <Card className="overflow-hidden border-neutral-200/80 bg-white shadow-[0_20px_40px_-36px_rgba(3,14,29,0.2)]">
      <CardHeader className="gap-4 border-b border-neutral-100 bg-neutral-50/70">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("rounded-full px-3 py-1", stateBadgeClasses[readiness.currentState])}
              >
                {readiness.currentStateLabel}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-neutral-600">
                Current stage: {readiness.currentStageLabel}
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {readiness.buyerSummary.headline}
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-neutral-600">
              {readiness.buyerSummary.body}
            </CardDescription>
          </div>
          {readiness.variant === "internal" ? (
            <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-3 text-xs text-neutral-600">
              <Metric label="Buyer-owned" value={readiness.internal.blockerCounts.buyer} />
              <Metric label="Broker-owned" value={readiness.internal.blockerCounts.broker} />
              <Metric label="System-owned" value={readiness.internal.blockerCounts.system} />
              <Metric label="High + critical" value={readiness.internal.blockerCounts.high + readiness.internal.blockerCounts.critical} />
            </div>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-neutral-500">{readiness.scopeNote}</p>
      </CardHeader>

      <CardContent className="space-y-6 px-6 py-6">
        <section className="grid gap-3 md:grid-cols-4">
          {readiness.checkpoints.map((checkpoint) => (
            <CheckpointCard key={checkpoint.key} checkpoint={checkpoint} />
          ))}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">Blockers</h3>
            <span className="text-xs text-neutral-500">
              {readiness.blockers.length} total
            </span>
          </div>

          {readiness.blockers.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700">
              No active readiness blockers right now.
            </div>
          ) : (
            <div className="grid gap-3">
              {readiness.blockers.map((blocker) => (
                <BlockerCard
                  key={blocker.id}
                  blocker={blocker}
                  showInternal={readiness.variant === "internal"}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">What to do next</h3>
          <div className="grid gap-2">
            {readiness.buyerSummary.nextSteps.map((step) => (
              <div
                key={step}
                className="rounded-2xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm text-neutral-700"
              >
                {step}
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function CheckpointCard({
  checkpoint,
}: {
  checkpoint: BuyerReadinessCheckpoint;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">{checkpoint.label}</h3>
        <Badge
          variant="outline"
          className={cn("rounded-full px-2.5 py-0.5 text-[11px]", stateBadgeClasses[checkpoint.state])}
        >
          {checkpoint.stateLabel}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-neutral-600">{checkpoint.summary}</p>
    </div>
  );
}

function BlockerCard({
  blocker,
  showInternal,
}: {
  blocker: BuyerReadinessBlocker;
  showInternal: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-4", blockerToneClasses[blocker.effect])}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{blocker.title}</p>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-neutral-600">
              {blocker.effect === "blocks" ? "Blocking" : "Attention"}
            </Badge>
            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-neutral-600">
              {blocker.checkpoints.map((checkpoint) => checkpoint[0].toUpperCase() + checkpoint.slice(1)).join(", ")}
            </Badge>
            {showInternal && blocker.internal ? (
              <>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-neutral-600">
                  {blocker.internal.owner}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-neutral-600">
                  {blocker.internal.severity}
                </Badge>
                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px] text-neutral-600">
                  {blocker.internal.reasonCode}
                </Badge>
              </>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-neutral-700">{blocker.summary}</p>
          <p className="text-sm font-medium text-neutral-900">{blocker.buyerAction}</p>
        </div>
      </div>

      {showInternal && blocker.internal ? (
        <div className="mt-4 grid gap-3 border-t border-neutral-200/70 pt-4 text-sm text-neutral-600 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="font-medium text-neutral-900">Internal remediation</p>
            <p className="mt-1 leading-6">{blocker.internal.remediation}</p>
          </div>
          <div>
            <p className="font-medium text-neutral-900">Supporting signals</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {blocker.internal.supportingSignals.map((signal) => (
                <span
                  key={signal}
                  className="rounded-full border border-neutral-200 bg-white/80 px-2.5 py-1 text-[11px] text-neutral-600"
                >
                  {signal}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
