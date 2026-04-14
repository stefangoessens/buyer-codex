import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NegotiationPlaybookView } from "@/lib/negotiation/playbook";

interface NegotiationPlaybookPanelProps {
  playbook: NegotiationPlaybookView;
}

export function NegotiationPlaybookPanel({
  playbook,
}: NegotiationPlaybookPanelProps) {
  const reviewVariant =
    playbook.review.state === "blocked"
      ? "destructive"
      : playbook.review.state === "review_required"
        ? "outline"
        : "secondary";

  return (
    <Card className="gap-4">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500">
              Negotiation playbook
            </p>
            <CardTitle className="text-xl text-neutral-900">
              {playbook.summary}
            </CardTitle>
            <CardDescription>{playbook.review.message}</CardDescription>
          </div>
          <Badge variant={reviewVariant}>{playbook.review.headline}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          {playbook.primary && <PlaybookBranchCard branch={playbook.primary} />}
          {playbook.fallback && <PlaybookBranchCard branch={playbook.fallback} />}
        </div>

        {playbook.audience === "internal" &&
          playbook.invalidationConditions.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <h3 className="text-sm font-semibold text-amber-950">
                Invalidate or re-route if
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-amber-900">
                {playbook.invalidationConditions.map((condition) => (
                  <li key={condition}>- {condition}</li>
                ))}
              </ul>
            </section>
          )}
      </CardContent>
    </Card>
  );
}

function PlaybookBranchCard({
  branch,
}: {
  branch: NonNullable<NegotiationPlaybookView["primary"]>;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            {branch.title}
          </h3>
          <p className="mt-1 text-sm text-neutral-600">{branch.trigger}</p>
        </div>
        {branch.askLabel && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Ask
            </p>
            <p className="text-lg font-semibold text-neutral-900">
              {branch.askLabel}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DetailBlock title="Posture" items={[branch.postureLabel]} />
        <DetailBlock title="Timing" items={[branch.timingLabel]} />
        {branch.contingencies.length > 0 && (
          <DetailBlock title="Contingencies" items={branch.contingencies} />
        )}
        {branch.concessions.length > 0 && (
          <DetailBlock title="Concessions / credits" items={branch.concessions} />
        )}
      </div>

      {branch.rationale.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            Why this branch
          </p>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700">
            {branch.rationale.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DetailBlock({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{title}</p>
      <ul className="space-y-2 text-sm text-neutral-700">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
