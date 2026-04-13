# shadcn preset b2D0wqNxS

Role in hierarchy: authenticated app card density and component surface reference.

## Important Caveat

The current preset preview URL does not expose the full left-nav dashboard shell described in `KIN-946`. What it does expose is a dense component lab with stable app-card, chart, form, and button patterns. Use it for app surface styling, not for nav shell geometry.

## What Was Captured

- Full preset preview
- Card surfaces and button treatment
- Analytics/chart cards
- Mobile stacked layout

## Key Observations

- Font family is `Geist`.
- Primary action button uses a strong indigo tone with pale foreground text.
- Cards are white, heavily rounded (`26px`), ringed, and use a medium app shadow.
- Interior spacing is usually `16-24px`.
- The preview confirms a strong card language for dashboards, but not a canonical sidebar frame.

## Adopt

- Card radius and border-ring treatment
- Quiet analytics cards and chart framing
- Dense-but-readable form grouping
- Pill buttons for app surfaces

## Hold

- Sidebar shell geometry
- Search-grid composition
- Top CTA rail inside the authenticated shell

Those are still provisional until the correct preset view is visible.

## Screenshot Set

- `screenshots/pass-1-desktop-preview-full.png`
- `screenshots/pass-2-desktop-card-surface.png`
- `screenshots/pass-2-desktop-analytics-cards.png`
- `screenshots/pass-3-mobile-preview-full.png`
- `screenshots/pass-3-mobile-stack.png`
