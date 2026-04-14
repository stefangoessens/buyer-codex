"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { SurfaceDrawer } from "@/components/product/SurfaceDrawer";
import { Button } from "@/components/ui/button";
import { DASHBOARD_NAV } from "@/lib/dealroom/dashboard-types";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  buyerName?: string;
  buyerEmail?: string;
}

export function AppSidebar({ buyerName, buyerEmail }: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 px-4 py-4 md:flex">
      <div className="flex w-full flex-col overflow-hidden rounded-[30px] border border-neutral-200/80 bg-white shadow-[0_18px_36px_-32px_rgba(3,14,29,0.1)]">
        <div className="border-b border-neutral-200/80 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-600 text-sm font-semibold text-white">
              bc
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">buyer-codex</p>
              <p className="text-xs text-neutral-500">Authenticated buyer shell</p>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between gap-5 p-3">
          <nav className="flex flex-col gap-1.5">
            {DASHBOARD_NAV.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    "flex flex-col gap-1 rounded-[22px] px-3.5 py-3 text-sm transition-all",
                    isActive
                      ? "border border-neutral-200 bg-neutral-50 text-neutral-900"
                      : "border border-transparent text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-primary-500" : "bg-neutral-300",
                      )}
                    />
                    {item.label}
                  </span>
                  <span className="pl-4 text-xs leading-5 text-neutral-500">
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="space-y-3">
            {pathname.startsWith("/dealroom/") && (
              <div className="rounded-[22px] border border-neutral-200/80 bg-neutral-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700">
                  Deal room
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  Pricing, leverage, and offer panels stay inside the same shell
                  family as the dashboard.
                </p>
              </div>
            )}

            <div className="rounded-[22px] border border-neutral-200/80 bg-white px-4 py-4">
              <p className="text-sm font-medium text-neutral-900">
                {buyerName ?? "Signed-in buyer"}
              </p>
              {buyerEmail && (
                <p className="mt-1 truncate text-xs text-neutral-500">{buyerEmail}</p>
              )}
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Use the rail for orientation. Keep primary property action in the
                canvas.
              </p>
              <div className="mt-4">
                <SignOutButton className="w-full justify-center" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem = resolveChromeItem(pathname);

  return (
    <>
      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur-xl md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">
              {activeItem.eyebrow}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-neutral-900">
              {activeItem.label}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </svg>
            Menu
          </Button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4">
          {DASHBOARD_NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-neutral-200 bg-white text-neutral-900 shadow-sm"
                    : "border-neutral-200 bg-white text-neutral-600",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <SurfaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Buyer dashboard"
        description="Jump between onboarding, deal rooms, offers, and close tasks."
      >
        <nav className="space-y-2">
          {DASHBOARD_NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border px-4 py-3 transition-colors",
                  isActive
                    ? "border-neutral-200 bg-neutral-50 text-neutral-900"
                    : "border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                )}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-neutral-500">{item.description}</span>
              </Link>
            );
          })}
        </nav>
      </SurfaceDrawer>
    </>
  );
}

function resolveChromeItem(pathname: string) {
  if (pathname.startsWith("/dealroom/")) {
    return {
      label: "Deal room",
      description: "Pricing, claims, and offer action",
      eyebrow: "Buyer workspace",
    };
  }

  if (pathname.startsWith("/property/")) {
    return {
      label: "Property shell",
      description: "Deal room preview",
      eyebrow: "Buyer workspace",
    };
  }

  const navItem =
    DASHBOARD_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? DASHBOARD_NAV[0];

  return {
    ...navItem,
    eyebrow: "Buyer workspace",
  };
}
