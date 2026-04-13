# KIN-963 - Florida Compliance Matrix

Status: Accepted
Parent: `KIN-966`
Date: 2026-04-13
Scope: Florida agreements, tour gating, compensation/rebate, communications, collaborator-share and referral boundaries

## Decision Summary

- Weekend open-house registration stays a distinct, lighter-weight funnel. It must never silently enter the private-tour or buyer-representation workflows.
- Private tours require a signed `tour_pass` or `full_representation` agreement derived from backend state, not a client-supplied snapshot.
- Offer drafting, negotiation, listing-side compensation exchange, and contract-generation surfaces require `full_representation`, not just `tour_pass`.
- Exact compensation, rebate, and closing-credit numbers are deal-specific. Public surfaces may educate with examples, but buyer-specific commitments require broker review and lender-cap validation.
- SMS can operate only through explicit opt-in / opt-out / suppression state. Calling and AI voice are blocked from launch until dedicated consent, disclosure, retention, and audit fields exist.
- Deal-room share links are collaborator access only. They are not a referral program, not buyer-agent solicitation, and not a way to route unlicensed third parties into license-critical workflows.
- Any rule or copy change that alters agency relationship, compensation language, rebate promises, AI calling behavior, or referral incentives requires explicit broker and/or legal sign-off as defined below.

## Implementation Anchors

| Area | Current repo anchors | Related Linear issues |
| --- | --- | --- |
| Public compensation / legal copy | `src/lib/pricing/disclosures.ts`, `src/content/disclosures.ts`, `src/content/legal.ts`, `src/content/faq.ts`, `convex/settings.ts` | `KIN-912`, `KIN-773`, `KIN-963` |
| Open-house preregistration | `src/lib/preregistration/types.ts`, `src/lib/preregistration/logic.ts`, `convex/schema.ts` (`visitorPreregistrations`) | `KIN-901` |
| Buyer agreements and audit | `convex/agreements.ts`, `convex/agreementAudit.ts`, `convex/agreementSupersession.ts`, `packages/shared/src/contracts.ts`, `convex/schema.ts` (`agreements`, `agreementAuditEvents`) | `KIN-928`, `KIN-927`, `KIN-929`, `KIN-870`, `KIN-961` |
| Private-tour request / showing ops | `src/lib/tours/requestValidation.ts`, `convex/tourRequests.ts`, `convex/tours.ts`, `convex/schema.ts` (`tourRequests`, `tours`) | `KIN-879`, `KIN-972`, `KIN-923`, `KIN-1012` |
| Offer eligibility | `convex/offerEligibility.ts`, `convex/schema.ts` (`offerEligibilityState`) | `KIN-915`, `KIN-917` |
| Compensation / rebate / closing credit | `convex/ledger.ts`, `convex/lenderCreditValidation.ts`, `convex/listingResponses.ts`, `convex/externalAccess.ts`, `convex/schema.ts` (`feeLedgerEntries`, `compensationStatus`, `lenderCreditValidations`, `listingResponses`) | `KIN-925`, `KIN-900`, `KIN-1018`, `KIN-959` |
| SMS / delivery preferences | `src/lib/messagePreferences.ts`, `convex/messagePreferences.ts`, `convex/buyerProfiles.ts`, `convex/smsIntake.ts`, `src/lib/intake/sms.ts`, `convex/schema.ts` (`messageDeliveryPreferences`, `smsConsent`, `smsIntakeMessages`) | `KIN-956`, `KIN-904`, `KIN-918`, `KIN-930` |
| Collaborator share access | `convex/dealRoomShareLinks.ts`, `src/lib/dealroom/share-link.ts`, `convex/schema.ts` (`dealRoomShareLinks`, `dealRoomShareLinkEvents`) | `KIN-988`, `KIN-959` |

## Sign-Off Boundaries

| Change type | Broker sign-off | Legal sign-off | Notes |
| --- | --- | --- | --- |
| Public copy about agency relationship, representation, compensation, rebate, builder incentives, closing-credit treatment, or AI calling | Required | Required | Includes `src/content/legal.ts`, `src/content/disclosures.ts`, `src/content/faq.ts`, `src/lib/pricing/disclosures.ts`, and any settings-backed disclosure copy. |
| Agreement template text, disclosure versions, agreement transition rules, or who may sign / upgrade / replace an agreement | Required | Required | Covers `tour_pass`, `full_representation`, and any replacement/supersession rules. |
| Deal-specific compensation confirmation, rebate percent, projected buyer credit, lender-cap exception, or manual override | Required | Not required unless copy or legal interpretation changes | Broker review must be stored or derivable from audit state. |
| Lender / IPC validation rows in `review_required` state | Required | Not required | Broker can approve or reject; legal only if policy text or program interpretation changes. |
| SMS suppression and STOP handling | Operational review only | Not required | Must follow the explicit consent model from `KIN-956`; no ad hoc exceptions. |
| New call or AI-voice flow, disclosure script, or recording policy | Required | Required | Blocked until dedicated state and audit fields exist. |
| Deal-room collaborator share link UX or scopes | Required if the surface exposes more than read-only collaboration | Required if it changes referral / compensation / solicitation posture | Sharing must remain collaborator-only unless a separate licensed referral program is implemented. |
| Internal-only referral economics or partner bonus logic | Required | Required before any externalization | The internal FAQ entry is not a public contract and must remain internal-only. |

## Rule Summary Matrix

| Rule | Domain | Current status | Broker sign-off | Legal sign-off | Primary surfaces |
| --- | --- | --- | --- | --- | --- |
| `OH-1` | Open-house preregistration remains distinct from private tour | Partial | Only for assisted conversion | Only if the public disclaimer changes | `KIN-901`, `visitorPreregistrations`, preregistration logic |
| `TOUR-1` | Private tours require signed `tour_pass` or `full_representation` | Covered | Required for agreement lifecycle | Required for agreement template / copy changes | `KIN-928`, `KIN-879`, `convex/tourRequests.ts`, `convex/tours.ts` |
| `OFFER-1` | Offer / negotiation / contract surfaces require `full_representation` | Covered | Required | Required for agreement / compensation copy changes | `KIN-927`, `KIN-915`, `KIN-900` |
| `COMP-1` | Public compensation education stays illustrative, not deal-specific | Covered | Required when changing figures shown to a buyer | Required for copy changes | `src/lib/pricing/disclosures.ts`, `src/content/legal.ts`, `KIN-912` |
| `COMP-2` | Deal-specific compensation and rebate require broker-reviewed ledger state | Partial | Required | Not required unless policy wording changes | `KIN-925`, `convex/ledger.ts`, `convex/listingResponses.ts` |
| `COMP-3` | IPC / closing-credit guidance must run lender-cap validation before commitment | Partial | Required for review-required / override | Only if policy wording changes | `convex/lenderCreditValidation.ts`, `KIN-1018` |
| `COMM-1` | SMS must honor explicit consent, STOP, HELP, and suppression | Covered for SMS only | Not required for normal send path | Required if copy or channel scope changes | `KIN-956`, `KIN-904`, `smsConsent`, `smsIntakeMessages` |
| `COMM-2` | Calling and AI voice need separate consent and disclosure state | Gap | Required | Required | No implementation surface yet; blocked by missing state |
| `SHARE-1` | Deal-room share links are collaborator-only, not referral or agency delegation | Partial | Required for scope expansion | Required for any referral incentive or solicitation change | `KIN-988`, `convex/dealRoomShareLinks.ts` |
| `REF-1` | Unlicensed referral / friend-share cannot enter compensation or negotiation flows | Gap | Required | Required | Internal FAQ entry exists; explicit product guardrails do not |

## Detailed Rules

### `OH-1` Weekend open-house preregistration stays lighter than private tour

Status: Partial

Product surfaces

- Open-house / weekend visitor form and reminder flow backed by `src/lib/preregistration/types.ts`, `src/lib/preregistration/logic.ts`, and `convex/schema.ts` `visitorPreregistrations`.
- Public-site acquisition flow under `KIN-901`.

Backend checks and workflow guards

- Use `visitorPreregistrations` only. Do not create `tourRequests`, `tours`, `agreements`, or `offerEligibilityState` rows during initial preregistration.
- Allowed preregistration conversions remain explicit and typed: `buyer_agreement_signed`, `private_tour_requested`, `deal_room_created`.
- A conversion from open-house attendance into private tour must create a new deal-room / agreement path rather than mutating the preregistration into a tour request.
- Open-house copy must not promise representation, negotiation, or rebate entitlement merely by preregistering.

Human review requirement

- Broker sign-off is required when staff converts a preregistration directly into `buyer_agreement_signed` or `private_tour_requested`.
- Legal sign-off is required only if the preregistration disclaimer or CTA language changes in a way that could imply agency or compensation.

Required data fields

- Existing: `propertyId`, `eventStartAt`, `eventEndAt`, `visitorName`, `visitorEmail`, `visitorPhone`, `partySize`, `visitorNote`, `status`, `conversion.kind`, `conversion.targetRefId`, `conversion.convertedAt`.
- Add before broad launch:
  - `disclosureVersion`: string. Version of the open-house disclaimer shown at form submit.
  - `followUpConsent`: object keyed by `email`, `sms`, `call`; needed if the prereg flow triggers post-event outreach before account creation.
  - `sourceSurface`: enum (`landing_page`, `deal_room`, `broker_invite`, `qr_code`) so audit and analytics can distinguish open-house capture from deal-room engagement.

Downstream issue mapping

- Consumes `KIN-901`.
- Any open-house to private-tour bridge must reuse `KIN-928`, `KIN-879`, and `KIN-915`.
- If the missing fields above are added, they should land under the public-site acquisition umbrella rather than the tour-request module.

### `TOUR-1` Private tours require signed `tour_pass` or `full_representation`

Status: Covered

Product surfaces

- Buyer deal-room private-tour CTA and validation layer in `src/lib/tours/requestValidation.ts`.
- Backend creation and submission in `convex/tourRequests.ts`.
- Executed showing record in `convex/tours.ts`.
- Ops queue and showing coordination surfaces under `KIN-972`.

Backend checks and workflow guards

- `convex/tourRequests.ts` derives the live agreement snapshot from the `agreements` table. The client cannot provide its own signed-state claim.
- `convex/tours.ts` separately checks for a signed `tour_pass` before `requestTour`, which is correct defense in depth for the executed tour layer.
- A valid private-tour request requires either `agreementStateSnapshot.type = tour_pass` or `full_representation`, with `status = signed`.
- If a signed agreement is later replaced or canceled, downstream gating must recalculate from live agreement state; the frozen request snapshot remains audit evidence only.

Human review requirement

- Broker sign-off is required for agreement draft/send/sign/replace/cancel operations and for any manual override of a blocked request.
- Legal sign-off is required for agreement template or representation-copy changes, not for normal request processing.

Required data fields

- Existing agreement fields: `type`, `status`, `effectiveStartAt`, `effectiveEndAt`, `sentAt`, `signedAt`, `canceledAt`, `supersededAt`, `supersessionReason`, `replacedById`, document metadata.
- Existing tour-request fields: `preferredWindows`, `attendeeCount`, `buyerNotes`, frozen `agreementStateSnapshot`, `blockingReason`, `failureReason`, `internalNotes`.
- Add:
  - `agreementDisclosureVersion`: string on `agreements` so audit can prove which disclosure copy governed the signature.
  - `brokerReviewedByUserId` and `brokerReviewedAt` on agreement lifecycle or a dedicated review table if audit-log reconstruction is deemed too indirect.
  - `requestChannel`: enum on `tourRequests` (`deal_room`, `broker_assisted`, `post_open_house`) so policy reporting can distinguish direct private tours from open-house follow-ons.

Downstream issue mapping

- Already implemented by `KIN-928`, `KIN-879`, `KIN-972`, `KIN-929`, `KIN-870`.
- `KIN-1012` should re-own this flow with the same invariant: no private-tour advance without signed agreement state from backend truth.

### `OFFER-1` Offer, negotiation, and contract workflows require `full_representation`

Status: Covered

Product surfaces

- Offer-entry gate in `convex/offerEligibility.ts`.
- Offer UI entry points such as `src/components/offer/EligibilityGate.tsx` and `src/components/offer/OfferCockpit.tsx`.
- Contract adapter path in `packages/shared/src/contracts.ts` and `convex/contracts.ts`.

Backend checks and workflow guards

- `offerEligibilityState` is the cached read model, but `agreements` remains the source of truth.
- `tour_pass` is sufficient for private tours but insufficient for offer drafting, listing-side negotiation, contract generation, or compensation confirmation.
- Required action on a blocked offer path is machine-readable: `sign_agreement` or `upgrade_to_full_rep`.
- Any listing-side communication tied to an offer or compensation must use `full_representation` plus a broker-controlled path.

Human review requirement

- Broker sign-off is required before any offer is sent, countered, or converted into a Florida contract package.
- Legal sign-off is required only when the full-representation agreement template or contract-mapping disclosures change.

Required data fields

- Existing: `offerEligibilityState.isEligible`, `currentAgreementType`, `governingAgreementId`, `blockingReasonCode`, `requiredAction`.
- Existing Florida contract fields in `packages/shared/src/contracts.ts`.
- Add:
  - `offerRepresentationDisclosureVersion`: string linked to the governing agreement or offer-eligibility record.
  - `negotiationAuthorityCapturedAt`: timestamp proving the buyer explicitly entered the full-representation state before listing-side communication.

Downstream issue mapping

- Implemented by `KIN-927`, `KIN-915`, `KIN-917`, `KIN-900`.
- Any future offer UX must consume the same `requiredAction` contract rather than inventing alternate local gating.

### `COMP-1` Public compensation / rebate copy remains illustrative

Status: Covered

Product surfaces

- `src/lib/pricing/disclosures.ts`
- `src/content/disclosures.ts`
- `src/content/legal.ts`
- `src/content/faq.ts`
- Admin-managed disclosure catalog in `convex/settings.ts`

Backend checks and workflow guards

- Public surfaces may explain historical commission ranges, negotiability, and the existence of a rebate model.
- Public surfaces must not present property-specific compensation, promised savings, or lender-feasible closing-credit amounts without a deal-room record and broker-reviewed state.
- Builder-incentive copy must continue to state that stacking is subject to written terms.

Human review requirement

- Broker and legal sign-off are both required for any copy or settings change that affects compensation, rebate, builder-incentive, or agency language.

Required data fields

- Existing public disclosure ids: `estimate_not_guarantee`, `commission_negotiable`, `buyer_credit_conditions`, `licensed_brokerage`, `no_fee_offer_acceptance`, plus brokerage relationship disclosures.
- Add:
  - `disclosureVersion` for any public copy surfaced inside a deal room or agreement flow so the buyer-visible version can be audited later.
  - `settingsApprovalRef` for settings-backed disclosure entries when content changes outside source control.

Downstream issue mapping

- Consumes `KIN-912` / `KIN-773`.
- Any settings-backed copy publishing workflow should be handled as a separate internal tooling issue if approval metadata is added.

### `COMP-2` Deal-specific compensation and rebate require broker-reviewed ledger state

Status: Partial

Product surfaces

- Fee ledger and compensation rollup in `convex/ledger.ts`.
- Listing-side compensation responses in `convex/listingResponses.ts`.
- Limited external counterparty token model in `convex/externalAccess.ts`.
- Deal-room pricing, close, and rebate surfaces under `KIN-925`, `KIN-984`, `KIN-1018`.

Backend checks and workflow guards

- Buyer-specific compensation numbers must come from `compensationStatus` and `feeLedgerEntries`, not from public calculator assumptions.
- Listing-side compensation updates require a scoped external token permitting `confirm_compensation` and must write auditable response records.
- Compensation status transitions must be explicit and auditable: do not infer “confirmed” solely from UI state.
- Any rebate below the configured operational floor already requires manual broker approval per `convex/settings.ts`; treat that as a hard backend gate, not just UI copy.

Human review requirement

- Broker sign-off is required whenever compensation is confirmed, disputed, overridden, or surfaced to the buyer as a deal-specific figure.
- Legal sign-off is not needed for ordinary state transitions, but is required if the disclosure language or rebate policy changes.

Required data fields

- Existing: `compensationStatus.status`, `previousStatus`, `transitionReason`, `transitionActorId`, `expectedBuyerFee`, `sellerPaidAmount`, `buyerPaidAmount`, `projectedClosingCredit`.
- Existing: fee-ledger `bucket`, `dimension`, `amount`, `source`, lifecycle, provenance.
- Existing: listing-response compensation payload (`confirmedPct`, `confirmedFlat`, `disputeReason`) and external token scope.
- Add:
  - `compensationDisclosureVersion`: string on either `compensationStatus` or a related review record.
  - `brokerApprovedAt`, `brokerApprovedByUserId`: required when compensation moves from externally confirmed to buyer-visible.
  - `builderIncentiveCompatibility`: enum (`unknown`, `allowed`, `disallowed`, `review_required`) with optional `sourceDocument`.

Downstream issue mapping

- Consumes `KIN-925`, `KIN-959`, `KIN-960`.
- `KIN-1018` should add the missing approval/disclosure fields above if the ledger model is re-authored.

### `COMP-3` IPC / closing-credit guidance needs lender-cap validation before commitment

Status: Partial

Product surfaces

- Buyer close and offer surfaces that show projected credits or cash-to-close.
- Backend validation in `convex/lenderCreditValidation.ts`.

Backend checks and workflow guards

- Use `lenderCreditValidations` before presenting any deal-specific buyer credit as operable at closing.
- `review_required` is a first-class state and must route to broker review, not silently render as valid.
- `projectedClosingCredit` shown to the buyer must be traceable to a specific validation row and ledger rollup.
- New-construction / builder incentive scenarios must run through the same validation path; builder stacking is not exempt.

Human review requirement

- Broker sign-off is required for every `review_required` validation and any manual override.
- Legal sign-off is required only if the buyer-facing credit-cap policy or copy changes.

Required data fields

- Existing: `financingType`, `purchasePrice`, `ltvRatio`, `projectedSellerCredit`, `projectedBuyerCredit`, `projectedClosingCredit`, `totalProjectedCredits`, `ipcLimitPercent`, `ipcLimitDollars`, `validationOutcome`, `reviewDecision`.
- Add:
  - `guidanceSurface`: enum to record where the validation was consumed (`offer_cockpit`, `close_dashboard`, `broker_console`).
  - `brokerDecisionReason`: structured reason code rather than freeform `reviewNotes` alone.
  - `programCapSourceVersion`: string or document ref so cap logic can be audited when lender rules change.

Downstream issue mapping

- Consumes current `convex/lenderCreditValidation.ts`.
- Any missing fields should be folded into `KIN-1018`.

### `COMM-1` SMS must honor explicit consent, STOP, HELP, and suppression

Status: Covered for SMS only

Product surfaces

- SMS intake in `convex/smsIntake.ts` with helper logic mirrored in `src/lib/intake/sms.ts`.
- Buyer communication preferences in `src/lib/messagePreferences.ts` and `convex/messagePreferences.ts`.
- Buyer profile writes in `convex/buyerProfiles.ts`.

Backend checks and workflow guards

- `smsConsent` is keyed by hashed phone only; never store raw phone numbers as the consent system of record.
- STOP, START, HELP, suppression, and deduplication must continue to be processed before any outbound reply generation.
- SMS channel stays opt-in by default; marketing remains off by default.
- Message delivery logic must consult shared preference state rather than channel-specific flags in UI code.

Human review requirement

- No broker sign-off is needed for ordinary SMS send decisions.
- Legal sign-off is required for template copy changes, disclosure changes, or expanding SMS beyond the typed consent model.

Required data fields

- Existing: `smsConsent.phoneHash`, `status`, `optedInAt`, `optedOutAt`, `suppressedAt`, `suppressedReason`, `lastTriggeringMessageSid`.
- Existing: `smsIntakeMessages.messageSid`, `phoneHash`, `outcome`, `replyBody`, `replySent`, reply-link metadata.
- Existing: `messageDeliveryPreferences.channels.sms`, category booleans.
- Add:
  - `consentSource`: enum (`web_form`, `sms_start`, `broker_assisted`, `open_house_form`) on `smsConsent`.
  - `consentDisclosureVersion`: string.
  - `suppressionScope`: enum to distinguish global suppression from channel-local suppression if voice/call is later added.

Downstream issue mapping

- Implemented today by `KIN-904`, `KIN-918`, `KIN-930`.
- Any SMS expansion should remain subordinate to the architecture in `KIN-956`.

### `COMM-2` Calling and AI voice need separate consent and disclosure state

Status: Gap

Product surfaces

- No current calling or AI-voice implementation surface exists in the repo.
- Any future broker dialer, AI call assistant, outbound reminder call, or AI voice workflow must treat this rule as launch-blocking.

Backend checks and workflow guards

- Do not reuse `messageDeliveryPreferences.channels.sms` or `smsConsent` as a proxy for call consent.
- A call workflow must capture channel-specific consent, disclosure version, whether AI voice is permitted, whether call recording is enabled, opt-out state, and retention metadata.
- AI voice cannot execute unless the workflow records that the caller disclosed AI participation and the buyer has not opted out of that channel.
- Any call or AI-voice workflow must write append-only audit records for consent capture, disclosure, initiation, connection, transfer to human, opt-out, and recording retention events.

Human review requirement

- Broker sign-off is required before launching any call workflow.
- Legal sign-off is required for the consent copy, AI disclosure script, recording/retention policy, and any escalation to AI voice.

Required data fields

- Add a new `callConsent` table keyed to buyer identity or normalized phone:
  - `buyerId` or `phoneHash`
  - `channel` (`call`, `ai_voice`)
  - `status` (`opted_in`, `opted_out`, `suppressed`)
  - `capturedAt`, `capturedBy`, `consentSource`, `consentDisclosureVersion`
  - `aiVoiceAllowed`: boolean
  - `recordingAllowed`: boolean
  - `optOutAt`, `suppressedAt`, `suppressedReason`
- Add a new `callEvents` or broader communications ledger keyed by `dealRoomId`, `buyerId`, `channel`, `templateVersion`, `scriptDisclosureVersion`, `startedAt`, `endedAt`, `transferredToHumanAt`, `recordingRef`.

Downstream issue mapping

- This rule is specified by `KIN-956` but not implemented by any current engineering issue.
- Ticket-ready implementation should live under a communications or broker-operations umbrella before any calling feature is attempted.

### `SHARE-1` Deal-room share links are collaborator-only

Status: Partial

Product surfaces

- `convex/dealRoomShareLinks.ts`
- `src/lib/dealroom/share-link.ts`
- iOS share import is out of scope; collaborator share is not the same thing as listing-link import.

Backend checks and workflow guards

- Share links remain scoped to one deal room and one of `summary_only`, `summary_and_documents`, or `full_read`.
- Share links must not grant the ability to negotiate, confirm compensation, sign agreements, or communicate as the buyer.
- Share-link creation and resolution must stay auditable.
- Collaborator share must never be used as a disguised lead-gen or referral-program surface.

Human review requirement

- Broker sign-off is required before expanding scopes beyond read-only collaboration.
- Legal sign-off is required before any share flow offers incentives, referral compensation, or public solicitation language.

Required data fields

- Existing: `dealRoomId`, `createdByUserId`, `slug`, `scope`, `status`, `expiresAt`, `accessCount`, `lastAccessedAt`.
- Add:
  - `intendedRelationship`: enum (`spouse`, `parent`, `advisor`, `other`) so ops can distinguish collaborators from referral schemes.
  - `sharePurpose`: enum (`collaboration`, `document_review`, `schedule_coordination`) to make non-referral intent explicit.
  - `disclaimerVersion`: string shown when the link is created or resolved.

Downstream issue mapping

- Builds directly on `KIN-988`.
- Any collaborator-access expansion must remain consistent with `KIN-959` limited external access boundaries.

### `REF-1` Unlicensed referral / friend-share cannot enter compensation or negotiation flows

Status: Gap

Product surfaces

- Internal-only referral economics currently appear only as the internal FAQ entry `agent_bonus_split` in `src/content/faq.ts`.
- Share-link flow in `KIN-988` is the nearest user-facing surface that could accidentally drift into a referral product if left unchecked.

Backend checks and workflow guards

- No public or buyer-facing surface may mention referral compensation, partner bonuses, or “share this deal to earn” incentives.
- Unlicensed collaborators may not receive listing-side compensation confirmation links, negotiation tasks, agreement-signing requests, or any permission that implies agency.
- If a future referral program is introduced, it must be modeled as a separate program with its own licensed-role checks, disclosures, payout policy, and tax / compliance review. Do not bolt it onto `dealRoomShareLinks`.

Human review requirement

- Broker and legal sign-off are both required before any referral or incentive feature is exposed externally.

Required data fields

- Existing: none appropriate for a public referral flow, which is correct.
- Add only if a separate referral program is deliberately created:
  - `referralProgramEnrollment`
  - `referrerRole`
  - `licenseStatusVerifiedAt`
  - `payoutEligible`
  - `referralDisclosureVersion`
  - `taxReportingStatus`

Downstream issue mapping

- No current implementation issue exists, which is the correct posture for launch.
- Any future referral program needs a dedicated issue, not an extension of `KIN-988`.

## Required Field Deltas By System

| System | Fields to add | Why |
| --- | --- | --- |
| `visitorPreregistrations` | `disclosureVersion`, `followUpConsent`, `sourceSurface` | Preserve the open-house disclaimer boundary and any pre-account communication consent. |
| `agreements` / agreement review model | `agreementDisclosureVersion`, `brokerReviewedByUserId`, `brokerReviewedAt` | Prove which disclosure text governed the agreement and who performed the licensed review. |
| `tourRequests` | `requestChannel` | Distinguish direct private tours from open-house follow-on conversions. |
| `compensationStatus` or linked review table | `compensationDisclosureVersion`, `brokerApprovedAt`, `brokerApprovedByUserId`, `builderIncentiveCompatibility` | Prevent buyer-visible compensation numbers from bypassing broker review or builder-incentive checks. |
| `lenderCreditValidations` | `guidanceSurface`, `brokerDecisionReason`, `programCapSourceVersion` | Make IPC decisions auditable and reproducible by surface and rule source. |
| `smsConsent` | `consentSource`, `consentDisclosureVersion`, `suppressionScope` | Separate how consent was captured from the fact of consent itself. |
| New `callConsent` / `callEvents` model | Channel-specific consent, AI-voice allowance, disclosure version, recording retention, opt-out state | Calling and AI voice are currently blocked because SMS-only state is insufficient. |
| `dealRoomShareLinks` | `intendedRelationship`, `sharePurpose`, `disclaimerVersion` | Keep collaboration distinct from referral or delegated agency behavior. |

## Downstream Engineering Decomposition

### Existing implementation tickets that should consume this matrix immediately

- `KIN-1012` - preserve `TOUR-1` and `OH-1` separation when re-owning tour/showing workflow.
- `KIN-1017` - add explicit disclosure-version and broker-review capture to the agreement / eligibility re-own.
- `KIN-1018` - add compensation disclosure versioning, broker approval capture, builder-incentive compatibility, and lender-cap provenance.
- `KIN-911` - add analytics events for compliance-critical state transitions only after the underlying state fields exist.

### Ticket-ready follow-ons not currently represented by a concrete implementation issue

#### 1. Implement call and AI-voice consent state and audit trail

Suggested parent: broker-operations / communications umbrella

Scope

- Add `callConsent` and `callEvents` tables.
- Gate any call or AI-voice execution on explicit channel-specific consent.
- Capture disclosure versions, AI-voice allowance, recording retention, and transfer-to-human events.

Acceptance criteria

- Calls and AI voice cannot run without explicit consent state and disclosure capture.
- Opt-out and suppression work independently from SMS state.
- Audit history reconstructs consent capture, disclosure, call start, transfer, opt-out, and retention events.

#### 2. Implement collaborator-share compliance guardrails

Suggested parent: `KIN-989`

Scope

- Extend `dealRoomShareLinks` with `intendedRelationship`, `sharePurpose`, and disclaimer versioning.
- Add UI copy that states collaborator access is read-only and not a referral or agency delegation.
- Prevent any share-link path from initiating agreement, negotiation, or compensation flows.

Acceptance criteria

- Share links remain collaboration-only.
- No collaborator surface can imply referral compensation or delegated agency authority.
- Denied attempts are auditable.

#### 3. Implement disclosure versioning and licensed-review capture across agreements and compensation

Suggested parent: `KIN-987` for agreements and `KIN-984` for compensation

Scope

- Add disclosure-version fields to agreement and compensation review state.
- Require broker review metadata before surfacing buyer-specific compensation / rebate figures.
- Ensure settings-backed disclosure changes can be tied to an approval record.

Acceptance criteria

- Every signed agreement and buyer-specific compensation presentation can be traced to the disclosure version shown.
- Broker review metadata is explicit rather than inferred from UI behavior.
- Legal / broker approval boundaries are preserved even when copy comes from settings.

## Non-Negotiable Launch Rules

- Do not collapse open-house preregistration into private-tour request creation.
- Do not let `tour_pass` unlock offer drafting, listing-side negotiation, or compensation confirmation.
- Do not show buyer-specific rebate or closing-credit numbers without broker-reviewed ledger state.
- Do not ship any call or AI-voice workflow using SMS consent as a substitute for call consent.
- Do not repurpose collaborator share links into a referral or incentive program.
