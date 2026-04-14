import type { Metadata } from "next";
import Link from "next/link";
import { PRICING_SECTIONS } from "@/content/pricing";
import { PUBLIC_DISCLOSURES } from "@/content/disclosures";
import { filterPublic, selectDisclosures } from "@/lib/content/publicFilter";
import { ContentValidationError } from "@/components/marketing/content/ContentPageTemplate";
import { DisclosureList } from "@/components/marketing/content/PricingSections";
import type { ContentPageMeta } from "@/lib/content/types";
import {
  MarketingCtaBand,
  MarketingSection,
  MarketingSectionIntro,
} from "@/components/marketing/MarketingScaffold";
import { TrustProofShowcase } from "@/components/marketing/TrustProofShowcase";
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
  const headline = sections.find((section) => section.id === "headline");
  const calculator = sections.find(
    (section) => section.id === "savings_calculator_cta",
  );
  const commissions = sections.find(
    (section) => section.id === "how_commissions_work",
  );
  const included = sections.find((section) => section.id === "what_you_get");
  const finalCta = sections.find((section) => section.id === "final_cta");

  if (sections.length === 0) {
    return <ContentValidationError missing={["pricing: no public sections"]} />;
  }

  // Headline disclosures shown under the pricing sections
  const headlineIds = [
    "estimate_not_guarantee",
    "commission_negotiable",
    "buyer_credit_conditions",
  ];
  const headlineDisclosures = selectDisclosures(PUBLIC_DISCLOSURES, headlineIds);

  return (
    <>
      <section className="px-6 pb-8 pt-10 lg:px-8 lg:pb-12 lg:pt-14">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.88fr)]">
          <div className="rounded-[40px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.1)] backdrop-blur lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              {META.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950 lg:text-6xl">
              {META.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 lg:text-lg">
              {META.description}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                "No subscription or upfront buyer fee",
                "Rebate framing stays visible from first page view",
                "Broker representation and platform access are sold together",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[40px] bg-slate-950 p-7 text-white shadow-[0_35px_100px_rgba(15,23,42,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300">
              Summary
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em]">
              {headline?.title ?? "Free to use. Paid from the seller's commission."}
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {headline?.body}
            </p>
            <div className="mt-6 space-y-3">
              {headline?.bullets?.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                >
                  {bullet}
                </div>
              ))}
            </div>
            {calculator?.cta ? (
              <Link
                href={calculator.cta.href}
                className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-primary-100"
              >
                {calculator.cta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <MarketingSection className="pt-6 lg:pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8 lg:py-10">
            <MarketingSectionIntro
              eyebrow="What buyers get"
              title={included?.title ?? "What's included"}
              description={included?.body}
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {included?.bullets?.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-sm font-medium leading-6 text-slate-700">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
                Commission mechanics
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                {commissions?.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {commissions?.body}
              </p>
              <div className="mt-6 space-y-3">
                {commissions?.bullets?.map((bullet) => (
                  <div
                    key={bullet}
                    className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    {bullet}
                  </div>
                ))}
              </div>
            </div>

            {headlineDisclosures.length > 0 ? (
              <div className="rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8">
                <h2 className="text-base font-semibold text-slate-950">
                  Important disclosures
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  These apply to every figure and buyer-credit example on this
                  page.
                </p>
                <div className="mt-5">
                  <DisclosureList modules={headlineDisclosures} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </MarketingSection>

      {(trustProof.stats.length > 0 || trustProof.caseStudies.length > 0) && (
        <TrustProofShowcase
          eyebrow="Buyer proof"
          title="Typical outcomes stay attached to the pricing education."
          description="The pricing shell now uses the same buyer-codex proof boundary as the homepage, instead of treating proof as a separate inherited section type."
          stats={trustProof.stats}
          caseStudies={trustProof.caseStudies}
          sectionBadge={trustProof.sectionBadge}
          sectionBadgeAriaLabel={trustProof.sectionBadgeAriaLabel}
        />
      )}

      <MarketingCtaBand
        eyebrow="Run the numbers on a real property"
        title={finalCta?.title ?? "Ready to start?"}
        description={
          finalCta?.body ??
          "Paste a listing link on the homepage and we'll have your free analysis and deal room ready in seconds."
        }
        primaryHref={finalCta?.cta?.href ?? "/"}
        primaryLabel={finalCta?.cta?.label ?? "Start with a listing link"}
        secondaryHref={calculator?.cta?.href}
        secondaryLabel={calculator?.cta?.label}
      />
    </>
  );
}
