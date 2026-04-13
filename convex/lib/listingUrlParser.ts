// ═══════════════════════════════════════════════════════════════════════════
// Listing URL Parser — CONVEX MIRROR
//
// Convex functions cannot import from `src/`, so backend entry points keep a
// local mirror of the canonical listing URL parser contract used by the web
// layer. SMS intake and the generic intake mutation should both import this
// module instead of carrying their own parser copies.
// ═══════════════════════════════════════════════════════════════════════════

export type ConvexSourcePlatform = "zillow" | "redfin" | "realtor";

export type ConvexParseErrorCode =
  | "unsupported_url"
  | "malformed_url"
  | "missing_listing_id";

export interface ConvexParseError {
  code: ConvexParseErrorCode;
  message: string;
  platform?: ConvexSourcePlatform;
}

export interface ConvexPortalMetadata {
  platform: ConvexSourcePlatform;
  listingId: string;
  normalizedUrl: string;
  rawUrl: string;
}

export type ConvexParseResult =
  | { success: true; data: ConvexPortalMetadata }
  | { success: false; error: ConvexParseError };

interface PortalMatcher {
  platform: ConvexSourcePlatform;
  domains: string[];
  match: (url: URL) => { listingId: string } | null;
}

const PORTAL_MATCHERS: PortalMatcher[] = [
  {
    platform: "zillow",
    domains: ["zillow.com", "www.zillow.com"],
    match(url: URL) {
      const zpidMatch = url.pathname.match(/(\d+)_zpid/);
      if (!zpidMatch) return null;
      return { listingId: zpidMatch[1] };
    },
  },
  {
    platform: "redfin",
    domains: ["redfin.com", "www.redfin.com"],
    match(url: URL) {
      const homeMatch = url.pathname.match(/\/home\/(\d+)/);
      if (!homeMatch) return null;
      return { listingId: homeMatch[1] };
    },
  },
  {
    platform: "realtor",
    domains: ["realtor.com", "www.realtor.com"],
    match(url: URL) {
      const detailMatch = url.pathname.match(
        /\/realestateandhomes-detail\/([^/]+)/,
      );
      if (!detailMatch) return null;
      return { listingId: detailMatch[1] };
    },
  },
];

export function parseListingUrl(input: string): ConvexParseResult {
  const trimmed = input.trim();

  let url: URL;
  try {
    const withProtocol = trimmed.startsWith("http")
      ? trimmed
      : `https://${trimmed}`;
    url = new URL(withProtocol);
  } catch {
    return {
      success: false,
      error: {
        code: "malformed_url",
        message: "Input is not a valid URL",
      },
    };
  }

  const hostname = url.hostname.toLowerCase();

  for (const portal of PORTAL_MATCHERS) {
    if (
      !portal.domains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      )
    ) {
      continue;
    }

    const match = portal.match(url);
    if (!match) {
      return {
        success: false,
        error: {
          code: "missing_listing_id",
          message: `URL appears to be ${portal.platform} but no listing ID could be extracted`,
          platform: portal.platform,
        },
      };
    }

    const normalized = new URL(url.pathname, `https://${portal.domains[0]}`);
    return {
      success: true,
      data: {
        platform: portal.platform,
        listingId: match.listingId,
        normalizedUrl: normalized.toString(),
        rawUrl: trimmed,
      },
    };
  }

  return {
    success: false,
    error: {
      code: "unsupported_url",
      message: `URL domain "${hostname}" is not a supported real estate portal. Supported: Zillow, Redfin, Realtor.com`,
    },
  };
}

export function buildSourceUrlLookupCandidates(
  rawUrl: string,
  normalizedUrl: string,
): Array<string> {
  const candidates: Array<string> = [];

  for (const candidate of [normalizedUrl.trim(), rawUrl.trim()]) {
    if (!candidate || candidates.includes(candidate)) {
      continue;
    }
    candidates.push(candidate);
  }

  return candidates;
}
