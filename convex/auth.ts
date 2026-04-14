import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins/magic-link";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { readAuthRuntimeConfig } from "./lib/authRuntime";

export const authComponent = createClient<DataModel>(components.betterAuth);

function renderMagicLinkEmail(url: string) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
      <p style="margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#2563eb">
        buyer-codex
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15">Sign in to buyer-codex</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4b5563">
        Use the secure link below to continue your buyer dashboard, deal room, or intake flow.
      </p>
      <p style="margin:0 0 24px">
        <a href="${url}" style="display:inline-block;border-radius:14px;background:#2563eb;color:#ffffff;padding:14px 20px;font-size:15px;font-weight:700;text-decoration:none">
          Open buyer-codex
        </a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;word-break:break-word">
        If the button does not work, paste this URL into your browser:<br />
        <a href="${url}" style="color:#2563eb">${url}</a>
      </p>
    </div>
  `;
}

async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const runtime = readAuthRuntimeConfig();
  if (!runtime.emailEnabled) {
    throw new Error("Email auth is not configured for this environment.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: runtime.authEmailFrom,
      to: [email],
      subject: "Your buyer-codex sign-in link",
      html: renderMagicLinkEmail(url),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Magic link delivery failed with ${response.status}: ${text.slice(0, 200)}`,
    );
  }
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const runtime = readAuthRuntimeConfig();

  return {
    baseURL: runtime.siteUrl,
    secret: runtime.secret,
    database: authComponent.adapter(ctx),
    socialProviders: runtime.googleEnabled
      ? {
          google: {
            clientId: runtime.googleClientId,
            clientSecret: runtime.googleClientSecret,
          },
        }
      : undefined,
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail({ email, url });
        },
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
