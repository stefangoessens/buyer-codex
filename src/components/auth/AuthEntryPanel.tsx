"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { rememberAuthProviderHint } from "@/lib/auth-hints";
import { convex } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AuthEntryPanelProps {
  mode: "sign-in" | "sign-up";
  returnTo: string;
  title: string;
  description: string;
  compact?: boolean;
  footerHref?: string;
  footerLabel?: string;
}

function normalizeReturnTo(returnTo: string) {
  if (!returnTo.startsWith("/")) {
    return "/dashboard";
  }
  return returnTo;
}

export function AuthEntryPanel({
  mode,
  returnTo,
  title,
  description,
  compact = false,
  footerHref,
  footerLabel,
}: AuthEntryPanelProps) {
  const router = useRouter();
  const normalizedReturnTo = useMemo(() => normalizeReturnTo(returnTo), [returnTo]);
  const { data: sessionData, isPending: isSessionPending } = authClient.useSession();
  const capabilities = useQuery(
    api.authState.getCapabilities,
    convex ? {} : "skip",
  );

  const [email, setEmail] = useState("");
  const [isGooglePending, setGooglePending] = useState(false);
  const [isEmailPending, setEmailPending] = useState(false);
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionData?.session && !isSessionPending) {
      router.replace(normalizedReturnTo);
    }
  }, [isSessionPending, normalizedReturnTo, router, sessionData?.session]);

  const googleEnabled = Boolean(capabilities?.googleEnabled);
  const emailEnabled = Boolean(capabilities?.emailEnabled);
  const authUnavailable =
    capabilities !== undefined && !capabilities.googleEnabled && !capabilities.emailEnabled;

  const handleGoogle = async () => {
    setError(null);
    setGooglePending(true);
    rememberAuthProviderHint("google");

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: normalizedReturnTo,
        newUserCallbackURL: normalizedReturnTo,
        errorCallbackURL: `/auth/sign-in?returnTo=${encodeURIComponent(normalizedReturnTo)}`,
      });

      if (result.error) {
        setError(result.error.message ?? "Google sign-in could not be started.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Google sign-in could not be started.");
    } finally {
      setGooglePending(false);
    }
  };

  const handleMagicLink = async () => {
    setError(null);
    setEmailSent(null);
    setEmailPending(true);
    rememberAuthProviderHint("email");

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: normalizedReturnTo,
        newUserCallbackURL: normalizedReturnTo,
        errorCallbackURL: `/auth/sign-in?returnTo=${encodeURIComponent(normalizedReturnTo)}`,
      });

      if (result.error) {
        setError(result.error.message ?? "Magic link sign-in could not be started.");
        return;
      }

      setEmailSent(email);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Magic link sign-in could not be started.",
      );
    } finally {
      setEmailPending(false);
    }
  };

  const content = (
    <div className="space-y-5">
      <div className="space-y-2">
        <h1 className={compact ? "text-xl font-semibold text-neutral-900" : "text-3xl font-semibold text-neutral-900"}>
          {title}
        </h1>
        <p className="text-sm leading-6 text-neutral-600">{description}</p>
      </div>

      {authUnavailable && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          Auth is scaffolded but provider credentials are not configured in this environment
          yet. Google and magic-link email sign-in will stay disabled until those keys are added.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      {emailSent && (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">
          Magic link sent to <span className="font-medium">{emailSent}</span>. Open it in
          this browser to finish signing in.
        </div>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          className="h-11 w-full justify-center"
          onClick={() => void handleGoogle()}
          disabled={!googleEnabled || isGooglePending || capabilities === undefined}
        >
          {isGooglePending ? "Redirecting to Google…" : "Continue with Google"}
        </Button>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void handleMagicLink()}
            disabled={
              !emailEnabled || !email.trim() || isEmailPending || capabilities === undefined
            }
          >
            {isEmailPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </div>
      </div>

      <p className="text-xs leading-5 text-neutral-500">
        {mode === "sign-up"
          ? "New buyers can continue with Google or a magic link. buyer-codex creates the auth account during the first successful sign-in."
          : "Use the same browser session so buyer-codex can restore your intended route after sign-in."}
      </p>

      {footerHref && footerLabel ? (
        <p className="text-sm text-neutral-500">
          <Link href={footerHref} className="font-medium text-primary hover:text-primary/80">
            {footerLabel}
          </Link>
        </p>
      ) : null}
    </div>
  );

  if (compact) {
    return content;
  }

  return (
    <Card className="border-neutral-200/80 bg-white shadow-[0_16px_36px_-30px_rgba(3,14,29,0.09)]">
      <CardContent className="p-6">{content}</CardContent>
    </Card>
  );
}
