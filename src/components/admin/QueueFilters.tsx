"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  QUEUE_STATUSES,
  QUEUE_STATUS_LABELS,
  QUEUE_PRIORITIES,
  QUEUE_PRIORITY_LABELS,
  type QueueKey,
} from "@/lib/admin/queueLabels";
import {
  AGE_BUCKETS,
  AGE_BUCKET_LABELS,
  DEFAULT_FILTER_STATE,
  filterToSearchParams,
  type QueueFilterState,
} from "@/lib/admin/queueFilters";
import {
  DEFAULT_SHOWING_COORDINATION_FILTER_STATE,
  SHOWING_COORDINATION_AGE_FILTERS,
  SHOWING_COORDINATION_AGE_LABELS,
  SHOWING_COORDINATION_ASSIGNMENT_FILTERS,
  SHOWING_COORDINATION_ASSIGNMENT_LABELS,
  SHOWING_COORDINATION_STATUS_FILTERS,
  SHOWING_COORDINATION_STATUS_LABELS,
  showingCoordinationFilterToSearchParams,
  type ShowingCoordinationFilterState,
} from "@/lib/tours/coordinationFilters";

interface QueueFiltersProps {
  filter: QueueFilterState;
  /** If true, the queue picker is suppressed (queue detail pages pin to one queue). */
  hideQueueKey?: boolean;
  /** Bind each link to this queue key — used when the page already fixes one queue. */
  pinnedQueueKey?: QueueKey;
}

interface ShowingCoordinationAgentOption {
  agentId: string;
  name: string;
  brokerage?: string;
}

interface ShowingCoordinationFiltersProps {
  mode: "showingCoordination";
  filter: ShowingCoordinationFilterState;
  agents: ShowingCoordinationAgentOption[];
}

function pillHref(
  pathname: string,
  filter: QueueFilterState,
  patch: Partial<QueueFilterState>,
): string {
  const next = { ...filter, ...patch };
  const params = filterToSearchParams(next);
  const qs = new URLSearchParams(params).toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

interface PillGroupProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  active: T;
  buildHref: (value: T) => string;
}

function PillGroup<T extends string>({
  label,
  options,
  active,
  buildHref,
}: PillGroupProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <Link
            key={opt.value}
            href={buildHref(opt.value)}
            aria-pressed={active === opt.value}
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active === opt.value
                ? "border-primary-500 bg-primary-50 text-primary-700"
                : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900",
            )}
          >
            {opt.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Filter toolbar shown above the queue table. Every control is a
 * `<Link>` so filter state is shareable via URL and the page owner
 * does not need client-side state. Resetting drops all params.
 */
export function QueueFilters(
  props: QueueFiltersProps | ShowingCoordinationFiltersProps,
) {
  if ("mode" in props && props.mode === "showingCoordination") {
    return (
      <ShowingCoordinationFilters
        mode="showingCoordination"
        filter={props.filter}
        agents={props.agents}
      />
    );
  }

  return <GenericQueueFilters {...(props as QueueFiltersProps)} />;
}

function GenericQueueFilters({
  filter,
  hideQueueKey = false,
  pinnedQueueKey,
}: QueueFiltersProps) {
  const pathname = usePathname() ?? "/queues";
  const baseFilter: QueueFilterState = pinnedQueueKey
    ? { ...filter, queueKey: pinnedQueueKey }
    : filter;

  const statusOptions: { value: QueueFilterState["status"]; label: string }[] = [
    { value: "all", label: "All statuses" },
    ...QUEUE_STATUSES.map((s) => ({ value: s, label: QUEUE_STATUS_LABELS[s] })),
  ];
  const priorityOptions: { value: QueueFilterState["priority"]; label: string }[] = [
    { value: "all", label: "All priorities" },
    ...QUEUE_PRIORITIES.map((p) => ({ value: p, label: QUEUE_PRIORITY_LABELS[p] })),
  ];
  const ageOptions = AGE_BUCKETS.map((a) => ({ value: a, label: AGE_BUCKET_LABELS[a] }));

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <PillGroup
          label="Status"
          options={statusOptions}
          active={baseFilter.status}
          buildHref={(value) => pillHref(pathname, baseFilter, { status: value })}
        />
        <PillGroup
          label="Priority"
          options={priorityOptions}
          active={baseFilter.priority}
          buildHref={(value) => pillHref(pathname, baseFilter, { priority: value })}
        />
        <PillGroup
          label="Age"
          options={ageOptions}
          active={baseFilter.age}
          buildHref={(value) => pillHref(pathname, baseFilter, { age: value })}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>
          {hideQueueKey
            ? "Filters apply to this queue."
            : "Share this URL to preserve filters."}
        </span>
        <Link
          href={pathname}
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Reset filters
        </Link>
      </div>
    </div>
  );
}

function ShowingCoordinationFilters({
  filter,
  agents,
}: ShowingCoordinationFiltersProps) {
  const pathname = usePathname() ?? "/queues/tour_dispute";
  const router = useRouter();

  const pillHref = (
    patch: Partial<ShowingCoordinationFilterState>,
  ): string => {
    const next = { ...filter, ...patch };
    const params = showingCoordinationFilterToSearchParams(next);
    const qs = new URLSearchParams(params).toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <PillGroup
          label="Status"
          options={SHOWING_COORDINATION_STATUS_FILTERS.map((value) => ({
            value,
            label: SHOWING_COORDINATION_STATUS_LABELS[value],
          }))}
          active={filter.status}
          buildHref={(value) => pillHref({ status: value })}
        />
        <PillGroup
          label="Assignment"
          options={SHOWING_COORDINATION_ASSIGNMENT_FILTERS.map((value) => ({
            value,
            label: SHOWING_COORDINATION_ASSIGNMENT_LABELS[value],
          }))}
          active={filter.assignment}
          buildHref={(value) => pillHref({ assignment: value })}
        />
        <PillGroup
          label="Age"
          options={SHOWING_COORDINATION_AGE_FILTERS.map((value) => ({
            value,
            label: SHOWING_COORDINATION_AGE_LABELS[value],
          }))}
          active={filter.age}
          buildHref={(value) => pillHref({ age: value })}
        />
        <PillGroup
          label="Prerequisites"
          options={[
            { value: "all", label: "All requests" },
            { value: "needs_attention", label: "Needs attention" },
          ]}
          active={filter.hasPrerequisiteFailure ? "needs_attention" : "all"}
          buildHref={(value) =>
            pillHref({ hasPrerequisiteFailure: value === "needs_attention" })
          }
        />
      </div>
      <form
        className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const agentId = String(formData.get("agent") ?? "");
          const geographyQuery = String(formData.get("geo") ?? "");
          const params = showingCoordinationFilterToSearchParams({
            ...filter,
            agentId,
            geographyQuery,
          });
          const qs = new URLSearchParams(params).toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="coordination-geo"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
          >
            Geography
          </label>
          <input
            id="coordination-geo"
            name="geo"
            defaultValue={filter.geographyQuery}
            placeholder="City, county, state, or ZIP"
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="coordination-agent"
            className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
          >
            Assigned Agent
          </label>
          <select
            id="coordination-agent"
            name="agent"
            defaultValue={filter.agentId}
            className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          >
            <option value="">All agents</option>
            {agents.map((agent) => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.name}
                {agent.brokerage ? ` · ${agent.brokerage}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          Apply
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <span>Filter by status, age, assignment, geography, and prerequisite state.</span>
        <Link
          href={pathname}
          className="font-medium text-primary-600 hover:text-primary-700"
        >
          Reset filters
        </Link>
      </div>
    </div>
  );
}

export { DEFAULT_FILTER_STATE };
export { DEFAULT_SHOWING_COORDINATION_FILTER_STATE };
