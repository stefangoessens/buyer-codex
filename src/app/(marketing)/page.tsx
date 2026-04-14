import type { Metadata } from "next";
import Image from "next/image";
import { HeroSection } from "@/components/marketing/HeroSection";
import { TrustBar } from "@/components/marketing/TrustBar";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { TrustProofCaseStudyCard } from "@/components/marketing/TrustProofCaseStudyCard";
import { HeroInput } from "@/components/marketing/HeroInput";
import { BentoCard } from "@/components/marketing/BentoCard";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";
import { buildHomepageTrustProofReadModel } from "@/lib/trustProof/readModel";

/* ─── Data ────────────────────────────────────────────────────────────── */

const features = [
  { imageSrc: "/images/marketing/features/feature-1.png", imageAlt: "Paste a listing link and instantly get property data", title: "Paste any listing link", description: "Drop a Zillow, Redfin, or Realtor.com URL. We instantly pull the property data and start our AI analysis engine." },
  { imageSrc: "/images/marketing/features/feature-2.png", imageAlt: "AI-powered property analysis dashboard", title: "Get AI-powered analysis", description: "Fair pricing, comparable sales, leverage signals, risk assessment, and a competitiveness score — all in seconds." },
  { imageSrc: "/images/marketing/features/feature-3.png", imageAlt: "Expert buyer representation saves you money", title: "Save with expert representation", description: "Our licensed Florida brokers negotiate on your behalf using AI insights, with buyer-credit mechanics explained clearly before closing." },
];

const steps = [
  { number: 1, title: "Paste a link", description: "Copy any listing URL from Zillow, Redfin, or Realtor.com and paste it into our analysis bar.", imageSrc: "/images/marketing/steps/step-1.png" },
  { number: 2, title: "Review your analysis", description: "Get an instant AI-powered report with fair pricing, comps, leverage signals, and a property score.", imageSrc: "/images/marketing/steps/step-2.png" },
  { number: 3, title: "Close with confidence", description: "Connect with a licensed Florida broker who uses your analysis to negotiate the best possible deal.", imageSrc: "/images/marketing/steps/step-3.png" },
];

/* ─── Page (Server Component) ─────────────────────────────────────────── */

export const metadata: Metadata = metadataForStaticPage("home");

export default function Home() {
  const trustProof = buildHomepageTrustProofReadModel();

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <HeroSection><HeroInput /></HeroSection>

      {/* ── Trust Bar ────────────────────────────────────────────────── */}
      <TrustBar
        stats={trustProof.stats}
        badge={trustProof.sectionBadge}
        badgeAriaLabel={trustProof.sectionBadgeAriaLabel}
      />

      {/* ── Features (PayFit-style: image cards) ─────────────────────── */}
      <section className="w-full bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1248px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Why buyer-codex</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.003em] text-neutral-800 lg:text-[41px] lg:leading-[1.2]">How buyer-codex works for you</h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-500">From paste to close, we handle every step of your home buying journey with AI precision and human expertise.</p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((f) => <FeatureCard key={f.title} imageSrc={f.imageSrc} imageAlt={f.imageAlt} title={f.title} description={f.description} />)}
          </div>
        </div>
      </section>

      {/* ── Product Screenshot (full-width like PayFit hero) ──────── */}
      <section className="w-full bg-neutral-50 py-16 lg:py-20">
        <div className="mx-auto max-w-[1248px] px-6">
          <div className="overflow-hidden rounded-[24px] border border-neutral-200/80 bg-white shadow-lg">
            <Image
              src="/images/marketing/hero/product-dashboard.png"
              alt="buyer-codex property analysis dashboard"
              width={1248}
              height={760}
              className="w-full"
              sizes="(max-width: 1280px) 100vw, 1248px"
            />
          </div>
        </div>
      </section>

      {/* ── Bento Grid (PayFit-style: image + title cards) ────────── */}
      <section className="w-full bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1248px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.003em] text-neutral-800 lg:text-[41px] lg:leading-[1.2]">From analysis to closing, every step covered</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
            <BentoCard
              src="/images/marketing/bento/bento-1.png"
              title="Fair pricing engine"
              description="Instant fair-price ranges and overpay risk, grounded in local comparable sales."
              imageAspectClassName="aspect-[1524/1512]"
              className="md:col-span-5"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
            <BentoCard
              src="/images/marketing/bento/bento-2.png"
              title="Automated comp analysis"
              description="Pulls comps, adjusts for features, and highlights the listings that truly set the market."
              imageAspectClassName="aspect-[2160/1512]"
              className="md:col-span-7"
              sizes="(max-width: 768px) 100vw, 58vw"
            />
            <BentoCard
              src="/images/marketing/bento/bento-3.png"
              title="Negotiation leverage"
              description="Turns data into crisp concession asks, counter offers, and timing advantages."
              imageAspectClassName="aspect-[2160/1512]"
              className="md:col-span-7"
              sizes="(max-width: 768px) 100vw, 58vw"
            />
            <BentoCard
              src="/images/marketing/bento/bento-4.png"
              title="Market intelligence"
              description="Track price drops, days-on-market shifts, and micro-trends as they happen."
              imageAspectClassName="aspect-[1524/1512]"
              className="md:col-span-5"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
            <BentoCard
              src="/images/marketing/bento/bento-5.png"
              title="Document management"
              description="Keep disclosures, PDFs, and revisions organized in one place from offer to close."
              imageAspectClassName="aspect-[1749/1512]"
              className="md:col-span-5"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
            <BentoCard
              src="/images/marketing/bento/bento-6.png"
              title="Deal room timeline"
              description="A single timeline for tasks, deadlines, and broker actions so nothing slips."
              imageAspectClassName="aspect-[2160/1512]"
              className="md:col-span-7"
              sizes="(max-width: 768px) 100vw, 58vw"
            />
          </div>
        </div>
      </section>

      {/* ── How It Works (PayFit-style: number + title + desc + phone mockup) */}
      <section id="how-it-works" className="scroll-mt-[84px] w-full bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1248px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Simple process</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.003em] text-neutral-800 lg:text-[41px] lg:leading-[1.2]">Three steps to your best deal</h2>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((step) => (
              <div key={step.number} className="group text-center">
                {/* Step number */}
                <p className="text-sm font-bold text-primary-400">{step.number}</p>
                <h3 className="mt-2 text-xl font-semibold text-neutral-800">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">{step.description}</p>
                {/* Phone mockup image */}
                <div className="mt-6 overflow-hidden rounded-[24px] border border-neutral-200 bg-neutral-50 transition-shadow duration-300 group-hover:shadow-lg">
                  <div className="relative aspect-[3/4]">
                    <Image src={step.imageSrc} alt="" fill className="object-cover object-top" sizes="(max-width: 768px) 100vw, 33vw" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Proof ─────────────────────────────────────────────── */}
      <section className="w-full bg-neutral-50 py-20 lg:py-28">
        <div className="mx-auto max-w-[1248px] px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-400">Trust proof</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.003em] text-neutral-800 lg:text-[41px] lg:leading-[1.2]">Illustrative buyer scenarios, kept separate from live closings</h2>
            <p className="mt-4 text-lg leading-relaxed text-neutral-500">
              buyer-codex uses a typed trust-proof catalog for public marketing surfaces, so scenario content stays visibly illustrative until verified transaction records exist.
            </p>
          </div>
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {trustProof.caseStudies.map((study) => (
              <TrustProofCaseStudyCard
                key={study.id}
                study={study}
                showBadge={trustProof.sliceLabelingMode.kind === "mixed"}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-primary-800 py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.003em] text-white lg:text-[41px] lg:leading-[1.2]">Ready to find your Florida home?</h2>
          <p className="mt-4 text-lg text-primary-100/80">Paste a listing link and get your free AI analysis in seconds. No sign-up required.</p>
          <div className="mt-8"><HeroInput /></div>
        </div>
      </section>
    </>
  );
}
