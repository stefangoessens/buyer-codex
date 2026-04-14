# KIN-1049 Advisory Usability And Comprehension Test Plan

Last updated: 2026-04-13

This plan validates the advisory surfaces that currently ship on `origin/main`. It is not a generic UX research brief. It is an execution artifact for moderated sessions against the actual web surfaces in:

- `src/app/(dealroom)/dealroom/[dealRoomId]/page.tsx`
- `src/components/dealroom/PropertyCaseOverview.tsx`
- `src/app/(dealroom)/dealroom/[dealRoomId]/offer/page.tsx`
- `src/components/offer/OfferCockpit.tsx`
- `src/components/offer/ScenarioComparison.tsx`
- `src/lib/dealroom/advisoryTelemetry.ts`

## Objective

Confirm that buyers and brokers can:

- explain the current recommendation back in their own words
- distinguish recommendation confidence from source quality and review state
- use source trace to verify a claim rather than treating the UI as an opaque black box
- understand what is missing, pending, or held back
- decide what to do next without inventing certainty the product does not support

The output of this plan is a decision on whether v1.1 can keep the current memo-first advisory IA, or must change wording, hierarchy, and sparse-data behavior before broader rollout.

## Current Surfaces Under Test

| Surface | Current labels and controls on main | Why it must be tested |
| --- | --- | --- |
| Overview hero and memo | `Buyer-safe case`, address, `78% confidence`-style chip, `headerDescription`, `keyTakeaways` cards | The memo is currently split between header copy and takeaway cards, so users may not perceive one clear decision memo artifact. |
| Recommendation | `Recommended action`, `Suggested opener` or `Illustrative opener`, confidence badge, risk badge, `Why this opening number`, `Suggested contingencies`, `How are you using this recommendation?` | Buyers may treat the opener as a command, not a broker-reviewed starting point. |
| Confidence summary | `Confidence details` disclosure with `Overall confidence`, `Available signals`, `Pending review`, `Held back` | Users may confuse overall confidence with acceptance odds or with data completeness. |
| Confidence breakdown | `Confidence behind the recommendation` with section cards for `Pricing`, `Comparable sales`, `Negotiation leverage`, `Risk`, `Offer recommendation` | The surface is information-dense and may duplicate or conflict with the simpler disclosure above it. |
| Claim-level proof | `Comparative claims` cards with `View source`, delta badges, confidence badges, reference lines | We need to know whether users can actually verify a claim from the proof affordance. |
| Source trace summary | `Source coverage` cards showing engine label, citation id, status, confidence, claim count, guardrail label, timestamp | Users may not connect these cards back to the claim they just read. |
| Sparse-data / withheld states | `Missing or uncertain signals`, recommendation empty states, summary withheld states | We need to know whether buyers understand that missing evidence blocks certainty rather than simply meaning “the UI is incomplete.” |
| Buyer-safe summary | `Buyer-safe summary`, `Copy summary`, `Share summary` | Summary wording is a likely overstatement risk if participants repeat it with more certainty than the UI intends. |
| Broker review | `Broker adjudication`, `Open linked source trace`, `Approve source`, `Override source`, `Reason category`, `Detail (optional)` | Brokers need to understand what to review, how that review affects buyer-visible output, and whether the source-trace linkage is sufficient. |
| Recommendation handoff | `Offer cockpit` CTA from overview and `Offer scenarios` in the offer route | We need to verify whether users understand the relationship between the overview recommendation and the editable scenario grid. |

## Test Sample

Run 10 moderated sessions in two waves.

- Wave 1: 4 buyers, 2 brokers
- Wave 2: 2 buyers, 2 brokers after first-round fixes to confirm that the critical comprehension issues are actually resolved

Participant profile:

- Buyers: active homebuyers or recent buyers who can reason about asking price, contingencies, and broker involvement
- Brokers: active buyer-side agents or brokers who regularly explain pricing posture and review recommendation quality

Do not substitute internal teammates for either role.

## Test Fixtures

Use three seeded deal-room states. Sessions should use the real UI, not slides.

### Fixture A: ready buyer-safe overview

Goal: baseline comprehension when the overview is mostly complete.

Must include:

- visible `Recommended action`
- at least 3 `Comparative claims`
- populated `Confidence behind the recommendation`
- populated `Source coverage`
- shareable `Buyer-safe summary`

The existing preview shape in `src/components/dealroom/preview-data.ts` is the right starting point:

- `78% confidence`
- `Suggested opener` of `$928,000`
- one pending `Offer strategy` refresh

### Fixture B: mixed evidence / sparse data

Goal: verify whether users notice uncertainty and understand safe next steps.

Must include:

- recommendation visible but softened
- at least 1 `Missing or uncertain signals` card
- at least 1 confidence section with `Mixed evidence` or `Waiting on evidence`
- withheld or partial buyer-safe summary state

### Fixture C: internal broker review

Goal: validate trust and adjudication behavior.

Must include:

- internal variant of overview
- at least 2 `Broker adjudication` items
- one `pending` source
- one `rejected` or overridable source
- linked claims for at least one adjudication row

## Session Structure

Run each session for 45 minutes.

1. Warm-up, 5 minutes
2. First-pass overview comprehension, 10 minutes
3. Confidence and source-trace tasks, 10 minutes
4. Recommendation and actionability tasks, 10 minutes
5. Summary wording or broker adjudication tasks, 7 minutes
6. Debrief, 3 minutes

Moderator rule: do not explain what confidence, source trace, or guardrails mean unless the task specifically asks the participant to interpret them. We are testing comprehension, not guided training.

## Buyer Tasks

### Buyer Task 1: first-pass decision memo read

Prompt:

`You just opened this property. In under a minute, tell me what the product thinks you should do next and why.`

Success criteria:

- participant identifies the current action direction without prompting
- participant cites at least one reason from the overview memo/takeaway area
- participant distinguishes the case for action from raw facts

Failure signals:

- cannot locate a single place that explains the case
- reads isolated badges or claim cards but cannot summarize the recommendation
- interprets the page as a dashboard of unrelated widgets rather than one decision surface

Triggered changes:

- if 2 or more buyers cannot point to a clear memo location, consolidate `headerDescription` and `keyTakeaways` into an explicitly labeled `Decision memo` section
- if buyers ignore the current memo area and jump straight to claims, move the memo closer to `Recommended action` and shorten the proof stack

### Buyer Task 2: interpret confidence correctly

Prompt:

`What does the confidence on this screen mean to you? What would make you trust the recommendation more or less?`

Success criteria:

- participant explains confidence as evidence strength or recommendation support
- participant does not interpret confidence as seller acceptance probability
- participant can name one missing or conflicting input from the confidence surfaces

Failure signals:

- treats `73% action confidence` as “73% chance the offer gets accepted”
- confuses `pending review` or `held back` with product bugs instead of evidence state
- cannot explain the difference between `Confidence details` and `Confidence behind the recommendation`

Triggered changes:

- if 2 or more buyers interpret confidence as outcome probability, replace percent-first phrasing with evidence-first copy such as `Moderate support from current evidence`
- if buyers cannot distinguish the two confidence surfaces, collapse the disclosure into the section breakdown or remove one of them

### Buyer Task 3: verify a claim with source trace

Prompt:

`Pick the claim you trust least. Show me how you would check where it came from.`

Success criteria:

- participant uses `View source` on a claim or navigates to the matching `Source coverage` card
- participant can tell which engine/source row supports the claim
- participant can describe whether the proof feels sufficient

Failure signals:

- does not notice `View source`
- lands in `Source coverage` and cannot tell whether the new location proves the claim
- expects richer proof than the anchor jump provides and reports that the product still feels opaque

Triggered changes:

- if 40% or more of participants miss `View source`, increase prominence on the claim card and attach a visible explanation of what opens
- if the source jump does not satisfy trust, replace anchor-only trace with a richer trace drawer or an inline linked-claim preview

### Buyer Task 4: act on the recommendation safely

Prompt:

`Would you use this recommendation with your broker today? If yes, what number or posture would you take forward? If no, what is stopping you?`

Success criteria:

- participant states the opener as a starting point, not a guaranteed answer
- participant mentions at least one qualifier, risk, or pending signal
- participant understands whether the next action is to continue in `Offer cockpit`, wait, or ask the broker to review

Failure signals:

- quotes the opener as an exact answer without mentioning review, risk, or uncertainty
- misses the `Illustrative opener` / softened treatment entirely
- is unclear whether to go to `Offer cockpit` or `Close dashboard`

Triggered changes:

- if buyers treat the opener as final instruction, rename the price block to `Illustrative starting range` and repeat broker-review language above the number instead of below it
- if buyers hesitate between `Offer cockpit` and `Close dashboard`, hide or demote the irrelevant CTA based on stage

### Buyer Task 5: use the buyer-safe summary

Prompt:

`Imagine you are texting your partner after reading this. Would you copy or share the buyer-safe summary as-is? What sounds too strong or too weak?`

Success criteria:

- participant understands the summary as a buyer-safe recap, not legal/compliance approval
- participant spots when the summary should mention missing evidence or softened guidance
- participant can say whether the wording matches the rest of the page

Failure signals:

- summary sounds more certain than the recommendation and confidence surfaces
- participant would share the summary while being unable to explain the caveats it leaves out
- participant thinks `buyer-safe` means “fully approved to act on without broker review”

Triggered changes:

- if summary wording is consistently restated with higher certainty than the UI intends, prepend uncertainty context before the recommendation line in `buildBuyerSafeSummaryText`
- if `buyer-safe` is misunderstood as `fully approved`, rename the card to `Shareable summary` and move buyer-safe/compliance language into helper text

## Broker Tasks

### Broker Task 1: assess whether the overview is safe to forward

Prompt:

`You are reviewing this before the buyer acts on it. Is the overview safe to leave as-is? What would you verify first?`

Success criteria:

- broker identifies whether the current overview is safe to leave live
- broker inspects recommendation, confidence, and source state before answering
- broker names at least one proof or review dependency

Failure signals:

- broker answers based only on opener or headline copy
- ignores pending or rejected evidence states
- cannot tell which part of the overview is buyer-safe versus review-sensitive

Triggered changes:

- if brokers cannot quickly identify review-sensitive content, elevate review state into the recommendation and source-trace surfaces
- if they cannot tell buyer-safe output from review context, separate buyer-facing copy from adjudication copy more sharply

### Broker Task 2: review and override a source

Prompt:

`Open broker adjudication. Find a source you would approve or override, and talk me through what you expect to happen to the buyer-facing case.`

Success criteria:

- broker opens `Broker adjudication`
- uses `Open linked source trace`
- chooses `Approve source` or `Override source` with a meaningful reason category
- explains expected downstream effect on the memo or recommendation

Failure signals:

- cannot tell which row matters most
- does not trust the source linkage enough to make an adjudication decision
- treats override reasons as compliance logging only, not as a change to buyer-visible advice

Triggered changes:

- if brokers cannot prioritize rows, sort adjudication items by buyer-visible claim count and review state severity
- if override impact is unclear, add preview copy showing which claim or recommendation depends on that source

### Broker Task 3: reconcile overview recommendation with offer scenarios

Prompt:

`Start on the overview, then go to Offer cockpit. Tell me whether the scenarios match the recommendation you just saw.`

Success criteria:

- broker explains the relationship between overview recommendation and `Offer scenarios`
- can identify the recommended scenario in the cockpit
- understands that the overview recommendation is a starting point and the cockpit is the execution surface

Failure signals:

- perceives the offer route as a conflicting second opinion
- cannot tell why scenario confidence and overview confidence differ
- thinks the cockpit invalidates the overview memo

Triggered changes:

- if brokers perceive conflict between surfaces, add shared wording between the overview recommendation and `Offer scenarios` input summary
- if scenario confidence is read as a different kind of confidence with no explanation, add a plain-language note tying backend scenario confidence to the overview recommendation

## Likely Confusion, Overload, And Trust Failures To Watch

| Risk | Where it happens now | What to listen for | Triggered change if observed |
| --- | --- | --- | --- |
| No single clear memo | `Buyer-safe case` header plus separate takeaway cards | “I know the pieces, but I cannot tell what the main case is.” | Convert the split memo into one clearly labeled `Decision memo` block. |
| Confidence reads like prediction, not support | `78% confidence`, `73% action confidence` | “So it’s a 73% chance this offer works.” | Rewrite confidence labels to emphasize evidence support instead of numeric odds. |
| Confidence overload | `Confidence details` plus `Confidence behind the recommendation` | “These look like two different confidence systems.” | Cut one layer or merge them into one progressive-disclosure model. |
| Trace does not feel like proof | `View source` jumps to `Source coverage` | “I clicked source, but I still can’t see why this proves the claim.” | Replace anchor jump with richer trace context or claim-linked evidence drawer. |
| Recommendation over-trusted | `Suggested opener` / `Illustrative opener` | “Great, I should offer exactly this.” | Rename and restyle the recommendation as an advisory range with more visible guardrail wording. |
| Sparse-data state under-signals risk | `Missing or uncertain signals` card sits below recommendation | “I saw that later, but it didn’t change the main advice.” | Promote blocker or pending state into the recommendation card or header. |
| Summary overstates certainty | `Buyer-safe summary` copy/share | “I’d send this, but it sounds firmer than the page did.” | Inject missing-signal and caveat language into the generated summary. |
| Broker review impact is unclear | `Broker adjudication` | “I can approve this source, but I don’t know what buyer text changes.” | Add linked-claim preview and expected output impact next to adjudication controls. |
| CTA competition | `Offer cockpit` and `Close dashboard` both visible from overview | “I’m not sure which route I’m supposed to take.” | Stage-gate the secondary CTA or demote it visually. |

## Success Thresholds

Treat these as release gates for v1.1, not aspirational metrics.

- No critical confusion remains unresolved after Wave 1 fixes.
- At least 5 of 6 buyer sessions must correctly explain:
  - the current recommendation
  - what confidence means
  - at least one missing or pending signal
- At least 4 of 4 broker sessions must complete a source-review task without moderator explanation of the adjudication model.
- At least 75% of participants must successfully use source trace to inspect a claim.
- Fewer than 25% of buyers may interpret recommendation confidence as acceptance odds.
- Fewer than 25% of buyers may say they would share the summary while missing material caveats.

Severity rubric:

- Critical: unsafe action or false trust caused by wording or IA; fix before more sessions
- High: task failure rate of 40% or more on a core surface; fix before broader rollout
- Medium: hesitation, slow path, or duplicated mental model without unsafe action; fix if low-cost before launch, otherwise queue immediately after
- Low: cosmetic or copy polish that does not change comprehension or trust

## Required Capture

For every session, record:

- participant role and experience level
- fixture used
- whether first-pass recommendation was correct
- participant definition of confidence in their own words
- whether they noticed `View source` without prompting
- whether they could explain a missing or pending signal
- whether they would use/share the summary
- exact quote for the highest-severity confusion
- concrete UI change implied by that confusion

Pair moderator notes with already-shipping telemetry where possible:

- `advisory_memo_viewed`
- `advisory_recommendation_viewed`
- `advisory_confidence_details_expanded`
- `advisory_source_trace_opened`
- `advisory_broker_adjudication_opened`
- `advisory_buyer_safe_summary_copied`
- `advisory_buyer_safe_summary_shared`

Telemetry does not replace moderated observation. It only helps confirm whether confusion happened before or after a surface was opened.

## Synthesis Output Format

After the sessions, publish findings in this structure:

1. surface tested
2. participant quote
3. observed failure or success
4. severity
5. recommended change
6. owner issue to update

Map findings directly into these downstream workstreams:

- IA and composition: `KIN-1046`
- sparse-data / withheld-state behavior: `KIN-1047`
- release go/no-go and cut-line decisions: `KIN-1048`
- mobile follow-up only after web comprehension is fixed: `KIN-1050`

## Decision Rules After Testing

- If buyers cannot explain the memo back, change IA before adding more advisory surfaces.
- If confidence is misread as probability, change wording before broad launch.
- If source trace fails to build trust, improve trace design before adding more recommendation depth.
- If sparse-data states are ignored, escalate blocker language and placement before shipping to wider traffic.
- If the summary is more forceful than the memo, rewrite the summary generator before enabling outbound sharing at scale.

The output of KIN-1049 is complete only when these sessions produce concrete revision decisions, not just a list of participant opinions.
