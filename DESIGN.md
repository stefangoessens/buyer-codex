# buyer-codex Design System

Canonical design language for the buyer-codex platform. Every UI surface — marketing site, deal room, dashboards, broker console, iOS app — derives from this document.

---

## 1. North Star

> **PayFit aesthetic in Hosman structural form.**

This means two things working in concert:

**PayFit supplies the visual identity.** Deep blues that convey trust, warm coral accents that invite action, generous whitespace, crisp geometric typography (Inter), smooth micro-interactions, and polished component surfaces (cards with subtle shadows, rounded inputs, pill badges). The overall feeling is modern European SaaS — professional without being corporate, friendly without being juvenile.

**Hosman supplies the page architecture.** Full-width hero sections with a prominent search/input CTA, scrolling trust strips with logos and stats, structured calculator and pricing sections, testimonial blocks, and conversion-oriented layout sequencing (hook → credibility → value prop → proof → CTA). Every public page follows Hosman's proven real estate marketing cadence.

**RealAdvisor supplements with data patterns.** Score badges (e.g., 9.4/10 pills), comparison tables, agent matching cards, and data visualization conventions for metrics-heavy surfaces like the deal room and broker console.

The result: a platform that *looks* like the best SaaS tools in Europe and *flows* like the best real estate marketing sites.

---

## 2. Reference Hierarchy

| Source | What We Take | What We Skip |
|---|---|---|
| **PayFit** | Color palette (deep blue + coral), typography (Inter, geometric sans), spacing system (generous), component polish (cards, buttons, inputs, badges), motion language (subtle, purposeful), illustration tone (friendly, minimal), empty state patterns | HR/payroll domain content, pricing tiers layout, enterprise feature comparison grids |
| **Hosman** | Page architecture (hero → trust → features → CTA), hero with prominent input, calculator/pricing section placement, trust bar pattern, testimonial layout, section sequencing, conversion flow, information architecture | French-specific real estate content, agent matching directory, city-specific landing page templates |
| **RealAdvisor** | Score badge component (numeric pill), data visualization patterns, comparison table layout, metric cards, property data display conventions | Agent directory layout, Swiss market specifics, multi-language navigation patterns |

---

## 3. Color Palette

### Brand Colors

| Token | Value | Usage |
|---|---|---|
| `brand-primary` | `#1B2B65` | Primary UI surfaces, headings, nav, trust |
| `brand-primary-light` | `#2A3F8F` | Hover states, secondary surfaces |
| `brand-primary-dark` | `#111D45` | Deep backgrounds, footer |
| `brand-accent` | `#FF6B4A` | CTAs, action buttons, highlights, warmth |
| `brand-accent-light` | `#FF8A70` | Hover on accent, soft emphasis |
| `brand-accent-dark` | `#E85535` | Active/pressed state on accent |
| `brand-secondary` | `#0FA573` | Success states, positive metrics, confirmations |
| `brand-secondary-light` | `#34C791` | Lighter success surfaces |
| `brand-secondary-dark` | `#0B7D57` | Dark success emphasis |

### Neutrals (Cool Gray)

| Token | Value |
|---|---|
| `neutral-50` | `#F8FAFC` |
| `neutral-100` | `#F1F5F9` |
| `neutral-200` | `#E2E8F0` |
| `neutral-300` | `#CBD5E1` |
| `neutral-400` | `#94A3B8` |
| `neutral-500` | `#64748B` |
| `neutral-600` | `#475569` |
| `neutral-700` | `#334155` |
| `neutral-800` | `#1E293B` |
| `neutral-900` | `#0F172A` |
| `neutral-950` | `#020617` |

### Semantic Colors

| Token | Value | Usage |
|---|---|---|
| `success` | `#0FA573` | Positive outcomes, confirmations |
| `success-light` | `#ECFDF5` | Success backgrounds |
| `warning` | `#F59E0B` | Caution, pending states |
| `warning-light` | `#FFFBEB` | Warning backgrounds |
| `error` | `#EF4444` | Errors, destructive actions |
| `error-light` | `#FEF2F2` | Error backgrounds |
| `info` | `#3B82F6` | Informational, links, help |
| `info-light` | `#EFF6FF` | Info backgrounds |

### Surface Colors

| Token | Value | Usage |
|---|---|---|
| `surface-white` | `#FFFFFF` | Card backgrounds, modals |
| `surface-subtle` | `#F8FAFC` | Page background, alternating sections |
| `surface-muted` | `#F1F5F9` | Disabled surfaces, secondary panels |
| `surface-tinted` | `#EEF2FF` | Brand-tinted background (hero, feature sections) |
| `surface-dark` | `#1B2B65` | Dark sections (footer, dark hero variant) |
| `surface-overlay` | `rgba(15, 23, 42, 0.6)` | Modal/dialog backdrop |

---

## 4. Typography

### Font Stack

| Role | Font | Fallback |
|---|---|---|
| **Display / Headings** | `Inter` | `system-ui, -apple-system, sans-serif` |
| **Body** | `Inter` | `system-ui, -apple-system, sans-serif` |
| **Monospace** | `JetBrains Mono` | `ui-monospace, 'Cascadia Code', monospace` |

Load via `next/font/google` for automatic optimization:

```tsx
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
```

### Type Scale

| Token | Size | Line Height | Usage |
|---|---|---|---|
| `text-xs` | 12px | 1.5 | Captions, fine print, badges |
| `text-sm` | 14px | 1.5 | Secondary text, table cells, helper text |
| `text-base` | 16px | 1.5 | Body text (default) |
| `text-lg` | 18px | 1.5 | Lead paragraphs, emphasized body |
| `text-xl` | 20px | 1.35 | Card headings, section subheads |
| `text-2xl` | 24px | 1.3 | Section headings |
| `text-3xl` | 30px | 1.25 | Page titles |
| `text-4xl` | 36px | 1.2 | Hero subheadings |
| `text-5xl` | 48px | 1.15 | Hero headings |
| `text-6xl` | 60px | 1.1 | Display (marketing hero, large) |
| `text-7xl` | 72px | 1.1 | Display (max, used sparingly) |

### Font Weights

| Token | Weight | Usage |
|---|---|---|
| `font-regular` | 400 | Body text, descriptions |
| `font-medium` | 500 | Labels, nav items, emphasis |
| `font-semibold` | 600 | Subheadings, buttons, card titles |
| `font-bold` | 700 | Hero headings, display text, strong emphasis |

### Letter Spacing

| Token | Value | Usage |
|---|---|---|
| `tracking-tight` | `-0.02em` | Headings (text-2xl and above) |
| `tracking-normal` | `0` | Body text |
| `tracking-wide` | `0.05em` | All-caps labels, overlines |

---

## 5. Spacing

Base unit: **4px**. All spacing values are multiples of 4.

| Token | Value | Usage |
|---|---|---|
| `space-0` | 0px | Reset |
| `space-1` | 4px | Tight internal padding (badge, tag) |
| `space-2` | 8px | Icon-to-text gap, inline spacing |
| `space-3` | 12px | Input padding, compact card padding |
| `space-4` | 16px | Standard padding, form gaps |
| `space-5` | 20px | Card padding, button padding-x |
| `space-6` | 24px | Gutter (min), section-internal spacing |
| `space-8` | 32px | Gutter (standard), card-to-card gap |
| `space-10` | 40px | Large component spacing |
| `space-12` | 48px | Section padding (compact) |
| `space-16` | 64px | Section padding (standard) |
| `space-20` | 80px | Section padding (generous) |
| `space-24` | 96px | Section padding (max) |

### Layout Constants

| Constant | Value |
|---|---|
| Container max-width | `1280px` |
| Container padding-x | `24px` (mobile), `32px` (tablet+) |
| Section padding-y | `64px` (mobile), `80px` (tablet), `96px` (desktop) |
| Grid gutter | `24px` (mobile), `32px` (desktop) |
| Sidebar width | `260px` (collapsed: `64px`) |
| Top nav height | `64px` |

---

## 6. Border Radii

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | `6px` | Inputs, badges, small tags |
| `radius-md` | `8px` | Cards, dropdowns, tooltips |
| `radius-lg` | `12px` | Modals, panels, large cards |
| `radius-xl` | `16px` | Hero cards, featured CTAs, promo banners |
| `radius-full` | `9999px` | Pills, avatars, circular buttons |

---

## 7. Elevation / Shadows

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.05)` | Inputs, subtle lift |
| `shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)` | Cards, dropdowns |
| `shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)` | Modals, popovers, floating panels |
| `shadow-xl` | `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)` | Full-page overlays, hero feature cards |
| `shadow-inner` | `inset 0 2px 4px rgba(0, 0, 0, 0.05)` | Pressed inputs, inset surfaces |
| `shadow-none` | `none` | Reset |

### Elevation Usage Pattern

- **Resting**: `shadow-sm` or none (most components)
- **Interactive hover**: `shadow-md` (cards, buttons)
- **Floating**: `shadow-lg` (dropdowns, popovers, tooltips)
- **Modal**: `shadow-xl` (dialogs, full overlays)

---

## 8. Motion

### Duration

| Token | Value | Usage |
|---|---|---|
| `duration-fast` | `150ms` | Hover states, color changes, opacity |
| `duration-normal` | `250ms` | Expand/collapse, slide, scale |
| `duration-slow` | `400ms` | Page transitions, complex animations |
| `duration-page` | `600ms` | Full page/section reveals, hero entrance |

### Easing

| Token | Value | Usage |
|---|---|---|
| `ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements entering view, exits |
| `ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | State transitions, transforms |
| `ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Interactive feedback, bouncy press |

### Animation Rules

1. **Purposeful only** — animation must communicate state change or guide attention. No decorative animation.
2. **Respect `prefers-reduced-motion`** — wrap all animations in a `@media (prefers-reduced-motion: no-preference)` check or use Tailwind's `motion-safe:` variant.
3. **Entrance pattern** — fade-up (translate-y 8px + opacity 0 → 0 + 1) at `duration-normal` with `ease-out`. Stagger siblings by 50ms.
4. **Hover pattern** — shadow lift + subtle scale (1.01-1.02) at `duration-fast`.
5. **Loading pattern** — skeleton pulse with neutral-200 → neutral-100 gradient sweep at `duration-slow` in a loop.

---

### Motion Decision Rules

Use these rules when more than one animation approach would be plausible:

| Situation | Choose | Why it matches PayFit | Do not choose |
|---|---|---|---|
| Primary CTA hover | Background tint shift + shadow increase + at most 1-2px perceived lift at `150-200ms` | PayFit buttons feel responsive and polished, but never theatrical | Bounce, glow, elastic scale, icon spin |
| Card hover | Shadow step (`shadow-sm` → `shadow-md`) and optional `scale(1.01)` | Keeps the surface feeling touchable without looking like a draggable tile | 3D tilt, `scale(1.04+)`, hard drop shadows |
| Section reveal on public pages | Fade-up `8-12px`, `250-400ms`, stagger `40-60ms`, one pass only | PayFit uses reveal as orchestration, not as an ambient effect | Re-triggering on every scroll, long parallax, layered timelines |
| Step-to-step onboarding transition | Outgoing content fades to `0` while incoming content slides `12-16px` on the x-axis and fades in at `250ms` | Feels guided and product-like, not like a marketing carousel | Full-screen wipes, slide decks, modal-like cross-zooms |
| Expand/collapse disclosures or FAQ | Height/opacity transition at `200-250ms` with `ease-in-out` | Keeps compliance/help copy readable and calm | Overshoot springs, accordion snap, collapsing multiple panels at once |
| Async confirmation | Subtle color confirmation, check icon fade-in, or border accent | Trust surfaces should reinforce certainty, not celebrate | Confetti, success bursts, looping checkmark pulses |
| Loading | Skeleton sweep or steady pulse `1.4-1.8s` | Matches PayFit's "system is working" feel | Spinners as the default for content regions, jittery shimmer, rainbow loaders |

### Public vs. Authenticated Motion

| Surface type | Motion posture | Allowed emphasis | Restricted behaviors |
|---|---|---|---|
| **Public marketing** | Guided, slightly more spacious | Section reveals, CTA hover lift, feature-card hover, controlled testimonial/proof entrance | Auto-rotating testimonial carousels, floating decorative shapes, looping hero motion |
| **Intake / onboarding** | Reassuring, task-forward | Step transitions, validation states, disclosure expansion, progress indicator updates | Multiple simultaneous reveals, attention traps near inputs, animated distractions next to legal copy |
| **Authenticated product** | Quiet, utility-first | Instant hover feedback, panel open/close, inline optimistic updates, skeletons | Large staggered reveals after first paint, animated counters on every refresh, marketing-style hero entrances |

### Motion Anti-Patterns

- Too flashy: parallax, marquee logos, count-up vanity metrics, pulsing trust badges, floating gradient blobs, autoplay carousels.
- Too startup-generic: springy cards, micro-bounce on every click, animated mascot scenes, attention-grabbing cursor-follow effects.
- Too enterprise-flat: zero hover feedback, abrupt accordion snaps, no progress cues in onboarding, dead/static empty states.
- `ease-spring` is reserved for tiny input affordances only. Never use it for trust claims, testimonials, disclosures, or page-level transitions.

---

## 9. Illustration

### Choose Illustration vs. Product UI vs. Photography

| If the message is about... | Use | Why | Avoid |
|---|---|---|---|
| Workflow clarity, dashboard output, automation, or search results | Product UI screenshot/mock frame | Real interface detail builds credibility faster than metaphor | Abstract illustration standing in for a concrete product claim |
| Guidance, reassurance, empty states, onboarding support, or invisible service work | Minimal illustration | Softens the experience without pretending to be evidence | Dense UI screenshots that overwhelm a lightweight support moment |
| Real humans, outcomes, reviews, or properties | Photography | Trust comes from specific people and real homes, not from illustration | Generic stock office scenes or AI-looking people |
| Pricing math, legal framing, disclosures, or data-heavy comparison | Plain UI + typography | These surfaces need clarity over charm | Decorative scenes, oversized icons, or emotional imagery competing with legal copy |

### Illustration Treatment Rules

1. **Style**: flat or softly shaded 2D, geometric, human but not character-led, with clean outlines or crisp fill boundaries.
2. **Palette**: one dominant brand-primary family, one warm accent, one success/support color, and neutral grounding. Illustrations should feel like an extension of the token system, not a separate palette.
3. **Complexity**: one clear idea per illustration. PayFit's illustrations are compositional support, not puzzle images.
4. **Framing**: keep illustrations inside cards, split-content sections, or empty-state containers. Do not let them float as disconnected collage elements.
5. **Relationship to UI**: product UI wins whenever the claim can be shown directly. Illustration is secondary and explanatory.
6. **Scale**: on marketing pages, one illustration per major narrative section is enough. In authenticated surfaces, restrict illustration to empty states, onboarding side panels, and light contextual support.
7. **Texture**: use clean fills, sparse highlights, and subtle shadows only where they reinforce depth. No grain-heavy poster treatment, hand-drawn sketching, or glossy 3D rendering.

### Illustration Anti-Patterns

- Too flashy: 3D isometric scenes, mascots, exaggerated gradients, oversized decorative ribbons, layered floating stickers.
- Too startup-generic: generic AI orbit graphics, purple blob collages, emoji-led scenes, abstract "innovation" visuals.
- Too enterprise-flat: icon-only sections where a supportive illustration should soften the page, grayscale compliance panels with no visual relief.
- Do not imitate PayFit's exact characters, product scenes, or compositions literally. Borrow the level of friendliness and restraint, not the proprietary artwork.

---

## 10. Trust Surfaces

### Trust Surface Formula

Every trust-forward surface should combine at least **two** of these evidence types:

| Evidence type | What counts | Typical location |
|---|---|---|
| **Outcome proof** | Savings figures, time-to-close, buyer count, response-time metric, score improvement | Trust bar, calculator support, KPI rail |
| **Human proof** | Buyer testimonial, named reviewer, broker review, partner/press/customer logo | Mid-page proof section, footer trust strip, onboarding reassurance panel |
| **Operational proof** | Licensed brokerage note, broker review process, secure document handling, disclosure language, certification badges | Calculator support, onboarding, footer, deal-room side panels |

A trust surface is weak if it relies on only one evidence type. Example: a testimonial carousel with no quantified outcome or operational framing is too soft; a disclosure wall with no human or outcome proof is too cold.

### Trust Pattern Selection

Use this table when choosing between plausible trust implementations:

| Need | Choose | Composition rules | Do not substitute with |
|---|---|---|---|
| Immediate reassurance below the hero | `TrustBar` | 3-5 items max; mix one quantified outcome, one human/company signal, one operational signal; keep copy fragment-length | Long testimonials, badge clouds, auto-scrolling logo belts |
| Support a calculator or savings claim | Result card + `DisclosureStack` + one proof block or testimonial | Put the strongest disclosure directly under the result, then an expandable stack for the rest; adjacent proof should support the claim, not repeat it | Hiding disclosure in tooltip/modals, putting legal copy only in footer |
| Convince a skeptical public visitor mid-page | Testimonial cluster with proof companion stats | 2-3 testimonials max per row; pair with one stat rail or one licensing/process note | Full-wall review dumps, testimonial carousels that autoplay |
| Reassure a user inside onboarding | Compact `TrustPanel` | Focus on broker oversight, data handling, timeline clarity, and next-step certainty; keep it sidebar/card scale | Marketing testimonials, large logo strips, animated proof counters |
| Reinforce legitimacy near the footer/CTA | Certification or policy rail | Use restrained badges plus one sentence on what the certification/process means | Giant stamp graphics, legal text blocks that dominate the CTA |

### Public vs. Authenticated Trust

| Surface type | Primary trust mechanism | Secondary support | Tone |
|---|---|---|---|
| **Public marketing** | Social proof and outcome proof | Disclosures, licensing, certifications, buyer stories | Warm, spacious, persuasive |
| **Intake / onboarding** | Operational proof | One calm testimonial or proof stat only if it directly reduces hesitation | Guided, low-friction, reassuring |
| **Authenticated product** | System reliability and process clarity | Audit trail language, status badges, broker review cues, secure-upload messaging | Calm, compact, non-promotional |

Rules:

1. Public surfaces may use testimonials, logos, proof stats, and licensing together, but the visual hierarchy must still lead with the task or value proposition.
2. Authenticated surfaces should almost never reuse marketing-style testimonial cards. After login, trust comes from state clarity, response expectations, and visible process ownership.
3. On onboarding surfaces, operational proof beats social proof. "Reviewed by a licensed broker" is stronger than "buyers love us" next to a required form.
4. Trust surfaces should be interleaved with decision points. Do not stack multiple trust-heavy sections back-to-back without advancing the user.

### Implementation Guardrails

These are product rules, not optional styling advice:

1. Public proof blocks and case studies must render through `src/lib/trustProof/policy.ts` and `src/lib/trustProof/types.ts`. Do not hand-roll testimonial/proof arrays inside components.
2. If proof is illustrative rather than live, the visible label policy from `DEFAULT_LABELING_POLICY` is mandatory. Never make illustrative examples look like verified transaction proof.
3. Calculator trust support must consume `src/lib/pricing/disclosures.ts`. The strongest disclosure belongs immediately under the headline claim; the rest may collapse, but they may not disappear.
4. If there is no verified proof yet, prefer a clearly labeled illustrative example or plain process explanation over vague vanity metrics.
5. Regulatory or brokerage claims should be phrased as process assurance, then backed by a specific note. Example shape: claim, one-sentence explanation, disclosure link/accordion.

### Trust Anti-Patterns

- Too flashy: animated number counters, flashing ratings, rotating certification badges, testimonial carousels on timers.
- Too startup-generic: anonymous five-star grids, vague "trusted by top buyers" copy, AI-generated avatars, unqualified superlatives.
- Too enterprise-flat: monochrome disclosure walls, unlabeled dense legal tables, sterile proof sections with no human context.
- Do not copy PayFit's Trustpilot-heavy composition literally. Reuse the pacing and evidence balance, not the exact review-provider treatment.

---

## 11. Surface Mapping

How design patterns map to buyer-codex surfaces:

| Surface | Primary Reference | Layout Pattern | Key Components |
|---|---|---|---|
| **Public homepage** | Hosman hero + PayFit polish | Full-width hero → trust strip → feature cards → calculator teaser → testimonials → CTA | `PasteLinkInput`, `TrustBar`, `FeatureCard`, `TestimonialCard` |
| **Pricing / FAQ** | Hosman structure + PayFit tables | Section-based vertical scroll: hero → pricing table → FAQ accordion → CTA | `PricingTable`, `AccordionFAQ`, `ComparisonRow` |
| **Savings calculator** | Hosman placement + PayFit inputs | Two-column: controls (sliders, inputs) left, results (cards, chart) right | `SliderInput`, `ResultCard`, `SavingsChart` |
| **Deal room** | RealAdvisor data + PayFit cards | Dashboard grid: property header → score panel → analysis tabs → timeline | `ScoreBadge`, `PropertyCard`, `AnalysisPanel`, `TimelineStep` |
| **Buyer dashboard** | PayFit SaaS dashboard | Left sidebar nav + main content area with card grid | `NavSidebar`, `DealCard`, `TaskList`, `KPICard` |
| **Broker console** | PayFit ops + shadcn data tables | Left sidebar nav + table/detail split view | `DataTable`, `QueueCard`, `KPICard`, `StatusBadge` |
| **Onboarding flow** | PayFit onboarding stepper | Centered card with progress stepper, one question per step | `StepIndicator`, `QuestionCard`, `ProgressBar` |
| **Auth screens** | PayFit minimal | Centered card on tinted background, logo + form | `AuthCard`, `SocialLoginButton` |

---

## 12. Component Patterns

Key reusable components derived from the reference sites. Each component lists its source inspiration, visual characteristics, and buyer-codex adaptation.

### PasteLinkInput
- **Source**: Hosman hero search bar, adapted for URL paste
- **Visual**: Large input (48-56px height), rounded-xl, prominent placeholder, brand-accent submit button, subtle shadow-md
- **Behavior**: Paste or type a Zillow/Redfin/Realtor.com URL; validates on paste; animates to loading state
- **Surface**: Public homepage hero

### ScoreBadge
- **Source**: RealAdvisor score pills (e.g., "9.4" / "7.4")
- **Visual**: Rounded-full pill, bold numeric value, color-coded background (green/amber/red based on score), compact (28-32px height)
- **Variants**: `positive` (green), `neutral` (amber), `negative` (red), `info` (blue)
- **Surface**: Deal room, property cards, analysis panels

### PropertyCard
- **Source**: Hosman property listing + RealAdvisor metrics
- **Visual**: radius-md card with photo (aspect-video), score badge overlay, address, key metrics row (price, beds, baths, sqft), subtle shadow-md on hover
- **Surface**: Buyer dashboard, deal room, search results

### TrustBar
- **Source**: Hosman trust strip
- **Visual**: Full-width, neutral-50 background, horizontally scrolling or evenly spaced partner logos, optional stats ("500+ buyers served", "$2M+ saved"), and at least one operational trust cue (licensed brokerage, secure process, reviewed by broker)
- **Composition rule**: 3-5 items max. One row on desktop, horizontal scroll on mobile. Prefer a mix of quantified proof + human/company signal + process proof.
- **Surface**: Public homepage, below hero

### KPICard
- **Source**: PayFit dashboard metric cards
- **Visual**: radius-md card, large numeric value (text-3xl, font-bold), label below (text-sm, neutral-500), optional trend indicator (up/down arrow + percentage), optional sparkline
- **Surface**: Buyer dashboard, broker console

### TimelineStep
- **Source**: PayFit process stepper
- **Visual**: Vertical timeline with circle indicators (brand-primary filled for complete, accent for current, neutral-300 for future), connecting line, step label + description
- **Variants**: `completed`, `current`, `upcoming`
- **Surface**: Deal room timeline, onboarding flow

### FeatureCard
- **Source**: PayFit feature sections
- **Visual**: radius-lg card, icon (40px, brand-primary tint), heading (text-xl, font-semibold), description (text-base, neutral-600), optional link
- **Surface**: Public homepage feature sections

### AccordionFAQ
- **Source**: Hosman FAQ section
- **Visual**: Clean accordion with neutral-200 dividers, smooth expand/collapse (duration-normal), chevron rotation, generous padding
- **Surface**: Pricing/FAQ page

### EmptyState
- **Source**: PayFit empty states
- **Visual**: Centered layout, friendly illustration (minimal line art style, brand-primary + accent colors), heading, description, primary CTA button
- **Illustration rule**: use one bounded illustration or UI-support graphic only. No mascots, celebratory confetti, or decorative scenery.
- **Surface**: Any list/dashboard with no data

### LoadingState
- **Source**: PayFit skeleton loaders
- **Visual**: Skeleton shapes matching the component they replace (rounded rects for text, circles for avatars, aspect-video rects for images), pulse animation with neutral-200/neutral-100 gradient
- **Surface**: All async-loaded components

### DataTable
- **Source**: shadcn/ui Table + PayFit styling
- **Visual**: Clean header row (font-medium, neutral-500, text-sm), alternating row backgrounds (white/neutral-50), hover highlight (surface-tinted), sortable column indicators, pagination
- **Surface**: Broker console, admin views

### StatusBadge
- **Source**: PayFit status indicators
- **Visual**: Rounded-full pill, dot indicator + label, color-coded per status
- **Variants**: `active` (green), `pending` (amber), `closed` (neutral), `urgent` (red)
- **Surface**: Dashboards, tables, cards

### DisclosureStack
- **Source**: PayFit support/compliance framing, adapted for buyer-codex calculator and intake requirements
- **Purpose**: Keep legal and brokerage-critical trust copy near the claim it qualifies
- **Visual**: Compact stack of 2-5 disclosure rows inside a low-contrast card or accordion. First row is always visible and uses stronger typography or border emphasis; remaining rows can collapse. Use generous line length control, subdued separators, and no alert-red styling unless the content is truly negative.
- **Variants**:
  - `inline` -- first disclosure only, shown directly under a savings/result figure
  - `stacked` -- visible list for calculator support sections
  - `accordion` -- compact version for mobile or denser onboarding flows
- **Surfaces**: Savings calculator, pricing page, onboarding reassurance blocks

### TrustPanel
- **Source**: PayFit trust-forward product support panels, adapted for buyer onboarding and deal-room sidebars
- **Purpose**: Reassure users inside task flows without dropping them into marketing mode
- **Visual**: Radius-lg side panel or inline card with short heading, 2-3 trust bullets, one lightweight badge row, and one optional supporting disclosure or response-time note. Calm background, neutral typography, and restrained iconography.
- **Variants**:
  - `onboarding` -- emphasizes licensed broker review, secure data handling, and expected turnaround
  - `dealroom` -- emphasizes auditability, document security, and process ownership
  - `compact` -- inline reassurance block adjacent to a form
- **Surfaces**: Intake flow, onboarding steps, deal room sidebars

### TestimonialCard
- **Source**: Hosman testimonials section
- **Purpose**: Social proof via buyer testimonials and success stories
- **Visual**: White card (radius-lg, shadow-sm) with quote text (lg, gray-800, italic, snug leading). Below: avatar circle (48px, radius-full), name (medium), role/location (sm, gray-500). Optional star rating row above the quote. Quotation mark decorative element (primary-100, oversized) in top-left corner.
- **Variants**:
  - `default` -- standard card with quote + attribution
  - `featured` -- larger card, primary-50 background, used for hero testimonial
  - `compact` -- inline quote without card chrome, for embedding in other sections
  - `carousel` -- multiple cards in a horizontally scrollable row
- **Trust rule**: pair with either a proof stat or a process/compliance note when used on marketing pages. Do not use the carousel variant on autoplay.
- **Surfaces**: Homepage testimonials section, landing pages, deal room (agent reviews)

---

## 13. Adopted vs. Rejected Patterns

### PayFit

| Adopted | Rationale |
|---|---|
| Deep blue + warm accent palette | Conveys trust (real estate) + action (conversion) |
| Inter typeface at all scales | Clean, geometric, excellent readability, free |
| Generous whitespace and section padding | Premium feel, reduces cognitive load |
| Card-based component surfaces with subtle shadows | Consistent containment, clear hierarchy |
| Skeleton loading states | Smooth perceived performance |
| Dashboard sidebar + content layout | Proven SaaS pattern, good for dense data |
| Metric cards with trend indicators | Quick buyer/broker status comprehension |
| Stepper/timeline for multi-step flows | Clear progress indication for long processes |
| Micro-interactions (hover lift, fade-up entrance) | Polish without distraction |
| Empty state with illustration + CTA | Guides users to action vs. blank screen |

| Rejected | Rationale |
|---|---|
| HR/payroll content patterns | Different domain (real estate) |
| Enterprise pricing tier layout | buyer-codex has a single commission model, not SaaS tiers |
| Complex multi-tab settings UI | Over-engineered for buyer-codex's simpler config needs |
| Illustration-heavy onboarding | buyer-codex onboarding is URL-paste-first, not tour-based |

### Hosman

| Adopted | Rationale |
|---|---|
| Full-width hero with prominent search/input | URL paste is the primary intent signal — hero input is the #1 conversion surface |
| Trust strip below hero | Social proof is critical in real estate |
| Calculator section in marketing flow | Savings calculator is a core value prop |
| Section-based scroll architecture | Proven real estate marketing cadence |
| Testimonial blocks with photos | Builds trust for high-stakes transactions |
| FAQ accordion in pricing context | Answers objections at the decision point |
| Footer with structured sitemap | SEO + navigation completeness |

| Rejected | Rationale |
|---|---|
| French real estate content patterns | buyer-codex is Florida-specific |
| Agent matching directory | buyer-codex has its own broker assignment model |
| City-specific landing page templates | Not needed at launch (FL-first) |
| Hosman's specific color scheme | Replaced by PayFit-derived brand palette |

### RealAdvisor

| Adopted | Rationale |
|---|---|
| Numeric score badge (pill with value) | Perfect for deal room property scoring |
| Data visualization in property context | AI engine outputs need clear visual representation |
| Comparison table layout | Useful for comp analysis in deal room |
| Metric-dense card patterns | Broker console needs information density |

| Rejected | Rationale |
|---|---|
| Agent directory listing layout | buyer-codex doesn't have a public agent directory |
| Swiss market navigation patterns | Different market |
| Multi-language selector UI | English-only at launch |
| Review/rating collection UI | buyer-codex doesn't collect public reviews |

---

## 14. Coverage Rationale

### What This Document Covers

This design system covers every visual and structural decision needed to build buyer-codex's UI surfaces:

- **Color**: Full brand palette with primary, accent, secondary, neutrals, semantic, and surface colors — sufficient for all UI states.
- **Typography**: Font family, scale (12-72px), weights, line heights, and letter spacing — covers everything from badge captions to hero display text.
- **Spacing**: 4px-base grid with 15 tokens from 0-96px, plus layout constants (container, gutter, section padding, sidebar, nav height).
- **Shape**: Border radii from 6px (inputs) to 9999px (pills) — 5 tokens covering all component shapes.
- **Elevation**: 6 shadow tokens with clear usage guidance (resting → hover → floating → modal).
- **Motion**: Duration, easing, pacing rules, public-vs-product posture, and anti-patterns with enough detail to choose between plausible transitions.
- **Illustration**: Explicit rules for when to use illustration versus product UI or photography, plus the allowed visual treatment.
- **Trust surfaces**: Composition rules for proof bars, testimonials, disclosures, onboarding reassurance, and authenticated trust patterns tied to existing typed data modules.
- **Surface mapping**: 8 distinct surfaces mapped to reference sources, layout patterns, and key components.
- **Component patterns**: Trust/disclosure components plus the core marketing and product primitives, each with source attribution, visual specification, and surface assignments.
- **Adopted/rejected patterns**: Explicit decisions for all three reference sites with rationale.

### What Is Intentionally Out of Scope

- **Icon library**: Uses Lucide (configured in `components.json`). No custom icon set needed.
- **Commissioned illustration asset pack**: The style rules are defined above, but the final owned scenes/characters are not specified asset-by-asset here.
- **iOS-specific tokens**: SwiftUI adaptations will derive from these tokens but are documented in `ios/DESIGN_IOS.md` when that milestone begins.
- **Dark mode**: Not in scope for launch. The neutral scale and surface tokens are structured to support it later.
- **Print styles**: Not applicable.
- **Email templates**: Separate design concern, will reference brand colors and typography but not component patterns.

### Token Implementation

Design tokens are implemented in two companion files (owned by the token-impl teammate):

- `design-references/tokens.css` — CSS custom properties for all tokens above
- `design-references/tokens.ts` — TypeScript constants mirroring CSS tokens for use in component logic

These files are the single source of truth for token *values*. This document (`DESIGN.md`) is the single source of truth for token *semantics and usage*.
