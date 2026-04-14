import type { Metadata } from "next";
import {
  MarketingShellFooter,
  MarketingShellHeader,
} from "@/components/marketing/MarketingScaffold";
import { appSurfaceDefinitions } from "@/lib/app-shell";

export const dynamic = "force-static";
export const metadata: Metadata = appSurfaceDefinitions.marketing.metadata;

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_22%,#ffffff_60%,#f8fafc_100%)]">
      <MarketingShellHeader />
      <main className="pb-8">{children}</main>
      <MarketingShellFooter />
    </div>
  );
}
