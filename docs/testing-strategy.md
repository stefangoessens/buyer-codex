# Testing Strategy

`buyer-codex` uses different tools per surface, but every gate is expected to run against deterministic fixtures or hermetic mocks in CI.

## Surface map

| Surface | Tooling | Source of truth | CI gate |
| --- | --- | --- | --- |
| Web app + shared TS logic | Vitest | `src/__tests__/**`, `src/test/**` | `Web quality` |
| Convex backend contracts | TypeScript typecheck + web-side contract tests | `convex/**`, contract tests under `src/__tests__/**` | `Convex quality` |
| AI eval harness | Vitest + `scripts/ai-eval.ts` | `src/lib/ai/eval/**`, `src/__tests__/lib/ai/**` | `AI eval harness` |
| Web smoke journeys | Playwright | `src/test/e2e/**` | `Web smoke e2e` |
| Python worker library | pytest | `python-workers/tests/**` | `Worker quality` |
| Extraction service | pytest | `services/extraction/tests/**` | `Worker quality` |
| iOS app | XCTest / Swift Testing | `ios/BuyerCodex/Tests/**` | `iOS quality` |

## Commands

```bash
pnpm test:coverage
pnpm test:e2e
pnpm eval pricing latest
pnpm workers:lib:test
pnpm workers:service:test
pnpm ios:test
```

## Coverage and quality thresholds

- Web: Vitest coverage thresholds are enforced at `50/50/50/50` for `statements/branches/functions/lines`.
- Python workers: parser inventory and extractor correctness are fixture-backed and CI-blocking. Numeric coverage thresholds are documented here but not yet CI-enforced.
- Convex: contract safety currently rides on typecheck plus web-side consumer tests until direct Convex runtime integration tests land.
- iOS: correctness is enforced through XCTest/Swift Testing suites rather than numeric coverage gates.
- AI: the pricing seed fixture must pass both unit tests and `pnpm eval pricing latest`.

## Parser fixture contract

The parser corpus lives under `python-workers/fixtures/` and is organized around a shared manifest:

- `python-workers/fixtures/parser_cases.json` is the canonical inventory of portal fixtures and normalized expectations.
- `python-workers/fixtures/parser_cases.py` is the Python helper consumed by pytest parser suites.
- `src/test/parser-fixtures.ts` is the TypeScript helper consumed by web-side parser contract tests.

Each portal keeps five canonical cases:

- one JSON-LD-backed detail page
- one portal-specific structured payload page (`apollo`, `redux`, or `nextData`)
- one HTML fallback page
- one additional realistic variant to keep the extractor from overfitting
- one new-construction or edge-shape variant

`python-workers/tests/test_parser_fixture_inventory.py` is the guardrail that keeps the manifest, file tree, and fallback-path coverage aligned.

## Playwright scope

The PR-blocking Playwright suite is intentionally narrow and stable:

- homepage hero render
- intake landing route
- get-started marketing route
- admin preview shell
- deal room placeholder route

As downstream feature issues land the real paste -> teaser -> register -> deal-room journey, extend this smoke suite by replacing placeholder assertions with those live flows rather than adding duplicate exploratory specs.
