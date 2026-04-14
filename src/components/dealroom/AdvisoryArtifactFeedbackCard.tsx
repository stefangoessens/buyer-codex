"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  advisoryFeedbackArtifactLabel,
  advisoryFeedbackDimensionControls,
  advisoryFeedbackPrompt,
  advisoryFeedbackReasonOptions,
  normalizeAdvisoryFeedbackReasonCodes,
  type AdvisoryFeedbackArtifact,
  type AdvisoryFeedbackDimension,
  type AdvisoryFeedbackReasonCode,
  type AdvisoryFeedbackResponse,
  type AdvisoryFeedbackSentiment,
} from "@/lib/dealroom/advisory-feedback";
import { cn } from "@/lib/utils";

interface AdvisoryArtifactFeedbackCardProps {
  artifact: AdvisoryFeedbackArtifact;
  onSubmit: (input: {
    artifact: AdvisoryFeedbackArtifact;
    responses: AdvisoryFeedbackResponse[];
    reasonCodes: AdvisoryFeedbackReasonCode[];
  }) => Promise<void>;
}

export function AdvisoryArtifactFeedbackCard({
  artifact,
  onSubmit,
}: AdvisoryArtifactFeedbackCardProps) {
  const [selectionByDimension, setSelectionByDimension] = useState<
    Partial<Record<AdvisoryFeedbackDimension, AdvisoryFeedbackSentiment>>
  >({});
  const [reasonCodes, setReasonCodes] = useState<AdvisoryFeedbackReasonCode[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  const responses = advisoryFeedbackDimensionControls().flatMap((control) => {
    const sentiment = selectionByDimension[control.dimension];
    return sentiment
      ? [{ dimension: control.dimension, sentiment }]
      : [];
  });
  const reasonOptions = advisoryFeedbackReasonOptions(artifact, responses);

  function selectDimension(
    dimension: AdvisoryFeedbackDimension,
    sentiment: AdvisoryFeedbackSentiment,
  ) {
    setSelectionByDimension((current) => {
      const next = { ...current, [dimension]: sentiment };
      const normalizedResponses = advisoryFeedbackDimensionControls().flatMap(
        (control) => {
          const nextSentiment = next[control.dimension];
          return nextSentiment
            ? [{ dimension: control.dimension, sentiment: nextSentiment }]
            : [];
        },
      );
      setReasonCodes((existing) =>
        normalizeAdvisoryFeedbackReasonCodes(artifact, normalizedResponses, existing),
      );
      return next;
    });
    setStatus("idle");
  }

  function toggleReason(reason: AdvisoryFeedbackReasonCode) {
    setReasonCodes((current) =>
      current.includes(reason)
        ? current.filter((value) => value !== reason)
        : [...current, reason],
    );
    setStatus("idle");
  }

  async function submit() {
    if (responses.length === 0 || status === "saving") return;

    setStatus("saving");
    try {
      await onSubmit({
        artifact,
        responses,
        reasonCodes,
      });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-200 p-3">
      <p className="text-sm font-semibold text-neutral-900">
        {advisoryFeedbackPrompt(artifact)}
      </p>
      <p className="mt-1 text-xs leading-5 text-neutral-500">
        Save structured buyer feedback for this {advisoryFeedbackArtifactLabel(artifact)}
        {" "}version.
      </p>

      <div className="mt-3 space-y-3">
        {advisoryFeedbackDimensionControls().map((control) => {
          const selected = selectionByDimension[control.dimension];

          return (
            <div
              key={control.dimension}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                {control.label}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selected === "positive" ? "default" : "outline"}
                  onClick={() => selectDimension(control.dimension, "positive")}
                >
                  {control.positiveLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selected === "negative" ? "default" : "outline"}
                  onClick={() => selectDimension(control.dimension, "negative")}
                >
                  {control.negativeLabel}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {reasonOptions.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
            What felt off?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {reasonOptions.map((option) => {
              const selected = reasonCodes.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 bg-neutral-50 text-neutral-700",
                  )}
                  onClick={() => toggleReason(option.value)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={responses.length === 0 || status === "saving"}
        >
          {status === "saving" ? "Saving..." : "Save feedback"}
        </Button>
        {status === "saved" ? (
          <p className="text-xs font-medium text-neutral-500">
            Saved for this {advisoryFeedbackArtifactLabel(artifact)} version.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-xs font-medium text-error-600">
            Feedback could not be saved. Try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
