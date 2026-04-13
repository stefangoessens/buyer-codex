import React from "react";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
  variant?: "soft" | "solid" | "outline";
}

const sizeClasses = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-base",
} as const;

function getScoreTone(score: number) {
  if (score >= 7) {
    return {
      soft: "border-success-100 bg-success-50 text-success-700",
      solid: "border-success-600 bg-success-600 text-white",
      outline: "border-success-300 bg-white text-success-700",
    };
  }
  if (score >= 5) {
    return {
      soft: "border-warning-100 bg-warning-50 text-warning-700",
      solid: "border-warning-500 bg-warning-500 text-white",
      outline: "border-warning-300 bg-white text-warning-700",
    };
  }
  return {
    soft: "border-error-100 bg-error-50 text-error-700",
    solid: "border-error-500 bg-error-500 text-white",
    outline: "border-error-300 bg-white text-error-700",
  };
}

export function ScoreBadge({
  score,
  maxScore,
  size = "md",
  variant = "soft",
}: ScoreBadgeProps) {
  const tone = getScoreTone(score);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold tracking-[-0.02em]",
        sizeClasses[size],
        tone[variant],
      )}
    >
      {score.toFixed(1)}
      {maxScore != null && (
        <span
          className={cn(
            "font-medium opacity-70",
            variant === "solid" && "text-white/75",
          )}
        >
          / {maxScore}
        </span>
      )}
    </span>
  );
}
