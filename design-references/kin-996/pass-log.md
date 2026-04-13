# KIN-996 Parity Pass Log

## Scope

Surfaces reviewed against captured references:

- Homepage
- Intake entry
- Buyer dashboard shell
- Deal room shell
- Shared primitives

Primary direction for the authenticated shell and primitives stayed anchored to the shadcn preset `b2D0wqNxS`: simple, white, spacious, restrained.

## Reference Evidence

Homepage and intake references:

- `design-references/payfit/screenshots/pass-2-desktop-hero.png`
- `design-references/hosman/screenshots/pass-2-desktop-hero-estimator.png`
- `design-references/hosman/screenshots/pass-2-desktop-property-grid.png`
- `design-references/hosman/screenshots/pass-2-desktop-conversion-flow.png`

Dashboard, deal room, and shared primitive references:

- `design-references/shadcn-b2D0wqNxS/screenshots/preset-desktop-reference.png`
- `design-references/shadcn-b2D0wqNxS/screenshots/pass-2-desktop-card-surface.png`
- `design-references/shadcn-b2D0wqNxS/screenshots/pass-2-desktop-analytics-cards.png`

Final local evidence set:

- `design-references/kin-996/screenshots/loop-4-homepage-local.png`
- `design-references/kin-996/screenshots/loop-4-intake-local.png`
- `design-references/kin-996/screenshots/loop-4-dashboard-local.png`
- `design-references/kin-996/screenshots/loop-4-dealroom-local.png`
- `design-references/kin-996/screenshots/loop-4-primitives-local.png`

Earlier loop evidence retained for comparison:

- `design-references/kin-996/screenshots/loop-1-*.png`
- `design-references/kin-996/screenshots/loop-2-*.png`
- `design-references/kin-996/screenshots/loop-3-*.png`
- `design-references/kin-996/screenshots/loop-3-primitives-local-focus.png`

## Loop 1

Observed deltas:

- Intake entry failed the forwarded-listing handoff and fell back to the empty-state copy even when a URL query string was present.
- Dashboard and deal room previews were blocked locally when Convex was not configured, so parity review could not proceed on the intended surfaces.
- Shared primitives still read as a mixed visual language rather than a coherent white-shell system.
- Buyer-app shell and deal-room shell were not yet aligned enough to compare as one product family.

Patches:

- Split intake rendering so the route metadata stays server-side and the actual query-string handoff reads from a client component.
- Added preview-data fallbacks for dashboard and deal room surfaces when `NEXT_PUBLIC_CONVEX_URL` is absent.
- Reused the shared authenticated shell for deal-room routes.
- Started the first primitive alignment pass across CTA, KPI, property-card, badge, and button surfaces.

## Loop 2

Observed deltas:

- Surfaces were functional but still visually heavier than the references.
- Shell chrome used more tint and more decorative energy than the preset family.
- Dashboard and deal room were aligned structurally but still needed calmer card treatment.

Patches:

- Simplified shell framing and unified the buyer-app and deal-room chrome.
- Reduced ornamental treatment across cards and KPI tiles.
- Tightened component reuse so the homepage, dashboard, and design-system showcase were pulling from the same primitive family.

## Loop 3

Observed deltas:

- The overall system was close, but some panels still carried too much blue tint and too much shadow relative to `b2D0wqNxS`.
- The dashboard preview still had extra context chrome that made the surface busier than the reference.

Patches:

- Removed the extra preview context card from the preview-path dashboard.
- Simplified the sidebar rail and brought more cards back to plain white.
- Reduced gradient usage and moved the shells into a calmer neutral background.
- Preserved the darker property-context hero in the deal room while simplifying the surrounding shell.

## Loop 4

Trigger:

- Final user direction explicitly asked to stay close to shadcn preset `b2D0wqNxS`, especially for dashboard and shared component quality.

Observed deltas:

- Remaining gap was mostly chrome weight, not information architecture.
- Shadows and blue tint were still slightly heavier than the preset family in the dashboard, intake entry, and shared CTA/card surfaces.

Patches:

- Softened shadows on the sidebar, CTA card, KPI cards, property cards, and deal-room support cards.
- Flattened the intake hero and auth-disabled cards to plain white surfaces with lighter borders.
- Reduced mobile nav emphasis and removed the last tinted active-state treatment from the compact drawer nav.
- Softened button elevation to keep the preset’s cleaner, flatter feel.

Result:

- Dashboard shell now reads as white, spacious, and quiet, with the rail acting as orientation rather than decoration.
- Deal room keeps its darker property hero for context, but the surrounding system now stays within the same restrained white-shell family.
- Shared primitives are close to the preset language and now feel consistent across marketing and authenticated surfaces.

## Intentional Deviations

- Intake entry still shows auth-disabled messaging in local preview because authentication is not configured in this environment.
- Dashboard and deal room use static preview data locally when Convex is not configured so parity review can proceed without runtime failure.
- Deal room keeps a darker property-context hero than the shadcn preset because the property photo and buyer-safe-case framing need stronger focus than the neutral dashboard shell.
- Homepage keeps the existing public-information architecture from the earlier implementation pass; parity work here focused on the shared primitives and CTA shell rather than replacing the page structure with the dashboard preset.

## Verification

Commands:

- `git diff --check`
- `pnpm typecheck`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_PORT=3001 pnpm test:e2e src/test/e2e/app-smoke.spec.ts`

Browser verification:

- Chrome DevTools MCP screenshots captured for each major local surface.
- Dashboard console warnings/errors: none.
- Deal room console warnings/errors: none.

Outcome:

- Required parity loops completed with final loop-4 evidence added after the last restraint pass.
- The remaining differences from the references are deliberate and documented above.
