"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { SurfaceDrawer } from "@/components/product/SurfaceDrawer";
import { findActiveNavSlug, groupNavItemsBySection } from "@/lib/admin/nav";
import { convex } from "@/lib/convex";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { AccessDeniedCard } from "./AccessDeniedCard";
import { ShellLoadingState } from "./ShellLoadingState";
import { ShellUnavailableCard } from "./ShellUnavailableCard";
import type { NavItem, NavSection } from "@/lib/admin/nav";
import type { InternalConsoleRole } from "@/lib/admin/roles";

export interface AdminShellSession {
  user: {
    _id: string;
    name: string;
    email: string;
    role: InternalConsoleRole;
  };
  navItems: NavItem[];
  snapshot: {
    openReviewItems: number;
    urgentReviewItems: number;
    latestKpiComputedAt: string | null;
    pendingOverrideCount: number;
  };
}

/**
 * Wrap every admin page in this component. It resolves the current
 * internal-console session from Convex and renders three states:
 *
 *   1. loading — the Convex query is in flight
 *   2. denied — the user is logged out or not broker/admin
 *   3. authorized — sidebar + topbar + page content
 *
 * The server-side `adminShell.getCurrentSession` query enforces the role
 * boundary. This component only reflects its answer; it does not make
 * authorization decisions itself.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  // When `NEXT_PUBLIC_CONVEX_URL` is not configured the root Providers
  // tree omits ConvexProvider entirely, so `useQuery` would throw. Render
  // a friendly unavailable state so the shell still loads in a broken
  // deploy instead of a raw React error screen. The h1 is kept
  // consistent across every shell state (authorized, loading, denied,
  // unavailable) so e2e tests and assistive tech always find a page
  // title on internal routes.
  if (!convex) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6">
        <h1 className="sr-only">Broker Console</h1>
        <ShellUnavailableCard />
      </div>
    );
  }

  return <AdminShellLive>{children}</AdminShellLive>;
}

function AdminShellLive({ children }: { children: ReactNode }) {
  const session = useQuery(api.adminShell.getCurrentSession) as
    | AdminShellSession
    | null
    | undefined;
  const pathname = usePathname();

  if (session === undefined) {
    return (
      <>
        <h1 className="sr-only">Broker Console</h1>
        <ShellLoadingState />
      </>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-neutral-50 px-6">
        <h1 className="sr-only">Broker Console</h1>
        <AccessDeniedCard />
      </div>
    );
  }

  // Cast nav items — Convex returns them with literal union types
  // matching `NavItem`. We avoid `as` at the call site by tagging here.
  const navItems = session.navItems as unknown as NavItem[];

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <h1 className="sr-only">Broker Console</h1>
      <AdminSidebar
        navItems={navItems}
        pathname={pathname}
        role={session.user.role}
        openReviewItems={session.snapshot.openReviewItems}
        urgentReviewItems={session.snapshot.urgentReviewItems}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar
          user={session.user}
          snapshot={session.snapshot}
          mobileNavigation={
            <AdminMobileNavigation
              navItems={navItems}
              pathname={pathname}
              role={session.user.role}
              openReviewItems={session.snapshot.openReviewItems}
              urgentReviewItems={session.snapshot.urgentReviewItems}
            />
          }
        />
        <main
          id="admin-main"
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// Re-export nav types so pages can import them without reaching across layers.
export type { NavItem, NavSection };

function AdminMobileNavigation({
  navItems,
  pathname,
  role,
  openReviewItems,
  urgentReviewItems,
}: {
  navItems: NavItem[];
  pathname: string | null;
  role: InternalConsoleRole;
  openReviewItems: number;
  urgentReviewItems: number;
}) {
  const [open, setOpen] = useState(false);
  const sections = groupNavItemsBySection(navItems);
  const activeSlug = findActiveNavSlug(navItems, pathname);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
        onClick={() => setOpen(true)}
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

      <SurfaceDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Internal console"
        description="Review queues, metrics, notes, and overrides."
        footer={
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>Role</span>
            <span className="rounded-full bg-neutral-100 px-2 py-1 font-medium uppercase tracking-[0.16em] text-neutral-700">
              {role}
            </span>
          </div>
        }
      >
        <nav className="space-y-6" aria-label="Internal console navigation">
          {sections.map((section) => (
            <div key={section.section} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-400">
                {section.label}
              </p>
              <div className="space-y-2">
                {section.items.map((item) => {
                  const active = item.slug === activeSlug;
                  const showQueueBadge =
                    item.slug === "queues" && openReviewItems > 0;
                  return (
                    <Link
                      key={item.slug}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={
                        active
                          ? "flex items-center justify-between rounded-xl border border-primary-200 bg-primary-50/70 px-4 py-3 text-sm font-medium text-primary-700"
                          : "flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"
                      }
                    >
                      <span>{item.label}</span>
                      {showQueueBadge ? (
                        <span
                          className={
                            urgentReviewItems > 0
                              ? "rounded-full bg-error-100 px-2 py-0.5 text-xs font-medium text-error-700"
                              : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700"
                          }
                        >
                          {openReviewItems}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </SurfaceDrawer>
    </>
  );
}
