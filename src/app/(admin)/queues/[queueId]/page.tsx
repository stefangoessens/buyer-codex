"use client";

import { use, useEffect, useMemo, useState, useTransition } from "react";
import { notFound } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { QueueFilters } from "@/components/admin/QueueFilters";
import {
  QueueItemTable,
  ShowingCoordinationTable,
  type QueueItemRowData,
  type ShowingCoordinationRowData,
} from "@/components/admin/QueueItemRow";
import { QueueActionPanel } from "@/components/admin/QueueActionPanel";
import { Button } from "@/components/ui/button";
import {
  QUEUE_KEY_DESCRIPTIONS,
  QUEUE_KEY_LABELS,
  isQueueKey,
  type QueueKey,
} from "@/lib/admin/queueLabels";
import {
  DEFAULT_FILTER_STATE,
  parseFilterFromSearchParams,
  type QueueFilterState,
} from "@/lib/admin/queueFilters";
import { pluralize } from "@/lib/admin/format";
import {
  buildShowingCoordinationQueryArgs,
  parseShowingCoordinationFilterFromSearchParams,
  showingCoordinationFilterToSearchParams,
  type ShowingCoordinationFilterState,
} from "@/lib/tours/coordinationFilters";
import type { Id } from "../../../../../convex/_generated/dataModel";

interface QueueDetailPageProps {
  params: Promise<{ queueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SHOWING_COORDINATION_QUEUE_KEY: QueueKey = "tour_dispute";
const coordinationApi = (api as any).showingCoordination;
const tourRequestsApi = (api as any).tourRequests;
const agentCoverageApi = (api as any).agentCoverage;

/**
 * Queue detail route. Shows the table of items for a single queue with
 * status/priority/age filters. URL params drive the filter so results
 * are shareable and bookmarkable. The first row with `status=open`
 * becomes the focused action target.
 */
export default function QueueDetailPage({ params, searchParams }: QueueDetailPageProps) {
  const { queueId } = use(params);
  const searchParamsValue = use(searchParams);
  if (!isQueueKey(queueId)) notFound();
  const queueKey = queueId;

  return (
    <AdminShell>
      <QueueDetailContent queueKey={queueKey} searchParams={searchParamsValue} />
    </AdminShell>
  );
}

interface QueueDetailContentProps {
  queueKey: QueueKey;
  searchParams: Record<string, string | string[] | undefined>;
}

function QueueDetailContent({ queueKey, searchParams }: QueueDetailContentProps) {
  if (queueKey === SHOWING_COORDINATION_QUEUE_KEY) {
    return <ShowingCoordinationQueueContent searchParams={searchParams} />;
  }

  return <OpsQueueDetailContent queueKey={queueKey} searchParams={searchParams} />;
}

function OpsQueueDetailContent({
  queueKey,
  searchParams,
}: QueueDetailContentProps) {
  const filter: QueueFilterState = useMemo(
    () => ({ ...parseFilterFromSearchParams(searchParams), queueKey }),
    [searchParams, queueKey],
  );

  const items = useQuery(api.opsQueues.listQueueItems, {
    queueKey,
    status: filter.status,
    priority: filter.priority,
    age: filter.age,
    limit: 200,
  }) as QueueItemRowData[] | undefined;

  const now = useMemo(() => new Date(), []);
  const focusId: Id<"opsReviewQueueItems"> | null = useMemo(() => {
    if (!items || items.length === 0) return null;
    const open = items.find((row) => row.status === "open") ?? items[0];
    return open ? (open._id as Id<"opsReviewQueueItems">) : null;
  }, [items]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Queue"
        title={QUEUE_KEY_LABELS[queueKey]}
        description={QUEUE_KEY_DESCRIPTIONS[queueKey]}
      />
      <QueueFilters filter={filter} hideQueueKey pinnedQueueKey={queueKey} />
      {items === undefined ? (
        <AdminEmptyState title="Loading queue items…" />
      ) : items.length === 0 ? (
        <AdminEmptyState
          title="No items match these filters"
          description="Try widening the filters — or pat yourself on the back, the queue is clear."
        />
      ) : (
        <>
          <div className="mb-3 text-xs text-neutral-500">
            Showing {pluralize(items.length, "item")}, sorted urgent → low, then oldest.
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <QueueItemTable rows={items} now={now} showQueueKey={false} />
            {focusId ? (
              <QueueActionPanel
                itemId={focusId}
                currentStatus={
                  items.find((r) => r._id === focusId)?.status ?? "open"
                }
              />
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

interface ShowingCoordinationBuckets {
  incoming: unknown[];
  blocked: unknown[];
  assigned: unknown[];
  confirmed: unknown[];
  stale: unknown[];
  totalActive: number;
}

interface AssignableAgentOption {
  agentId: Id<"users">;
  name: string;
  brokerage?: string;
}

function readSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const raw = params[key];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

function ShowingCoordinationQueueContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const filter: ShowingCoordinationFilterState = useMemo(
    () => parseShowingCoordinationFilterFromSearchParams(searchParams),
    [searchParams],
  );
  const queryArgs = useMemo(
    () => ({ ...buildShowingCoordinationQueryArgs(filter), limit: 200 }),
    [filter],
  );

  const workspace = useQuery(
    coordinationApi.listWorkspace,
    queryArgs,
  ) as { rows: ShowingCoordinationRowData[]; generatedAt: string } | undefined;
  const buckets = useQuery(
    coordinationApi.getQueueBuckets,
  ) as ShowingCoordinationBuckets | undefined;
  const agents = useQuery(
    coordinationApi.listAssignableAgents,
  ) as AssignableAgentOption[] | undefined;

  const now = useMemo(() => new Date(), []);
  const selectedRequestId = readSearchParam(searchParams, "request");
  const selectedRow = useMemo(() => {
    if (!workspace?.rows || workspace.rows.length === 0) return null;
    return (
      workspace.rows.find((row) => String(row.requestId) === selectedRequestId) ??
      workspace.rows[0] ??
      null
    );
  }, [selectedRequestId, workspace?.rows]);

  const buildRequestHref = (requestId: string) => {
    const params = new URLSearchParams(
      showingCoordinationFilterToSearchParams(filter),
    );
    params.set("request", requestId);
    const qs = params.toString();
    return qs ? `/queues/${SHOWING_COORDINATION_QUEUE_KEY}?${qs}` : `/queues/${SHOWING_COORDINATION_QUEUE_KEY}`;
  };

  return (
    <>
      <AdminPageHeader
        eyebrow="Queue"
        title="Showing coordination"
        description="Triage incoming tour requests, surface blockers, assign agents, and advance the shared tour-request state machine from one internal workspace."
      />
      <QueueFilters
        mode="showingCoordination"
        filter={filter}
        agents={(agents ?? []).map((agent) => ({
          agentId: String(agent.agentId),
          name: agent.name,
          brokerage: agent.brokerage,
        }))}
      />
      {workspace === undefined || buckets === undefined || agents === undefined ? (
        <AdminEmptyState title="Loading showing coordination workspace…" />
      ) : workspace.rows.length === 0 ? (
        <AdminEmptyState
          title="No tour requests match these filters"
          description="Try widening the filters or clearing geography/agent constraints."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-5">
            <SummaryCard label="Incoming" value={buckets.incoming.length} />
            <SummaryCard label="Blocked" value={buckets.blocked.length} />
            <SummaryCard label="Assigned" value={buckets.assigned.length} />
            <SummaryCard label="Confirmed" value={buckets.confirmed.length} />
            <SummaryCard label="Stale" value={buckets.stale.length} tone="warning" />
          </div>
          <div className="mb-3 text-xs text-neutral-500">
            Showing {pluralize(workspace.rows.length, "request")}, sorted stale first,
            then oldest first.
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <ShowingCoordinationTable
              rows={workspace.rows}
              now={now}
              selectedRequestId={selectedRow?.requestId ? String(selectedRow.requestId) : null}
              buildRequestHref={buildRequestHref}
            />
            <ShowingCoordinationActionPanel row={selectedRow} agents={agents} />
          </div>
        </>
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        tone === "warning"
          ? "border-warning-200 bg-warning-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">
        {value}
      </div>
    </div>
  );
}

function ShowingCoordinationActionPanel({
  row,
  agents,
}: {
  row: ShowingCoordinationRowData | null;
  agents: AssignableAgentOption[];
}) {
  const addCoordinatorNote = useMutation(coordinationApi.addCoordinatorNote);
  const markBlocked = useMutation(tourRequestsApi.markBlocked);
  const unblock = useMutation(tourRequestsApi.unblock);
  const recordManualAssignment = useMutation(agentCoverageApi.recordManualAssignment);
  const updateAssignmentStatus = useMutation(agentCoverageApi.updateAssignmentStatus);

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setSelectedAgentId(row?.agentId ? String(row.agentId) : "");
    setNotes("");
    setError(null);
  }, [row?.requestId, row?.agentId]);

  if (!row) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="text-sm font-medium text-neutral-900">No request selected</div>
        <p className="mt-1 text-sm text-neutral-500">
          Pick a request from the table to assign it, change its state, or add an
          internal note.
        </p>
      </div>
    );
  }

  const requestId = row.requestId as Id<"tourRequests">;
  const assignmentId = row.currentAssignmentId
    ? (row.currentAssignmentId as Id<"tourAssignments">)
    : null;

  const runAction = (action: "note" | "block" | "unblock" | "assign" | "confirm" | "return") => {
    setError(null);
    const trimmedNotes = notes.trim();

    startTransition(async () => {
      try {
        if (action === "note") {
          if (trimmedNotes.length === 0) {
            throw new Error("Note body required");
          }
          await addCoordinatorNote({
            tourRequestId: requestId,
            body: trimmedNotes,
            category: "triage",
          });
          setNotes("");
          return;
        }

        if (action === "block") {
          if (trimmedNotes.length === 0) {
            throw new Error("Blocking reason required");
          }
          await markBlocked({ requestId, reason: trimmedNotes });
          setNotes("");
          return;
        }

        if (action === "unblock") {
          await unblock({ requestId });
          return;
        }

        if (action === "assign") {
          if (selectedAgentId.length === 0) {
            throw new Error("Select an agent first");
          }
          await recordManualAssignment({
            requestId,
            agentId: selectedAgentId as Id<"users">,
            notes: trimmedNotes.length > 0 ? trimmedNotes : undefined,
          });
          setNotes("");
          return;
        }

        if (action === "confirm") {
          if (!assignmentId) {
            throw new Error("No active assignment to confirm");
          }
          await updateAssignmentStatus({
            assignmentId,
            newStatus: "confirmed",
            reason: trimmedNotes.length > 0 ? trimmedNotes : undefined,
          });
          setNotes("");
          return;
        }

        if (!assignmentId) {
          throw new Error("No active assignment to return to the queue");
        }
        await updateAssignmentStatus({
          assignmentId,
          newStatus: "canceled",
          reason: trimmedNotes.length > 0 ? trimmedNotes : undefined,
        });
        setNotes("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  const canAssign =
    (row.status === "submitted" || row.status === "blocked") &&
    row.currentAssignmentStatus === null;
  const canConfirm =
    row.status === "assigned" && row.currentAssignmentStatus === "pending";
  const canReturnToQueue =
    row.currentAssignmentStatus === "pending" ||
    row.currentAssignmentStatus === "confirmed";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3">
        <div className="text-sm font-medium text-neutral-900">Showing actions</div>
        <p className="mt-0.5 text-xs text-neutral-500">
          Assignment and status changes write through the shared tour-request and
          assignment state machine.
        </p>
      </div>
      <dl className="grid gap-2 text-sm text-neutral-600">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Buyer
          </dt>
          <dd className="mt-0.5 text-neutral-900">{row.buyerName}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Property
          </dt>
          <dd className="mt-0.5 text-neutral-900">{row.propertyAddress}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Current state
          </dt>
          <dd className="mt-0.5 capitalize text-neutral-900">
            {row.status.replaceAll("_", " ")}
            {row.currentAssignmentStatus
              ? ` · ${row.currentAssignmentStatus.replaceAll("_", " ")}`
              : ""}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-1.5">
        <label
          htmlFor="coordination-agent-select"
          className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
        >
          Assign Agent
        </label>
        <select
          id="coordination-agent-select"
          value={selectedAgentId}
          onChange={(event) => setSelectedAgentId(event.target.value)}
          className="h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          <option value="">Select agent</option>
          {agents.map((agent) => (
            <option key={agent.agentId} value={agent.agentId}>
              {agent.name}
              {agent.brokerage ? ` · ${agent.brokerage}` : ""}
            </option>
          ))}
        </select>
      </div>

      <label
        htmlFor="coordination-notes"
        className="mt-4 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500"
      >
        Note / reason
      </label>
      <textarea
        id="coordination-notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        maxLength={2000}
        rows={5}
        placeholder="Required for blocking. Optional for assignment and status changes."
        className="mt-1.5 w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
      />
      <div className="mt-1 text-right text-[11px] text-neutral-400">
        {notes.length} / 2000
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-error-500/40 bg-error-50 px-3 py-2 text-sm text-error-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => runAction("note")}
          disabled={isPending || notes.trim().length === 0}
        >
          Add note
        </Button>
        {row.status === "submitted" ? (
          <Button
            variant="outline"
            onClick={() => runAction("block")}
            disabled={isPending || notes.trim().length === 0}
          >
            Mark blocked
          </Button>
        ) : null}
        {row.status === "blocked" ? (
          <Button
            variant="outline"
            onClick={() => runAction("unblock")}
            disabled={isPending}
          >
            Return to submitted
          </Button>
        ) : null}
        {canAssign ? (
          <Button
            onClick={() => runAction("assign")}
            disabled={isPending || selectedAgentId.length === 0}
          >
            Assign agent
          </Button>
        ) : null}
        {canConfirm ? (
          <Button
            onClick={() => runAction("confirm")}
            disabled={isPending}
          >
            Confirm assignment
          </Button>
        ) : null}
        {canReturnToQueue ? (
          <Button
            variant="outline"
            onClick={() => runAction("return")}
            disabled={isPending}
          >
            Return to queue
          </Button>
        ) : null}
      </div>
    </div>
  );
}
