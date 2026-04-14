import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { trackServerEvent } from "@/lib/analytics.server";
import { env } from "@/lib/env";
import {
  buildExtensionIntakeRedirectUrl,
  type ExtensionIntakeFailureCode,
} from "@/lib/extension/detect-listing";

const AUTH_SESSION_COOKIES = [
  "better-auth.session_token",
  "session_token",
  "__session",
] as const;

function readCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) return null;

  for (const segment of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = segment.trim().split("=");
    if (rawName === cookieName) {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

function resolveConvexAuthToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim() || null;
  }

  const cookieHeader = request.headers.get("cookie");
  for (const cookieName of AUTH_SESSION_COOKIES) {
    const cookieValue = readCookieValue(cookieHeader, cookieName);
    if (cookieValue) {
      return cookieValue;
    }
  }

  return null;
}

async function trackExtensionFailure(
  code: ExtensionIntakeFailureCode,
  stage: "request" | "submit",
) {
  await trackServerEvent("extension_intake_failed", {
    code,
    stage,
  });
}

export async function POST(request: Request) {
  if (!env.NEXT_PUBLIC_CONVEX_URL) {
    await trackExtensionFailure("backend_unavailable", "request");
    return NextResponse.json(
      {
        ok: false,
        kind: "unsupported",
        code: "backend_unavailable",
        error: "NEXT_PUBLIC_CONVEX_URL is not configured.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await trackExtensionFailure("invalid_request", "request");
    return NextResponse.json(
      {
        ok: false,
        kind: "unsupported",
        code: "invalid_request",
        error: "Request body must be valid JSON.",
      },
      { status: 400 },
    );
  }

  const url =
    body && typeof body === "object" && "url" in body && typeof body.url === "string"
      ? body.url
      : "";

  if (!url.trim()) {
    await trackExtensionFailure("invalid_request", "request");
    return NextResponse.json(
      {
        ok: false,
        kind: "unsupported",
        code: "invalid_request",
        error: "A listing URL is required.",
      },
      { status: 400 },
    );
  }

  try {
    const client = new ConvexHttpClient(env.NEXT_PUBLIC_CONVEX_URL);
    const token = resolveConvexAuthToken(request);
    if (token) {
      client.setAuth(token);
    }

    const result = await client.mutation(api.intake.submitExtensionUrl, { url });

    if (result.kind === "unsupported") {
      await trackExtensionFailure(result.code, "submit");
      return NextResponse.json(
        {
          ok: false,
          ...result,
        },
        { status: 422 },
      );
    }

    await trackServerEvent("extension_intake_succeeded", {
      platform: result.platform,
      outcome: result.kind,
      authState: result.authState,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      redirectUrl: buildExtensionIntakeRedirectUrl(env.NEXT_PUBLIC_APP_URL, {
        ...result,
        sourceListingId: String(result.sourceListingId),
      }),
    });
  } catch (error) {
    await trackExtensionFailure("backend_unavailable", "submit");
    return NextResponse.json(
      {
        ok: false,
        kind: "unsupported",
        code: "backend_unavailable",
        error:
          error instanceof Error
            ? error.message
            : "Extension intake request failed.",
      },
      { status: 503 },
    );
  }
}
