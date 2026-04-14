import React from "react";
import type {
  TrustProofCaseStudyReadModel,
  TrustProofHighlightReadModel,
} from "@/lib/trustProof/readModel";

interface TrustProofCaseStudyCardProps {
  study: TrustProofCaseStudyReadModel;
  showBadge?: boolean;
}

function HighlightChip({
  highlight,
}: {
  highlight: TrustProofHighlightReadModel;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {highlight.label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-neutral-900">
        {highlight.value}
      </dd>
    </div>
  );
}

export function TrustProofCaseStudyCard({
  study,
  showBadge = false,
}: TrustProofCaseStudyCardProps) {
  return (
    <article className="flex h-full flex-col rounded-[24px] border border-neutral-200 bg-white p-8">
      {showBadge && study.badge && (
        <p
          className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-accent-700"
          aria-label={study.badgeAriaLabel ?? study.badge}
        >
          {study.badge}
        </p>
      )}

      <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
        {study.headline}
      </h3>
      <p className="mt-4 flex-1 text-base leading-relaxed text-neutral-700">
        {study.summary}
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {study.highlights.map((highlight) => (
          <HighlightChip
            key={`${study.id}-${highlight.label}`}
            highlight={highlight}
          />
        ))}
      </dl>

      <div className="mt-6 border-t border-neutral-100 pt-6">
        <p className="text-sm font-semibold text-neutral-900">
          {study.buyerDisplayName}
        </p>
        <p className="mt-1 text-sm text-neutral-500">{study.buyerContext}</p>
      </div>
    </article>
  );
}
