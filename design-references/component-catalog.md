# Component Catalog

Harvested component patterns for buyer-codex. This file is the handoff surface for `KIN-945`.

## Shipping Components

| Component | Source winner | Influences | Screenshot refs | Notes |
| --- | --- | --- | --- | --- |
| `EstimatorHero` | Hosman structure + PayFit tone | Homepage, intake, calculator entry | `hosman/screenshots/pass-2-desktop-hero-estimator.png`, `hosman/screenshots/pass-3-mobile-hero-clean.png` | One field, one CTA, one friction-reducer row. Keep the entry experience direct. |
| `ProofStrip` | Hosman | Homepage, pricing, calculator | `hosman/screenshots/pass-1-desktop-home-full.png` | Stats immediately below the hero. Numbers first, explanation second. |
| `PropertyRailCard` | Hosman | Homepage proof, buyer dashboard, deal room lists | `hosman/screenshots/pass-2-desktop-property-grid.png` | Rounded 24px cards, image-first, compact metadata, agent avatar for human trust. |
| `ThreeStepJourney` | Hosman | Homepage, pricing explainer, deal room overview | `hosman/screenshots/pass-2-desktop-conversion-flow.png` | Three deliberate steps with numbered chips and repeated CTA. |
| `HighTrustCTA` | PayFit visual tone | Marketing and app CTAs | `payfit/screenshots/pass-2-desktop-hero.png`, `payfit/screenshots/pass-3-mobile-hero.png` | Filled primary button plus quieter secondary action. Keep copy short. |
| `TestimonialRail` | PayFit/Hosman | Homepage, pricing, trust sections | `payfit/screenshots/pass-2-desktop-testimonials-footer.png`, `hosman/screenshots/pass-1-desktop-home-full.png` | Use after proof sections, before final CTA. |
| `FAQClose` | PayFit | Homepage close, pricing close | `payfit/screenshots/pass-2-desktop-testimonials-footer.png` | Dense FAQ followed by a compact final CTA block. |
| `AppCard` | shadcn preset | Dashboard, deal room, admin | `shadcn-b2D0wqNxS/screenshots/pass-2-desktop-card-surface.png` | White card, `26px` radius, thin ring, medium shadow, 16-24px padding. |
| `AnalyticsCard` | shadcn preset | Dashboard, admin, internal console | `shadcn-b2D0wqNxS/screenshots/pass-2-desktop-analytics-cards.png` | Quiet labels, one dominant metric, muted chart frame. |
| `DenseFormCard` | shadcn preset | Settings, profile, deal-room forms | `shadcn-b2D0wqNxS/screenshots/pass-1-desktop-preview-full.png` | Form fields grouped in a single raised surface, not scattered across the page. |

## Provisional Components

| Component | Current fallback | Why provisional | Unblock condition |
| --- | --- | --- | --- |
| `ScoreBadge` | shadcn metric chip + Hosman DPE chip | RealAdvisor score/ranking UI could not be harvested | Remove Cloudflare blocker and recapture RealAdvisor |
| `SideNavShell` | shadcn card density only | Current `b2D0wqNxS` preview URL did not expose the left-nav shell described in `KIN-946` | Find the shell route or an alternate preset view that shows the full authenticated layout |
| `SearchGridShell` | Hosman property rail + shadcn cards | RealAdvisor and the expected shadcn shell view are both incomplete | Same as above |

## Rejected Patterns

- PayFit's news ticker/navigation promos: too noisy for a trust-first brokerage product.
- Hosman's oversized footer taxonomy: too much information scent for buyer-codex.
- Literal reuse of the shadcn demo content: the preset is a surface-language reference, not a content model.
