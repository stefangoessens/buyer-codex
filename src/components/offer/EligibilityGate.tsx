"use client";

// Gate that blocks offer cockpit access when the buyer is not eligible and surfaces the resolution step.
import { useEffect, useRef } from "react";
import type { OfferEligibilitySnapshot } from "@/lib/dealroom/offer-cockpit-types";
import { Button } from "@/components/ui/button";
import { trackAgreementPrompted } from "@/lib/intake/pasteLinkFunnel";

interface EligibilityGateProps {
  eligibility: OfferEligibilitySnapshot;
  children: React.ReactNode;
  dealRoomId?: string;
  agreementHref?: string;
}

export function EligibilityGate({
  eligibility,
  children,
  dealRoomId,
  agreementHref,
}: EligibilityGateProps) {
  const promptTracked = useRef(false);

  useEffect(() => {
    const requiredAction = eligibility.requiredAction?.toLowerCase() ?? "";
    const mentionsAgreement = requiredAction.includes("agreement");
    if (!dealRoomId || !mentionsAgreement || eligibility.isEligible) {
      return;
    }

    if (promptTracked.current) {
      return;
    }

    promptTracked.current = true;
    trackAgreementPrompted({
      dealRoomId,
      source: "offer_cockpit_gate",
      requiredAction: eligibility.requiredAction ?? undefined,
    });
  }, [
    dealRoomId,
    eligibility.isEligible,
    eligibility.requiredAction,
  ]);

  if (eligibility.isEligible) {
    return <>{children}</>;
  }

  const blockingMessage =
    eligibility.blockingReasonMessage ??
    "Complete the required steps before you can make an offer on this property.";

  const requiredAction = eligibility.requiredAction?.toLowerCase() ?? "";
  const mentionsAgreement = requiredAction.includes("agreement");
  const showAgreementAction = mentionsAgreement && Boolean(agreementHref);

  return (
    <div className="rounded-xl border border-warning-200 bg-warning-50 p-8 text-center">
      <h2 className="text-xl font-semibold text-warning-800">Offer entry is locked</h2>
      <p className="mt-2 text-sm text-warning-700">{blockingMessage}</p>
      <div className="mt-5 flex justify-center">
        {showAgreementAction ? (
          <Button asChild variant="default">
            <a href={agreementHref}>Review buyer agreement</a>
          </Button>
        ) : (
          <Button asChild variant="outline">
            <a href="/dashboard">Back to dashboard</a>
          </Button>
        )}
      </div>
    </div>
  );
}
