# Shared Component Library

Code-backed component contract for `KIN-945`.

This file covers the reusable shadcn-based primitives and product components that now span marketing, the buyer dashboard, the deal room, and the internal console. Reference intent still lives in [component-catalog.md](./component-catalog.md); this file documents the actual code shapes, slot rules, and consumer examples.

## Core files

- `src/components/product/PasteLinkCtaCard.tsx`
- `src/components/product/PropertyCard.tsx`
- `src/components/product/ScoreBadge.tsx`
- `src/components/product/KPICard.tsx`
- `src/components/product/SegmentedTabs.tsx`
- `src/components/product/SurfaceDrawer.tsx`
- `src/components/product/PricingPanel.tsx`
- `src/components/product/CalculatorField.tsx`
- `src/components/product/TimelineStep.tsx`
- `src/components/product/SurfaceState.tsx`
- `src/components/product/LoadingState.tsx`

## PasteLinkCtaCard

Consumers:
- Homepage hero via `src/components/marketing/HeroInput.tsx`
- Buyer dashboard via `src/components/dealroom/PasteLinkCTA.tsx`

Slots:
- `controls`
- `children`
- `footer`

Composition rules:
- Keep eyebrow, title, and support copy in the fixed header area.
- Put mode switches in `controls`; do not mix them into the prose block.
- Put the primary intake input/form in `children`.
- Use `surface="marketing"` for public hero usage and `surface="product"` for authenticated surfaces.

Example:

```tsx
<PasteLinkCtaCard
  eyebrow="Start a new analysis"
  title="Paste any listing link to see pricing, comps, and leverage."
  description="Drop a Zillow, Redfin, or Realtor.com URL."
  controls={<SegmentedTabs items={items} value={mode} onValueChange={setMode} />}
>
  <PasteLinkInput variant="hero" onSubmit={handleSubmit} />
</PasteLinkCtaCard>
```

## PropertyCard

Consumers:
- Buyer dashboard / search grid via `src/components/dealroom/DealRoomCard.tsx`
- Design system showcase for documentation

Slots:
- Optional status badge
- Optional activity label
- Optional score badge overlay

Composition rules:
- Keep the media block at `16:9`.
- Put score in the media overlay, not in the text column.
- Use `eyebrow` for workflow state and `activityLabel` for freshness.
- Keep facts to one compact row: beds, baths, sqft.

Example:

```tsx
<PropertyCard
  href={`/dealroom/${dealRoomId}`}
  eyebrow={projectStatusLabel(row)}
  address={row.addressLine}
  detail="Property details loading"
  price={row.listPrice}
  beds={row.beds}
  baths={row.baths}
  sqft={row.sqft}
  score={row.score}
  imageUrl={row.primaryPhotoUrl}
  activityLabel={formatDealRoomActivity(row.updatedAt, now)}
/>
```

## ScoreBadge

Consumers:
- Deal room cards
- Offer scenarios
- Property card overlays

Composition rules:
- Use a `0-10` scale for buyer-facing competitiveness scoring.
- Prefer `variant="soft"` for surface overlays and `variant="solid"` only when the badge must dominate a dense data block.

Example:

```tsx
<ScoreBadge score={9.4} maxScore={10} size="sm" />
```

## KPICard

Consumers:
- Buyer dashboard summary band
- Internal console metric tiles

Composition rules:
- Use `density="compact"` in four-up summary bands.
- Use `tone` to highlight urgency; do not add bespoke background treatments at the call site.
- Keep descriptions short enough to fit one line in compact mode.

Example:

```tsx
<KPICard
  label="Urgent follow-up"
  value="2"
  tone="warning"
  trend={{ direction: "up", text: "1 new" }}
/>
```

## SegmentedTabs

Consumers:
- Homepage hero intake mode switch
- Design system showcase

Composition rules:
- Use for mode switches or shell-level alternate views with 2-4 options.
- Keep labels short.
- Do not use it as a content-rich navigation bar.

Example:

```tsx
<SegmentedTabs
  items={[
    { value: "link", label: "Paste link" },
    { value: "address", label: "Enter address" },
  ]}
  value={mode}
  onValueChange={setMode}
/>
```

## SurfaceDrawer

Consumers:
- Buyer dashboard mobile shell via `src/components/dealroom/AppSidebar.tsx`
- Internal console mobile shell via `src/components/admin/AdminShell.tsx`

Composition rules:
- Use for compact mobile navigation and dense secondary actions.
- Keep title + description concise; the drawer should orient quickly.
- Close the drawer on route change selection.

Example:

```tsx
<SurfaceDrawer
  open={open}
  onClose={() => setOpen(false)}
  title="Buyer dashboard"
  description="Jump between onboarding, deal rooms, offers, and close tasks."
>
  <nav>{/* links */}</nav>
</SurfaceDrawer>
```

## PricingPanel

Consumers:
- Savings calculator result state
- Savings calculator zero-commission state
- Design system showcase

Slots:
- `highlights`
- `footer`

Composition rules:
- Use `value` for the primary pricing figure.
- Put secondary math rows in `highlights`.
- Put disclosures in `footer`; do not mix them into the result rows.

Example:

```tsx
<PricingPanel
  eyebrow="Estimated buyer credit"
  title="Projected closing credit"
  value={formatUSD(result.buyerCreditAmount)}
  description={`at closing on a ${formatUSD(result.input.purchasePrice)} purchase`}
  highlights={[<ResultRow key="credit" label="Your credit back" value="$16,500" emphasized />]}
  footer={<HeadlineDisclosures />}
/>
```

## CalculatorField

Consumers:
- Savings calculator controls

Composition rules:
- Keep suffix outside the editable text area.
- Use helper text for regulatory or interpretive support, not validation.
- Validation output should render outside the field component.

Example:

```tsx
<CalculatorField
  id="buyer-credit"
  label="Buyer credit (our rebate)"
  suffix="%"
  value={raw.buyerCreditPercent}
  onChange={(next) => onChange("buyerCreditPercent", next)}
  placeholder="33"
  inputMode="decimal"
/>
```

## TimelineStep

Consumers:
- Design system showcase
- Ready for close-dashboard and deal-room timeline use

Composition rules:
- Use `completed`, `current`, and `upcoming` only.
- Keep descriptions short; multi-paragraph copy belongs in adjacent cards, not inside the step.

Example:

```tsx
<TimelineStep
  label="Counteroffer review"
  description="Waiting on seller response and next buyer decision."
  status="current"
/>
```

## SurfaceState and LoadingState

Consumers:
- Buyer dashboard empty state
- Deal room overview loading/error states
- Internal console empty states

Composition rules:
- Use `SurfaceState` for empty or error messaging.
- Use `LoadingState` for structure-preserving skeletons.
- Avoid one-off dashed cards when one of these already fits.

Examples:

```tsx
<SurfaceState
  tone="error"
  title="This deal room overview is not available."
  description="The overview stays hidden until buyer-safe evidence and route data are available."
/>
```

```tsx
<LoadingState variant="panel" />
```
