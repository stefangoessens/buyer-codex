# Analytics Event Catalog — Governance

The comprehensive analytics catalog now lives in `@buyer-codex/shared/analytics-events`.

That shared module is the source of truth for:

- the full cross-surface event map
- the serializable contract snapshot
- per-event owner, source, when-fired rule, semantics, and PII posture
- dashboard, deal-room, document, tour, offer, closing, communication, agent-ops, engagement, and system surfaces

Launch-critical events remain defined in `@buyer-codex/shared/launch-events` and are inherited into the broader analytics contract so KIN-771 and KIN-911 stay aligned.

## Contract fields

Each event definition in `ANALYTICS_EVENT_CONTRACT` includes:

- `name`: canonical snake_case event name
- `category`: reporting surface bucket
- `props`: typed payload schema
- `owner`: team or guild responsible for semantics
- `source`: emitting surface or service, for example `web.dashboard.home` or `backend.offer_pipeline`
- `whenFired`: exact trigger rule
- `semantics`: what business fact the event represents
- `piiSafe`: whether free-form payload scrubbing must run before dispatch

## Usage examples

Client-side:

```ts
import { track } from "@/lib/analytics";

track("dashboard_viewed", {
  role: "buyer",
  activeDealCount: 3,
  pendingTaskCount: 2,
});
```

Server-side:

```ts
import { trackServerEvent } from "@/lib/analytics.server";

await trackServerEvent("document_parsed", {
  documentId: "doc_123",
  parser: "contract-v1",
  durationMs: 842,
});
```

Both helpers preserve the event payload contract and add transport metadata via `analytics_transport` instead of overwriting domain-level payload fields such as `source`.

## Adding or changing an event

1. If the event is launch-critical, update `@buyer-codex/shared/launch-events` first.
2. Update `@buyer-codex/shared/analytics-events` with the event shape and contract metadata.
3. Keep the event name in `snake_case` and use a past-tense `verb_noun` form unless it is a probe-style system event.
4. Add or update tests alongside the contract change.
5. Land the catalog update atomically with the instrumentation call site in the same PR.

## Governance

- The contract is reviewed in PRs; downstream web, backend, and iOS instrumentation should not invent parallel event names or payload shapes.
- `piiSafe: false` events are scrubbed before dispatch. Do not place direct email, phone, name, or address fields into event properties.
- Use the shared contract for planning and codegen instead of re-documenting event semantics ad hoc in individual features.
