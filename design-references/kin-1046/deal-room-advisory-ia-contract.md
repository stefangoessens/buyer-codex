# Deal Room Advisory IA Contract

Derived from `KIN-1046`, parent `KIN-1022`, and the current deal-room routes on `origin/main` as of `2026-04-13`.

## Why This Exists

The repo already contains the foundational execution surfaces:

- `src/app/(dealroom)/dealroom/[dealRoomId]/page.tsx` renders the default advisory overview.
- `src/app/(dealroom)/dealroom/[dealRoomId]/offer/page.tsx` renders the negotiation execution surface.
- `src/app/(dealroom)/dealroom/[dealRoomId]/close/page.tsx` renders the post-contract execution surface.
- `src/components/dealroom/PropertyCaseOverview.tsx` already composes recommendation, claims, missing-signal, and source-coverage sections.
- `src/components/offer/OfferCockpit.tsx` already owns scenario comparison and broker review.
- `src/components/close/CloseDashboard.tsx` already owns close-task execution.

The repo does **not** yet contain the missing product contract:

- which upcoming advisory surfaces stay on the overview page
- which ones move into the offer surface
- which ones are secondary proof layers rather than first-pass content
- where confidence, source trace, and review state live in the shell
- what must be cut so the deal room does not become an equal-weight card wall

This file closes that gap.

## Product Skeleton

The deal room keeps exactly three top-level product surfaces:

1. `Overview` — advisory and decision support
2. `Offer` — negotiation execution
3. `Close` — post-contract execution

Do **not** create additional top-level tabs or routes for dossier, market context, confidence, source trace, memo, readiness, counterfactuals, negotiation playbook, or summary. Those are subordinate surfaces inside one of the three existing product surfaces.

## Surface Qualification Rule

A surface earns inline placement on the default overview only if it answers one of these questions in the first pass:

1. What should I do next?
2. Why is that the right next move?
3. Am I blocked from doing it safely?

If a surface mainly answers one of these questions instead, it defaults to drill-down:

- Show me the proof behind that statement.
- Show me the raw supporting detail.
- Show me export or broker-only material.

This rule is the cut line. Future issues should map new UI to an existing slot instead of inventing a new top-level card.

## Fixed Overview Order

The default deal-room overview route must render advisory content in this order:

1. `Context header`
2. `Decision band`
3. `Why-this-home memo`
4. `Evidence stack`
5. `Trust rail`
6. `Secondary actions`

Do not reorder these sections based on which engine landed first. Missing data changes section state, not section order.

### 1. Context header

Purpose: orient the buyer or broker before any deep reading.

Must contain:

- property identity: address, stage, list price, hero image
- one global confidence chip
- one global review-state chip
- last refreshed timestamp
- one stage-appropriate primary handoff action:
  - `Go to offer` during `offer_prep` / `offer_sent`
  - `Go to close` during `under_contract` / `closing`
  - no more than one primary CTA in the header

Must not contain:

- dense comps tables
- source lists
- multiple competing CTA buttons
- a standalone dossier block

### 2. Decision band

Purpose: answer the first-pass product question in one scan.

This band owns three inline cards only:

1. `Decision summary`
2. `Recommendation`
3. `Readiness`

Rules:

- `Decision summary` is the short buyer-safe distillation of the current case.
- `Recommendation` is the single dominant action card for the overview.
- `Readiness` answers whether the recommendation is actionable now, blocked, or waiting on review/input.
- If readiness is blocked, the blocker copy lives here instead of burying the blocker in the trust rail.
- Do not add charts, trace lists, or full scenario grids to this band.

### 3. Why-this-home memo

Purpose: explain the recommendation in narrative form before the user opens proof.

Rules:

- Keep this as one memo surface, not three separate cards.
- Prefer either:
  - one short narrative block with 2 to 3 short paragraphs, or
  - one narrative intro plus 3 key takeaways
- This section is buyer-safe synthesis, not raw evidence.
- Link outward to evidence and trace from phrases or footers; do not inline the full trace here.

### 4. Evidence stack

Purpose: show the strongest evidence that supports the memo and recommendation.

This stack owns:

- comparative claims
- compact market context

Rules:

- Comparative claims remain the primary evidence unit.
- Market context appears inline only as the compact context needed to interpret the claims:
  - comp cluster
  - days-on-market signal
  - seller posture / listing-performance context
- Limit the default stack to the strongest `3` claims.
- Each claim must show:
  - one topic label
  - one claim sentence
  - one market reference line
  - one local confidence treatment
  - one source-trace affordance
- Full comps tables, trend charts, and neighborhood detail belong behind drill-down.

### 5. Trust rail

Purpose: answer “can I trust this?” without replacing the main flow.

This rail owns compact secondary cards for:

- confidence breakdown
- source trace summary
- dossier snapshot
- missing / withheld / uncertain signals
- broker-only review details when the viewer is internal

Rules:

- The rail is the proof-and-diagnostics zone, not the first-pass narrative.
- The rail may be right-column on desktop and stacked below evidence on mobile.
- Every card in the rail is summary-first:
  - small status counts
  - one short explanation
  - one drill-down entry point
- Do not dump raw extracted facts, long citation inventories, or negotiation scenarios into this rail.

### 6. Secondary actions

Purpose: expose optional next layers once the first-pass decision is clear.

This section owns:

- counterfactuals teaser
- negotiation playbook teaser
- client-ready summary / export

Rules:

- These are optional and lower priority than the five sections above.
- Each item is teaser-sized on overview.
- Full detail opens elsewhere:
  - counterfactuals open the offer surface
  - negotiation playbook opens the offer surface or broker export
  - client-ready summary opens export / share flow

## Surface Ownership Matrix

| Surface | Owner route | Inline on overview | Default form | Drill-down destination | Hard cut |
|---|---|---|---|---|---|
| Dossier | `Overview` | `Secondary only` | Trust-rail snapshot with status counts, missing docs/facts, and top blocker | Dossier drawer / panel backed by document and fact summaries | No full document list or long fact table inline |
| Market context | `Overview` | `Yes` | Compact evidence support inside the evidence stack | Full market-context drawer with comps table, trend lines, and neighborhood detail | No standalone top-level market tab |
| Confidence | `Overview` + `Offer` | `Yes, as metadata only` | Global chip in header, local chips on recommendation and claims, compact breakdown in trust rail | Confidence detail drawer if needed | No separate full-width “confidence widget” |
| Source trace | `Overview` | `Yes, as links and a summary card` | Per-claim trace link plus source-summary card in trust rail | Trace drawer with engine, timestamp, review state, and linked claims | No full raw trace wall inline |
| Why-this-home memo | `Overview` | `Primary` | One memo section between decision band and evidence | Links back to trace or market detail | Do not split into many equal-weight memo cards |
| Recommendation | `Overview` | `Primary` | One dominant action card in the decision band | Handoff to offer or close route | Never render multiple recommendation cards at once |
| Readiness | `Overview` and then `Close` | `Primary` | One companion card in the decision band | Deep blocker detail in trust rail or execution route | Do not bury blockers below the fold |
| Counterfactuals | `Offer` | `Teaser only` | Small teaser card on overview when recommendation exists | Full scenario comparison in `src/components/offer/ScenarioComparison.tsx` | No side-by-side scenario grid on overview |
| Negotiation playbook | `Offer` | `Teaser only` | One-line or short-card preview of the recommended posture | Full playbook or brief export backed by `src/lib/negotiation/*` | No full playbook card on overview |
| Summary | `Overview` | `Primary summary + secondary export` | Decision summary card inline; client-ready summary as secondary action | Share / export flow using summary scopes | Do not add a second long-form summary card below the memo |

## Confidence, Trace, And Review-State Rules

### Confidence

- Global confidence appears once in the context header.
- Local confidence appears only where it changes interpretation:
  - recommendation
  - comparative claims
  - offer scenarios on the offer route
- Detailed confidence explanation belongs in the trust rail or a drill-down.
- Confidence is an attribute of content, not a peer surface.

### Source trace

- Every inline claim must have a direct trace affordance.
- The recommendation must link to the evidence or source rows that justify it.
- The trust rail owns the compact source-summary card:
  - engine label
  - availability / pending / unavailable state
  - linked-claim count
  - generated timestamp
  - source confidence when available
- Buyers should never see raw prompt output or raw internal provenance payloads on the default surface.

### Review state

- Show one global review-state chip in the context header.
- Section-level review state is only shown where it changes availability:
  - recommendation withheld
  - dossier awaiting review
  - source trace pending refresh
- Pending or rejected review state must keep the section shell visible with explicit explanation. Do not silently remove the section and change page order.
- Broker-only notes and override rationale stay internal. Buyer-safe overview copy should only expose the resulting state and next step.

## Stage Emphasis Rules

| Deal stage | Emphasize on overview | Keep secondary / teaser only |
|---|---|---|
| `analysis` / `tour_scheduled` | dossier snapshot, market context, memo, missing signals | counterfactuals, negotiation playbook |
| `offer_prep` / `offer_sent` | recommendation, readiness, memo, strongest market evidence | full dossier detail, full comps tables, full playbook |
| `under_contract` / `closing` | readiness handoff, summary, key dossier blockers, route CTA to close dashboard | offer counterfactuals, negotiation playbook |
| `closed` / `withdrawn` | archived summary and evidence snapshot only | all live execution helpers |

## Cut List

These patterns are explicitly out of bounds:

- No new top-level tabs for each advisory engine or artifact.
- No equal-weight grid of dossier, confidence, trace, memo, readiness, recommendation, counterfactuals, playbook, and summary cards all at once.
- No more than `3` primary cards in the decision band.
- No more than `3` inline comparative claims before a “see more” affordance.
- No full counterfactual scenario comparison on the overview page.
- No full negotiation playbook on the overview page.
- No long raw dossier list on the overview page.
- No duplicated confidence treatment in header, band, rail, and footer at the same time.
- No broker-only review notes in the buyer-safe variant.
- No page reflow that promotes secondary proof cards above the recommendation and readiness layer.

## Downstream Implementation Targets

If later UI issues implement this contract, the likely touch points are:

- `src/app/(dealroom)/layout.tsx`
- `src/app/(dealroom)/dealroom/[dealRoomId]/page.tsx`
- `src/components/dealroom/PropertyCaseOverview.tsx`
- `src/lib/dealroom/property-case-overview.ts`
- `src/lib/dealroom/document-summary.ts`
- `src/lib/dealroom/risk-summary.ts`
- `src/components/offer/OfferCockpit.tsx`
- `src/components/offer/ScenarioComparison.tsx`
- `src/lib/negotiation/brief.ts`

Implementation direction:

- Keep the overview route as the single advisory landing surface.
- Split `PropertyCaseOverview` into explicit zone components if needed:
  - `ContextHeader`
  - `DecisionBand`
  - `WhyThisHomeMemo`
  - `EvidenceStack`
  - `TrustRail`
  - `SecondaryActions`
- Extend the offer route for full counterfactuals and negotiation playbook detail rather than backfilling those into the overview.
- Reuse existing typed read models for dossier, risk, and negotiation exports rather than inventing ad hoc UI-only payloads.
