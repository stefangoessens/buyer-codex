import type { Metadata } from "next";
import { HeroInput } from "@/components/marketing/HeroInput";
import {
  MarketingCtaBand,
  MarketingSection,
  MarketingSectionIntro,
} from "@/components/marketing/MarketingScaffold";
import { TrustProofShowcase } from "@/components/marketing/TrustProofShowcase";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";
import { buildHomepageTrustProofReadModel } from "@/lib/trustProof/readModel";

const marketSignals = [
  {
    label: "Pricing lane",
    title: "Fair value, not just a Zestimate",
    body: "We re-check asking price against comps, condition drift, and negotiation posture before you spend time on the wrong home.",
  },
  {
    label: "Leverage lane",
    title: "Offer posture with actual context",
    body: "Days on market, price drops, builder incentives, and listing-side pressure get assembled into one buyer-facing recommendation.",
  },
  {
    label: "Broker lane",
    title: "Human review where it matters",
    body: "Licensed Florida brokers stay in the loop for representation, negotiations, contracts, and closing coordination.",
  },
] as const;

const operatingCadence = [
  {
    step: "01",
    title: "Intake the listing",
    body: "Paste a Zillow, Redfin, or Realtor.com URL and we normalize it into a buyer-codex deal room entry point.",
  },
  {
    step: "02",
    title: "Pressure-test the property",
    body: "Pricing, comps, leverage, and rebate math run together so your first answer includes the commercial reality.",
  },
  {
    step: "03",
    title: "Decide with a broker",
    body: "The system hands off clean context to a licensed broker instead of burying the human workflow behind generic marketing copy.",
  },
  {
    step: "04",
    title: "Stay on track to close",
    body: "Representation, coordination, documents, and buyer credit expectations stay visible from first paste through closing.",
  },
] as const;

const reviewLanes = [
  {
    title: "Value review",
    description: "Comparable sales, outlier detection, condition context, and overpay signals for Florida neighborhoods that move fast.",
  },
  {
    title: "Negotiation review",
    description: "Leverage cues, incentive stacking, and buyer credit context so the first conversation is already grounded in strategy.",
  },
  {
    title: "Execution review",
    description: "Deal-room readiness, showing support, contract guidance, and closing coordination instead of a dead-end lead form.",
  },
] as const;

const deliverySurfaces = [
  {
    title: "Public site",
    detail: "Explains the service and routes buyers into the same intake system the product uses.",
  },
  {
    title: "Deal room",
    detail: "Carries pricing, leverage, tasks, documents, and next-best action context once a buyer is in motion.",
  },
  {
    title: "Broker workflow",
    detail: "Keeps representation and compliance actions clearly separate from the public marketing shell.",
  },
] as const;

export const metadata: Metadata = metadataForStaticPage("home");

export default function Home() {
  const trustProof = buildHomepageTrustProofReadModel();

  return (
    <>
      <section
        className="px-6 pb-8 pt-10 lg:px-8 lg:pb-12 lg:pt-14"
        data-testid="homepage-hero"
      >
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="rounded-[40px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.1)] backdrop-blur lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              Florida-exclusive buyer brokerage
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl lg:text-7xl">
              Get the best deal on your Florida home
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
              buyer-codex is a buyer operating system, not a brochure site. Paste
              a listing and you move straight into pricing, leverage, broker
              guidance, and closing-aware next steps.
            </p>

            <div className="mt-8 max-w-3xl">
              <HeroInput />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                "Supports Zillow, Redfin, and Realtor.com",
                "No buyer upfront fee or subscription",
                "Licensed Florida broker representation stays attached",
              ].map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
                >
                  {line}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[40px] bg-slate-950 p-7 text-white shadow-[0_35px_100px_rgba(15,23,42,0.18)]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300">
                Re-owned public shell
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] lg:text-3xl">
                The marketing site now mirrors how the service actually runs.
              </h2>
              <div className="mt-6 space-y-4">
                {marketSignals.map((signal) => (
                  <div
                    key={signal.title}
                    className="rounded-[26px] border border-white/10 bg-white/5 p-5"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-200">
                      {signal.label}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-white">
                      {signal.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {signal.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
                  Decision cadence
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                  4 stages
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Intake, analysis, broker review, and closing coordination stay
                  connected instead of split across separate marketing fragments.
                </p>
              </div>
              <div className="rounded-[32px] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
                  Buyer economics
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                  Commission rebate built in
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Pricing education, savings framing, and broker representation
                  now share one consistent public boundary.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <MarketingSection id="how-it-works" className="scroll-mt-28 pt-6 lg:pt-8">
        <div className="grid gap-8 rounded-[40px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:px-8 lg:py-10">
          <MarketingSectionIntro
            eyebrow="How it works"
            title="A public-site rhythm built around real buyer work."
            description="The homepage now leads with service stages and operating boundaries instead of inherited feature-card and testimonial-first sequencing."
          />

          <div className="grid gap-4 md:grid-cols-2">
            {operatingCadence.map((item) => (
              <div
                key={item.step}
                className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
                  {item.step}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingSection>
        <MarketingSectionIntro
          eyebrow="What gets re-checked"
          title="Each buyer decision runs through three distinct review lanes."
          description="This makes the public shell match the product boundary: educational framing on the outside, operational decision support on the inside."
          align="center"
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {reviewLanes.map((lane) => (
            <div
              key={lane.title}
              className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
            >
              <h3 className="text-xl font-semibold text-slate-950">
                {lane.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {lane.description}
              </p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <TrustProofShowcase
        eyebrow="Buyer proof"
        title="Representative outcomes stay in view without taking over the shell."
        description="Proof and testimonials now sit inside a dedicated shared boundary rather than driving the entire page rhythm."
        stats={trustProof.stats}
        caseStudies={trustProof.caseStudies}
        sectionBadge={trustProof.sectionBadge}
        sectionBadgeAriaLabel={trustProof.sectionBadgeAriaLabel}
      />

      <MarketingSection>
        <div className="grid gap-8 rounded-[40px] bg-slate-950 px-6 py-8 text-white lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-8 lg:py-10">
          <MarketingSectionIntro
            eyebrow="Shared boundaries"
            title="Marketing, product, and broker workflows now have cleaner edges."
            description="The public shell explains what the platform does, while the deal room and broker workflows own the execution detail."
            tone="light"
          />

          <div className="grid gap-4">
            {deliverySurfaces.map((surface) => (
              <div
                key={surface.title}
                className="rounded-[28px] border border-white/10 bg-white/5 p-5"
              >
                <h3 className="text-lg font-semibold text-white">
                  {surface.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {surface.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        eyebrow="Start with a live listing"
        title="Paste a property link and move straight into analysis."
        description="The public site now hands buyers into the same intake and deal-room path the product actually uses, without a disconnected marketing detour."
        primaryHref="/get-started"
        primaryLabel="Open guided intake"
        secondaryHref="/pricing"
        secondaryLabel="Review pricing"
      />
    </>
  );
}
