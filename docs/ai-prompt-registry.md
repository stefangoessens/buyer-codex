# AI Prompt Registry

`KIN-939` introduces a shared prompt catalog plus Convex-backed prompt metadata for the AI runtime.

## What is stored

- Every engine prompt has a stable `promptKey` and content-derived `version`.
- Prompt metadata is persisted in `promptRegistry` with `engineType`, `promptKey`, `version`, `model`, `author`, `createdAt`, `changeNotes`, and `isActive`.
- AI engine outputs persist the `promptVersion`, optional `promptKey`, and an `inputSnapshot` so historical runs can be replayed.

## Runtime rules

- Engine actions must be called with an explicit `promptVersion`; they do not resolve an implicit latest prompt.
- Copilot resolves a concrete prompt version before calling the gateway and stores that version on the emitted copilot message.
- `promptRegistry.syncCatalogPrompts` / `ensureCatalogPrompts` seed the Convex table from the shared catalog in `packages/shared/src/prompt-registry.ts`.

## Replay support

- `convex/promptReplay.ts` replays historical `pricing`, `comps`, `leverage`, `offer`, and `cost` runs from stored `inputSnapshot` payloads.
- `src/lib/ai/promptReplay.ts` compares the historical output snapshot with the replayed snapshot so regressions and rollbacks are explicit.

## Console surface

- The internal settings page shows active prompt versions per engine plus recent version history.
- That page seeds the catalog automatically for broker/admin users if the registry is empty.
