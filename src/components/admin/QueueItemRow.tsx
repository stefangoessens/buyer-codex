import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  QUEUE_KEY_LABELS,
  QUEUE_PRIORITY_LABELS,
  QUEUE_PRIORITY_TONE,
  QUEUE_STATUS_LABELS,
  QUEUE_STATUS_TONE,
  type QueueKey,
  type QueuePriority,
  type QueueStatus,
} from "@/lib/admin/queueLabels";
import { shortAge } from "@/lib/admin/queueFilters";
import {
  formatPrerequisiteFailureLabel,
  type PrerequisiteFailure,
} from "@/lib/tours/coordinationFilters";

export interface QueueItemRowData {
  _id: string;
  queueKey: QueueKey;
  subjectType: string;
  subjectId: string;
  priority: QueuePriority;
  status: QueueStatus;
  summary: string;
  openedAt: string;
}

interface QueueItemRowProps {
  row: QueueItemRowData;
  now: Date;
  showQueueKey?: boolean;
}

/**
 * Single queue item row — used in both the queue index table and the
 * per-queue detail table. `showQueueKey` controls whether the queue
 * label is rendered (hidden on per-queue pages).
 */
export function QueueItemRow({ row, now, showQueueKey = true }: QueueItemRowProps) {
  return (
    <tr className="border-t border-neutral-100 last:border-b-0 hover:bg-neutral-50">
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            QUEUE_PRIORITY_TONE[row.priority],
          )}
        >
          {QUEUE_PRIORITY_LABELS[row.priority]}
        </span>
      </td>
      {showQueueKey ? (
        <td className="px-4 py-3 text-xs text-neutral-500">
          {QUEUE_KEY_LABELS[row.queueKey]}
        </td>
      ) : null}
      <td className="px-4 py-3 text-sm">
        <Link
          href={`/queues/${row.queueKey}#${row._id}`}
          className="font-medium text-neutral-900 hover:text-primary-700"
        >
          {row.summary}
        </Link>
        <div className="mt-0.5 text-xs text-neutral-500">
          {row.subjectType} · {row.subjectId.slice(0, 12)}
          {row.subjectId.length > 12 ? "…" : ""}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            QUEUE_STATUS_TONE[row.status],
          )}
        >
          {QUEUE_STATUS_LABELS[row.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-xs text-neutral-500 tabular-nums">
        {shortAge(row.openedAt, now)}
      </td>
    </tr>
  );
}

interface QueueItemTableProps {
  rows: QueueItemRowData[];
  now: Date;
  showQueueKey?: boolean;
}

export function QueueItemTable({ rows, now, showQueueKey = true }: QueueItemTableProps) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-3 w-28">Priority</th>
            {showQueueKey ? <th className="px-4 py-3 w-40">Queue</th> : null}
            <th className="px-4 py-3">Subject</th>
            <th className="px-4 py-3 w-28">Status</th>
            <th className="px-4 py-3 w-16 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <QueueItemRow
              key={row._id}
              row={row}
              now={now}
              showQueueKey={showQueueKey}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface ShowingCoordinationRowData {
  requestId: string;
  agentId: string | null;
  currentAssignmentId: string | null;
  propertyAddress: string;
  buyerName: string;
  assignedAgentName: string | null;
  status: "submitted" | "blocked" | "assigned" | "confirmed";
  blockingReason: string | null;
  currentAssignmentStatus: string | null;
  assignmentRoutingPath: string | null;
  createdAt: string;
  submittedAt: string | null;
  assignedAt: string | null;
  isStale: boolean;
  prerequisiteFailures: PrerequisiteFailure[];
  latestCoordinatorNote:
    | {
        body: string;
        category: string;
        createdAt: string;
        authorName: string;
      }
    | null;
  geography:
    | {
        city: string;
        county: string | null;
        state: string;
        zip: string;
      }
    | null;
}

interface ShowingCoordinationTableProps {
  rows: ShowingCoordinationRowData[];
  now: Date;
  selectedRequestId?: string | null;
  buildRequestHref: (requestId: string) => string;
}

function coordinationStatusTone(
  row: ShowingCoordinationRowData,
): string {
  if (row.status === "blocked") return "bg-error-100 text-error-700";
  if (row.isStale) return "bg-warning-100 text-warning-700";
  if (row.status === "confirmed") return "bg-success-100 text-success-700";
  if (row.status === "assigned") return "bg-primary-50 text-primary-700";
  return "bg-neutral-100 text-neutral-700";
}

function assignmentSummary(row: ShowingCoordinationRowData): string {
  if (row.assignedAgentName) {
    return row.currentAssignmentStatus
      ? `${row.assignedAgentName} · ${row.currentAssignmentStatus.replaceAll("_", " ")}`
      : row.assignedAgentName;
  }
  if (row.assignmentRoutingPath === "manual") return "Manual broker queue";
  return "Unassigned";
}

function coordinationAnchor(row: ShowingCoordinationRowData): string {
  return row.assignedAt ?? row.submittedAt ?? row.createdAt;
}

export function ShowingCoordinationTable({
  rows,
  now,
  selectedRequestId,
  buildRequestHref,
}: ShowingCoordinationTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <table className="w-full">
        <thead className="border-b border-neutral-200 bg-neutral-50">
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            <th className="px-4 py-3">Property</th>
            <th className="px-4 py-3 w-48">Buyer</th>
            <th className="px-4 py-3 w-44">Status</th>
            <th className="px-4 py-3 w-56">Prerequisites</th>
            <th className="px-4 py-3 w-48">Assignment</th>
            <th className="px-4 py-3 w-48">Latest note</th>
            <th className="px-4 py-3 w-16 text-right">Age</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedRequestId === row.requestId;
            return (
              <tr
                key={row.requestId}
                className={cn(
                  "border-t border-neutral-100 align-top hover:bg-neutral-50",
                  selected && "bg-primary-50/50",
                )}
              >
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={buildRequestHref(row.requestId)}
                    className="font-medium text-neutral-900 hover:text-primary-700"
                  >
                    {row.propertyAddress}
                  </Link>
                  <div className="mt-0.5 text-xs text-neutral-500">
                    {row.geography
                      ? `${row.geography.city}, ${row.geography.state} ${row.geography.zip}`
                      : "Unknown geography"}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-700">
                  <div className="font-medium text-neutral-900">{row.buyerName}</div>
                  {row.blockingReason ? (
                    <div className="mt-0.5 text-xs text-error-700">
                      Blocker: {row.blockingReason}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      coordinationStatusTone(row),
                    )}
                  >
                    {row.status.replaceAll("_", " ")}
                  </span>
                  {row.isStale ? (
                    <div className="mt-1 text-xs font-medium text-warning-700">
                      Stale
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {row.prerequisiteFailures.length === 0 ? (
                    <span className="text-xs text-neutral-500">Clear</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {row.prerequisiteFailures.map((failure) => (
                        <span
                          key={failure}
                          className="inline-flex items-center rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-medium text-warning-700"
                        >
                          {formatPrerequisiteFailureLabel(failure)}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-neutral-700">
                  {assignmentSummary(row)}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">
                  {row.latestCoordinatorNote ? (
                    <>
                      <div className="font-medium text-neutral-700">
                        {row.latestCoordinatorNote.authorName}
                      </div>
                      <div className="mt-0.5 line-clamp-2">
                        {row.latestCoordinatorNote.body}
                      </div>
                    </>
                  ) : (
                    "No notes yet"
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-neutral-500 tabular-nums">
                  {shortAge(coordinationAnchor(row), now)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
