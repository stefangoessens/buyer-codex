import type { Metadata } from "next";
import { AuthEntryPanel } from "@/components/auth/AuthEntryPanel";

export const metadata: Metadata = {
  title: "Sign in | buyer-codex",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo = "/dashboard" } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center px-6 py-16">
      <AuthEntryPanel
        mode="sign-in"
        returnTo={returnTo}
        title="Sign in to buyer-codex"
        description="Use Google or a magic link email to reopen your buyer dashboard, deal room, or internal console session."
        footerHref="/auth/sign-up"
        footerLabel="Need a buyer account? Start here."
      />
    </div>
  );
}
