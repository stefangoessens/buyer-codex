// ═══════════════════════════════════════════════════════════════════════════
// /intake — Landing page for inbound URL forwards (KIN-816)
//
// This route accepts a `?url=<listing-url>&source=<channel>` query string
// and hands off to the main intake flow. It's deliberately minimal in
// v1: the extension (KIN-816) and SMS handler (KIN-776) forward here, and a
// follow-up card will wire in the
// auth-aware signed-in / signed-out / duplicate branching.
//
// For now this page:
//   1. Validates the forwarded URL with the canonical parser
//   2. Shows the buyer the detected listing metadata
//   3. Offers a "Continue" CTA that returns to the homepage where the
//      existing PasteLinkInput handles the next step
//
// The page is a server component so we can read searchParams without a
// client roundtrip and so SEO can mark the route as noindex (intake is
// not a discoverable surface).
// ═══════════════════════════════════════════════════════════════════════════

import Link from "next/link";
import type { Metadata } from "next";
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
        <p className="mt-2 text-sm text-neutral-500 break-all">URL: {url}</p>
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
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
        {extensionViewModel?.eyebrow ?? `Importing from ${portalLabel}`}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {extensionViewModel?.title ?? `Importing from ${portalLabel}`}
      </h1>
      <p className="mt-4 text-neutral-600">
        {extensionViewModel?.body ??
          `We detected a valid ${portalLabel} listing. Continue to buyer-codex to see your pricing panel, comps, and leverage analysis.`}
      </p>
      <dl className="mt-6 rounded-lg border border-neutral-200 p-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-500">Portal</dt>
          <dd className="font-medium">{portalLabel}</dd>
        </div>
        <div className="mt-2 flex justify-between">
          <dt className="text-neutral-500">Listing ID</dt>
          <dd className="font-medium font-mono text-xs">{parsed.data.listingId}</dd>
        </div>
        {source ? (
          <div className="mt-2 flex justify-between">
            <dt className="text-neutral-500">Source</dt>
            <dd className="font-medium">{source}</dd>
          </div>
        ) : null}
        {extensionViewModel ? (
          <div className="mt-2 flex justify-between">
            <dt className="text-neutral-500">State</dt>
            <dd className="font-medium">{extensionViewModel.statusLabel}</dd>
          </div>
        ) : null}
      </dl>
      <Link
        href={
          extensionViewModel?.primaryHref ??
          `/?intake=${encodeURIComponent(parsed.data.normalizedUrl)}`
        }
        className="mt-6 inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
      >
        {extensionViewModel?.primaryLabel ?? "Continue to buyer-codex"}
      </Link>
      {extensionViewModel?.secondaryHref && extensionViewModel.secondaryLabel ? (
        <Link
          href={extensionViewModel.secondaryHref}
          className="mt-3 inline-block text-sm font-medium text-neutral-600 underline-offset-2 hover:underline"
        >
          {extensionViewModel.secondaryLabel}
        </Link>
      ) : null}
    </main>
  );
}
