"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithAuth } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode } from "react";
import { convex } from "@/lib/convex";
import { env, isConfigured } from "@/lib/env";
import { PostHogPageView, PostHogProvider } from "@/lib/posthog";

function ConvexClerkProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>;
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

function useAnonymousConvexAuth() {
  return {
    isLoading: false,
    isAuthenticated: false,
    fetchAccessToken: async () => null,
  };
}

function AuthProviders({ children }: { children: ReactNode }) {
  const authProvider = env.NEXT_PUBLIC_AUTH_PROVIDER;
  const isClerkConfigured =
    authProvider === "clerk" && isConfigured.auth();

  if (!isClerkConfigured) {
    if (!convex) {
      return <>{children}</>;
    }

    return (
      <ConvexProviderWithAuth client={convex} useAuth={useAnonymousConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    );
  }

  return (
    <ClerkProvider publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <ConvexClerkProvider>{children}</ConvexClerkProvider>
    </ClerkProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PostHogProvider>
      <PostHogPageView />
      <AuthProviders>{children}</AuthProviders>
    </PostHogProvider>
  );
}
