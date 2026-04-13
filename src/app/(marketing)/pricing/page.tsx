import type { Metadata } from "next";
import { PRICING_SECTIONS } from "@/content/pricing";
import { PUBLIC_DISCLOSURES } from "@/content/disclosures";
import { filterPublic, selectDisclosures } from "@/lib/content/publicFilter";
import {
  ContentPageTemplate,
  ContentValidationError,
} from "@/components/marketing/content/ContentPageTemplate";
import {
  PricingSections,
  DisclosureList,
} from "@/components/marketing/content/PricingSections";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import type { ContentPageMeta } from "@/lib/content/types";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";
import { buildPricingTrustProofReadModel } from "@/lib/trustProof/readModel";

const META: ContentPageMeta = {
  slug: "pricing",
  eyebrow: "Pricing",
  title: "Free for buyers. Paid from the commission.",
  description:
    "buyer-codex never charges buyers up front. Our fee comes out of the buyer-agent commission at closing, and we rebate a portion of it back to you.",
};

export const metadata: Metadata = metadataForStaticPage("pricing");

export default function PricingPage() {
  const sections = filterPublic(PRICING_SECTIONS);
  const trustProof = buildPricingTrustProofReadModel();

  if (sections.length === 0) {
    return (
      <ContentPageTemplate meta={META}>
        <ContentValidationError missing={["pricing: no public sections"]} />
      </ContentPageTemplate>
    );
  }

  // Headline disclosures shown under the pricing sections
  const headlineIds = [
    "estimate_not_guarantee",
    "commission_negotiable",
    "buyer_credit_conditions",
  ];
  const headlineDisclosures = selectDisclosures(PUBLIC_DISCLOSURES, headlineIds);

  return (
    <ContentPageTemplate meta={META}>
      <PricingSections sections={sections} />

      {(trustProof.stats.length > 0 || trustProof.caseStudies.length > 0) && (
        <section className="mt-12 rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200 lg:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              Trust proof
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral-900">
              Typical buyer outcomes, kept distinct from live transactional proof
            </h2>
            <p className="mt-3 text-base text-neutral-700">
              Pricing education shares the same typed trust-proof catalog used on other public surfaces, so illustrative examples stay labeled until live closing data is available.
            </p>
            {trustProof.sectionBadge && (
              <p
                className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent-700"
                aria-label={trustProof.sectionBadgeAriaLabel ?? trustProof.sectionBadge}
              >
                {trustProof.sectionBadge}
              </p>
            )}
          </div>

          {trustProof.stats.length > 0 && (
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {trustProof.stats.map((stat) => (
                <div
                  key={stat.id}
                  className="rounded-2xl bg-white p-5 ring-1 ring-neutral-200"
                >
                  <p className="text-3xl font-bold text-neutral-900">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-sm font-medium text-neutral-700">
                    {stat.label}
                  </p>
                  {stat.description && (
                    <p className="mt-2 text-xs text-neutral-500">
                      {stat.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {trustProof.caseStudies.length > 0 && (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {trustProof.caseStudies.map((study) => (
                <TestimonialCard
                  key={study.id}
                  quote={study.summary}
                  author={study.buyerDisplayName}
                  role={study.buyerRole}
                  eyebrow={
                    trustProof.sliceLabelingMode.kind === "mixed" &&
                    study.isIllustrative
                      ? study.badge ?? undefined
                      : undefined
                  }
                  eyebrowAriaLabel={study.badgeAriaLabel ?? undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {headlineDisclosures.length > 0 && (
        <div className="mt-12">
          <h2 className="text-base font-semibold text-neutral-900">
            Important disclosures
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            These apply to every figure on this page.
          </p>
          <div className="mt-4">
            <DisclosureList modules={headlineDisclosures} />
          </div>
        </div>
      )}
    </ContentPageTemplate>
  );
}
