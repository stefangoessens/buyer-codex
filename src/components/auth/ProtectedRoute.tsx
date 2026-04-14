"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { readAuthProviderHint } from "@/lib/auth-hints";
import { SurfaceState } from "@/components/product/SurfaceState";

interface ProtectedRouteProps {
  surface: "buyer" | "admin";
  children: ReactNode;
}

function buildReturnTo(pathname: string, searchParams: URLSearchParams | null) {
  const search = searchParams?.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function ProtectedRoute({ surface, children }: ProtectedRouteProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useQuery(api.authState.getViewerSession);
  const syncCurrentIdentity = useMutation(api.users.syncCurrentIdentity);

  const [isSyncing, setIsSyncing] = useState(false);
  const syncAttemptedRef = useRef(false);
  const returnTo = useMemo(
    () => buildReturnTo(pathname, searchParams),
    [pathname, searchParams],
  );

  useEffect(() => {
    if (session?.kind !== "unknown_user" || syncAttemptedRef.current || isSyncing) {
      return;
    }

    syncAttemptedRef.current = true;
    setIsSyncing(true);

    void syncCurrentIdentity({
      authProviderHint: readAuthProviderHint(),
    }).finally(() => {
      setIsSyncing(false);
    });
  }, [isSyncing, session, syncCurrentIdentity]);

  useEffect(() => {
    if (session === undefined || isSyncing) {
      return;
    }

    if (session.kind === "anonymous") {
      router.replace(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (session.kind === "unknown_user") {
      router.replace(`/get-started?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    if (surface === "admin" && !session.permissions.canAccessInternalConsole) {
      router.replace("/dashboard");
    }
  }, [isSyncing, returnTo, router, session, surface]);

  if (session === undefined || isSyncing) {
    return (
      <SurfaceState
        tone="info"
        title="Checking your session…"
        description="buyer-codex is restoring your authenticated route."
        className="min-h-[280px] bg-white"
      />
    );
  }

  if (session.kind !== "authenticated") {
    return (
      <SurfaceState
        tone="info"
        title="Redirecting to sign-in…"
        description="Protected buyer-codex routes require an authenticated session."
        className="min-h-[280px] bg-white"
      />
    );
  }

  if (surface === "admin" && !session.permissions.canAccessInternalConsole) {
    return (
      <SurfaceState
        tone="error"
        title="Redirecting to an allowed surface…"
        description="This account can sign in but does not have access to the internal console."
        className="min-h-[280px] bg-white"
      />
    );
  }

  return <>{children}</>;
}
