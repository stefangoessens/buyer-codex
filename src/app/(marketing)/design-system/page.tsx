import {
  colors,
  layout,
  semanticColors,
  semanticMotion,
  semanticRadii,
  semanticSpacing,
  semanticTypography,
  tokenUsage,
} from "@buyer-codex/shared/theme";

import { BentoCard } from "@/components/marketing/BentoCard";
import { FeatureCard } from "@/components/marketing/FeatureCard";
import { PageHeader } from "@/components/marketing/PageHeader";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const primitiveColorSwatches = [
  { name: "primary-700", value: colors.primary[700], usage: tokenUsage.colors.primary },
  { name: "primary-400", value: colors.primary[400], usage: "Focus, rings, and lighter trust accents." },
  { name: "accent-500", value: colors.accent[500], usage: tokenUsage.colors.accent },
  { name: "secondary-700", value: colors.secondary[700], usage: tokenUsage.colors.secondary },
  { name: "neutral-50", value: colors.neutral[50], usage: "Soft page grounding for marketing and app shells." },
  { name: "neutral-200", value: colors.neutral[200], usage: "Default border rhythm and table separators." },
  { name: "neutral-800", value: colors.neutral[800], usage: "Primary text and high-signal data labels." },
  { name: "success-500", value: colors.success[500], usage: "Positive status, pricing wins, and momentum cues." },
];

const semanticColorSwatches = [
  { name: "textPrimary", value: semanticColors.textPrimary, usage: "Default copy across marketing, dashboard, and iOS surfaces." },
  { name: "surfaceCard", value: semanticColors.surfaceCard, usage: "Primary card and panel background." },
  { name: "surfaceBrand", value: semanticColors.surfaceBrand, usage: "Trust-tinted supporting section background." },
  { name: "borderDefault", value: semanticColors.borderDefault, usage: "Default card and input framing." },
  { name: "actionPrimary", value: semanticColors.actionPrimary, usage: "High-trust CTA and nav emphasis." },
  { name: "actionAccent", value: semanticColors.actionAccent, usage: "Positive/highlight action without warm-sales pressure." },
];

const typographyExamples = [
  { name: "display", sample: "Measure signal before you bid.", token: semanticTypography.display },
  { name: "heading", sample: "Shared tokens across trust and data density.", token: semanticTypography.heading },
  { name: "bodyLead", sample: "A single token system should feel calm on the homepage and disciplined in the dashboard.", token: semanticTypography.bodyLead },
  { name: "caption", sample: "Caption / metadata / helper text", token: semanticTypography.caption },
];

const spacingTokens = [
  { name: "cardPadding", value: semanticSpacing.cardPadding, usage: "Default card interiors." },
  { name: "gridGap", value: semanticSpacing.gridGap, usage: tokenUsage.spacing.grid },
  { name: "sectionPadding", value: semanticSpacing.sectionPadding, usage: tokenUsage.spacing.section },
  { name: "controlX", value: semanticSpacing.controlX, usage: tokenUsage.spacing.control },
];

const radiusTokens = [
  { name: "control", value: semanticRadii.control, usage: "Inputs, pills, and compact action surfaces." },
  { name: "card", value: semanticRadii.card, usage: "Standard cards and secondary panels." },
  { name: "panel", value: semanticRadii.panel, usage: "Hero cards, feature wrappers, and elevated marketing surfaces." },
  { name: "pill", value: semanticRadii.pill, usage: "Badges, avatars, and score pills." },
];

const motionTokens = [
  { name: "interactiveDuration", value: semanticMotion.interactiveDuration, usage: tokenUsage.motion.interactive },
  { name: "surfaceDuration", value: semanticMotion.surfaceDuration, usage: "Card elevation, expandable panels, inline transitions." },
  { name: "pageDuration", value: semanticMotion.pageDuration, usage: tokenUsage.motion.page },
  { name: "entranceEasing", value: semanticMotion.entranceEasing, usage: "Hero and section reveal curve." },
];

function tokenTextStyle(token: (typeof semanticTypography)[keyof typeof semanticTypography]) {
  return {
    fontSize: token.fontSize,
    fontWeight: token.fontWeight,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    color: semanticColors.textPrimary,
  } as const;
}

export default function DesignSystemPage() {
  return (
    <>
      <PageHeader
        eyebrow="Design system"
        title={<>Tokens and reusable marketing components</>}
        description={<>The canonical token contract lives in the shared package and is mirrored into web CSS plus SwiftUI-friendly artifacts.</>}
        imageSrc="/images/marketing/hero/product-dashboard.png"
        imageAlt="buyer-codex UI"
        imageClassName="object-top"
      />

      <section className="w-full bg-[var(--color-surface-canvas)] py-[var(--spacing-section-padding-hero)]">
        <div className="mx-auto max-w-[var(--layout-container-max)] px-[var(--spacing-page-padding-mobile)] lg:px-[var(--spacing-page-padding-desktop)]">
          <div className="grid grid-cols-1 gap-[var(--spacing-section-padding-dense)]">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Primitive palette</h2>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {primitiveColorSwatches.map((swatch) => (
                  <div
                    key={swatch.name}
                    className="rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding-dense)] shadow-[var(--shadow-elevation-card)]"
                  >
                    <div className="h-12 rounded-[var(--radius-card)]" style={{ backgroundColor: swatch.value }} />
                    <div className="mt-4 text-sm font-semibold text-[var(--color-text-primary)]">{swatch.name}</div>
                    <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{swatch.usage}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Semantic aliases</h2>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {semanticColorSwatches.map((swatch) => (
                  <div
                    key={swatch.name}
                    className="rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding-dense)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{swatch.name}</div>
                        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{swatch.usage}</p>
                      </div>
                      <div
                        className="size-12 shrink-0 rounded-[var(--radius-card)] border border-[var(--color-border-default)]"
                        style={{ backgroundColor: swatch.value }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding)] shadow-[var(--shadow-elevation-card)]">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Typography scale</h2>
                <div className="mt-6 space-y-6">
                  {typographyExamples.map((example) => (
                    <div key={example.name} className="border-b border-[var(--color-border-default)] pb-6 last:border-none last:pb-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-brand)]">{example.name}</p>
                      <p className="mt-3" style={tokenTextStyle(example.token)}>
                        {example.sample}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--radius-panel)] bg-[var(--color-surface-subtle)] p-[var(--spacing-card-padding)]">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Spacing and grid</h2>
                <div className="mt-6 space-y-4">
                  {spacingTokens.map((token) => (
                    <div key={token.name} className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding-dense)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{token.name}</div>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{token.usage}</p>
                        </div>
                        <div className="text-sm font-mono text-[var(--color-text-brand)]">{token.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-[var(--spacing-card-padding-dense)]">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Container max: <span className="font-semibold text-[var(--color-text-primary)]">{layout.containerMax}</span>
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    Content max: <span className="font-semibold text-[var(--color-text-primary)]">{layout.contentMax}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
              <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding)]">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Radii and motion</h2>
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {radiusTokens.map((token) => (
                    <div key={token.name} className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] p-[var(--spacing-card-padding-dense)]">
                      <div
                        className="h-16 border border-[var(--color-border-default)] bg-[var(--color-surface-brand)]"
                        style={{ borderRadius: token.value }}
                      />
                      <div className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">{token.name}</div>
                      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{token.usage}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4">
                  {motionTokens.map((token) => (
                    <div key={token.name} className="rounded-[var(--radius-card)] border border-[var(--color-border-default)] p-[var(--spacing-card-padding-dense)]">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{token.name}</div>
                          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{token.usage}</p>
                        </div>
                        <div className="text-sm font-mono text-[var(--color-text-brand)]">{token.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="rounded-[var(--radius-panel)] border-[var(--color-border-default)] p-[var(--spacing-card-padding)] shadow-[var(--shadow-elevation-card)]">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">UI primitives</h2>
                <div className="mt-6 flex flex-wrap items-center gap-[var(--spacing-inline-default)]">
                  <Badge>Badge</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-[var(--spacing-inline-default)]">
                  <Button className="rounded-[var(--radius-control)]">Primary</Button>
                  <Button variant="secondary" className="rounded-[var(--radius-control)]">
                    Secondary
                  </Button>
                  <Button variant="outline" className="rounded-[var(--radius-control)]">
                    Outline
                  </Button>
                </div>
                <div className="mt-6 grid gap-[var(--spacing-inline-default)]">
                  <Input className="h-12 rounded-[var(--radius-control)]" placeholder="Input" />
                </div>
                <div className="mt-8 rounded-[var(--radius-panel)] bg-[var(--color-surface-subtle)] p-[var(--spacing-card-padding)]">
                  <FeatureCard
                    imageSrc="/images/marketing/features/feature-2.png"
                    imageAlt="Feature preview"
                    title="FeatureCard"
                    description="Shared tokens keep marketing polish and denser application surfaces aligned without one-off overrides."
                  />
                </div>
              </Card>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">Marketing components</h2>
              <div className="mt-6 grid grid-cols-1 gap-[var(--spacing-grid-gap)] md:grid-cols-12">
                <BentoCard
                  src="/images/marketing/bento/bento-1.png"
                  title="BentoCard"
                  description="Uses the shared panel radius, card padding, and surface treatment for visual continuity."
                  imageAspectClassName="aspect-[1524/1512]"
                  className="md:col-span-5"
                  sizes="(max-width: 768px) 100vw, 40vw"
                />
                <BentoCard
                  src="/images/marketing/bento/bento-2.png"
                  title="BentoCard (wide)"
                  description="Wide marketing surfaces still inherit the same token cadence used by dashboard cards."
                  imageAspectClassName="aspect-[2160/1512]"
                  className="md:col-span-7"
                  sizes="(max-width: 768px) 100vw, 58vw"
                />
              </div>

              <div className="mt-8 grid grid-cols-1 gap-[var(--spacing-grid-gap)] md:grid-cols-3">
                <TestimonialCard
                  quote="Tokens now resolve from the shared theme contract, so card polish stays consistent between documentation and production surfaces."
                  author="Example Buyer"
                  role="Orlando"
                />
                <TestimonialCard
                  quote="Spacing and radius decisions trace back to the same semantic layer rather than one-off values."
                  author="Example Buyer"
                  role="Miami"
                />
                <TestimonialCard
                  quote="The same palette can feel calm on a homepage and disciplined on a dense app screen."
                  author="Example Buyer"
                  role="Tampa"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
