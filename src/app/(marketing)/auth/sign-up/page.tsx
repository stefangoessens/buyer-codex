import type { Metadata } from "next";
import { AuthEntryPanel } from "@/components/auth/AuthEntryPanel";

export const metadata: Metadata = {
  title: "Create account | buyer-codex",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo = "/dashboard" } = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center px-6 py-16">
      <AuthEntryPanel
        mode="sign-up"
        returnTo={returnTo}
        title="Create your buyer account"
        description="Start with Google or a magic-link email. buyer-codex keeps anonymous intake public, then resumes the protected buyer flow after sign-in."
        footerHref="/auth/sign-in"
        footerLabel="Already have an account? Sign in."
      />
    </div>
  );
}
