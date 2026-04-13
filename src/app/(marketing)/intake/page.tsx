import type { Metadata } from "next";
import { IntakePageClient } from "@/components/onboarding/IntakePageClient";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";

export const metadata: Metadata = metadataForStaticPage("intake");
export const dynamic = "force-dynamic";

interface IntakePageProps {
  searchParams: Promise<{
    url?: string;
    source?: string;
    submittedAt?: string;
    result?: string;
    auth?: string;
    platform?: string;
    listingId?: string;
    sourceListingId?: string;
  }>;
}

export default function IntakePage({ searchParams }: IntakePageProps) {
  return (
    <IntakePageClient searchParams={searchParams} />
  );
}
