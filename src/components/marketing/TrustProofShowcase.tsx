import type { TrustProofCaseStudyReadModel, TrustProofStatReadModel } from "@/lib/trustProof/readModel";
import { MarketingSection, MarketingSectionIntro } from "@/components/marketing/MarketingScaffold";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";

export function TrustProofShowcase({
  eyebrow,
  title,
  description,
  stats,
  caseStudies,
  sectionBadge,
  sectionBadgeAriaLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats: readonly TrustProofStatReadModel[];
  caseStudies: readonly TrustProofCaseStudyReadModel[];
  sectionBadge?: string | null;
  sectionBadgeAriaLabel?: string | null;
}) {
  return (
    <MarketingSection>
      <div className="rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8 lg:py-10">
        <MarketingSectionIntro
          eyebrow={eyebrow}
          title={title}
          description={description}
        />

        {sectionBadge ? (
          <p
            className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-accent-700"
            aria-label={sectionBadgeAriaLabel ?? sectionBadge}
          >
            {sectionBadge}
          </p>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-6"
              >
                <p className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {stat.label}
                </p>
                {stat.description ? (
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {stat.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {caseStudies.map((study) => (
              <TestimonialCard
                key={study.id}
                quote={study.summary}
                author={study.buyerDisplayName}
                role={study.buyerContext}
                eyebrow={study.isIllustrative ? study.badge ?? undefined : undefined}
                eyebrowAriaLabel={study.badgeAriaLabel ?? undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
