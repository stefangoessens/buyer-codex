import { type ReactNode } from "react";
import { SurfaceState } from "@/components/product/SurfaceState";

interface AdminEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Standard empty state for internal console placeholders. KIN-797 leaves
 * the content cards empty; follow-up cards (798/800/799/807/808) swap
 * this for real tables and charts as they land.
 */
export function AdminEmptyState({
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <SurfaceState
      title={title}
      description={description}
      action={action}
      className="bg-white"
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M9 14h6" />
        </svg>
      }
    />
  );
}
