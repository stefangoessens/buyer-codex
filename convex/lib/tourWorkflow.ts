import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  attemptTourAssignmentTransition,
  isActiveTourAssignment,
  type TourAssignmentState,
} from "../../src/lib/tours/assignmentStatus";
import {
  attemptTransition,
  validateTourRequestInput,
  type TourRequestInput,
  type TourRequestState,
} from "../../src/lib/tours/requestValidation";

type ReplaceableDoc = { _id: string; _creationTime: number };

type WorkflowCtx = {
  db: {
    get: (...args: any[]) => Promise<unknown>;
    insert: (...args: any[]) => Promise<unknown>;
    patch: (...args: any[]) => Promise<void>;
    query: (...args: any[]) => any;
    replace: (...args: any[]) => Promise<void>;
  };
};

export type AgreementSnapshot = {
  type: "none" | "tour_pass" | "full_representation";
  status: "none" | "draft" | "sent" | "signed" | "replaced" | "canceled";
  signedAt?: string;
};

export function serializeDetails(details: Record<string, unknown>): string {
  return JSON.stringify(details);
}

function stripSystemFields<T extends ReplaceableDoc>(
  doc: T,
): Omit<T, "_id" | "_creationTime"> {
  const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...rest } = doc;
  return rest;
}

function applyOptionalPatch<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T>,
): T {
  const next: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  return next as T;
}

export async function replaceDoc<T extends ReplaceableDoc>(
  ctx: WorkflowCtx,
  doc: T,
  patch: Partial<Omit<T, "_id" | "_creationTime">>,
): Promise<void> {
  const base = stripSystemFields(doc);
  const next = applyOptionalPatch(base, patch);
  await ctx.db.replace(doc._id, next);
}

export function assertTourRequestTransition(
  from: TourRequestState,
  to: TourRequestState,
): TourRequestState {
  const result = attemptTransition(from, to);
  if (!result.ok) {
    throw new Error(`ILLEGAL_TRANSITION: ${result.message}`);
  }
  return result.next;
}

export function assertTourAssignmentTransition(
  from: TourAssignmentState,
  to: TourAssignmentState,
): TourAssignmentState {
  const result = attemptTourAssignmentTransition(from, to);
  if (!result.ok) {
    throw new Error(`ILLEGAL_TRANSITION: ${result.message}`);
  }
  return result.next;
}

export function validateTourRequestDraftInputOrThrow(
  input: TourRequestInput,
  now: string,
) {
  const result = validateTourRequestInput(input, now);
  if (!result.ok) {
    throw new Error(`${result.code.toUpperCase()}: ${result.message}`);
  }
  return result.sanitized;
}

export async function loadCurrentAgreementSnapshot(
  ctx: MutationCtx | WorkflowCtx,
  buyerId: Id<"users">,
): Promise<AgreementSnapshot> {
  const agreements = (await ctx.db
    .query("agreements")
    .withIndex("by_buyerId", (q: any) => q.eq("buyerId", buyerId))
    .collect()) as Array<Doc<"agreements">>;

  const signedFullRep = agreements
    .filter((agreement) => {
      return (
        agreement.type === "full_representation" &&
        agreement.status === "signed"
      );
    })
    .sort((left, right) =>
      (right.signedAt ?? "").localeCompare(left.signedAt ?? ""),
    )
    .at(0);
  if (signedFullRep) {
    return {
      type: "full_representation",
      status: "signed",
      signedAt: signedFullRep.signedAt,
    };
  }

  const signedTourPass = agreements
    .filter((agreement) => {
      return agreement.type === "tour_pass" && agreement.status === "signed";
    })
    .sort((left, right) =>
      (right.signedAt ?? "").localeCompare(left.signedAt ?? ""),
    )
    .at(0);
  if (signedTourPass) {
    return {
      type: "tour_pass",
      status: "signed",
      signedAt: signedTourPass.signedAt,
    };
  }

  return { type: "none", status: "none" };
}

export async function getActiveAssignmentsForRequest(
  ctx: WorkflowCtx,
  requestId: Id<"tourRequests">,
): Promise<Array<Doc<"tourAssignments">>> {
  const assignments = (await ctx.db
    .query("tourAssignments")
    .withIndex("by_tourRequestId", (q: any) => q.eq("tourRequestId", requestId))
    .collect()) as Array<Doc<"tourAssignments">>;

  return assignments.filter((assignment) =>
    isActiveTourAssignment(assignment.status as TourAssignmentState),
  );
}

export async function ensureCanonicalTourForRequest(
  ctx: WorkflowCtx,
  request: Doc<"tourRequests">,
  params: {
    routingPath: "network" | "showami" | "manual";
    agentId?: Id<"users">;
    showamiFallbackId?: string;
  },
): Promise<Id<"tours">> {
  const existingTour = request.linkedTourId
    ? ((await ctx.db.get(request.linkedTourId)) as Doc<"tours"> | null)
    : null;

  if (existingTour) {
    await replaceDoc(ctx, existingTour, {
      tourRequestId: request._id,
      assignmentRoutingPath: params.routingPath,
      ...(params.agentId !== undefined ? { agentId: params.agentId } : {}),
      ...(params.showamiFallbackId !== undefined
        ? { showamiFallbackId: params.showamiFallbackId }
        : {}),
    });
    return existingTour._id;
  }

  const tourId = (await ctx.db.insert("tours", {
    dealRoomId: request.dealRoomId,
    propertyId: request.propertyId,
    buyerId: request.buyerId,
    tourRequestId: request._id,
    status: "requested",
    ...(params.agentId !== undefined ? { agentId: params.agentId } : {}),
    assignmentRoutingPath: params.routingPath,
    ...(params.showamiFallbackId !== undefined
      ? { showamiFallbackId: params.showamiFallbackId }
      : {}),
    ...(request.buyerNotes !== undefined ? { notes: request.buyerNotes } : {}),
  })) as Id<"tours">;

  await ctx.db.patch(request._id, {
    linkedTourId: tourId,
  });

  return tourId;
}

export async function createAssignmentRecord(
  ctx: WorkflowCtx,
  actorId: Id<"users">,
  request: Doc<"tourRequests">,
  params: {
    routingPath: "network" | "showami" | "manual";
    agentId?: Id<"users">;
    notes?: string;
    showamiFallbackId?: string;
    routingReason: string;
    cooperatingBrokerage?: string;
  },
): Promise<Id<"tourAssignments">> {
  const tourId = await ensureCanonicalTourForRequest(ctx, request, {
    routingPath: params.routingPath,
    agentId: params.agentId,
    showamiFallbackId: params.showamiFallbackId,
  });

  const activeAssignments = await getActiveAssignmentsForRequest(ctx, request._id);
  if (activeAssignments.length > 0) {
    throw new Error(
      "Tour request already has an active assignment. Cancel it before routing again.",
    );
  }

  const now = new Date().toISOString();
  const assignmentId = (await ctx.db.insert("tourAssignments", {
    tourId,
    tourRequestId: request._id,
    routingPath: params.routingPath,
    status: "pending",
    assignedAt: now,
    routingReason: params.routingReason,
    ...(params.agentId !== undefined ? { agentId: params.agentId } : {}),
    ...(params.notes !== undefined ? { notes: params.notes } : {}),
    ...(params.showamiFallbackId !== undefined
      ? { showamiFallbackId: params.showamiFallbackId }
      : {}),
    ...(params.cooperatingBrokerage !== undefined
      ? { cooperatingBrokerage: params.cooperatingBrokerage }
      : {}),
  })) as Id<"tourAssignments">;

  await replaceDoc(ctx, request, {
    status:
      params.routingPath === "manual" && params.agentId === undefined
        ? "blocked"
        : "assigned",
    ...(params.routingPath === "manual" && params.agentId === undefined
      ? {
          blockingReason: "manual_broker_queue",
        }
      : {
          agentId: params.agentId,
          assignedAt: now,
          blockingReason: undefined,
          failureReason: undefined,
        }),
    updatedAt: now,
    currentAssignmentId: assignmentId,
    assignmentRoutingPath: params.routingPath,
    showamiFallbackId: params.showamiFallbackId,
  });

  const tour = (await ctx.db.get(tourId)) as Doc<"tours"> | null;
  if (tour) {
    await replaceDoc(ctx, tour, {
      tourRequestId: request._id,
      assignmentRoutingPath: params.routingPath,
      agentId: params.agentId,
      showamiFallbackId: params.showamiFallbackId,
      showamiStatus:
        params.routingPath === "showami" ? "requested" : undefined,
    });
  }

  await ctx.db.insert("auditLog", {
    userId: actorId,
    action: "tour_assignment_recorded",
    entityType: "tourAssignments",
    entityId: assignmentId,
    details: serializeDetails({
      requestId: request._id,
      tourId,
      routingPath: params.routingPath,
      agentId: params.agentId,
      showamiFallbackId: params.showamiFallbackId,
      routingReason: params.routingReason,
    }),
    timestamp: now,
  });

  return assignmentId;
}

export async function syncCanonicalStateFromAssignment(
  ctx: WorkflowCtx,
  assignment: Doc<"tourAssignments">,
  nextStatus: TourAssignmentState,
  now: string,
  opts?: {
    completedAt?: string;
    scheduledAt?: string;
    showamiStatus?: string;
    agentId?: Id<"users">;
    blockingReason?: string;
  },
): Promise<void> {
  const request = assignment.tourRequestId
    ? ((await ctx.db.get(assignment.tourRequestId)) as Doc<"tourRequests"> | null)
    : null;
  const tour = (await ctx.db.get(assignment.tourId)) as Doc<"tours"> | null;

  if (request) {
    if (nextStatus === "confirmed") {
      await replaceDoc(ctx, request, {
        status: "confirmed",
        confirmedAt: now,
        updatedAt: now,
        blockingReason: undefined,
        failureReason: undefined,
        agentId: opts?.agentId ?? assignment.agentId,
        currentAssignmentId: assignment._id,
      });
    } else if (nextStatus === "completed") {
      await replaceDoc(ctx, request, {
        status: "completed",
        completedAt: opts?.completedAt ?? now,
        confirmedAt: request.confirmedAt ?? now,
        updatedAt: now,
        agentId: opts?.agentId ?? assignment.agentId,
        currentAssignmentId: assignment._id,
      });
    } else if (nextStatus === "canceled") {
      await replaceDoc(ctx, request, {
        status: opts?.blockingReason ? "blocked" : "submitted",
        updatedAt: now,
        blockingReason: opts?.blockingReason,
        currentAssignmentId: undefined,
        agentId: undefined,
      });
    }
  }

  if (!tour) {
    return;
  }

  if (nextStatus === "confirmed") {
    await replaceDoc(ctx, tour, {
      status: "confirmed",
      assignmentRoutingPath: assignment.routingPath,
      agentId: opts?.agentId ?? assignment.agentId,
      scheduledAt: opts?.scheduledAt ?? tour.scheduledAt,
      showamiFallbackId: assignment.showamiFallbackId,
      showamiStatus: opts?.showamiStatus,
    });
    return;
  }

  if (nextStatus === "completed") {
    await replaceDoc(ctx, tour, {
      status: "completed",
      assignmentRoutingPath: assignment.routingPath,
      agentId: opts?.agentId ?? assignment.agentId,
      completedAt: opts?.completedAt ?? now,
      showamiFallbackId: assignment.showamiFallbackId,
      showamiStatus: opts?.showamiStatus,
    });
    return;
  }

  if (nextStatus === "canceled") {
    await replaceDoc(ctx, tour, {
      status: "requested",
      agentId: undefined,
      assignmentRoutingPath: assignment.routingPath,
      showamiFallbackId: assignment.showamiFallbackId,
      showamiStatus: opts?.showamiStatus,
    });
  }
}
