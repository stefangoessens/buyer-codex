import Link from "next/link";
import type { Metadata } from "next";
import { BuyerOnboardingFlow } from "@/components/onboarding/BuyerOnboardingFlow";
import {
  getExtensionIntakeViewModel,
  type ExtensionIntakeAuthState,
  type ExtensionIntakeOutcome,
  type ExtensionIntakeSuccessResult,
} from "@/lib/extension/detect-listing";
import { parseListingUrl } from "@/lib/intake/parser";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";

export const metadata: Metadata = metadataForStaticPage("intake");

interface IntakePageProps {
  searchParams: Promise<{
    url?: string;
    source?: string;
    result?: string;
    auth?: string;
    platform?: string;
    listingId?: string;
    sourceListingId?: string;
  }>;
}

function isExtensionOutcome(value: string | undefined): value is ExtensionIntakeOutcome {
  return value === "created" || value === "duplicate";
}

function isExtensionAuthState(
  value: string | undefined,
): value is ExtensionIntakeAuthState {
  return value === "signed_in" || value === "signed_out";
}

export default async function IntakePage({ searchParams }: IntakePageProps) {
  const { url, source, result, auth, platform, listingId, sourceListingId } =
    await searchParams;

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

  if (!parsed.success) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <h1 className="text-2xl font-semibold">We couldn&apos;t import that link</h1>
        <p className="mt-4 text-neutral-600">
          {parsed.error.code === "unsupported_url"
            ? "buyer-codex currently supports Zillow, Redfin, and Realtor.com listings."
            : "The forwarded URL was not recognized as a listing. Try pasting it on the homepage."}
        </p>
        <p className="mt-2 break-all text-sm text-neutral-500">URL: {url}</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again from homepage
        </Link>
      </main>
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
    typeof sourceListingId === "string"
      ? getExtensionIntakeViewModel({
          kind: result,
          authState: auth,
          platform,
          listingId,
          normalizedUrl: parsed.data.normalizedUrl,
          sourceListingId,
        } satisfies ExtensionIntakeSuccessResult)
      : null;

  return (
    <main className="min-h-screen bg-neutral-50">
      <BuyerOnboardingFlow
        listingUrl={parsed.data.normalizedUrl}
        portalLabel={portalLabel}
        summaryTitle={extensionViewModel?.title}
        summaryBody={extensionViewModel?.body}
        initialSourcePlatform={parsed.data.platform}
      />
    </main>
  );
}
