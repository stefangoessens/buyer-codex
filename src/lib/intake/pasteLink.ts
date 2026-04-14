import type { LinkPastedSource } from "@buyer-codex/shared/launch-events";
import { parseListingUrl } from "./parser";
import type { SourcePlatform } from "./types";
import type { ParseErrorCode, ParseResult } from "./types";

export interface BuildListingIntakeHrefOptions {
  source?: LinkPastedSource;
  submittedAt?: number;
  platform?: SourcePlatform;
  sourceListingId?: string;
  attemptId?: string;
}

export function buildListingIntakeHref(
  url: string,
  options: BuildListingIntakeHrefOptions = {},
): string {
  const params = new URLSearchParams({ url });

  if (options.source) {
    params.set("source", options.source);
  }

  if (typeof options.submittedAt === "number") {
    params.set("submittedAt", String(options.submittedAt));
  }

  if (options.platform) {
    params.set("platform", options.platform);
  }

  if (options.sourceListingId) {
    params.set("sourceListingId", options.sourceListingId);
  }

  if (options.attemptId) {
    params.set("attemptId", options.attemptId);
  }

  return `/intake?${params.toString()}`;
}

export function getPasteLinkErrorMessage(code: ParseErrorCode): string {
  switch (code) {
    case "unsupported_url":
    case "invalid_domain":
      return "Paste a Zillow, Redfin, or Realtor.com listing link.";
    case "missing_listing_id":
      return "We recognized the portal, but that URL does not point to a specific listing.";
    case "malformed_url":
      return "Paste the full listing link, including the page path.";
  }
}

export interface PreparedListingIntakeSubmissionSuccess {
  ok: true;
  href: string;
  parsed: Extract<ParseResult, { success: true }>;
}

export interface PreparedListingIntakeSubmissionFailure {
  ok: false;
  code: ParseErrorCode;
  message: string;
}

export type PreparedListingIntakeSubmission =
  | PreparedListingIntakeSubmissionSuccess
  | PreparedListingIntakeSubmissionFailure;

export function prepareListingIntakeSubmission(
  input: string,
  source: LinkPastedSource,
  submittedAt: number = Date.now(),
): PreparedListingIntakeSubmission {
  const parsed = parseListingUrl(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: parsed.error.code,
      message: getPasteLinkErrorMessage(parsed.error.code),
    };
  }

  return {
    ok: true,
    parsed,
    href: buildListingIntakeHref(parsed.data.normalizedUrl, {
      source,
      submittedAt,
    }),
  };
}
