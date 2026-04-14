"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { PostHogPageView, PostHogProvider } from "@/lib/posthog";

function AuthProviders({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}

export function Providers({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  return (
    <PostHogProvider>
      <PostHogPageView />
      <AuthProviders initialToken={initialToken}>{children}</AuthProviders>
    </PostHogProvider>
  );
}
