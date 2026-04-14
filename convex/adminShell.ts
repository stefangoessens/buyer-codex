/**
 * convex/adminShell.ts — KIN-797 Internal Console Shell backend.
 *
 * Single entry point the Next.js admin layout queries on every mount.
 * Returns the current user, their role-filtered nav, and a compact
 * at-a-glance snapshot of queue/metrics health. Non-internal users
 * (buyers, logged-out visitors) get a `null` session so the client
 * shows the access-denied surface instead of leaking data.
 */

import { query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./lib/session";
import {
  filterNavItemsForRole,
  NAV_SECTION_ORDER,
  STATIC_NAV_ITEMS,
  type NavSection,
} from "../src/lib/admin/nav";
import { canAccessInternalConsole } from "../src/lib/admin/roles";

type InternalRole = "broker" | "admin";
type SessionNavItem = {
  slug: string;
  label: string;
  href: string;
  section: NavSection;
  allowedRoles: InternalRole[];
  description?: string;
};

const navItemValidator = v.object({
  slug: v.string(),
  label: v.string(),
  href: v.string(),
  section: v.union(
    v.literal("overview"),
    v.literal("queues"),
    v.literal("metrics"),
    v.literal("tools"),
    v.literal("settings"),
  ),
  allowedRoles: v.array(v.union(v.literal("broker"), v.literal("admin"))),
  description: v.optional(v.string()),
});

const sessionUserValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
  role: v.union(v.literal("broker"), v.literal("admin")),
});

const snapshotValidator = v.object({
  openReviewItems: v.number(),
  urgentReviewItems: v.number(),
  latestKpiComputedAt: v.union(v.string(), v.null()),
  pendingOverrideCount: v.number(),
});

const sessionValidator = v.object({
  user: sessionUserValidator,
  navItems: v.array(navItemValidator),
  snapshot: snapshotValidator,
});

/**
 * Primary admin shell query. Returns:
 *   - `null` for any caller who cannot access the console (unauthenticated,
 *     buyer role, unknown user). The client treats `null` as access denied.
 *   - The current user (name/email/role), their role-filtered nav items
 *     (static + custom dynamic entries from `adminNavItems`), and a compact
 *     snapshot for the topbar and overview page.
 *
 * All data is computed server-side. The UI never recomputes role gating.
 */
export const getCurrentSession = query({
  args: {},
  returns: v.union(sessionValidator, v.null()),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    if (!canAccessInternalConsole(user.role)) return null;
    const role: InternalRole = user.role;

    const staticFiltered = filterNavItemsForRole(STATIC_NAV_ITEMS, role).map(
      (item): SessionNavItem => ({
        ...item,
        allowedRoles: [...item.allowedRoles],
      }),
    );

    // Merge dynamic nav items persisted in `adminNavItems` (empty by default).
    // We keep the static catalog canonical, then append dynamic items within
    // their declared section order so the shell contract remains predictable.
    const dynamic = await ctx.db.query("adminNavItems").collect();
    const dynamicFiltered = dynamic
      .filter((row) => !row.hidden)
      .filter((row) => row.allowedRoles.includes(role))
      .sort((a, b) => {
        const sectionDelta =
          NAV_SECTION_ORDER.indexOf(a.section as NavSection) -
          NAV_SECTION_ORDER.indexOf(b.section as NavSection);
        if (sectionDelta !== 0) return sectionDelta;
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      })
      .map(
        (row): SessionNavItem => ({
          slug: row.slug,
          label: row.label,
          href: row.href,
          section: row.section,
          allowedRoles: row.allowedRoles,
        }),
      );

    const staticSlugs = new Set(staticFiltered.map((item) => item.slug));
    const dynamicBySection = new Map<NavSection, SessionNavItem[]>();
    for (const item of dynamicFiltered) {
      if (staticSlugs.has(item.slug)) continue;
      const bucket = dynamicBySection.get(item.section) ?? [];
      bucket.push(item);
      dynamicBySection.set(item.section, bucket);
    }
    const navItems = NAV_SECTION_ORDER.flatMap((section) => [
      ...staticFiltered.filter((item) => item.section === section),
      ...(dynamicBySection.get(section) ?? []),
    ]);

    // Snapshot — cheap aggregates that power the topbar badge + overview
    // hero. Each lookup is O(index hit) and bounded.
    const openReviewItems = await ctx.db
      .query("opsReviewQueueItems")
      .withIndex("by_status_and_priority", (q) => q.eq("status", "open"))
      .collect();
    const urgent = openReviewItems.filter((row) => row.priority === "urgent");

    // Pick the globally-newest snapshot across every metric key via the
    // dedicated `by_computedAt` index. Using `by_metric_and_bucketStart`
    // here would order by metricKey first and return a stale timestamp
    // from the lexicographically-highest key.
    const latestKpi = await ctx.db
      .query("kpiSnapshots")
      .withIndex("by_computedAt")
      .order("desc")
      .take(1);

    // Overrides that have not yet been reversed count as "pending" for the
    // overview — ops uses this to check that every change has a matched
    // review entry in the audit log. We count the full unreversed set
    // rather than a capped window so older pending overrides never get
    // dropped and give operators a false "all clear" signal. The table
    // is small (manual overrides are rare) so a collect() is fine here;
    // KIN-799 will replace this with an indexed status field.
    const allOverrides = await ctx.db
      .query("manualOverrideRecords")
      .collect();
    const pendingOverrideCount = allOverrides.filter(
      (row) => !row.reversedAt,
    ).length;

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role,
      },
      navItems,
      snapshot: {
        openReviewItems: openReviewItems.length,
        urgentReviewItems: urgent.length,
        latestKpiComputedAt: latestKpi[0]?.computedAt ?? null,
        pendingOverrideCount,
      },
    };
  },
});

/**
 * Lightweight existence check. The Next.js layout can call this from a
 * server component in the future if we add an RSC path — it avoids
 * shipping user PII to the client just to answer "are you allowed in?".
 */
export const canAccessConsole = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return false;
    return user.role === "broker" || user.role === "admin";
  },
});
