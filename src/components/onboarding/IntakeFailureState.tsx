"use client";

import React from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ParseErrorCode } from "@/lib/intake/types";

interface IntakeFailureStateProps {
  code: ParseErrorCode;
  url: string;
  children?: ReactNode;
}

function titleFor(code: ParseErrorCode): string {
  switch (code) {
    case "unsupported_url":
    case "invalid_domain":
      return "This link needs a supported intake path";
    case "missing_listing_id":
      return "This portal link isn’t specific enough yet";
    case "malformed_url":
      return "We couldn’t read that listing link";
  }
}

function bodyFor(code: ParseErrorCode): string {
  switch (code) {
    case "unsupported_url":
    case "invalid_domain":
      return "buyer-codex currently imports Zillow, Redfin, and Realtor.com listings directly. If you only have the street address, switch to manual address entry below.";
    case "missing_listing_id":
      return "We recognized the portal, but this URL does not point to a specific listing. Open the listing details page, then retry.";
    case "malformed_url":
      return "Paste the full listing URL, including the page path. If the portal keeps truncating the link, manual address entry is the safer fallback.";
  }
}

export function IntakeFailureState({
  code,
  url,
  children,
}: IntakeFailureStateProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-16">
      <section className="rounded-[28px] border border-neutral-200/80 bg-white px-6 py-6 shadow-[0_18px_40px_-34px_rgba(3,14,29,0.08)] sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-rose-700">
          Intake recovery
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-neutral-900 sm:text-[2.5rem] sm:leading-[1.04]">
          {titleFor(code)}
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600 sm:text-base">
          {bodyFor(code)}
        </p>
        <div className="mt-5 rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Submitted value:</span>{" "}
          <span className="break-all">{url}</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[24px] border border-neutral-200/80 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(3,14,29,0.09)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700">
            Recovery options
          </p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-600">
            <div className="rounded-[18px] border border-neutral-200/80 bg-neutral-50 px-4 py-3">
              Supported direct import: Zillow, Redfin, Realtor.com.
            </div>
            <div className="rounded-[18px] border border-neutral-200/80 bg-neutral-50 px-4 py-3">
              Manual fallback: enter the property address when the portal URL is
              unavailable or incomplete.
            </div>
            <div className="rounded-[18px] border border-neutral-200/80 bg-neutral-50 px-4 py-3">
              Retry the homepage flow if you want to paste a different listing.
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              Back to homepage
            </Link>
          </div>
        </section>

        <section className="rounded-[24px] border border-neutral-200/80 bg-white p-6 shadow-[0_16px_36px_-30px_rgba(3,14,29,0.09)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700">
            Manual address entry
          </p>
          <div className="mt-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
