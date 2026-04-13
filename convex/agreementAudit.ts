import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import {
  agreementAccessOutcome,
  agreementAccessScope,
  agreementAuditEventType,
  agreementAuditVisibility,
  agreementDocumentSource,
  agreementStatus,
  supersessionReason,
  userRole,
} from "./lib/validators";

const documentMetadataValidator = v.object({
  storageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
  checksumSha256: v.optional(v.string()),
  source: v.optional(agreementDocumentSource),
  uploadedAt: v.optional(v.string()),
  uploadedByUserId: v.optional(v.id("users")),
});

const agreementAuditEventReadModelValidator = v.object({
  eventId: v.id("agreementAuditEvents"),
  agreementId: v.id("agreements"),
  dealRoomId: v.id("dealRooms"),
  buyerId: v.id("users"),
  eventType: agreementAuditEventType,
  visibility: agreementAuditVisibility,
  occurredAt: v.string(),
  actorUserId: v.optional(v.id("users")),
  actorRole: v.optional(userRole),
  previousStatus: v.optional(agreementStatus),
  nextStatus: v.optional(agreementStatus),
  successorAgreementId: v.optional(v.id("agreements")),
  reason: v.optional(v.string()),
  supersessionReason: v.optional(supersessionReason),
  accessScope: v.optional(agreementAccessScope),
  accessOutcome: v.optional(agreementAccessOutcome),
  effectiveStartAt: v.optional(v.string()),
  effectiveEndAt: v.optional(v.string()),
  document: v.optional(documentMetadataValidator),
});

function auditActionForEventType(
  eventType:
    | "created"
    | "sent_for_signing"
    | "signed"
    | "canceled"
    | "replaced"
    | "document_accessed",
): string {
  switch (eventType) {
    case "created":
      return "agreement_created";
    case "sent_for_signing":
      return "agreement_sent";
    case "signed":
      return "agreement_signed";
    case "canceled":
      return "agreement_canceled";
    case "replaced":
      return "agreement_replaced";
    case "document_accessed":
      return "agreement_document_accessed";
  }
}

function projectEvent(
  event: Record<string, any>,
  role: "buyer" | "broker" | "admin",
) {
  const document =
    event.documentStorageId ||
    event.documentFileName ||
    event.documentContentType ||
    event.documentSizeBytes
      ? {
          ...(role === "buyer" ? {} : { storageId: event.documentStorageId }),
          fileName: event.documentFileName,
          contentType: event.documentContentType,
          sizeBytes: event.documentSizeBytes,
        }
      : undefined;

  if (role === "buyer") {
    return {
      eventId: event._id,
      agreementId: event.agreementId,
      dealRoomId: event.dealRoomId,
      buyerId: event.buyerId,
      eventType: event.eventType,
      visibility: event.visibility,
      occurredAt: event.occurredAt,
      previousStatus: event.previousStatus,
      nextStatus: event.nextStatus,
      successorAgreementId: event.successorAgreementId,
      reason: event.reason,
      supersessionReason: event.supersessionReason,
      effectiveStartAt: event.effectiveStartAt,
      effectiveEndAt: event.effectiveEndAt,
      document,
    };
  }

  return {
    eventId: event._id,
    agreementId: event.agreementId,
    dealRoomId: event.dealRoomId,
    buyerId: event.buyerId,
    eventType: event.eventType,
    visibility: event.visibility,
    occurredAt: event.occurredAt,
    actorUserId: event.actorUserId,
    actorRole: event.actorRole,
    previousStatus: event.previousStatus,
    nextStatus: event.nextStatus,
    successorAgreementId: event.successorAgreementId,
    reason: event.reason,
    supersessionReason: event.supersessionReason,
    accessScope: event.accessScope,
    accessOutcome: event.accessOutcome,
    effectiveStartAt: event.effectiveStartAt,
    effectiveEndAt: event.effectiveEndAt,
    document,
  };
}

export const recordEventInternal = internalMutation({
  args: {
    agreementId: v.id("agreements"),
    dealRoomId: v.id("dealRooms"),
    buyerId: v.id("users"),
    eventType: agreementAuditEventType,
    visibility: agreementAuditVisibility,
    actorUserId: v.optional(v.id("users")),
    actorRole: v.optional(userRole),
    previousStatus: v.optional(agreementStatus),
    nextStatus: v.optional(agreementStatus),
    successorAgreementId: v.optional(v.id("agreements")),
    documentStorageId: v.optional(v.id("_storage")),
    documentFileName: v.optional(v.string()),
    documentContentType: v.optional(v.string()),
    documentSizeBytes: v.optional(v.number()),
    reason: v.optional(v.string()),
    supersessionReason: v.optional(supersessionReason),
    accessScope: v.optional(agreementAccessScope),
    accessOutcome: v.optional(agreementAccessOutcome),
    effectiveStartAt: v.optional(v.string()),
    effectiveEndAt: v.optional(v.string()),
    occurredAt: v.string(),
  },
  returns: v.id("agreementAuditEvents"),
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("agreementAuditEvents", args);

    await ctx.db.insert("auditLog", {
      userId: args.actorUserId,
      action: auditActionForEventType(args.eventType),
      entityType: "agreements",
      entityId: args.agreementId,
      details: JSON.stringify({
        eventId,
        visibility: args.visibility,
        previousStatus: args.previousStatus,
        nextStatus: args.nextStatus,
        successorAgreementId: args.successorAgreementId,
        reason: args.reason,
        supersessionReason: args.supersessionReason,
        accessScope: args.accessScope,
        accessOutcome: args.accessOutcome,
        effectiveStartAt: args.effectiveStartAt,
        effectiveEndAt: args.effectiveEndAt,
        documentStorageId: args.documentStorageId,
        documentFileName: args.documentFileName,
        documentContentType: args.documentContentType,
        documentSizeBytes: args.documentSizeBytes,
      }),
      timestamp: args.occurredAt,
    });

    return eventId;
  },
});

export const listByAgreement = query({
  args: {
    agreementId: v.id("agreements"),
    limit: v.optional(v.number()),
  },
  returns: v.array(agreementAuditEventReadModelValidator),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) return [];

    const isBuyer = agreement.buyerId === user._id;
    const isInternal = user.role === "broker" || user.role === "admin";
    if (!isBuyer && !isInternal) return [];

    const events = await ctx.db
      .query("agreementAuditEvents")
      .withIndex("by_agreementId_and_occurredAt", (q) =>
        q.eq("agreementId", args.agreementId),
      )
      .collect();

    const filtered = (isBuyer
      ? events.filter((event) => event.visibility === "buyer")
      : events
    )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, args.limit ?? 100);

    return filtered.map((event) =>
      projectEvent(event, isBuyer ? "buyer" : user.role),
    );
  },
});
