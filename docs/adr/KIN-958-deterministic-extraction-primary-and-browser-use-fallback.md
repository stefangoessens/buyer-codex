# KIN-958 - Deterministic Extraction Primary Path and Browser Use Fallback Policy

Status: Accepted
Scope: web intake, extraction service, python workers, Convex enrichment jobs, operator recovery
Date: 2026-04-13

Update note (KIN-1019, 2026-04-13): deterministic extraction remains the
primary sync path, but Browser Use is now a first-class typed enrichment path
under explicit triggers (`parser_failure`, `low_confidence_parse`,
`missing_critical_fields`, `conflicting_portal_data`,
`operator_requested_deep_extract`). Bright Data access failures remain
access-layer concerns and do not silently trigger Browser Use.

## Decision Summary

buyer-codex supports a deterministic-primary ingestion model for listing imports.

- For `zillow`, `redfin`, and `realtor` URLs, the only supported primary ingestion path is deterministic extraction through the extraction service and deterministic portal parsers.
- Browser Use is not a peer primary extractor and must never run as a speculative first pass for supported portals.
- Browser Use is allowed only as a typed, operator-visible recovery lane implemented as `browser_use_fallback` under the enrichment job system.
- Browser Use may be queued only from one of three entrypoints:
  - automatic recovery after an explicit, mapped deterministic extraction failure on a supported portal
  - admin/operator manual override for a specific property and source URL
  - internal-only ops automation recovering a known unsupported portal import
- Browser Use must not be used for normal supported-portal imports, silent expansion of public portal support, routine refreshes, or broad enrichment fan-out.

This ADR is the implementation contract for KIN-975. Any change to the supported portal set, fallback eligibility, retry budget, or evidence requirements must update this ADR first.

## Context

The repo already contains the technical pieces of this architecture, but until now it did not contain the policy artifact that binds them together.

Current repo state:

- `services/extraction/src/contracts.py` defines the extraction service contract for `zillow`, `redfin`, and `realtor`, with synchronous `POST /extract` and typed fetch metadata.
- `services/extraction/src/runtime.py` resolves the portal, fetches HTML through the Bright Data unlocker/orchestrator, dispatches to a deterministic extractor, and emits structured error codes such as `fetch_anti_bot`, `fetch_vendor_error`, `schema_shift`, and `unsupported_portal`.
- `python-workers/parsers/zillow.py`, `python-workers/parsers/redfin.py`, and `python-workers/parsers/realtor.py` implement deterministic extractors for all three supported portals.
- `src/lib/intake/zillowExtractor.ts` and `src/lib/intake/redfinExtractor.ts` show the same product preference on the TypeScript side: deterministic parser versioning, required-field checks, explicit partial-vs-complete review state, and no LLM extraction.
- `src/lib/enrichment/types.ts`, `src/lib/enrichment/fallback.ts`, `src/lib/enrichment/errors.ts`, `src/lib/enrichment/jobContext.ts`, `src/lib/enrichment/scheduler.ts`, and `src/lib/ai/engines/enrichmentWorker.ts` already define a typed Browser Use fallback contract, retry budget, dedupe rules, and worker handoff.
- `convex/enrichmentJobs.ts`, `convex/schema.ts`, and `convex/enrichment.ts` already register `browser_use_fallback` as an enrichment source with queueing, status, audit log, and property-level job summary surfaces.

The missing artifact was the explicit decision record that says which of those paths is canonical, which are exception paths, and exactly when fallback is allowed.

## Primary Ingestion Contract

### Supported portals

Supported public listing portals are:

- `zillow`
- `redfin`
- `realtor`

The supported-portal contract is anchored at the extraction service boundary, not at ad hoc client-side parsing helpers.

For supported portals:

1. Detect the portal deterministically from the URL.
2. Call `POST /extract` on the extraction service.
3. Use the deterministic extractor result as the canonical primary listing payload.
4. Enqueue normal enrichment sources after primary extraction succeeds.

Primary extraction must stay deterministic, typed, and reviewable:

- deterministic parser versioning is part of the contract
- required-field checks are part of the contract
- upstream fetch metadata (`request_id`, `vendor`, `latency_ms`, `cost_usd`, `attempts`) is part of the contract
- Browser Use does not participate in this synchronous request path

### What counts as primary success

A supported-portal intake counts as primary success when deterministic extraction returns a canonical property payload with the required listing identity and price/address fields for that portal.

Important distinction:

- Missing optional fields or a partial completeness state are not fallback triggers by themselves.
- A deterministic result that is partial but valid should continue through the normal enrichment path.
- Browser Use is reserved for primary-path failure, not for optional-field polishing.

### Explicitly disallowed primary-path behavior

The following are not allowed:

- running Browser Use in parallel with deterministic extraction "just in case"
- using Browser Use to improve p95/p99 latency on supported portals
- treating Browser Use output as the first canonical payload for a supported portal
- using Browser Use as a hidden fourth supported portal parser for the public product
- bypassing typed merge/provenance paths and writing Browser Use output into ad hoc state

## Allowed Browser Use Entry Points

Browser Use fallback is allowed only in these cases:

1. `Automatic supported-portal recovery`
   Deterministic extraction for `zillow`, `redfin`, or `realtor` failed with a mapped failure category listed in the escalation matrix below.

2. `Manual operator override`
   An internal admin/operator flow explicitly requests Browser Use for one property and one source URL. This is encoded as `manual_override` and must carry an operator note.

3. `Internal unsupported-portal recovery`
   A support or ops automation is attempting recovery for an already-known unsupported portal. This is internal-only. It does not change the supported public portal set.

Everything else is disallowed.

In particular, Browser Use is not allowed for:

- scheduled refreshes
- routine enrichment of already-healthy properties
- bulk crawling or discovery
- comps collection, agent profile collection, or estimate fan-out unrelated to a failed primary extract
- masking an `unknown` failure without operator review

## Escalation Matrix

Normalization rule:

- When the extraction service returns a structured `error.code`, orchestration must normalize from that service code first.
- Raw HTTP status is only a fallback heuristic when no structured service code exists.
- KIN-975 must not reduce all `429` cases to one meaning. `fetch_quota_exceeded` is vendor exhaustion, not portal anti-bot.

Canonical escalation table:

| Deterministic outcome | Example service/runtime signals | Normalized failure category | Browser Use allowed | Fallback reason | Required next step |
| --- | --- | --- | --- | --- | --- |
| Parser/schema drift on supported portal | `schema_shift`, `parse_failed`, `malformed_html`, required canonical fields missing after deterministic parse | `parse_error` | Yes | `parser_schema_drift` | Enqueue `browser_use_fallback`; keep property in explicit pending/recovery state |
| Portal anti-bot or challenge page | `fetch_anti_bot`, portal-side 401/403, captcha/challenge page, challenge-shaped 429 | `rate_limited` or `unauthorized` | Yes | `anti_bot_block` | Enqueue fallback; preserve original failure metadata for ops |
| Vendor or transport unavailable | `fetch_vendor_error`, `fetch_failed`, `fetch_timeout`, transport reset, network failure, `fetch_quota_exceeded` | `network_error` or `timeout` | Yes | `vendor_unavailable` | Enqueue fallback; track vendor outage/cost impact |
| Unsupported portal in public intake | URL host outside supported set | n/a | No public auto-fallback | n/a | Return deterministic unsupported response |
| Unsupported portal in internal recovery flow | internal mutation/ops automation sets `unsupportedPortal=true` and `portal=\"unknown\"` | special internal recovery path | Yes, internal only | `unsupported_portal` | Enqueue fallback as recovery-only job; do not claim product support expanded |
| Listing not found / genuinely gone | normalized `not_found` | `not_found` | No | n/a | Fail deterministically and route to manual triage |
| Unknown or unmapped failure | normalized `unknown`, unexpected internal error, ambiguous transport/parser state | `unknown` | No auto-fallback | n/a | Fail deterministically and require operator review |
| Manual admin/operator run | internal admin flow sets `manualOverride=true` | override path | Yes | `manual_override` | Enqueue fallback with operator note even if the original error was not fallback-eligible |

Additional rules:

- Manual override does not bypass the fallback attempt cap.
- Unsupported-portal recovery is internal only. Public intake must still report the URL as unsupported.
- `not_found` and `unknown` must never auto-enqueue Browser Use.
- Optional-field incompleteness alone must never auto-enqueue Browser Use.

## Retry, Queueing, and State Rules

### Deterministic path

The deterministic extraction request budget is the extraction service contract:

- `timeout_s` default: `30.0`
- `retries` default: `3`
- fetch retry behavior belongs to the deterministic fetch/orchestrator path, not to Browser Use

The user-facing intake request may wait for deterministic extraction. It must not wait for Browser Use.

### Browser Use fallback path

Browser Use fallback is asynchronous and job-backed:

- source name: `browser_use_fallback`
- queue priority: `5`
- max attempts: `2`
- cache/dedupe TTL: `1 hour`
- dedupe shape: `(propertyId, sourceUrl hash, priorAttempts, hourBucket)`

Behavioral rules:

- enqueue only through the explicit fallback mutation or an equivalent typed orchestration call
- never enqueue from the general `enqueueAllSourcesForProperty` refresh lane
- never auto-refresh a prior Browser Use success
- after `2` attempts, stop automatic recovery and escalate to manual ops
- keep job lifecycle explicit: `pending`, `running`, `succeeded`, `failed`, or `skipped`

This is already consistent with the queue design in `src/lib/enrichment/types.ts`, `src/lib/enrichment/fallback.ts`, `src/lib/enrichment/scheduler.ts`, and `convex/enrichmentJobs.ts`.

### Required explicit states

KIN-975 must keep these states explicit for the property/operator surface:

- `primary_extraction_running`
- `primary_extraction_failed`
- `browser_use_fallback_pending`
- `browser_use_fallback_running`
- `browser_use_fallback_failed`
- `browser_use_fallback_max_attempts_exceeded`
- `manual_review_required`
- `unsupported_portal`

The product must never collapse these into a generic "failed" bucket that hides whether automatic recovery is still in progress.

## Latency Expectations

Latency policy is path-specific:

- Deterministic extraction is the only synchronous listing-import path.
- Browser Use fallback is always asynchronous recovery.
- A supported-portal import should resolve or fail within the deterministic extraction budget rather than turning the request into a long-lived browser-agent session.
- When fallback is eligible, the request path should finish quickly with a clear recovery state and enqueue the job rather than waiting for Browser Use completion.

Operational expectation:

- Use deterministic extraction for fast-path product UX.
- Use Browser Use only to recover failed cases without making the default path slower or less predictable.

## Cost Expectations

Cost policy is also path-specific:

- Deterministic extraction is the baseline paid path. Per-request cost already exists in `fetch.cost_usd`, and aggregate vendor usage exists at `GET /metrics/fetch`.
- Browser Use is the exception-cost path. It is explicitly more expensive and less stable than deterministic extraction and must remain rare.
- Vendor budget exhaustion or vendor outage is a recovery condition, not a reason to redefine Browser Use as a primary path.
- Unsupported-portal Browser Use runs are ops costs, not proof that the portal is now a supported product surface.

Cost control rules:

- no speculative Browser Use runs
- no scheduled Browser Use refreshes
- no broad fan-out from one failure into multiple Browser Use jobs
- every manual Browser Use run must be attributable to an operator or internal automation context

## Observability and Operator Visibility

### Deterministic path observability

The extraction service already exposes the minimum required deterministic-path telemetry:

- `GET /health`
- `GET /metrics/fetch`
- `x-request-id` on responses
- structured request logs
- optional Sentry capture for unhandled request errors

KIN-975 must preserve, attach, or surface the following deterministic failure context when a fallback is queued:

- `request_id`
- `vendor`
- `portal`
- `url`
- `latency_ms`
- `attempts`
- `cost_usd` when available
- original structured service `error.code`
- original message and retryability signal

### Fallback job observability

Every Browser Use fallback job must be operator-visible with at least:

- property id
- source URL
- portal
- fallback reason
- originating normalized error code
- originating service error code when available
- operator note for manual override flows
- attempt and maxAttempts
- dedupe key
- requested/started/completed timestamps
- terminal status
- error code/message on failure

The existing queue/audit surfaces already support most of this:

- `convex/schema.ts` stores status, attempts, priority, `dedupeKey`, `resultRef`, and `contextJson`
- `convex/enrichmentJobs.ts` records `browser_use_fallback_enqueued` audit events and stores fallback context in `contextJson`
- `convex/enrichment.ts` exposes property-level job summaries

### Evidence requirement

Browser Use success is not complete unless the result is reviewable.

Required success artifacts:

- citation
- evidence URLs for screenshots, HTML, or JSON capture
- canonical field payload returned by Browser Use
- linkage back to the originating property and source URL

`BrowserUseFallbackResult` already defines this contract in `src/lib/enrichment/types.ts`.

Implementation requirement for KIN-975:

- The fallback lane must persist or link those evidence artifacts in an operator-visible surface.
- It is not sufficient to mark the job `succeeded` while discarding the evidence payload.
- Because `convex/enrichmentJobs.ts` currently leaves `resultRef` undefined for `browser_use_fallback`, KIN-975 must add or reuse a durable artifact link before the fallback lane can be considered complete.

## Merge and Canonical Data Rules

Browser Use output must re-enter the canonical property system through the same typed merge/provenance path as deterministic extraction.

Rules:

- use `BrowserUseFallbackResult.canonicalFields` as the handoff payload
- preserve provenance that the result came from Browser Use fallback after deterministic failure
- do not invent a second canonical property schema for Browser Use
- do not bypass existing property merge, enrichment, or audit boundaries

Browser Use is a recovery mechanism for canonical data ingestion, not a side channel.

## Implementation Rules For KIN-975

KIN-975 should implement against the following concrete rules:

1. Normalize extraction-service failures from structured `error.code` first, and only use raw HTTP status as a fallback heuristic.
2. Map `fetch_quota_exceeded` to the vendor-unavailable bucket, not the anti-bot bucket.
3. Auto-enqueue Browser Use only for `parser_schema_drift`, `anti_bot_block`, and `vendor_unavailable` on supported portals.
4. Never auto-enqueue Browser Use for `not_found` or `unknown`.
5. Keep unsupported portals unsupported in the public product. Use `unsupported_portal` fallback only for internal recovery flows.
6. Keep manual override explicit, audited, and note-backed.
7. Respect the `2`-attempt cap even for manual override.
8. Preserve evidence and citations for successful Browser Use runs in an operator-visible surface.
9. Keep the fallback mapping identical across shared TypeScript helpers and Convex queue orchestration until the logic is centralized.
10. Do not change the supported portal matrix, retry budgets, or evidence requirements without updating this ADR.

## Evidence

Repo evidence for this ADR:

- `services/extraction/src/contracts.py` proves the extraction-service surface is typed and synchronous for `zillow`, `redfin`, and `realtor`.
- `services/extraction/src/runtime.py` proves the service already dispatches to deterministic portal extractors and emits structured fetch/parser failure codes.
- `services/extraction/src/main.py`, `services/extraction/README.md`, and `services/extraction/tests/test_main.py` prove the service already exposes request ids, metrics, and fetch metadata.
- `python-workers/parsers/zillow.py`, `python-workers/parsers/redfin.py`, and `python-workers/parsers/realtor.py` prove deterministic extractors already exist for all three supported portals.
- `src/lib/intake/zillowExtractor.ts` and `src/lib/intake/redfinExtractor.ts` prove the product already prefers deterministic parser versions, required-field gates, and explicit partial review state over opaque extraction.
- `src/lib/enrichment/types.ts`, `src/lib/enrichment/fallback.ts`, `src/lib/enrichment/errors.ts`, `src/lib/enrichment/jobContext.ts`, `src/lib/enrichment/scheduler.ts`, and `src/lib/ai/engines/enrichmentWorker.ts` prove the Browser Use fallback contract, retry cap, dedupe logic, and worker handoff already exist.
- `convex/enrichmentJobs.ts`, `convex/schema.ts`, and `convex/enrichment.ts` prove the fallback lane already has queue, context, audit, and job-summary surfaces that KIN-975 can build on.
- `docs/testing-strategy.md` and `docs/ci-cd-preview-workflow.md` prove the extraction service is already treated as a distinct deployable/tested surface with its own health and quality gates.

## Bottom Line

buyer-codex is deterministic-first for listing ingestion.

For supported portals, deterministic extraction is the default and Browser Use is an exception path.

Browser Use is allowed only as a typed, audited, asynchronous recovery lane for:

- explicit parser/schema drift
- explicit anti-bot blocking
- explicit vendor unavailability
- internal unsupported-portal recovery
- explicit manual operator override

It is not allowed to quietly become the product's default parser.
