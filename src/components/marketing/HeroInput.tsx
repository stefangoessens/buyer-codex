"use client";

import { useCallback, useState } from "react";
import { PasteLinkInput } from "@/components/marketing/PasteLinkInput";
import { ManualAddressInput } from "@/components/marketing/ManualAddressInput";
import { cn } from "@/lib/utils";

export function HeroInput() {
  const [mode, setMode] = useState<"link" | "address">("link");
  const [submitted, setSubmitted] = useState(false);
  const handleSubmit = useCallback((_url: string) => { setSubmitted(true); }, []);

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-neutral-200 bg-white/80 p-1 shadow-sm backdrop-blur">
        {[
          { value: "link", label: "Paste link" },
          { value: "address", label: "Enter address" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value as "link" | "address")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              mode === option.value
                ? "bg-primary-500 text-white"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "link" ? (
        submitted ? (
          <div
            className="flex h-[60px] items-center justify-center gap-3 rounded-[16px] border border-neutral-200 bg-white px-6 text-base font-medium text-neutral-700 shadow-sm"
            aria-live="polite"
          >
            <svg className="size-5 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing your property...
          </div>
        ) : (
          <PasteLinkInput variant="hero" onSubmit={handleSubmit} />
        )
      ) : (
        <ManualAddressInput />
      )}
    </div>
  );
}
