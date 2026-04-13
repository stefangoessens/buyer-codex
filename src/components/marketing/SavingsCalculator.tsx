"use client";

import { useMemo, useState } from "react";
import { CalculatorField } from "@/components/product/CalculatorField";
import { PricingPanel } from "@/components/product/PricingPanel";
import {
  calculateSavings,
  defaultCalculatorInput,
  formatUSD,
  parseRawField,
  type SavingsCalculatorInput,
} from "@/lib/pricing/savingsCalculator";
import {
  CALCULATOR_DISCLOSURES,
  getHeadlineDisclosures,
  type Disclosure,
} from "@/lib/pricing/disclosures";

/**
 * Raw-string edit state. Each field is stored as exactly what the user
 * typed (or the initial numeric default rendered to a string). This is
 * the source of truth while editing — the parsed numeric `input` is
 * derived from this state on every render via `parseRawField`.
 *
 * Keeping the raw string separate preserves transient decimal input
 * like `"2."` that would otherwise be lost if we round-tripped through
 * `Number(...)` on every keystroke — the bug that codex flagged on PR
 * #45 where typing `2.5` would immediately collapse to `25`.
 */
type RawInput = Record<keyof SavingsCalculatorInput, string>;

function toRawInput(input: SavingsCalculatorInput): RawInput {
  return {
    purchasePrice: String(input.purchasePrice),
    totalCommissionPercent: String(input.totalCommissionPercent),
    buyerAgentCommissionPercent: String(input.buyerAgentCommissionPercent),
    buyerCreditPercent: String(input.buyerCreditPercent),
  };
}

function parseRawInput(raw: RawInput): SavingsCalculatorInput {
  return {
    purchasePrice: parseRawField(raw.purchasePrice),
    totalCommissionPercent: parseRawField(raw.totalCommissionPercent),
    buyerAgentCommissionPercent: parseRawField(raw.buyerAgentCommissionPercent),
    buyerCreditPercent: parseRawField(raw.buyerCreditPercent),
  };
}

/**
 * Interactive savings calculator + commission education module for
 * the public site (KIN-772).
 *
 * The component is intentionally thin: all math lives in
 * `src/lib/pricing/savingsCalculator.ts` and all legal copy lives in
 * `src/lib/pricing/disclosures.ts`. This file only owns UI state and
 * composition.
 *
 * Two variants:
 *   - "full"    — standalone pricing page layout (default)
 *   - "compact" — homepage teaser with fewer controls and inline headline
 */
export function SavingsCalculator({
  variant = "full",
  initialPurchasePrice = 500_000,
}: {
  variant?: "full" | "compact";
  initialPurchasePrice?: number;
}) {
  const [raw, setRaw] = useState<RawInput>(() =>
    toRawInput(defaultCalculatorInput(initialPurchasePrice))
  );

  // Derive the parsed calculator input from the raw edit state.
  // Memoized so calculator runs only when a raw field actually changes.
  const input = useMemo(() => parseRawInput(raw), [raw]);
  const calculation = useMemo(() => calculateSavings(input), [input]);

  const updateField = (field: keyof SavingsCalculatorInput, next: string) => {
    setRaw((prev) => ({ ...prev, [field]: next }));
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        {/* Controls */}
        <div className="lg:col-span-3">
          <CalculatorControls raw={raw} onChange={updateField} />
        </div>

        {/* Result + headline disclosures */}
        <div className="lg:col-span-2">
          <CalculatorResultPanel calculation={calculation} />
        </div>
      </div>

      {/* Commission education accordion (full variant only) */}
      {variant === "full" && <CommissionEducation />}

      {/* Full disclosure accordion (full variant only) */}
      {variant === "full" && <FullDisclosures />}
    </div>
  );
}

// MARK: - Controls

function CalculatorControls({
  raw,
  onChange,
}: {
  raw: RawInput;
  onChange: (field: keyof SavingsCalculatorInput, next: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-md ring-1 ring-neutral-200 lg:p-8">
      <h3 className="text-xl font-semibold text-neutral-900">
        Estimate your savings
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        Adjust the assumptions to see how buyer-codex stacks up against a standard
        Florida commission.
      </p>

      <div className="mt-6 space-y-5">
        <CalculatorField
          id="purchase-price"
          label="Purchase price"
          suffix="USD"
          value={raw.purchasePrice}
          onChange={(v) => onChange("purchasePrice", v)}
          placeholder="500000"
          inputMode="numeric"
        />

        <CalculatorField
          id="total-commission"
          label="Total commission"
          suffix="%"
          value={raw.totalCommissionPercent}
          onChange={(v) => onChange("totalCommissionPercent", v)}
          placeholder="6"
          inputMode="decimal"
          help="Historically 5–6% of purchase price. Always negotiable."
        />

        <CalculatorField
          id="buyer-agent"
          label="Buyer-agent commission"
          suffix="%"
          value={raw.buyerAgentCommissionPercent}
          onChange={(v) => onChange("buyerAgentCommissionPercent", v)}
          placeholder="3"
          inputMode="decimal"
          help="The portion of the total commission paid to the buyer's side."
        />

        <CalculatorField
          id="buyer-credit"
          label="Buyer credit (our rebate)"
          suffix="%"
          value={raw.buyerCreditPercent}
          onChange={(v) => onChange("buyerCreditPercent", v)}
          placeholder="33"
          inputMode="decimal"
          help="Percentage of the buyer-agent commission we return to you at closing."
        />
      </div>
    </div>
  );
}

// MARK: - Result panel

function CalculatorResultPanel({
  calculation,
}: {
  calculation: ReturnType<typeof calculateSavings>;
}) {
  if (calculation.kind === "error") {
    return (
      <PricingPanel
        title="Let&apos;s fix those inputs"
        description="Update the assumptions below to generate a buyer-credit estimate."
        highlights={calculation.errors.map((err, index) => (
          <div key={`${err.kind}-${index}`} className="flex items-start gap-2">
            <span className="mt-0.5 text-base text-error-600" aria-hidden>
              !
            </span>
            <span>{err.message}</span>
          </div>
        ))}
      />
    );
  }

  const { result } = calculation;

  if (result.isZeroCommission) {
    return (
      <PricingPanel
        eyebrow="No buyer-agent commission"
        title="This listing has no buyer-side commission"
        description="We&apos;ll tell you up front before we engage. No buyer credit to calculate because there&apos;s no commission to rebate."
        footer={<HeadlineDisclosures />}
      />
    );
  }

  return (
    <PricingPanel
      eyebrow="Estimated buyer credit"
      title="Projected closing credit"
      value={formatUSD(result.buyerCreditAmount)}
      description={`at closing on a ${formatUSD(result.input.purchasePrice)} purchase`}
      tone="emphasis"
      highlights={[
        <ResultRow
          key="seller-paid"
          label="Seller-paid commission"
          value={formatUSD(result.totalCommissionAmount)}
        />,
        <ResultRow
          key="buyer-share"
          label="Buyer-agent share"
          value={formatUSD(result.buyerAgentCommissionAmount)}
        />,
        <ResultRow
          key="buyer-credit"
          label="Your credit back"
          value={formatUSD(result.buyerCreditAmount)}
          emphasized
        />,
        <ResultRow
          key="effective-rate"
          label="Effective buyer commission"
          value={`${result.effectiveBuyerCommissionPercent}%`}
        />,
      ]}
      footer={<HeadlineDisclosures />}
    />
  );
}

function ResultRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd
        className={
          emphasized
            ? "text-lg font-semibold text-primary-700"
            : "text-sm font-medium text-neutral-900"
        }
      >
        {value}
      </dd>
    </div>
  );
}

// MARK: - Headline disclosures (inline)

function HeadlineDisclosures() {
  const headlines = getHeadlineDisclosures();
  return (
    <div className="mt-2 border-t border-neutral-200 pt-4 text-xs text-neutral-600">
      <p className="font-semibold">Important</p>
      <ul className="mt-2 space-y-2">
        {headlines.map((d) => (
          <li key={d.id}>
            <span className="text-neutral-900">{d.label}:</span>{" "}
            {d.body}
          </li>
        ))}
      </ul>
    </div>
  );
}

// MARK: - Commission education (full variant only)

function CommissionEducation() {
  return (
    <section className="mt-12 rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200 lg:p-10">
      <h3 className="text-xl font-semibold text-neutral-900">
        How commissions work in Florida
      </h3>
      <div className="mt-4 grid grid-cols-1 gap-6 text-sm text-neutral-700 md:grid-cols-3">
        <EducationBlock
          step="1"
          title="The seller pays at closing"
          body="Historically the seller pays a single total commission out of proceeds. That total is split between the listing side and the buyer's side."
        />
        <EducationBlock
          step="2"
          title="The split is always negotiable"
          body="After the 2024 NAR settlement, buyer-agent compensation is explicitly negotiated between the parties. No number is fixed in stone."
        />
        <EducationBlock
          step="3"
          title="We rebate part back to you"
          body="buyer-codex credits a portion of the buyer-agent commission to you at closing. You keep the rebate; we keep a smaller service fee."
        />
      </div>
    </section>
  );
}

function EducationBlock({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex size-8 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white">
        {step}
      </div>
      <h4 className="mt-3 text-base font-semibold text-neutral-900">
        {title}
      </h4>
      <p className="mt-1.5 text-sm leading-relaxed text-neutral-700">
        {body}
      </p>
    </div>
  );
}

// MARK: - Full disclosures (full variant only)

function FullDisclosures() {
  return (
    <section className="mt-12 rounded-2xl bg-white p-6 ring-1 ring-neutral-200 lg:p-10">
      <h3 className="text-lg font-semibold text-neutral-900">
        Full disclosures
      </h3>
      <p className="mt-1 text-sm text-neutral-600">
        These disclosures apply to every savings estimate on this page.
      </p>
      <dl className="mt-5 space-y-5">
        {CALCULATOR_DISCLOSURES.map((d) => (
          <DisclosureBlock key={d.id} disclosure={d} />
        ))}
      </dl>
    </section>
  );
}

function DisclosureBlock({ disclosure }: { disclosure: Disclosure }) {
  const severityClass =
    disclosure.severity === "strong"
      ? "border-l-4 border-accent-500 bg-accent-50"
      : disclosure.severity === "emphasis"
        ? "border-l-4 border-primary-500 bg-primary-50/60"
        : "border-l-4 border-neutral-300 bg-neutral-50";
  return (
    <div className={`rounded-r-lg p-4 ${severityClass}`}>
      <dt className="text-sm font-semibold text-neutral-900">
        {disclosure.label}
      </dt>
      <dd className="mt-1 text-sm text-neutral-700">{disclosure.body}</dd>
    </div>
  );
}
