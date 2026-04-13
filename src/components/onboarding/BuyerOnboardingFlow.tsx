"use client";

import type { LinkPastedSource } from "@buyer-codex/shared/launch-events";
import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { env, isConfigured } from "@/lib/env";
import { buildListingIntakeHref } from "@/lib/intake/pasteLink";
import {
  trackRegistrationCompleted,
  trackRegistrationPrompted,
  trackTeaserRendered,
} from "@/lib/intake/pasteLinkFunnel";
import type { SourcePlatform } from "@/lib/intake/types";
import { linkFirstPropertyReference } from "@/lib/onboarding/api";
import {
  createBuyerOnboardingDraft,
  mergeBuyerOnboardingDraft,
  setBuyerOnboardingAuthState,
  setBuyerOnboardingPropertyStatus,
  validateBuyerOnboardingBasics,
  type BuyerOnboardingDraft,
  type BuyerOnboardingValidationError,
} from "@/lib/onboarding/state";
import { useStoredBuyerOnboardingDraft } from "@/lib/onboarding/storage";
import { identifyUser } from "@/lib/posthog";

interface BuyerOnboardingFlowProps {
  listingUrl: string;
  portalLabel: string;
  summaryTitle?: string;
  summaryBody?: string;
  intakeSource?: LinkPastedSource | null;
  submittedAtMs?: number | null;
  initialSourcePlatform?: SourcePlatform | null;
}

const STEP_LABELS = [
  { key: "account", label: "Create account" },
  { key: "buyer_basics", label: "Buyer basics" },
  { key: "first_property", label: "First property" },
] as const;

function returnUrlFor(listingUrl: string): string {
  if (typeof window !== "undefined") {
    return window.location.href;
  }
  return buildListingIntakeHref(listingUrl);
}

function formatValidationError(error: BuyerOnboardingValidationError): string {
  switch (error.code) {
    case "required":
      return error.field === "budgetMax"
        ? "Budget max is required."
        : "Move timeline is required.";
    case "invalid_number":
      return "Budget max must be a number.";
    case "non_positive":
      return "Budget max must be greater than zero.";
  }
}

function parsePreferredAreas(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function EnsureCurrentBuyerEffect({
  attributionSessionId,
  onError,
}: {
  attributionSessionId?: string;
  onError: (message: string | null) => void;
}) {
  const { user, isLoaded } = useUser();
  const ensureCurrentBuyer = useMutation(api.users.ensureCurrentBuyer);
  const attemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (attemptedFor.current === user.id) return;

    const primaryEmail =
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (!primaryEmail) {
      onError("Your auth account is missing a primary email address.");
      return;
    }

    attemptedFor.current = user.id;
    onError(null);

    void ensureCurrentBuyer({
      email: primaryEmail,
      name: user.fullName ?? user.firstName ?? primaryEmail,
      phone: user.primaryPhoneNumber?.phoneNumber,
      avatarUrl: user.imageUrl,
      attributionSessionId,
    }).catch((error) => {
      attemptedFor.current = null;
      onError(error instanceof Error ? error.message : "Could not bind your account.");
    });
  }, [attributionSessionId, ensureCurrentBuyer, isLoaded, onError, user]);

  return null;
}

function RegistrationCompletionEffect({
  source,
}: {
  source: string;
}) {
  const { user, isLoaded } = useUser();
  const trackedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (trackedFor.current === user.id) return;

    trackedFor.current = user.id;
    identifyUser(user.id);
    trackRegistrationCompleted({
      userId: user.id,
      source,
    });
  }, [isLoaded, source, user]);

  return null;
}

export function BuyerOnboardingFlow({
  ...props
}: BuyerOnboardingFlowProps) {
  const isClerkConfigured =
    env.NEXT_PUBLIC_AUTH_PROVIDER === "clerk" && isConfigured.auth();

  return isClerkConfigured ? (
    <BuyerOnboardingFlowWithAuth {...props} />
  ) : (
    <BuyerOnboardingFlowAuthDisabled {...props} />
  );
}

function BuyerOnboardingFlowAuthDisabled({
  listingUrl,
  portalLabel,
  summaryTitle,
  summaryBody,
  intakeSource = null,
  submittedAtMs = null,
  initialSourcePlatform = null,
}: BuyerOnboardingFlowProps) {
  const teaserTracked = useRef(false);
  const registrationPromptTracked = useRef(false);
  const registrationSource = intakeSource ?? "hero";
  const teaserSource = `${registrationSource}:intake_teaser`;

  useEffect(() => {
    if (teaserTracked.current) return;

    teaserTracked.current = true;
    trackTeaserRendered({
      source: teaserSource,
      platform: initialSourcePlatform ?? undefined,
      latencyMs:
        typeof submittedAtMs === "number"
          ? Math.max(Date.now() - submittedAtMs, 0)
          : undefined,
    });
  }, [initialSourcePlatform, submittedAtMs, teaserSource]);

  useEffect(() => {
    if (registrationPromptTracked.current) return;

    registrationPromptTracked.current = true;
    trackRegistrationPrompted(teaserSource);
  }, [teaserSource]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
          {portalLabel} intake
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">
          {summaryTitle ??
            `Create your buyer account to unlock this ${portalLabel} deal room.`}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-600">
          {summaryBody ??
            `We captured the listing link. Register once, tell us your buyer basics, and we’ll open the first deal room with this property already attached.`}
        </p>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Listing:</span>{" "}
          <span className="break-all">{listingUrl}</span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {STEP_LABELS.map((step, index) => (
          <div
            key={step.key}
            className={`rounded-xl border px-4 py-3 text-sm ${
              step.key === "account"
                ? "border-primary-300 bg-primary-50"
                : "border-neutral-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Step {index + 1}
            </p>
            <p className="mt-1 font-medium text-neutral-900">{step.label}</p>
          </div>
        ))}
      </div>

      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">
              Step 1: Create your account
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Auth is disabled in this environment, so the live registration step
              cannot complete here.
            </p>
          </div>

          <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
            Auth is not configured in this environment, so the registration step
            cannot complete.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BuyerOnboardingFlowWithAuth({
  listingUrl,
  portalLabel,
  summaryTitle,
  summaryBody,
  intakeSource = null,
  submittedAtMs = null,
  initialSourcePlatform = null,
}: BuyerOnboardingFlowProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { draft, isHydrated, setDraft, clearDraft } = useStoredBuyerOnboardingDraft();
  const submitUrl = useMutation(api.intake.submitUrl);
  const saveBuyerProfile = useMutation(api.buyerProfiles.createOrUpdate);
  const linkFirstProperty = useMutation(linkFirstPropertyReference);
  const actor = useQuery(api.contracts.getCurrentActor, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.buyerProfiles.getMyProfile, actor ? {} : "skip");

  const captureRequestedFor = useRef<string | null>(null);
  const prefilledFromProfile = useRef(false);
  const teaserTracked = useRef(false);
  const registrationPromptTracked = useRef(false);

  const [captureError, setCaptureError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    BuyerOnboardingValidationError[]
  >([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isClerkConfigured = true;

  useEffect(() => {
    if (!isHydrated) return;

    setDraft((current) => {
      if (current?.listingUrl === listingUrl) {
        return mergeBuyerOnboardingDraft(current, {
          intakeSource: current.intakeSource ?? intakeSource,
          sourcePlatform: current.sourcePlatform ?? initialSourcePlatform,
        });
      }

      return createBuyerOnboardingDraft({
        listingUrl,
        intakeSource,
        sourcePlatform: initialSourcePlatform,
      });
    });
  }, [initialSourcePlatform, intakeSource, isHydrated, listingUrl, setDraft]);

  useEffect(() => {
    if (!draft || draft.listingUrl !== listingUrl) return;
    if (draft.sourceListingId || captureRequestedFor.current === listingUrl) return;

    captureRequestedFor.current = listingUrl;
    setCaptureError(null);

    void submitUrl({ url: listingUrl })
      .then((result) => {
        if (!result.success) {
          setCaptureError(result.error);
          captureRequestedFor.current = null;
          return;
        }

        setDraft((current) => {
          if (!current || current.listingUrl !== listingUrl) return current;
          return mergeBuyerOnboardingDraft(current, {
            sourceListingId: String(result.sourceListingId),
            sourcePlatform: result.platform,
          });
        });
      })
      .catch((error) => {
        setCaptureError(
          error instanceof Error ? error.message : "Could not capture the listing link.",
        );
        captureRequestedFor.current = null;
      });
  }, [draft, listingUrl, setDraft, submitUrl]);

  useEffect(() => {
    if (!draft) return;
    if (draft.authStatus === "authenticated" || !isAuthenticated) return;

    setDraft((current) =>
      current ? setBuyerOnboardingAuthState(current, "authenticated") : current,
    );
  }, [draft, isAuthenticated, setDraft]);

  useEffect(() => {
    if (!draft || !profile || prefilledFromProfile.current) return;

    prefilledFromProfile.current = true;
    setDraft((current) => {
      if (!current) return current;
      return mergeBuyerOnboardingDraft(current, {
        buyerBasics: {
          budgetMax:
            current.buyerBasics.budgetMax ||
            (profile.financing.budgetMax ? String(profile.financing.budgetMax) : ""),
          financingType:
            current.buyerBasics.financingType ||
            profile.financing.financingType ||
            "",
          moveTimeline:
            current.buyerBasics.moveTimeline ||
            profile.searchPreferences.moveTimeline ||
            "",
          preferredAreas:
            current.buyerBasics.preferredAreas.length > 0
              ? current.buyerBasics.preferredAreas
              : profile.searchPreferences.preferredAreas,
        },
      });
    });
  }, [draft, profile, setDraft]);

  const activeDraft =
    draft && draft.listingUrl === listingUrl
      ? draft
      : createBuyerOnboardingDraft({
          listingUrl,
          intakeSource,
          sourcePlatform: initialSourcePlatform,
        });

  const registrationSource = activeDraft.intakeSource ?? intakeSource ?? "hero";
  const teaserSource = `${registrationSource}:intake_teaser`;

  useEffect(() => {
    if (teaserTracked.current) return;

    teaserTracked.current = true;
    trackTeaserRendered({
      source: teaserSource,
      platform: activeDraft.sourcePlatform ?? initialSourcePlatform ?? undefined,
      sourceListingId: activeDraft.sourceListingId ?? undefined,
      latencyMs:
        typeof submittedAtMs === "number"
          ? Math.max(Date.now() - submittedAtMs, 0)
          : undefined,
    });
  }, [
    activeDraft.sourceListingId,
    activeDraft.sourcePlatform,
    initialSourcePlatform,
    submittedAtMs,
    teaserSource,
  ]);

  useEffect(() => {
    if (registrationPromptTracked.current) return;
    if (!isClerkConfigured || isAuthLoading || isAuthenticated) return;

    registrationPromptTracked.current = true;
    trackRegistrationPrompted(teaserSource);
  }, [isAuthenticated, isAuthLoading, isClerkConfigured, teaserSource]);

  const handleDraftChange = (
    updater: (current: BuyerOnboardingDraft) => BuyerOnboardingDraft,
  ) => {
    setDraft((current) => {
      const base =
        current && current.listingUrl === listingUrl ? current : activeDraft;
      return updater(base);
    });
  };

  const handleBuyerBasicsSubmit = async () => {
    const validation = validateBuyerOnboardingBasics(activeDraft);
    if (!validation.ok) {
      setValidationErrors(validation.errors);
      return;
    }

    if (!activeDraft.sourceListingId) {
      setSubmitError("We are still preparing the first property link. Try again in a moment.");
      return;
    }

    setValidationErrors([]);
    setSubmitError(null);
    setIsSaving(true);

    try {
      await saveBuyerProfile({
        financing: {
          budgetMax: validation.value.budgetMax,
          financingType: validation.value.financingType,
          preApproved: false,
        },
        searchPreferences: {
          moveTimeline: validation.value.moveTimeline,
          preferredAreas: validation.value.preferredAreas,
        },
      });

      const result = await linkFirstProperty({
        sourceListingId: activeDraft.sourceListingId as Id<"sourceListings">,
      });

      if (result.status === "deal_room_ready") {
        clearDraft();
        router.push(`/dealroom/${result.dealRoomId}`);
        return;
      }

      setDraft((current) => {
        if (!current) return current;
        return setBuyerOnboardingPropertyStatus(current, {
          status: result.status,
          propertyId: null,
          dealRoomId: null,
        });
      });

      router.push("/dashboard");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not finish onboarding.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const returnUrl = returnUrlFor(listingUrl);
  const currentStep =
    !isAuthenticated
      ? "account"
      : activeDraft.stage === "first_property" || activeDraft.stage === "completed"
        ? "first_property"
        : "buyer_basics";

  return (
    <div
      className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16"
      data-onboarding-stage={activeDraft.stage}
      data-onboarding-auth={activeDraft.authStatus}
      data-onboarding-property-status={activeDraft.property.status}
    >
      <section className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
          {portalLabel} intake
        </p>
        <h1 className="text-3xl font-semibold text-neutral-900">
          {summaryTitle ??
            `Create your buyer account to unlock this ${portalLabel} deal room.`}
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-600">
          {summaryBody ??
            `We captured the listing link. Register once, tell us your buyer basics, and we’ll open the first deal room with this property already attached.`}
        </p>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
          <span className="font-medium text-neutral-900">Listing:</span>{" "}
          <span className="break-all">{listingUrl}</span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        {STEP_LABELS.map((step, index) => {
          const isActive = step.key === currentStep;
          const isComplete =
            step.key === "account"
              ? isAuthenticated
              : step.key === "buyer_basics"
                ? isAuthenticated && activeDraft.stage !== "account"
                : activeDraft.property.status === "deal_room_ready";

          return (
            <div
              key={step.key}
              className={`rounded-xl border px-4 py-3 text-sm ${
                isActive
                  ? "border-primary-300 bg-primary-50"
                  : isComplete
                    ? "border-success-200 bg-success-50"
                    : "border-neutral-200 bg-white"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Step {index + 1}
              </p>
              <p className="mt-1 font-medium text-neutral-900">{step.label}</p>
            </div>
          );
        })}
      </div>

      <Card
        className="border-neutral-200 bg-white shadow-sm"
        data-onboarding-stage={currentStep}
      >
        <CardContent className="space-y-6 p-6">
          {captureError && (
            <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
              {captureError}
            </div>
          )}

          {isClerkConfigured && isAuthenticated && actor === null && (
            <EnsureCurrentBuyerEffect
              attributionSessionId={undefined}
              onError={setAccountError}
            />
          )}

          {isClerkConfigured && isAuthenticated && (
            <RegistrationCompletionEffect source={teaserSource} />
          )}

          {!isClerkConfigured ? (
            <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
              Auth is not configured in this environment, so the registration step
              cannot complete.
            </div>
          ) : isAuthLoading || (isAuthenticated && actor === null) ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-900">
                Preparing your buyer account…
              </p>
              <p className="text-sm text-neutral-500">
                We&apos;re syncing your sign-in session with buyer-codex.
              </p>
            </div>
          ) : !isAuthenticated ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Step 1: Create your account
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Use the same return URL so the flow resumes on this listing after
                  sign-up or sign-in.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <SignUpButton forceRedirectUrl={returnUrl}>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                  >
                    Create buyer account
                  </button>
                </SignUpButton>
                <SignInButton forceRedirectUrl={returnUrl}>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-300 px-5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                  >
                    I already have an account
                  </button>
                </SignInButton>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Step 2: Fill in your buyer basics
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  We&apos;ll use this to prefill your first deal room and keep the
                  right property context tied to your account.
                </p>
              </div>

              {accountError && (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                  {accountError}
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-800">Budget max</span>
                  <Input
                    inputMode="numeric"
                    value={activeDraft.buyerBasics.budgetMax}
                    onChange={(event) =>
                      handleDraftChange((current) =>
                        mergeBuyerOnboardingDraft(current, {
                          buyerBasics: { budgetMax: event.target.value },
                        }),
                      )
                    }
                    placeholder="650000"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-800">Financing type</span>
                  <select
                    className="flex h-11 w-full rounded-[12px] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm"
                    value={activeDraft.buyerBasics.financingType}
                    onChange={(event) =>
                      handleDraftChange((current) =>
                        mergeBuyerOnboardingDraft(current, {
                          buyerBasics: {
                            financingType: event.target.value as BuyerOnboardingDraft["buyerBasics"]["financingType"],
                          },
                        }),
                      )
                    }
                  >
                    <option value="">Select financing</option>
                    <option value="cash">Cash</option>
                    <option value="conventional">Conventional</option>
                    <option value="fha">FHA</option>
                    <option value="va">VA</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-800">Move timeline</span>
                  <select
                    className="flex h-11 w-full rounded-[12px] border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm"
                    value={activeDraft.buyerBasics.moveTimeline}
                    onChange={(event) =>
                      handleDraftChange((current) =>
                        mergeBuyerOnboardingDraft(current, {
                          buyerBasics: {
                            moveTimeline: event.target.value as BuyerOnboardingDraft["buyerBasics"]["moveTimeline"],
                          },
                        }),
                      )
                    }
                  >
                    <option value="">Select timing</option>
                    <option value="asap">ASAP</option>
                    <option value="1_3_months">1-3 months</option>
                    <option value="3_6_months">3-6 months</option>
                    <option value="6_plus_months">6+ months</option>
                    <option value="just_looking">Just looking</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium text-neutral-800">
                    Preferred areas
                  </span>
                  <Input
                    value={activeDraft.buyerBasics.preferredAreas.join(", ")}
                    onChange={(event) =>
                      handleDraftChange((current) =>
                        mergeBuyerOnboardingDraft(current, {
                          buyerBasics: {
                            preferredAreas: parsePreferredAreas(event.target.value),
                          },
                        }),
                      )
                    }
                    placeholder="Miami, Tampa, St. Petersburg"
                  />
                </label>
              </div>

              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                  <p className="font-medium">We still need a few details:</p>
                  <ul className="mt-2 space-y-1">
                    {validationErrors.map((error) => (
                      <li
                        key={`${error.field}:${error.code}`}
                        data-error-field={error.field}
                        data-error-code={error.code}
                      >
                        {formatValidationError(error)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {submitError && (
                <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
                  {submitError}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-500">
                  The draft is saved locally, so you can leave and resume this step.
                </p>
                <button
                  type="button"
                  onClick={handleBuyerBasicsSubmit}
                  disabled={isSaving || !activeDraft.sourceListingId}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-primary-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-primary-200"
                >
                  {isSaving ? "Unlocking deal room…" : "Continue to deal room"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
