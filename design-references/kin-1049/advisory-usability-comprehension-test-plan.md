# KIN-1049 Advisory Usability And Comprehension Test Plan

Derived from the shipped advisory surfaces on `origin/main` after the fast-forward preflight on `2026-04-13`.

## Why This Exists

`KIN-1049` is the pre-launch comprehension gate for the v1.1 decisioning release. The repo already contains the shipped advisory experience and telemetry, but it does not yet contain the concrete test plan needed to validate whether buyers and brokers can actually interpret the surfaces correctly.

This file closes that gap with a moderator-ready plan tied to the current implementation rather than abstract UX themes.

## Surfaces Under Test

Test the surfaces exactly as they currently ship on `origin/main`:

- Deal-room overview route: `src/app/(dealroom)/dealroom/[dealRoomId]/page.tsx`
- Offer cockpit route: `src/app/(dealroom)/dealroom/[dealRoomId]/offer/page.tsx`
- Buyer-safe overview composition in `src/components/dealroom/PropertyCaseOverview.tsx`
- Offer scenario and broker-review handoff in `src/components/offer/OfferCockpit.tsx`
- Surface-state logic in `src/lib/advisory/surface-state.ts`
- Advisory telemetry events in `src/lib/dealroom/advisoryTelemetry.ts` and `packages/shared/src/analytics-events.ts`

The current overview includes these concrete first-pass surfaces:

- Coverage block plus `Confidence details` disclosure
- `Buyer-safe summary` with `Copy summary` and `Share summary`
- `Offer cockpit` and `Close dashboard` handoff CTAs
- Memo expressed as `keyTakeaways` cards
- `Confidence behind the recommendation`
- `Comparative claims` with `View source`
- `Recommended action`
- `Missing or uncertain signals`
- `Source coverage`

The current broker-only extension includes:

- `Internal cache details`
- `Advisory guardrails`
- `Internal confidence breakdown`
- `Broker adjudication`

The current secondary execution surface includes:

- `ScenarioComparison` in the offer cockpit
- broker review state copy
- draft / submit flow for broker review

## Concrete Risks To Validate

These are the likely confusion or trust failures in the shipped implementation and should be treated as test hypotheses, not assumed truths:

| Surface | Likely confusion or failure |
|---|---|
| Coverage + confidence details | Buyers may read `78% confidence` or `73% action confidence` as "chance this offer wins" instead of "confidence in the evidence behind the recommendation." |
| Memo / key takeaways | The memo currently renders as three equal cards, so users may miss the intended narrative hierarchy and read them as disconnected facts. |
| Recommended action | `Illustrative opener` plus contingencies may be interpreted as final instruction rather than broker-reviewed starting guidance. |
| Comparative claims | `View source` may feel too generic, and the citation id may look internal or meaningless to buyers. |
| Missing or uncertain signals | Buyers may notice the pending state but fail to connect it to what part of the recommendation should be treated cautiously. |
| Source coverage | Buyers may not understand whether source rows are proof, engine status, or both. |
| Buyer-safe summary | Users may over-trust the summary as seller-safe, legally safe, or complete enough to forward without broker context. |
| Internal confidence breakdown | Brokers may not connect section-level confidence to buyer-visible wording changes. |
| Broker adjudication | Brokers may not know which linked claims or buyer-facing copy would change if they override a source. |
| Offer cockpit | Buyers may treat scenario comparison as the product's real recommendation and devalue the overview memo, which would break the memo-first IA. |

## Required Test Setup

Run moderated sessions on staging using the real shipped routes and seeded deal rooms.

Create three reusable fixtures before recruiting:

1. `Case A: buyer-safe ready state`
   Use a deal room that mirrors the current preview shape in `src/components/dealroom/preview-data.ts`: three buyer-visible claims, one visible recommendation, one pending offer source, shareable summary enabled.
2. `Case B: sparse / partial state`
   Use a deal room where the memo is visible but one or more recommendation inputs are held back, missing, or review-required.
3. `Case C: internal broker state`
   Use the same property as A or B, but with broker/admin access so `Internal cache details`, `Internal confidence breakdown`, and `Broker adjudication` are visible.

Do not test from static screenshots alone. Participants must use the live overview and offer routes so navigation, disclosure behavior, and drill-down affordances are part of the comprehension read.

## Session Plan

- Round 1: `6` buyers, moderated, remote, `45` minutes each
- Round 2: `4` brokers, moderated, remote, `45` minutes each
- Device mix:
  - buyers: at least `4` desktop, `2` mobile-width
  - brokers: desktop only
- Recording:
  - screen + audio
  - timestamp every hesitation over `5` seconds
  - capture exact phrases used to explain confidence, proof, and next action

## Moderator Script

Open every session with the same framing:

> You are looking at a live buyer property case. Please think out loud. We are testing whether the product explains itself clearly, not whether you can guess what the team meant.

Do not explain the meaning of confidence, source trace, or guardrails up front. Those are core comprehension targets.

## Buyer Tasks

| Task | Starting surface | Moderator prompt | Success criteria | Failure signatures | Change triggered if it fails |
|---|---|---|---|---|---|
| B1 | Overview header + coverage block | "Without scrolling much, tell me what this page is saying about this property and what you think the next move is." | Buyer states a clear next move, mentions at least one supporting reason, and notices that the page is evidence-backed rather than just a score. | Focus stays on badges only; buyer cannot state the recommended next move; buyer thinks this is just a dashboard summary. | IA rewrite in `KIN-1046`: strengthen first-pass summary language and reduce competing header detail. |
| B2 | `Confidence details` + recommendation card | "What does `73% action confidence` mean here? What would make you trust it more or less?" | Buyer explains that confidence is about evidence quality / support, not win probability; buyer can identify at least one condition that would increase confidence. | Buyer interprets confidence as offer acceptance odds, appraisal odds, or legal safety; buyer cannot say what is missing. | Confidence presentation change in `KIN-1023`: replace raw percentage-only labels with clearer band + helper text near the recommendation. |
| B3 | Memo / key takeaways | "Read this memo area and explain the case back to me in your own words." | Buyer can restate pricing posture, seller posture, and negotiation shape without inventing unsupported claims. | Buyer remembers only one card; treats cards as unrelated facts; cannot tell which takeaway matters most. | Memo composition change in `KIN-1046`: collapse equal-weight cards into one narrative block or ordered takeaway stack. |
| B4 | Comparative claims + `View source` | "Show me where the pricing claim came from and tell me whether that source looks reliable." | Buyer reaches the matching source row in under `15` seconds and can explain available/pending status in plain English. | Buyer clicks the wrong thing, ignores `View source`, or reaches `Source coverage` but still cannot connect it to the original claim. | Source-trace affordance change in `KIN-1035`: rename `View source`, improve scroll target, and show claim-to-source linkage more explicitly. |
| B5 | Missing or uncertain signals | "What is the page still unsure about, and how should that change what you do next?" | Buyer identifies the pending or withheld signal and lowers certainty appropriately without assuming the whole memo is broken. | Buyer ignores the gap; buyer assumes pending means broken; buyer cannot say what part of the recommendation is affected. | Sparse-data and warning-state change in `KIN-1047`: move the most important missing-state copy closer to the affected recommendation or memo sentence. |
| B6 | Buyer-safe summary | "Would you copy or share this summary? With whom, and what would you worry about before sending it?" | Buyer understands that the summary is buyer-safe and plain-language, but not complete legal or seller-facing advice. | Buyer treats the summary as seller-ready, legally complete, or equivalent to broker approval. | Summary wording revision in the overview export surface: strengthen scope and audience framing before copy/share. |
| B7 | Offer cockpit CTA -> offer route | "If you were ready to act, where would you go next and what would you expect to find there?" | Buyer selects `Offer cockpit` intentionally and expects scenario comparison / term drafting rather than a brand-new explanation of the case. | Buyer opens offer cockpit expecting proof, confidence explanation, or a totally different recommendation engine. | IA adjustment in `KIN-1046`: tighten CTA labels and route expectation-setting so the memo stays primary and offer stays executional. |

## Broker Tasks

| Task | Starting surface | Moderator prompt | Success criteria | Failure signatures | Change triggered if it fails |
|---|---|---|---|---|---|
| R1 | Internal confidence breakdown | "Which part of this case is weakest right now, and what exactly would need to change before you trust it more?" | Broker identifies the weakest section, cites missing / conflicting evidence, and ties that to a buyer-visible limitation. | Broker reads the percentages but cannot connect them to the buyer-safe narrative or next action. | Broker/internal wording change in `KIN-1023` and `KIN-1045`: make buyer-impact more explicit inside each section. |
| R2 | Broker adjudication | "Pick the source you would review first. Tell me what buyer-visible claim it affects and whether you would approve or override it." | Broker chooses a pending or risky source, explains claim impact, and can complete approve/override reasoning without confusion. | Broker cannot tell which claim changes if a source is overridden; override reason feels detached from buyer-visible copy. | Adjudication UX change in `KIN-1030`: add impacted-claim previews and a buyer-visible consequence summary in each adjudication row. |
| R3 | Source trace from adjudication | "Open the linked source trace and tell me what you would verify before allowing the memo to inherit this output." | Broker uses the trace affordance quickly and names specific review checks: freshness, claim linkage, guardrail state, generated timestamp. | Broker treats source rows as status-only; does not see enough provenance to make a decision. | Source-trace detail change in `KIN-1035`: expose freshness / guardrail / claim linkage more directly in the broker drill-down. |
| R4 | Offer cockpit handoff | "After reviewing the overview, does the offer cockpit feel like the right next place to continue? Why or why not?" | Broker sees the cockpit as execution / scenario refinement, not as a replacement for the memo. | Broker expects to re-derive the whole case in the offer route or thinks the route is missing justification. | IA reinforcement in `KIN-1046`: tighten handoff copy between overview recommendation and offer scenario comparison. |
| R5 | Buyer-safe summary | "Would you let a buyer forward this summary as-is? What, if anything, would you edit first?" | Broker can describe when the summary is safe to share and what should be withheld or softened when evidence is pending. | Broker assumes summary is always safe, or always unsafe, because scope is unclear. | Summary wording and sharing guardrails revision in the overview summary surface and `KIN-1034` copy. |

## Quantitative Success Thresholds

Treat these as the default pass/fail bars for Round 1 and Round 2.

| Measure | Pass bar | Failure consequence |
|---|---|---|
| Buyers who can correctly restate the recommendation after first pass | `>= 5/6` | Rework the first-pass summary and recommendation hierarchy before broader rollout. |
| Buyers who interpret confidence as evidence confidence, not win probability | `>= 5/6` | Change confidence labeling and explanatory copy before rollout. |
| Buyers who can open the matching source from a claim in under `15` seconds | `>= 5/6` | Redesign source-trace affordance and linkage before rollout. |
| Buyers who identify at least one pending / missing signal and its consequence | `>= 4/6` | Move sparse-data messaging closer to the affected recommendation or memo. |
| Buyers who understand the summary as buyer-safe but not universal/legal/seller-ready | `>= 5/6` | Rewrite summary framing and possibly gate share when evidence is pending. |
| Brokers who can identify buyer-visible impact during adjudication | `>= 3/4` | Add claim-impact context to adjudication before rollout. |
| Brokers who view offer cockpit as executional follow-through, not competing IA | `>= 3/4` | Tighten overview-to-offer handoff copy and reduce duplicate explanation in offer. |

Any single task that produces a critical trust failure in `>= 2` sessions blocks the release gate for KIN-1049 even if the raw pass bar is met.

## Severity Rubric

| Severity | Definition | Required action |
|---|---|---|
| Critical | User would take the wrong real-world action, over-trust unsupported advice, or misread a buyer-safe surface as approval/legal certainty. | Fix before broader rollout. |
| High | User cannot explain the recommendation, confidence, or proof path without moderator rescue. | Fix in the next product pass tied to the owning KIN issue. |
| Medium | User eventually understands the surface, but only after extra scanning, trial clicks, or reading internal-looking labels. | Queue for cleanup if repeated in `>= 3` sessions. |
| Low | Cosmetic or wording preference that does not change interpretation. | Track, but do not block. |

## Decision Rules For What Changes Next

Route findings back into existing workstreams instead of creating ad hoc UX debt.

| Finding pattern | Owner issue(s) | Required product response |
|---|---|---|
| Buyers cannot tell what matters first on overview | `KIN-1046` | Reduce equal-weight cards, strengthen memo-first order, and simplify first-pass hierarchy. |
| Buyers misread or over-trust confidence percentages | `KIN-1023` | Rework percentage labels, band labels, and "what increases confidence" phrasing. |
| Users cannot connect claims to proof | `KIN-1035` | Change source-trace affordance label, destination context, and claim-to-source mapping. |
| Users ignore or misread pending / withheld states | `KIN-1047` | Move missing-state copy closer to the affected recommendation or hide the recommendation more aggressively. |
| Brokers cannot adjudicate without reconstructing buyer impact mentally | `KIN-1030`, `KIN-1045` | Show claim impact and consequence of approve/override inline. |
| Summary is interpreted as universally safe to share | current overview summary copy, `KIN-1034` | Add stronger audience/scope framing and conditional warning when evidence is pending or review-required. |
| Offer cockpit is treated as a second primary decision surface | `KIN-1046` | Reinforce overview as the decision surface and offer as execution / scenario refinement only. |

## Instrumentation To Review During Sessions

Use the existing typed telemetry as a companion signal, not as a replacement for moderation notes.

Review these events during or immediately after the sessions:

- `advisory_memo_viewed`
- `advisory_recommendation_viewed`
- `advisory_confidence_details_expanded`
- `advisory_source_trace_opened`
- `advisory_broker_adjudication_opened`
- `advisory_broker_override_submitted`
- `advisory_buyer_safe_summary_copied`
- `advisory_buyer_safe_summary_shared`
- `advisory_recommendation_feedback_recorded`

For every task, log both:

- observed outcome: success, hesitation, failure, or moderator rescue
- telemetry corroboration: whether the expected interaction event fired

## Session Notes Template

Use this template per participant:

```md
Participant:
Role: buyer | broker
Fixture: Case A | Case B | Case C
Device: desktop | mobile

Task B1/R1:
- Outcome:
- Time to first explanation:
- Exact phrase used by participant:
- Misread or hesitation:
- Severity:
- Owning issue:

Task B2/R2:
- Outcome:
- Time to completion:
- Exact phrase used by participant:
- Misread or hesitation:
- Severity:
- Owning issue:

Final trust readout:
- What they think confidence means:
- What they think "View source" means:
- Whether they would forward the buyer-safe summary:
- Whether they believe the recommendation is final or broker-reviewed:
```

## Exit Rule For KIN-1049

`KIN-1049` is complete only when:

- the moderated sessions have been run against the shipped overview and offer routes
- every critical confusion point has an explicit fix, cut, or acceptance decision
- no unresolved critical confusion remains on memo, recommendation, confidence, or source-trace comprehension
- the resulting fixes are routed back into `KIN-1046`, `KIN-1047`, `KIN-1023`, `KIN-1035`, `KIN-1030`, `KIN-1045`, or summary wording work as appropriate

Until then, the v1.1 advisory layer is shipped code, not validated comprehension.
