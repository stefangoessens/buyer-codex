"use client";

import { useCallback, useEffect, useState } from "react";
import type { BuyerOnboardingDraft } from "./state";
import { reviveBuyerOnboardingDraft } from "./state";

const STORAGE_KEY = "buyer-codex:onboarding-draft";

export function loadStoredBuyerOnboardingDraft(): BuyerOnboardingDraft | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value ? reviveBuyerOnboardingDraft(value) : null;
}

export function persistBuyerOnboardingDraft(
  draft: BuyerOnboardingDraft | null,
): void {
  if (typeof window === "undefined") return;
  if (!draft) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function useStoredBuyerOnboardingDraft() {
  const [draft, setDraftState] = useState<BuyerOnboardingDraft | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setDraftState(loadStoredBuyerOnboardingDraft());
    setIsHydrated(true);
  }, []);

  const setDraft = useCallback(
    (
      next:
        | BuyerOnboardingDraft
        | null
        | ((current: BuyerOnboardingDraft | null) => BuyerOnboardingDraft | null),
    ) => {
      setDraftState((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (value: BuyerOnboardingDraft | null) => BuyerOnboardingDraft | null)(
                current,
              )
            : next;
        persistBuyerOnboardingDraft(resolved);
        return resolved;
      });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    setDraftState(null);
    persistBuyerOnboardingDraft(null);
  }, []);

  return { draft, isHydrated, setDraft, clearDraft };
}
