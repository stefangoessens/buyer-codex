"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SurfaceDrawer } from "@/components/product/SurfaceDrawer";
import { DASHBOARD_NAV } from "@/lib/dealroom/dashboard-types";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  buyerName?: string;
  buyerEmail?: string;
}

export function AppSidebar({ buyerName, buyerEmail }: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-white md:flex">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-semibold text-white">
          bv
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-900">buyer-codex</p>
          <p className="text-xs text-neutral-500">Your deals home</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {DASHBOARD_NAV.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              <span className="font-medium">{item.label}</span>
              <span className="text-xs text-neutral-500">{item.description}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-neutral-200 p-4">
        <p className="text-sm font-medium text-neutral-900">
          {buyerName ?? "Signed-in buyer"}
        </p>
        {buyerEmail && (
          <p className="truncate text-xs text-neutral-500">{buyerEmail}</p>
        )}
      </div>
    </aside>
  );
}

export function AppTopNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeItem =
    DASHBOARD_NAV.find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? DASHBOARD_NAV[0];

  return (
    <>
      <div className="border-b border-neutral-200 bg-white md:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              Buyer app
            </p>
            <p className="truncate text-sm font-semibold text-neutral-900">
              {activeItem.label}
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
            onClick={() => setDrawerOpen(true)}
          >
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
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {DASHBOARD_NAV.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  isActive
                    ? "border-primary-400 bg-primary-50 text-primary-700"
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
                    ? "border-primary-200 bg-primary-50/60 text-primary-700"
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
