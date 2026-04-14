import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Articles" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
] as const;

const footerGroups = [
  {
    title: "Explore",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/calculator", label: "Savings calculator" },
      { href: "/blog", label: "Articles" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/careers", label: "Careers" },
      { href: "/licensing", label: "Licensing" },
      { href: "/disclosures", label: "Disclosures" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/legal/brokerage-disclosures", label: "Brokerage disclosures" },
    ],
  },
] as const;

export function MarketingShellHeader() {
  return (
    <header className="sticky top-0 z-50 px-4 pt-4 lg:px-6">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 rounded-full border border-white/70 bg-white/90 px-4 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
        <Link href="/" className="flex min-w-0 flex-1 flex-col md:flex-none">
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-500">
            buyer-codex
          </span>
          <span className="hidden truncate text-sm font-semibold text-slate-900 sm:block">
            Florida buyer brokerage, re-authored
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-5 md:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/"
          className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
        >
          <span className="sm:hidden">Start</span>
          <span className="hidden sm:inline">Start analysis</span>
        </Link>
      </div>
    </header>
  );
}

export function MarketingShellFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200/80 bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-[1280px] px-6 py-14 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))]">
          <div className="max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-300">
              buyer-codex
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              AI-native buyer guidance with a licensed Florida broker at the
              table.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Public marketing, pricing, and educational routes now share a
              buyer-codex-owned shell that keeps metadata and routing stable
              while separating the product from inherited marketing lineage.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-slate-300">
              <span className="rounded-full border border-white/15 px-3 py-1.5">
                Florida licensed brokerage
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5">
                No buyer upfront fee
              </span>
              <span className="rounded-full border border-white/15 px-3 py-1.5">
                SEO-safe public routes
              </span>
            </div>
          </div>

          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-300 transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} buyer-codex. All rights reserved.</p>
          <p>Routing, metadata, and analytics remain preserved across public surfaces.</p>
        </div>
      </div>
    </footer>
  );
}

export function MarketingSection({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("px-6 py-16 lg:px-8 lg:py-20", className)}
      {...props}
    >
      <div className="mx-auto max-w-[1280px]">{children}</div>
    </section>
  );
}

export function MarketingSectionIntro({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  tone?: "default" | "light";
}) {
  return (
    <div
      className={cn(
        "max-w-3xl",
        align === "center" && "mx-auto text-center",
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.24em]",
            tone === "light" ? "text-primary-300" : "text-primary-600",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "mt-4 text-3xl font-semibold tracking-[-0.04em] lg:text-5xl",
          tone === "light" ? "text-white" : "text-slate-950",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-7 lg:text-lg",
            tone === "light" ? "text-slate-300" : "text-slate-600",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingCtaBand({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <MarketingSection className="pt-4">
      <div className="overflow-hidden rounded-[40px] border border-slate-200 bg-slate-950 px-6 py-10 text-white shadow-[0_30px_100px_rgba(15,23,42,0.18)] lg:px-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300">
              {eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white lg:text-5xl">
              {title}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300 lg:text-lg">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-primary-100"
            >
              {primaryLabel}
            </Link>
            {secondaryHref && secondaryLabel ? (
              <Link
                href={secondaryHref}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/5"
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </MarketingSection>
  );
}
