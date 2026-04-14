"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearAuthProviderHint } from "@/lib/auth-hints";
import { resetIdentity } from "@/lib/posthog";
import { clearSentryUser } from "@/lib/sentry";
import { Button } from "@/components/ui/button";

interface SignOutButtonProps {
  variant?: "ghost" | "outline";
  size?: "sm" | "default";
  className?: string;
}

export function SignOutButton({
  variant = "outline",
  size = "sm",
  className,
}: SignOutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleSignOut = async () => {
    setIsPending(true);
    await authClient.signOut();
    clearAuthProviderHint();
    resetIdentity();
    clearSentryUser();
    window.location.assign("/");
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void handleSignOut()}
      disabled={isPending}
    >
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
