"use client";

import React from "react";
import Link from "next/link";
import type { SourceListingResolution } from "@/lib/onboarding/api";

type RecoverableSourceListingResolution = Extract<
  SourceListingResolution,
  {
    status:
      | "pending_source_listing"
      | "source_listing_partial"
      | "source_listing_failed";
  }
>;

interface SourceListingRecoveryBannerProps {
  resolution: RecoverableSourceListingResolution;
  listingUrl: string;
  intakeHref: string;
  className?: string;
}

function joinMissingFields(fields: string[]): string {
  if (fields.length === 0) return "critical listing details";
  return fields.slice(0, 3).join(", ");
}

export function SourceListingRecoveryBanner({
  resolution,
  listingUrl,
  intakeHref,
  className,
}: SourceListingRecoveryBannerProps) {
  if (resolution.status === "pending_source_listing") {
    const isReview = resolution.recoveryState === "review_required";
    return (
      <div
        className={`rounded-[20px] border px-4 py-4 text-sm ${isReview ? "border-amber-200 bg-amber-50 text-amber-900" : "border-sky-200 bg-sky-50 text-sky-950"} ${className ?? ""}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
          {isReview ? "Recovery review" : "Still processing"}
        </p>
        <p className="mt-2 text-base font-semibold">
          {isReview
            ? "We need one more pass before this listing is safe to attach."
            : "We’re still resolving the listing into a buyer-safe record."}
        </p>
        <p className="mt-2 leading-6 opacity-80">
          {isReview
            ? "The intake found a possible match, but the result still needs confirmation before we create the first deal room."
            : "You can keep filling in buyer basics now. We’ll keep the recovery state visible until the first property is ready."}
        </p>
      </div>
    );
  }

  if (resolution.status === "source_listing_partial") {
    return (
      <div
        className={`rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950 ${className ?? ""}`}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
          Partial extraction
        </p>
        <p className="mt-2 text-base font-semibold">
          We captured the listing, but some fields still need recovery.
        </p>
        <p className="mt-2 leading-6 opacity-80">
          Missing now: {joinMissingFields(resolution.missingFields)}. You can retry
          this listing or continue once the recovery pass fills the gaps.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href={intakeHref}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-600 px-5 font-semibold text-white transition-colors hover:bg-amber-700"
          >
            Retry this listing
          </Link>
          <span className="inline-flex h-11 items-center opacity-70">
            {listingUrl}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-950 ${className ?? ""}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
        Parser recovery failed
      </p>
      <p className="mt-2 text-base font-semibold">
        We couldn&apos;t safely turn this listing into a usable record.
      </p>
      <p className="mt-2 leading-6 opacity-80">
        {resolution.retryable
          ? "Retry the listing or switch to manual address entry if the portal page keeps failing."
          : "This listing needs a different intake path before it can appear in the dashboard."}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href={intakeHref}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-600 px-5 font-semibold text-white transition-colors hover:bg-rose-700"
        >
          Retry intake
        </Link>
        <span className="inline-flex h-11 items-center opacity-70">{listingUrl}</span>
      </div>
    </div>
  );
}
