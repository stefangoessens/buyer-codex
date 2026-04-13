# Design References

Reference materials for the buyer-codex design system.

Canonical implementation now lives in `packages/shared/src/theme.ts`.
Run `pnpm tokens:sync` after token edits to regenerate:

- `design-references/tokens.css`
- `ios/BuyerCodex/Sources/Design/BrandTheme.swift`

## Files

- `tokens.css` — generated CSS custom properties for web theme consumption
- `tokens.ts` — TypeScript re-export of the canonical shared token contract
- `component-catalog.md` — Harvested component patterns with usage notes

## Reference Sites

- [PayFit](https://payfit.com/) — Primary aesthetic (color, type, spacing, motion)
- [Hosman](https://www.hosman.co/) — Primary structure (page architecture, conversion flows)
- [RealAdvisor](https://realadvisor.ch/en/find-agent) — Supplementary (data viz, scores)

## North Star

> PayFit aesthetic in Hosman structural form.

See DESIGN.md for full design system documentation.
