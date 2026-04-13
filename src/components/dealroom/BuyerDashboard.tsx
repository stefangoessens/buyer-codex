"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { resolveBuyerDashboardState } from "@/lib/dashboard/deal-index-state";
import { BuyerDashboardSurface } from "./BuyerDashboardSurface";
import { OnboardingResumeCard } from "./OnboardingResumeCard";

interface BuyerDashboardProps {
  now: string;
}

export function BuyerDashboard({ now }: BuyerDashboardProps) {
  const dealIndex = useQuery(api.dashboard.getDealIndex, {});
  const state = resolveBuyerDashboardState(dealIndex);

  return (
    <BuyerDashboardSurface
      now={now}
      state={state}
      secondarySurface={<OnboardingResumeCard />}
    />
  );
}
