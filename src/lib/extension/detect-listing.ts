/**
 * Chrome extension listing page detection (KIN-816 / KIN-894).
 *
 * Pure TS — imported by Vitest and reused by the web handoff surface so
 * the extension can keep browser-side logic narrow while the backend
 * remains the source of truth for intake outcomes.
 */

import type { LinkPastedSource } from "@buyer-codex/shared/launch-events";
import { parseListingUrl } from "@/lib/intake/parser";
import type { SourcePlatform } from "@/lib/intake/types";

export type DetectionStatus =
  | "supported_listing"
  | "supported_portal_no_listing"
  | "unsupported_portal"
  | "invalid_url"
  | "empty";

export interface DetectionResult {
  status: DetectionStatus;
  platform?: SourcePlatform;
  listingId?: string;
  normalizedUrl?: string;
  message: string;
}

export const EXTENSION_INTAKE_AUTH_STATES = [
  "signed_in",
  "signed_out",
] as const;

export type ExtensionIntakeAuthState =
  (typeof EXTENSION_INTAKE_AUTH_STATES)[number];

export const EXTENSION_INTAKE_OUTCOMES = [
  "created",
  "duplicate",
] as const;

export type ExtensionIntakeOutcome =
  (typeof EXTENSION_INTAKE_OUTCOMES)[number];

export const EXTENSION_INTAKE_FAILURE_CODES = [
  "invalid_request",
  "backend_unavailable",
  "malformed_url",
  "missing_listing_id",
  "unsupported_url",
] as const;

export type ExtensionIntakeFailureCode =
  (typeof EXTENSION_INTAKE_FAILURE_CODES)[number];

export interface ExtensionIntakeSuccessResult {
  kind: ExtensionIntakeOutcome;
  authState: ExtensionIntakeAuthState;
  platform: SourcePlatform;
  listingId: string;
  normalizedUrl: string;
  sourceListingId: string;
  attemptId: string;
}

export interface ExtensionIntakeFailureResult {
  kind: "unsupported";
  code: ExtensionIntakeFailureCode;
  error: string;
  platform?: SourcePlatform;
}

export type ExtensionIntakeSubmissionResult =
  | ExtensionIntakeSuccessResult
  | ExtensionIntakeFailureResult;

export interface ExtensionIntakeViewModel {
  eyebrow: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  statusLabel: string;
}

export function detectListingPage(url: string | undefined): DetectionResult {
  if (!url || url.trim().length === 0) {
    return { status: "empty", message: "No URL on the current tab." };
  }

  if (
    url.startsWith("chrome://") ||
    url.startsWith("about:") ||
    url.startsWith("moz-extension://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://")
  ) {
    return { status: "empty", message: "Browser internal page." };
  }

  const parsed = parseListingUrl(url);

  if (parsed.success) {
    return {
      status: "supported_listing",
      platform: parsed.data.platform,
      listingId: parsed.data.listingId,
      normalizedUrl: parsed.data.normalizedUrl,
      message: `${portalLabel(parsed.data.platform)} listing detected. Click to save to buyer-codex.`,
    };
  }

  switch (parsed.error.code) {
    case "malformed_url":
      return { status: "invalid_url", message: "Invalid URL on the current tab." };
    case "missing_listing_id":
      return {
        status: "supported_portal_no_listing",
        message:
          "Supported portal, but this page isn't a specific listing. Open a listing page first.",
      };
    case "unsupported_url":
      return {
        status: "unsupported_portal",
        message:
          "Not a supported listing portal. buyer-codex supports Zillow, Redfin, and Realtor.com.",
      };
    default:
      return { status: "unsupported_portal", message: "Not a supported listing." };
  }
}

export function portalLabel(platform: SourcePlatform): string {
  switch (platform) {
    case "zillow":
      return "Zillow";
    case "redfin":
      return "Redfin";
    case "realtor":
      return "Realtor.com";
  }
}

export function buildIntakeForwardUrl(
  buyerCodexBaseUrl: string,
  normalizedListingUrl: string,
): string {
  const source: Extract<LinkPastedSource, "extension"> = "extension";
  const base = buyerCodexBaseUrl.replace(/\/$/, "");
  const encoded = encodeURIComponent(normalizedListingUrl);
  return `${base}/intake?url=${encoded}&source=${source}`;
}

export function buildExtensionIntakeRedirectUrl(
  buyerCodexBaseUrl: string,
  result: ExtensionIntakeSuccessResult,
): string {
  const base = buyerCodexBaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    url: result.normalizedUrl,
    source: "extension",
    result: result.kind,
    auth: result.authState,
    platform: result.platform,
    listingId: result.listingId,
    sourceListingId: result.sourceListingId,
    attemptId: result.attemptId,
  });

  return `${base}/intake?${params.toString()}`;
}

export function getExtensionIntakeViewModel(
  result: ExtensionIntakeSuccessResult,
): ExtensionIntakeViewModel {
  const portal = portalLabel(result.platform);
  const base = {
    eyebrow: `Chrome extension · ${portal}`,
    secondaryHref: result.normalizedUrl,
    secondaryLabel: "Open listing",
  };

  if (result.kind === "duplicate" && result.authState === "signed_in") {
    return {
      ...base,
      title: "This listing is already in buyer-codex",
      body: `We found an existing ${portal} intake for this property. Open your dashboard to keep working from the canonical buyer-codex record.`,
      primaryHref: "/dashboard",
      primaryLabel: "Open dashboard",
      statusLabel: "Duplicate listing",
    };
  }

  if (result.kind === "duplicate") {
    return {
      ...base,
      title: "This listing is already saved",
      body: `We already have this ${portal} property in buyer-codex. Sign in to continue from your dashboard, or head back to the site to paste another listing.`,
      primaryHref: "/",
      primaryLabel: "Go to buyer-codex",
      statusLabel: "Duplicate listing",
    };
  }

  if (result.authState === "signed_in") {
    return {
      ...base,
      title: `Saved from ${portal}`,
      body: `We added this ${portal} listing to the shared buyer-codex intake flow. Open your dashboard to follow the intake and analysis status.`,
      primaryHref: "/dashboard",
      primaryLabel: "Open dashboard",
      statusLabel: "Saved to intake",
    };
  }

  return {
    ...base,
    title: `Saved from ${portal}`,
    body: `We captured this ${portal} listing in buyer-codex. Sign in on the site to continue from your intake queue and unlock the full analysis.`,
    primaryHref: "/",
    primaryLabel: "Go to buyer-codex",
    statusLabel: "Saved to intake",
  };
}
