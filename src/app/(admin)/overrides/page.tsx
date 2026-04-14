"use client";

import { AdminShell, useAdminShellSession } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { OverrideForm } from "@/components/admin/OverrideForm";
import { OverrideHistoryTable } from "@/components/admin/OverrideHistoryTable";

/**
 * Manual overrides page. Shows the execute form plus the full audit
 * history. The Convex mutations are role-gated — broker-only fields
 * still appear for brokers, admin-only fields only for admins.
 */
export default function OverridesIndexPage() {
  return (
    <AdminShell>
      <OverridesContent />
    </AdminShell>
  );
}

function OverridesContent() {
  const session = useAdminShellSession();

  if (session.user.role !== "admin") {
    return (
      <>
        <AdminPageHeader
          eyebrow="Ops tools"
          title="Manual overrides"
          description="Audited manual changes with structured reason capture."
        />
        <AdminEmptyState description="Only admins can execute manual overrides." title="Not authorized" />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Ops tools"
        title="Manual overrides"
        description="Every override is recorded with a structured reason, before/after values, and the actor. Admin-only for most fields."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <OverrideForm role={session.user.role} />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-500">
            Recent overrides
          </h2>
          <OverrideHistoryTable />
        </div>
      </div>
    </>
  );
}
