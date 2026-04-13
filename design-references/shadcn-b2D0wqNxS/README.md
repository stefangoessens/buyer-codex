# shadcn preset b2D0wqNxS

Role in hierarchy: authenticated app card density and component surface reference.

## Capture Scope

This directory records the live multi-pass capture of the preset preview URL itself. The preview exposes a dense component lab with stable app-card, chart, form, and button patterns.

Exact buyer dashboard shell geometry is already documented separately in `dashboard-shell-contract.md`, which remains the source of truth for left-nav rhythm, header zoning, and authenticated page scaffolding.

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
- The preview confirms a strong card language for dashboards and internal tooling.

## Adopt

- Card radius and border-ring treatment
- Quiet analytics cards and chart framing
- Dense-but-readable form grouping
- Pill buttons for app surfaces

## Shell Boundary

- Use `dashboard-shell-contract.md` for sidebar shell geometry, header zoning, and dashboard-shell composition.
- Use this directory for the live preset preview evidence behind card density, form grouping, and analytics-surface choices.

## Screenshot Set

- `screenshots/pass-1-desktop-preview-full.png`
- `screenshots/pass-2-desktop-card-surface.png`
- `screenshots/pass-2-desktop-analytics-cards.png`
- `screenshots/pass-3-mobile-preview-full.png`
- `screenshots/pass-3-mobile-stack.png`
