"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PasteLinkInput } from "@/components/marketing/PasteLinkInput";
import { PasteLinkCtaCard } from "@/components/product/PasteLinkCtaCard";

/**
 * Authenticated-dashboard version of the homepage hero paste-link CTA.
 *
 * Wraps the shared `PasteLinkInput` in a product-surface Card. On submit
 * it routes to the intake pipeline with the pasted URL, identical to the
 * public homepage flow — the backend decides whether to reuse an
 * existing deal room or create a new one.
 */
export function PasteLinkCTA() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleSubmit = (submission: { href: string }) => {
    startTransition(() => {
      router.push(submission.href);
    });
  };

  return (
    <PasteLinkCtaCard
      eyebrow="Start a new analysis"
      title="Paste any listing link to see pricing, comps, and leverage."
      description="Drop a Zillow, Redfin, or Realtor.com URL. We&apos;ll create a deal room and analyze it in seconds."
      surface="product"
    >
      <PasteLinkInput variant="hero" onSubmit={handleSubmit} />
    </PasteLinkCtaCard>
  );
}
