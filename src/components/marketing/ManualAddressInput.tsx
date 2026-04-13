"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { normalizeAddress, type CanonicalAddress } from "@/lib/intake";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CandidateSummary {
  propertyId: string;
  canonical: CanonicalAddress;
  score: number;
}

type ManualAddressUiState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "validation_error"; errors: string[] }
  | {
      status: "matched";
      canonical: CanonicalAddress;
      propertyId: string;
      confidence: "exact" | "high";
      score: number;
    }
  | {
      status: "review_required";
      canonical: CanonicalAddress;
      reason: "ambiguous_match" | "low_confidence_match";
      confidence: "high" | "medium" | "low";
      score: number;
      bestMatch: CandidateSummary;
      candidates: CandidateSummary[];
    }
  | {
      status: "no_match";
      canonical: CanonicalAddress;
      score: number;
      bestMatch: CandidateSummary | null;
    }
  | { status: "server_error"; message: string };

function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
}

function confidenceLabel(value: "exact" | "high" | "medium" | "low"): string {
  return value === "exact" ? "Exact match" : `${value} confidence`;
}

function candidateFromResponse(candidate: {
  propertyId: string;
  canonical: CanonicalAddress;
  score: number;
}): CandidateSummary {
  return {
    propertyId: candidate.propertyId,
    canonical: candidate.canonical,
    score: candidate.score,
  };
}

function ResultCard({
  state,
}: {
  state: Exclude<ManualAddressUiState, { status: "idle" | "submitting" | "validation_error" | "server_error" }>;
}) {
  if (state.status === "matched") {
    return (
      <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-left">
        <p className="text-sm font-semibold text-emerald-700">
          {confidenceLabel(state.confidence)}
        </p>
        <p className="mt-2 text-base font-semibold text-neutral-900">
          {state.canonical.formatted}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          We matched this address with {formatScore(state.score)} confidence.
        </p>
        <Button asChild className="mt-4 h-11 rounded-[12px] px-4">
          <Link href={`/property/${state.propertyId}`}>Continue to property</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "review_required") {
    return (
      <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-left">
        <p className="text-sm font-semibold text-amber-700">
          {state.reason === "ambiguous_match"
            ? "Multiple close matches"
            : "Review required"}
        </p>
        <p className="mt-2 text-base font-semibold text-neutral-900">
          {state.canonical.formatted}
        </p>
        <p className="mt-1 text-sm text-neutral-600">
          {state.reason === "ambiguous_match"
            ? "We found more than one likely property for this address."
            : "We found a nearby property, but the confidence is too low to auto-match."}
        </p>
        <div className="mt-4 space-y-3">
          {state.candidates.slice(0, 3).map((candidate) => (
            <div
              key={candidate.propertyId}
              className="flex items-center justify-between rounded-[16px] border border-white/80 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {candidate.canonical.formatted}
                </p>
                <p className="text-xs text-neutral-500">
                  {confidenceLabel(state.confidence)} · {formatScore(candidate.score)}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="ml-3 shrink-0">
                <Link href={`/property/${candidate.propertyId}`}>Open</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-left">
      <p className="text-sm font-semibold text-rose-700">No confident match</p>
      <p className="mt-2 text-base font-semibold text-neutral-900">
        {state.canonical.formatted}
      </p>
      <p className="mt-1 text-sm text-neutral-600">
        We normalized the address, but couldn&apos;t match an existing property yet.
      </p>
      {state.bestMatch ? (
        <p className="mt-3 text-xs text-neutral-500">
          Closest existing record: {state.bestMatch.canonical.formatted} (
          {formatScore(state.bestMatch.score)})
        </p>
      ) : null}
    </div>
  );
}

export function ManualAddressInput() {
  const submitAddress = useMutation(api.addressIntake.createAddressIntake);
  const [value, setValue] = useState("");
  const [state, setState] = useState<ManualAddressUiState>({ status: "idle" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = normalizeAddress({ raw: value });
    if (!normalized.valid) {
      setState({
        status: "validation_error",
        errors: normalized.errors.map((error) => error.message),
      });
      return;
    }

    setState({ status: "submitting" });

    try {
      const response = await submitAddress({
        address: { raw: value },
      });

      switch (response.status) {
        case "matched":
          setState({
            status: "matched",
            canonical: response.canonical,
            propertyId: response.propertyId,
            confidence: response.confidence,
            score: response.score,
          });
          return;
        case "review_required":
          setState({
            status: "review_required",
            canonical: response.canonical,
            reason: response.reason,
            confidence: response.confidence,
            score: response.score,
            bestMatch: candidateFromResponse(response.bestMatch),
            candidates: response.candidates.map(candidateFromResponse),
          });
          return;
        case "no_match":
          setState({
            status: "no_match",
            canonical: response.canonical,
            score: response.score,
            bestMatch: response.bestMatch
              ? candidateFromResponse(response.bestMatch)
              : null,
          });
          return;
        case "validation_error":
          setState({
            status: "validation_error",
            errors: response.errors.map((error: { message: string }) => error.message),
          });
          return;
      }
    } catch (error) {
      setState({
        status: "server_error",
        message:
          error instanceof Error
            ? error.message
            : "We couldn't submit that address right now.",
      });
    }
  }

  const disabled = state.status === "submitting";

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
        <Input
          type="text"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (state.status !== "idle") {
              setState({ status: "idle" });
            }
          }}
          placeholder="Enter the property address, city, state, and ZIP"
          className="h-[60px] rounded-[16px] border border-neutral-200 bg-white px-4 text-base shadow-sm placeholder:text-neutral-400"
          aria-invalid={state.status === "validation_error"}
        />
        <Button
          type="submit"
          disabled={disabled || value.trim().length === 0}
          className="h-[60px] rounded-[12px] bg-primary-500 px-5 text-base font-medium text-white hover:bg-primary-600 disabled:bg-primary-200"
        >
          {state.status === "submitting" ? "Matching address..." : "Find property"}
        </Button>
      </form>

      <div aria-live="polite" className="space-y-3">
        {state.status === "validation_error" ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}

        {state.status === "server_error" ? (
          <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.message}
          </div>
        ) : null}

        {state.status !== "idle" &&
        state.status !== "submitting" &&
        state.status !== "validation_error" &&
        state.status !== "server_error" ? (
          <ResultCard state={state} />
        ) : null}
      </div>

      <p
        className={cn(
          "text-sm text-neutral-500",
          state.status === "matched" ? "text-neutral-600" : "",
        )}
      >
        We only use the normalized address for property matching. Paste a listing
        URL if you want the fastest deterministic import.
      </p>
    </div>
  );
}
