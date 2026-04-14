import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

const authServer =
  convexUrl && convexSiteUrl
    ? convexBetterAuthNextJs({
        convexUrl,
        convexSiteUrl,
      })
    : null;

const unavailableResponse = () =>
  Response.json(
    {
      ok: false,
      error: "auth_proxy_unavailable",
      message:
        "NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CONVEX_SITE_URL are required for Better Auth.",
    },
    { status: 503 },
  );

export const getToken = authServer ? authServer.getToken : async () => null;

export const handler = authServer
  ? authServer.handler
  : {
      GET: async () => unavailableResponse(),
      POST: async () => unavailableResponse(),
    };
