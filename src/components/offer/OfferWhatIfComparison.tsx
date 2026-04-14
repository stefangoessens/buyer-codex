import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScoreBadge } from "@/components/product/ScoreBadge";
import type { OfferWhatIfModel } from "@/lib/dealroom/offer-what-if";
import { cn } from "@/lib/utils";

interface OfferWhatIfComparisonProps {
  model: OfferWhatIfModel;
  viewerRole: "buyer" | "broker" | "admin";
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const riskStyles = {
  low: "border-success-100 bg-success-50 text-success-700",
  medium: "border-warning-100 bg-warning-50 text-warning-700",
  high: "border-error-100 bg-error-50 text-error-700",
} as const;

function formatContingencies(contingencies: string[]): string {
  if (contingencies.length === 0) return "Waived";
  return contingencies
    .map((value) =>
      value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    )
    .join(", ");
}

function formatPct(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs list`;
}

function formatGuardrail(value: string | null): string {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OfferWhatIfComparison({
  model,
  viewerRole,
}: OfferWhatIfComparisonProps) {
  const cards = [
    {
      key: "current",
      tone: "current" as const,
      title: model.current.title,
      kicker: "Live recommendation",
      assumptionLabel: "Status",
      assumptionValue: "Current",
      changedAssumptions: [],
      recommendation: model.current.recommendation,
      buyerSummary: {
        headline: "This is the live recommendation.",
        body: model.current.body,
      },
      internalSummary: null,
    },
    ...model.scenarios.map((scenario) => ({
      key: scenario.kind,
      tone: "hypothetical" as const,
      title: scenario.title,
      kicker: scenario.kicker,
      assumptionLabel: scenario.assumptionLabel,
      assumptionValue: scenario.assumptionValue,
      changedAssumptions: scenario.changedAssumptions,
      recommendation: scenario.recommendation,
      buyerSummary: scenario.buyerSummary,
      internalSummary:
        viewerRole === "buyer" ? null : scenario.internalSummary,
    })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-neutral-900">
          What-if scenarios
        </h2>
        <p className="text-sm text-neutral-500">
          The current recommendation stays separate from these hypothetical
          scenarios. Each card shows exactly which assumption changed before the
          recommendation moved.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <Card
            key={card.key}
            className={cn(
              "flex h-full flex-col border-neutral-200",
              card.tone === "current" && "border-primary-300 shadow-sm",
            )}
          >
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    card.tone === "current"
                      ? "border-primary-200 bg-primary-50 text-primary-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700"
                  }
                >
                  {card.kicker}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    riskStyles[card.recommendation.riskLevel],
                  )}
                >
                  {card.recommendation.riskLevel} risk
                </Badge>
              </div>
              <CardTitle className="text-xl text-neutral-900">
                {card.title}
              </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  {card.assumptionLabel}
                </p>
                <p className="mt-1 text-sm font-medium text-neutral-900">
                  {card.assumptionValue}
                </p>
              </div>

              <div>
                <p className="text-3xl font-bold text-neutral-900">
                  {currencyFormatter.format(card.recommendation.price)}
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  {formatPct(card.recommendation.priceVsListPct)}
                </p>
              </div>

              <dl className="flex flex-col gap-2 border-t border-neutral-100 pt-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Lane</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {card.recommendation.scenarioName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Closing</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {card.recommendation.closingDays} days
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Earnest</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {currencyFormatter.format(card.recommendation.earnestMoney)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Contingencies</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {formatContingencies(card.recommendation.contingencies)}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                <span className="text-sm text-neutral-500">Competitiveness</span>
                <ScoreBadge
                  score={card.recommendation.competitivenessScore / 10}
                  maxScore={10}
                  size="sm"
                />
              </div>

              {card.changedAssumptions.length > 0 && (
                <div className="rounded-xl bg-neutral-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Changed assumptions
                  </p>
                  <div className="mt-2 flex flex-col gap-2 text-sm">
                    {card.changedAssumptions.map((change) => (
                      <div key={change.key} className="flex flex-col gap-1">
                        <span className="font-medium text-neutral-900">
                          {change.label}
                        </span>
                        <span className="text-neutral-600">
                          {change.before}
                          {" -> "}
                          {change.after}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  Buyer-safe summary
                </p>
                <p className="mt-2 font-medium text-neutral-900">
                  {card.buyerSummary.headline}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                  {card.buyerSummary.body}
                </p>
              </div>

              {card.internalSummary && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <p className="text-xs uppercase tracking-wide text-neutral-500">
                    Internal reasoning
                  </p>
                  <p className="mt-2 font-medium text-neutral-900">
                    {card.internalSummary.headline}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    {card.internalSummary.body}
                  </p>

                  {card.internalSummary.changedOutputs.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2 text-sm">
                      {card.internalSummary.changedOutputs.map((change) => (
                        <div key={change.key} className="flex flex-col gap-1">
                          <span className="font-medium text-neutral-900">
                            {change.label}
                          </span>
                          <span className="text-neutral-600">
                            {change.before}
                            {" -> "}
                            {change.after}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 text-xs text-neutral-500">
                    Review threshold crossed:{" "}
                    {card.internalSummary.reviewThresholdCrossed ? "Yes" : "No"}
                    {card.recommendation.guardrailState
                      ? ` · Guardrail ${formatGuardrail(card.recommendation.guardrailState)}`
                      : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
