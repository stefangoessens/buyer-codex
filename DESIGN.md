# buyer-codex Design Direction

Status recorded for `KIN-946` on 2026-04-13.

This branch contains the durable capture pack for the buyer-codex design system harvest. It is usable for downstream token and component work, but `KIN-946` is not complete yet because the RealAdvisor reference remains blocked by Cloudflare in Chrome DevTools and direct HTTP fetches.

## 1. Current Status

| Reference | Status | Outcome |
| --- | --- | --- |
| PayFit | Captured | Aesthetic winner: typography tone, CTA polish, testimonial/FAQ close, motion restraint |
| Hosman | Captured | Structural winner: hero estimator, proof strip, property rail, three-step conversion flow |
| shadcn preset `b2D0wqNxS` | Captured with caveat | Card radius, dashboard card density, chart/form surfaces harvested; current preview URL does not expose the left-nav shell described in KIN-946 |
| RealAdvisor | Blocked | Cloudflare challenge blocks Chrome DevTools and raw HTTP; score-badge/search-density decisions remain provisional |

## 2. Winner Hierarchy

1. Aesthetic: PayFit first.
2. Structure and conversion flow: Hosman first.
3. Authenticated app card density and control surfaces: shadcn preset `b2D0wqNxS` first.
4. RealAdvisor only fills gaps once the blocker is removed.

## 3. Surface Decisions

| Surface | Structural winner | Visual winner | Notes |
| --- | --- | --- | --- |
| Homepage | Hosman | PayFit | Use Hosman hero + estimator + proof ordering, but with PayFit-style restrained typography, quieter motion, and cleaner CTA chrome |
| Pricing | Hosman | PayFit | Keep pricing/tariff explanation embedded in narrative sections instead of a noisy comparison table |
| Calculator | Hosman | PayFit | Start from Hosman's inline estimator pattern, then restyle controls and result cards with PayFit/shadcn card treatment |
| Intake entry | Hosman | PayFit | Treat intake like the homepage hero continuation, not a disconnected tool |
| Deal room | Hosman layout logic + shadcn card density | PayFit | Use denser app cards and charts from shadcn, but keep public-site trust tone |
| Buyer dashboard | shadcn card/form density | PayFit | Card system is ready; full side-nav shell remains provisional because the current preset preview did not expose it |
| Internal console | shadcn | PayFit-muted | Reuse the same tokens and cards, but lower the marketing intensity and keep the content density high |

## 4. Adopted Patterns

### PayFit

Adopt:

- Large, semibold display headings with tight line height and no playful flourish.
- White-first surfaces with deep ink text and one decisive blue action color.
- CTA pairs: filled primary plus quiet secondary/outline.
- Trust-heavy close: testimonial rail -> FAQ -> compact final CTA.
- Motion that confirms state change without decorative animation.

Reject:

- News ticker bars above navigation.
- Long marketing modules that read like feature catalogs rather than guided conversion.
- HR/payroll-specific iconography and domain-specific stats.

### Hosman

Adopt:

- Hero with a single estimator input and immediate CTA.
- Proof strip directly below the hero.
- Property card rail after proof, before deeper explanation.
- Three-step conversion story with numbered progression.
- Repeated "estimate now" CTAs after major proof sections.

Reject:

- Footer taxonomy that is too deep for buyer-codex.
- FAQ copy that is too long-form and repetitive.
- Multiple near-duplicate CTA phrasings in the same section.

### shadcn preset `b2D0wqNxS`

Adopt:

- Rounded app-card surfaces (`26px`), thin ring borders, and mid-elevation shadow.
- Quiet analytics cards with 16-24px interior spacing.
- Pill-like action buttons for app surfaces.
- Simple chart framing and muted field chrome.

Reject or hold:

- Do not assume the current preview is the final dashboard shell. The current URL behaves like a mixed component lab, not a canonical left-nav dashboard.
- Do not copy the preset's literal sample content or marketing copy.

### RealAdvisor

Hold:

- Score badge, ranking chip, and search-density decisions stay provisional until the blocker is removed.
- For now, use Hosman's property rail and shadcn's compact metric treatment as the temporary fallback.

## 5. Implementation Directives For Downstream Issues

### KIN-944 token work

- Start from `design-references/token-candidates.json`.
- Mirror the adopted section into code, not the raw source dumps.
- Keep color values provisional where RealAdvisor would normally settle a scoring state or ranking color.

### KIN-945 component work

- Start from `design-references/core-primitives.md` and `design-references/component-catalog.md`.
- Build public primitives first: `EstimatorHero`, `ProofStrip`, `PropertyRailCard`, `ThreeStepJourney`, `HighTrustCTA`, `TestimonialRail`, `FAQClose`.
- Build app primitives second: `AppCard`, `AnalyticsCard`, `DenseFormCard`, `SideNavShell` (provisional), `ScoreBadge` (provisional).

## 6. Blocker

`KIN-946` stays in progress because RealAdvisor cannot be harvested through the required Chrome DevTools workflow:

- `https://realadvisor.ch/en`
- `https://realadvisor.ch/en/find-agent`

Both routes return Cloudflare verification pages in DevTools, and raw `curl -L -A 'Mozilla/5.0'` requests return `HTTP/2 403` with `cf-mitigated: challenge`.

See:

- `design-references/realadvisor/README.md`
- `design-references/realadvisor/pass-log.md`
- `design-references/realadvisor/screenshots/pass-1-cloudflare-blocker.png`
- `design-references/realadvisor/screenshots/pass-1-find-agent-cloudflare-blocker.png`
