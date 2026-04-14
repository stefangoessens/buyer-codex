# v1.1 Mobile And iOS Decisioning Scope

Derived from `KIN-1050`, parent `KIN-1022`, the `KIN-1046` advisory IA contract, `src/components/dealroom/PropertyCaseOverview.tsx`, and the current native shell in `ios/BuyerCodex/Sources/Views/DealTracker/DealTrackerShell.swift` as of `2026-04-13`.

## Why This Exists

`KIN-1046` defines the desktop/web advisory IA, but it does not finish the platform decision for:

- responsive web on phone-sized viewports
- native iOS surfacing inside the current `Status / Tasks / Timeline` shell
- which outputs stay visible inline versus collapse into disclosure or handoff

This file is the execution contract for that gap.

## Decision Summary

v1.1 ships a **responsive web decisioning experience** on the existing deal-room overview route. It does **not** ship full native iOS parity.

Platform outcome:

- `Desktop web`: full v1.1 decisioning surface
- `Web mobile`: partial-layout parity, full launch-critical content parity
- `Native iOS`: snapshot-only parity plus handoff to web, not a full native decisioning client

Interpretation rules:

- `Full parity` means the output is first-class on that platform and can be understood there without leaving the surface.
- `Partial parity` means the output exists, but in a compressed, preview, or drill-down-first form.
- `Deferred` means do not build a dedicated v1.1 surface for that output on that platform.

## Platform Entry Points

### Desktop web

- Primary route: `src/app/(dealroom)/dealroom/[dealRoomId]/page.tsx`
- Supports the full memo-first overview contract from `KIN-1046`
- Keeps inline evidence, confidence explanation, recommendation detail, and source coverage on one page

### Web mobile

- Uses the same deal-room overview route
- Must remain one vertical memo-first flow, not a shrunk desktop two-column layout
- Is the only mobile surface that carries the full v1.1 buyer decisioning payload

### Native iOS

- Primary entry remains the existing `Status` tab in `DealTrackerShell`
- Do **not** add a fourth top-level `Decisioning` tab in v1.1
- Add at most one `Decision snapshot` card to `DealStatusView`
- The card may deep-link to the responsive web deal room for full detail

## Surface Matrix

| Output | Desktop web | Web mobile | Native iOS | Decision |
|---|---|---|---|---|
| Memo | full narrative section | full content parity in compressed stack form | preview only inside `Decision snapshot` | `Desktop/web mobile full`, `iOS partial` |
| Recommendation / next best action | dominant inline card | dominant inline card at top of stack | single-line primary action with one CTA | `Desktop/web mobile full`, `iOS partial` |
| Confidence | global chip + detailed breakdown + local claim confidence | global chip + collapsed detail + local confidence on visible claims only | single overall confidence pill only | `Desktop full`, `web mobile partial`, `iOS partial` |
| Source trace | per-claim links + source coverage section | per-claim links + bottom-sheet or accordion trace summaries | no native trace surface | `Desktop full`, `web mobile partial`, `iOS deferred` |
| Readiness | inline decision-band status plus blocker copy | inline blocker card directly below recommendation | one short readiness row in `Decision snapshot` | `Desktop/web mobile full`, `iOS partial` |
| Summary | inline buyer-safe summary with copy/share actions | summary card after trust content with copy/share in overflow or button row | no separate native summary/export control | `Desktop/web mobile partial-to-full`, `iOS deferred` |
| Neighborhood reality | compact market-context support inside memo/evidence only | compact market-context support inside memo/evidence only | not surfaced as a standalone native element | `Desktop/web mobile partial`, `iOS deferred` |

## Concrete Surface Contract

### 1. Web mobile overview order

On viewports below `md`, the overview must render in this order:

1. `Context hero`
2. `Recommendation card`
3. `Readiness / blocker card`
4. `Memo`
5. `Comparative claims`
6. `Confidence summary`
7. `Missing / uncertain signals`
8. `Buyer-safe summary`
9. `Offer / close handoff actions`

Notes:

- Do not keep the desktop sidebar as a second column on mobile.
- Do not place source coverage above the memo or claims.
- Do not push the recommendation below confidence or summary content.

### 2. Native iOS status-tab order

If native iOS gets the v1.1 snapshot, `DealStatusView` should render:

1. property hero
2. deal status badge
3. `Decision snapshot`
4. list price
5. existing property metrics

`Decision snapshot` contains only:

- recommendation headline
- one-line memo preview
- one overall confidence pill
- one readiness row
- one CTA: `Open full decisioning`

It must not contain:

- comparative-claim lists
- inline citations
- source coverage inventory
- broker adjudication controls
- share/export actions
- scenario comparison

## Output-Level Rules

### Memo

Desktop and web mobile ship the memo as the primary buyer explanation.

Web mobile memo rules:

- max `3` takeaways visible before expansion
- each takeaway max `2` short sentences
- no adjacent secondary summary card above the memo

Native iOS memo rules:

- preview only, max `280` characters or `2` lines of takeaways
- if memo state is not ready, show absence state text instead of a collapsed empty card

### Recommendation / next best action

Recommendation is the first decisioning block on both web desktop and web mobile.

Web mobile rules:

- recommendation card appears before the memo
- show one price/action headline, one confidence treatment, one risk treatment
- show no more than `3` contingency chips before `See all`
- show one dominant CTA only

Native iOS rules:

- recommendation is reduced to one headline plus one CTA
- CTA opens the responsive web overview or the appropriate execution route
- do not reproduce calibration feedback controls in native v1.1

### Confidence

Confidence remains supporting context, not a peer destination.

Desktop:

- existing detailed section remains allowed

Web mobile:

- show the global confidence chip in the hero
- keep detailed confidence behind one disclosure block
- show per-claim confidence only for the visible top `3` claims
- do not render the full desktop confidence matrix expanded by default

Native iOS:

- show a single overall confidence pill only
- if confidence is weak or unavailable, pair it with a plain-language fallback line
- do not build the multi-section confidence breakdown in v1.1

### Source trace

Source trace is required for trust on the web surfaces, but not for native iOS in v1.1.

Desktop:

- full source coverage section remains in scope

Web mobile:

- per-claim `View source` stays required
- trace detail opens as bottom sheet, drawer, or accordion, not as a long source wall inline
- keep the default trace summary to:
  - source name / engine
  - status
  - generated timestamp
  - linked-claim count
  - source confidence when available

Native iOS:

- no source trace UI in v1.1
- the only trust cues are confidence, updated-at recency, and the web handoff CTA

### Readiness

v1.1 does **not** introduce a standalone buyer-readiness workflow on mobile or iOS. The shipped readiness surface is only the immediate `can I act on this now?` state attached to the recommendation.

Desktop and web mobile:

- keep readiness tied to the recommendation
- blockers must appear directly below the recommendation, not after evidence
- if blocked, name the blocker class and the next human step

Native iOS:

- show only one readiness row
- allowed states: `ready now`, `waiting on review`, `missing evidence`, `use web for detail`
- do not add blocker lists or checklist widgets

### Summary

The v1.1 summary is the buyer-safe shareable recap already paired with the memo. It is not the larger `KIN-1033` client-summary/export surface.

Desktop:

- inline summary with copy/share remains allowed

Web mobile:

- keep summary below confidence and missing-signal content
- keep copy/share actions, but do not duplicate them in the hero
- if space is tight, collapse actions behind one `Share summary` affordance

Native iOS:

- no separate summary block
- summary intent is covered by the memo preview plus web handoff

### Neighborhood reality

Neighborhood reality stays subordinate to the memo/evidence layer in v1.1.

Desktop and web mobile:

- allow only compact signals already needed to explain the memo:
  - comparable cluster direction
  - days on market
  - listing momentum / seller posture
- do not create a standalone neighborhood section or route

Native iOS:

- defer
- if neighborhood context matters, it can appear only as phrasing inside the memo preview

## Mobile-Specific IA And Density Rules

These rules are mandatory for web mobile and should inform the native snapshot layout where relevant.

- One primary card per vertical step. Do not stack recommendation, confidence, and summary into one visually equal cluster.
- Maximum `2` metadata pills in the hero besides stage.
- Maximum `3` visible claims before `See more`.
- Maximum `1` expanded disclosure block open by default below the fold.
- Maximum `2` lines for chip rows before wrapping to a disclosure or overflow action.
- Keep all trust-heavy content below the memo except the single overall confidence chip.
- If a section duplicates the memo in different words, cut it.

## Progressive Disclosure Rules

Use these rules whenever the desktop composition does not translate to narrow screens.

### Collapse instead of duplicate

- If desktop shows both summary and memo, mobile keeps the memo expanded and summary secondary.
- If desktop shows local confidence plus section confidence plus source detail, mobile keeps the local confidence on the visible item and collapses the rest.

### Escalate proof, not narrative

- Memo and recommendation stay inline.
- Confidence detail, trace detail, and long missing-signal explanations move into disclosure.
- Proof layers may open as sheet, drawer, or accordion; they must not push the recommendation out of first view.

### Preserve action priority

- The first screenful must answer:
  - what the current recommendation is
  - whether the buyer can act now
  - why the system believes that
- Any surface that only answers `show me more proof` belongs after that first screenful.

## Explicit Web-Only v1.1 Surfaces

These remain web-only in v1.1 and should not be back-ported into native iOS:

- full comparative-claims browsing
- full source coverage / trace browsing
- detailed confidence-section matrix
- broker adjudication and override controls
- buyer feedback / calibration controls
- copy/share summary actions
- any future standalone neighborhood detail panel

## Explicitly Deferred Beyond v1.1

These are not part of the mobile/iOS contract for v1.1:

- native iOS parity for source trace
- native iOS parity for confidence-section breakdowns
- native iOS parity for comparative claims
- native iOS parity for client-summary export
- a standalone neighborhood reality surface on any platform
- a new iOS top-level decisioning tab

## Implementation Targets

Downstream implementation issues should use these touch points:

- Web mobile IA and disclosure behavior:
  - `src/components/dealroom/PropertyCaseOverview.tsx`
- Shared output shaping if additional mobile-specific fields are needed:
  - `src/lib/dealroom/property-case-overview.ts`
- Native iOS snapshot card and handoff:
  - `ios/BuyerCodex/Sources/Views/DealTracker/DealStatusView.swift`
  - `ios/BuyerCodex/Sources/Views/DealTracker/DealTrackerShell.swift`
  - service/model additions under `ios/BuyerCodex/Sources/Services/**` and `ios/BuyerCodex/Sources/Models/**`

## Ship Check

`KIN-1050` is satisfied only when downstream work preserves these calls:

- web mobile gets the full buyer-safe memo/recommendation understanding flow without copying the desktop columns
- native iOS gets a bounded decision snapshot, not accidental full-surface parity
- source trace, detailed confidence, and broker-only controls stay web-only in v1.1
- neighborhood reality remains embedded support, not a new primary surface
