"use client";

import { useState } from "react";
import type { LinkPastedSource } from "@buyer-codex/shared/launch-events";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildListingIntakeHref,
  getPasteLinkErrorMessage,
  prepareListingIntakeSubmission,
  type PreparedListingIntakeSubmissionSuccess,
} from "@/lib/intake/pasteLink";
import {
  trackParseSucceeded,
  trackPasteSubmitted,
} from "@/lib/intake/pasteLinkFunnel";
import { track } from "@/lib/analytics";
import { convex } from "@/lib/convex";

interface PasteLinkInputProps {
  onSubmit?: (submission: PreparedListingIntakeSubmissionSuccess) => void;
  placeholder?: string;
  variant?: Extract<LinkPastedSource, "hero" | "compact">;
}

export function PasteLinkInput({
  onSubmit,
  placeholder = "Paste a Zillow, Redfin, or Realtor.com link...",
  variant = "hero",
}: PasteLinkInputProps) {
  const [value, setValue] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHero = variant === "hero";
  const canSubmit = value.trim().length > 0 && !isSubmitting;

  async function recordParserFailure(url: string, submittedAt: string) {
    if (!convex) {
      return;
    }

    try {
      await convex.mutation(api.intake.recordAttemptFailure, {
        url,
        source: variant,
        submittedAt,
      });
    } catch {
      // Metrics must never block the inline recovery path.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }

    const submittedAtMs = Date.now();
    const submittedAt = new Date(submittedAtMs).toISOString();
    const submission = prepareListingIntakeSubmission(value, variant, submittedAtMs);
    if (!submission.ok) {
      setErrorMessage(submission.message);
      void recordParserFailure(value, submittedAt);
      return;
    }

    if (!convex) {
      setErrorMessage("Listing intake is temporarily unavailable. Try again in a moment.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await convex.mutation(api.intake.submitUrl, {
        url: submission.parsed.data.rawUrl,
        source: variant,
        submittedAt,
      });

      if (!result.success) {
        setErrorMessage(getPasteLinkErrorMessage(result.code));
        void recordParserFailure(value, submittedAt);
        return;
      }

      trackPasteSubmitted({
        url: result.normalizedUrl,
        source: variant,
        platform: result.platform,
      });
      trackParseSucceeded({
        source: variant,
        platform: result.platform,
        listingId: result.listingId,
      });

      const persistedSubmission: PreparedListingIntakeSubmissionSuccess = {
        ok: true,
        parsed: submission.parsed,
        href: buildListingIntakeHref(result.normalizedUrl, {
          source: variant,
          submittedAt: submittedAtMs,
          platform: result.platform,
          sourceListingId: String(result.sourceListingId),
          attemptId: String(result.attemptId),
        }),
      };

      onSubmit?.(persistedSubmission);
    } catch (err) {
      const code =
        err instanceof Error ? err.message : "unknown_intake_submission_error";
      setErrorMessage("We couldn't save this listing right now. Try again in a moment.");
      track("error_boundary_hit", { error: code });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex w-full items-start gap-3 ${isHero ? "flex-col" : ""}`}
    >
      <div className="w-full">
        <div className="relative w-full">
          <svg
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-neutral-400 ${isHero ? "left-4 size-5" : "left-3 size-4"}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-1.027a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364l1.757 1.757"
            />
          </svg>
          <Input
            type="text"
            inputMode="url"
            value={value}
            aria-invalid={errorMessage ? true : undefined}
            disabled={isSubmitting}
            onChange={(e) => {
              setValue(e.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            placeholder={placeholder}
            className={
              isHero
                ? "h-[60px] rounded-[16px] border border-neutral-200 bg-white pl-12 pr-4 text-base shadow-sm placeholder:text-neutral-400"
                : "h-11 rounded-[12px] border border-neutral-200 bg-white pl-10 pr-3 text-sm shadow-sm placeholder:text-neutral-400"
            }
          />
        </div>

        <p
          aria-live="polite"
          className={`mt-2 text-sm ${errorMessage ? "text-error-700" : "text-neutral-500"}`}
        >
          {errorMessage ??
            (isSubmitting
              ? "Saving the listing and opening your intake..."
              : "Supports Zillow, Redfin, and Realtor.com listing URLs.")}
        </p>
      </div>

      <Button
        type="submit"
        disabled={!canSubmit}
        className={
          isHero
            ? "h-[60px] w-full rounded-[12px] bg-primary-500 px-5 text-base font-medium hover:bg-primary-600 disabled:bg-primary-200"
            : "h-11 rounded-[12px] bg-primary-500 px-4 text-sm font-medium hover:bg-primary-600 disabled:bg-primary-200"
        }
      >
        {isSubmitting ? "Saving..." : isHero ? "Get free analysis" : "Analyze"}
      </Button>
    </form>
  );
}
