"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LINK_PASTED_SOURCES,
  type LinkPastedSource,
} from "@buyer-codex/shared/launch-events";
import { BuyerOnboardingFlow } from "@/components/onboarding/BuyerOnboardingFlow";
import { IntakeFailureState } from "@/components/onboarding/IntakeFailureState";
import { ManualAddressInput } from "@/components/marketing/ManualAddressInput";
import {
  getExtensionIntakeViewModel,
  type ExtensionIntakeAuthState,
  type ExtensionIntakeOutcome,
  type ExtensionIntakeSuccessResult,
} from "@/lib/extension/detect-listing";
import { parseListingUrl } from "@/lib/intake/parser";

const LINK_PASTED_SOURCE_SET = new Set<LinkPastedSource>(LINK_PASTED_SOURCES);

interface IntakePageClientProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function isExtensionOutcome(value: string | undefined): value is ExtensionIntakeOutcome {
  return value === "created" || value === "duplicate";
}

function isExtensionAuthState(
  value: string | undefined,
): value is ExtensionIntakeAuthState {
  return value === "signed_in" || value === "signed_out";
}

function isLinkPastedSource(
  value: string | undefined,
): value is LinkPastedSource {
  return value ? LINK_PASTED_SOURCE_SET.has(value as LinkPastedSource) : false;
}

export function IntakePageClient({ searchParams }: IntakePageClientProps) {
  void searchParams;
  const resolvedSearchParams = useSearchParams();
  const url = resolvedSearchParams.get("url") ?? undefined;
  const source = resolvedSearchParams.get("source") ?? undefined;
  const submittedAt = resolvedSearchParams.get("submittedAt") ?? undefined;
  const result = resolvedSearchParams.get("result") ?? undefined;
  const auth = resolvedSearchParams.get("auth") ?? undefined;
  const platform = resolvedSearchParams.get("platform") ?? undefined;
  const listingId = resolvedSearchParams.get("listingId") ?? undefined;
  const sourceListingId =
    resolvedSearchParams.get("sourceListingId") ?? undefined;
  const attemptId = resolvedSearchParams.get("attemptId") ?? undefined;

  if (!url) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">Intake</h1>
        <p className="mt-4 text-neutral-600">
          No listing URL was forwarded. Head back to the homepage and paste a
          Zillow, Redfin, or Realtor.com link to get started.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to homepage
        </Link>
      </main>
    );
  }

  const parsed = parseListingUrl(url);
  const intakeSource = isLinkPastedSource(source) ? source : null;
  const submittedAtMs =
    typeof submittedAt === "string" && /^\d+$/.test(submittedAt)
      ? Number(submittedAt)
      : null;

  if (!parsed.success) {
    return (
      <IntakeFailureState code={parsed.error.code} url={url}>
        <ManualAddressInput />
      </IntakeFailureState>
    );
  }

  const portalLabel =
    parsed.data.platform === "zillow"
      ? "Zillow"
      : parsed.data.platform === "redfin"
        ? "Redfin"
        : "Realtor.com";

  const extensionViewModel =
    source === "extension" &&
    isExtensionOutcome(result) &&
    isExtensionAuthState(auth) &&
    (platform === "zillow" || platform === "redfin" || platform === "realtor") &&
    typeof listingId === "string" &&
    typeof sourceListingId === "string" &&
    typeof attemptId === "string"
      ? getExtensionIntakeViewModel({
          kind: result,
          authState: auth,
          platform,
          listingId,
          normalizedUrl: parsed.data.normalizedUrl,
          sourceListingId,
          attemptId,
        } satisfies ExtensionIntakeSuccessResult)
      : null;

  return (
    <main className="min-h-screen bg-neutral-50">
      <BuyerOnboardingFlow
        listingUrl={parsed.data.normalizedUrl}
        portalLabel={portalLabel}
        summaryTitle={extensionViewModel?.title}
        summaryBody={extensionViewModel?.body}
        intakeSource={intakeSource}
        submittedAtMs={submittedAtMs}
        initialSourcePlatform={parsed.data.platform}
        initialSourceListingId={sourceListingId ?? null}
        initialAttemptId={attemptId ?? null}
      />
    </main>
  );
}
