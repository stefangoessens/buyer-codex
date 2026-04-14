# Design References

Reference materials for the buyer-codex design system.

Canonical implementation now lives in `packages/shared/src/theme.ts`.
Run `pnpm tokens:sync` after token edits to regenerate:

- `design-references/tokens.css`
- `ios/BuyerCodex/Sources/Design/BrandTheme.swift`

## Files

- `tokens.css` — generated CSS custom properties for web theme consumption
- `tokens.ts` — TypeScript re-export of the canonical shared token contract
- `token-candidates.json` — machine-readable token candidate snapshot from the reference harvest
- `component-catalog.md` — Harvested component patterns with usage notes
- `component-library.md` — Shared library slot rules, usage examples, and code-backed consumers
- `shadcn-b2D0wqNxS/dashboard-shell-contract.md` — Explicit buyer dashboard shell contract, reference captures, and annotated zone maps
- `kin-1046/deal-room-advisory-ia-contract.md` — Explicit deal-room advisory IA, inline-vs-drill-down rules, and cut line for future advisory surfaces
- `kin-1050/mobile-ios-decisioning-scope.md` — Explicit v1.1 responsive-web and native-iOS scope contract for decision memo, recommendation, trust, and defer rules
- `kin-1049/advisory-usability-comprehension-test-plan.md` — Moderator-ready comprehension test plan for the shipped advisory overview, source trace, summary, and broker review surfaces

## Capture Packs

- `payfit/README.md` + `payfit/pass-log.md` — multi-pass aesthetic capture pack and screenshot inventory
- `hosman/README.md` + `hosman/pass-log.md` — multi-pass structural capture pack and screenshot inventory
- `shadcn-b2D0wqNxS/README.md` + `shadcn-b2D0wqNxS/pass-log.md` — live preset preview capture pack for card, form, and analytics surfaces
- `realadvisor/README.md` + `realadvisor/pass-log.md` — supplementary deferred evidence only; retained to document the persistent Cloudflare challenge and avoid re-running blind attempts

## Reference Sites

- [PayFit](https://payfit.com/) — Primary aesthetic (color, type, spacing, motion)
- [Hosman](https://www.hosman.co/) — Primary structure (page architecture, conversion flows)
- [RealAdvisor](https://realadvisor.ch/en/find-agent) — Supplementary only; deferred after repeated Cloudflare challenge
- [shadcn preset b2D0wqNxS](https://ui.shadcn.com/create?item=preview&preset=b2D0wqNxS) — Authenticated shell scaffold, left-rail rhythm, and dashboard card density reference

## North Star

> PayFit aesthetic in Hosman structural form.

See DESIGN.md for full design system documentation.
