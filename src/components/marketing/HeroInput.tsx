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

  const handleSubmit = useCallback(
    (submission: { href: string }) => {
      router.push(submission.href);
    },
    [router],
  );

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
        <PasteLinkInput variant="hero" onSubmit={handleSubmit} />
      ) : (
        <ManualAddressInput />
      )}
    </PasteLinkCtaCard>
  );
}
