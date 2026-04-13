"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { buildListingIntakeHref } from "@/lib/intake/pasteLink";
import { trackDealRoomUnlocked } from "@/lib/intake/pasteLinkFunnel";
import {
  getSourceListingStatusReference,
  linkFirstPropertyReference,
} from "@/lib/onboarding/api";
import { setBuyerOnboardingPropertyStatus } from "@/lib/onboarding/state";
import { useStoredBuyerOnboardingDraft } from "@/lib/onboarding/storage";
import { SourceListingRecoveryBanner } from "@/components/onboarding/SourceListingRecoveryBanner";

export function OnboardingResumeCard() {
  const router = useRouter();
  const { draft, isHydrated, setDraft, clearDraft } = useStoredBuyerOnboardingDraft();
  const linkFirstProperty = useMutation(linkFirstPropertyReference);
  const markAttemptDossierReady = useMutation(api.intake.markAttemptDossierReady);
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const activeDraft =
    isHydrated && draft?.authStatus === "authenticated" ? draft : null;
  const sourceListingId = activeDraft?.sourceListingId as
    | Id<"sourceListings">
    | null
    | undefined;
  const sourceListingStatus = useQuery(
    getSourceListingStatusReference,
    sourceListingId ? { sourceListingId } : "skip",
  );

  useEffect(() => {
    if (!activeDraft) {
      return;
    }

    if (
      activeDraft.property.status === "deal_room_ready" &&
      activeDraft.property.dealRoomId
    ) {
      clearDraft();
      router.push(`/dealroom/${activeDraft.property.dealRoomId}`);
    }
  }, [activeDraft, clearDraft, router]);

  useEffect(() => {
    if (!activeDraft || !sourceListingId || !sourceListingStatus || isLinking) {
      return;
    }

    if (sourceListingStatus.status === "property_ready") {
      if (linkError) {
        return;
      }

      setIsLinking(true);
      setLinkError(null);

      void linkFirstProperty({ sourceListingId })
        .then((result) => {
          if (result.status === "deal_room_ready") {
            if (activeDraft.intakeAttemptId) {
              void markAttemptDossierReady({
                attemptId: activeDraft.intakeAttemptId as Id<"intakeAttempts">,
                readyAt: new Date().toISOString(),
              });
            }
            trackDealRoomUnlocked({
              dealRoomId: String(result.dealRoomId),
              propertyId: String(result.propertyId),
              sourceListingId: activeDraft.sourceListingId ?? undefined,
              platform: activeDraft.sourcePlatform ?? undefined,
            });
            clearDraft();
            router.push(`/dealroom/${result.dealRoomId}`);
            return;
          }

          setDraft((current) =>
            current
              ? setBuyerOnboardingPropertyStatus(current, {
                  status: result.status,
                  propertyId: null,
                  dealRoomId: null,
                })
              : current,
          );
        })
        .catch((error) => {
          setLinkError(
            error instanceof Error
              ? error.message
              : "Could not attach the first property to your dashboard.",
          );
        })
        .finally(() => {
          setIsLinking(false);
        });

      return;
    }

    setLinkError(null);
    setDraft((current) => {
      if (!current || current.property.status === sourceListingStatus.status) {
        return current;
      }

      return setBuyerOnboardingPropertyStatus(current, {
        status: sourceListingStatus.status,
        propertyId: null,
        dealRoomId: null,
      });
    });
  }, [
    activeDraft,
    clearDraft,
    isLinking,
    linkError,
    linkFirstProperty,
    markAttemptDossierReady,
    router,
    setDraft,
    sourceListingId,
    sourceListingStatus,
  ]);

  if (!activeDraft) {
    return null;
  }

  const intakeHref = buildListingIntakeHref(activeDraft.listingUrl, {
    source: activeDraft.intakeSource ?? undefined,
  });
  const currentStatus =
    sourceListingStatus?.status ??
    (activeDraft.property.status === "captured"
      ? "pending_source_listing"
      : activeDraft.property.status);

  if (
    sourceListingStatus &&
    (sourceListingStatus.status === "source_listing_failed" ||
      sourceListingStatus.status === "source_listing_partial" ||
      sourceListingStatus.recoveryState === "review_required")
  ) {
    return (
      <SourceListingRecoveryBanner
        resolution={sourceListingStatus}
        listingUrl={activeDraft.listingUrl}
        intakeHref={intakeHref}
      />
    );
  }

  return (
    <Card
      className="border-primary-200 bg-primary-50/50"
      data-onboarding-property-status={currentStatus}
    >
      <CardContent className="flex flex-col gap-4 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">
            Finishing onboarding
          </p>
          <h2 className="mt-1 text-lg font-semibold text-neutral-900">
            {isLinking
              ? "Adding your first property to the dashboard..."
              : "We're still finishing your first search."}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {isLinking
              ? "The listing resolved successfully. We're creating the deal room now."
              : "Your buyer basics are saved. We'll attach this listing to your dashboard as soon as the property ingestion finishes."}
          </p>
        </div>

        {linkError && (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
            {linkError}
          </div>
        )}

        <p className="break-all rounded-xl border border-primary-200 bg-white px-4 py-3 text-sm text-neutral-600">
          {activeDraft.listingUrl}
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={intakeHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-primary-300 bg-white px-5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50"
          >
            Resume onboarding
          </Link>
          <span className="inline-flex h-11 items-center text-sm text-neutral-500">
            {isLinking
              ? "Refreshing your searches..."
              : "This card disappears once the deal room is ready."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
