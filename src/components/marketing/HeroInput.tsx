"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PasteLinkInput } from "@/components/marketing/PasteLinkInput";
import { ManualAddressInput } from "@/components/marketing/ManualAddressInput";
import { PasteLinkCtaCard } from "@/components/product/PasteLinkCtaCard";
import { SegmentedTabs } from "@/components/product/SegmentedTabs";

export function HeroInput() {
  const router = useRouter();
  const [mode, setMode] = useState<"link" | "address">("link");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback((submission: { href: string }) => {
    setSubmitted(true);
    router.push(submission.href);
  }, [router]);

  return (
    <PasteLinkCtaCard
      surface="marketing"
      eyebrow="Paste a listing to start"
      title="Get pricing, leverage, and broker guidance in one pass."
      description="Use the same intake shell buyers see in the dashboard. Start with a listing URL or switch to manual address entry when you need it."
      controls={
        <SegmentedTabs
          items={[
            { value: "link", label: "Paste link" },
            { value: "address", label: "Enter address" },
          ]}
          value={mode}
          onValueChange={(next) => setMode(next as "link" | "address")}
        />
      }
    >
      {mode === "link" ? (
        submitted ? (
          <div
            className="flex h-[60px] items-center justify-center gap-3 rounded-[16px] border border-neutral-200 bg-white px-6 text-base font-medium text-neutral-700 shadow-sm"
            aria-live="polite"
          >
            <svg
              className="size-5 animate-spin text-primary-400"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Analyzing your property...
          </div>
        ) : (
          <PasteLinkInput variant="hero" onSubmit={handleSubmit} />
        )
      ) : (
        <ManualAddressInput />
      )}
    </PasteLinkCtaCard>
  );
}
