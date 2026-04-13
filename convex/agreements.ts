import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAuth } from "./lib/session";
import {
  agreementDocumentSource,
  agreementStatus,
  agreementType,
  supersessionReason,
  userRole,
} from "./lib/validators";
import {
  applySupersessionState,
  resolveCurrentGoverningFromRows,
} from "./agreementSupersession";
import { trackPosthogEvent } from "./lib/analytics";

const agreementDocumentArgs = {
  documentStorageId: v.optional(v.id("_storage")),
  documentFileName: v.optional(v.string()),
  documentContentType: v.optional(v.string()),
  documentSizeBytes: v.optional(v.number()),
  documentChecksumSha256: v.optional(v.string()),
  documentSource: v.optional(agreementDocumentSource),
};

const agreementDocumentMetadataValidator = v.object({
  storageId: v.optional(v.id("_storage")),
  fileName: v.optional(v.string()),
  contentType: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
  checksumSha256: v.optional(v.string()),
  source: v.optional(agreementDocumentSource),
  uploadedAt: v.optional(v.string()),
  uploadedByUserId: v.optional(v.id("users")),
});

const agreementReadModelValidator = v.object({
  agreementId: v.id("agreements"),
  dealRoomId: v.id("dealRooms"),
  buyerId: v.id("users"),
  type: agreementType,
  status: agreementStatus,
  createdAt: v.string(),
  updatedAt: v.string(),
  sentAt: v.optional(v.string()),
  signedAt: v.optional(v.string()),
  canceledAt: v.optional(v.string()),
  supersededAt: v.optional(v.string()),
  effectiveStartAt: v.optional(v.string()),
  effectiveEndAt: v.optional(v.string()),
  supersessionReason: v.optional(supersessionReason),
  replacedById: v.optional(v.id("agreements")),
  document: v.optional(agreementDocumentMetadataValidator),
  canAccessDocument: v.boolean(),
  isCurrentGoverning: v.boolean(),
});

const authorizedDocumentAccessValidator = v.object({
  agreementId: v.id("agreements"),
  dealRoomId: v.id("dealRooms"),
  fileId: v.id("_storage"),
});

type ViewerRole = "buyer" | "broker" | "admin";
type AgreementDocumentArgs = {
  documentStorageId?: string;
  documentFileName?: string;
  documentContentType?: string;
  documentSizeBytes?: number;
  documentChecksumSha256?: string;
  documentSource?: "manual_upload" | "signature_provider" | "internal_generated";
};

function hasIncomingDocumentMetadata(args: AgreementDocumentArgs): boolean {
  return Boolean(
    args.documentStorageId ||
      args.documentFileName ||
      args.documentContentType ||
      args.documentSizeBytes !== undefined ||
      args.documentChecksumSha256 ||
      args.documentSource,
  );
}

function assertDocumentMetadataConsistency(
  args: AgreementDocumentArgs,
  existingStorageId?: string,
) {
  if (!hasIncomingDocumentMetadata(args)) return;
  if (!args.documentStorageId && !existingStorageId) {
    throw new Error(
      "documentStorageId is required when document metadata is provided",
    );
  }
}

function buildDocumentFields(
  args: AgreementDocumentArgs,
  actorUserId: string,
  now: string,
  existing?: Record<string, any> | null,
) {
  assertDocumentMetadataConsistency(args, existing?.documentStorageId);

  const storageId = args.documentStorageId ?? existing?.documentStorageId;
  if (!storageId) {
    return {};
  }

  const storageChanged = args.documentStorageId !== undefined;

  return {
    documentStorageId: storageId,
    documentFileName: args.documentFileName ?? existing?.documentFileName,
    documentContentType:
      args.documentContentType ?? existing?.documentContentType,
    documentSizeBytes: args.documentSizeBytes ?? existing?.documentSizeBytes,
    documentChecksumSha256:
      args.documentChecksumSha256 ?? existing?.documentChecksumSha256,
    documentSource:
      args.documentSource ?? existing?.documentSource ?? "manual_upload",
    documentUploadedAt: storageChanged
      ? now
      : existing?.documentUploadedAt,
    documentUploadedByUserId: storageChanged
      ? actorUserId
      : existing?.documentUploadedByUserId,
  };
}

function projectAgreementDocument(
  row: Record<string, any>,
  viewerRole: ViewerRole,
) {
  if (
    !row.documentStorageId &&
    !row.documentFileName &&
    !row.documentContentType &&
    row.documentSizeBytes === undefined &&
    !row.documentChecksumSha256 &&
    !row.documentSource &&
    !row.documentUploadedAt &&
    !row.documentUploadedByUserId
  ) {
    return undefined;
  }

  if (viewerRole === "buyer") {
    return {
      fileName: row.documentFileName,
      contentType: row.documentContentType,
      sizeBytes: row.documentSizeBytes,
      uploadedAt: row.documentUploadedAt,
    };
  }

  return {
    storageId: row.documentStorageId,
    fileName: row.documentFileName,
    contentType: row.documentContentType,
    sizeBytes: row.documentSizeBytes,
    checksumSha256: row.documentChecksumSha256,
    source: row.documentSource,
    uploadedAt: row.documentUploadedAt,
    uploadedByUserId: row.documentUploadedByUserId,
  };
}

function projectAgreement(
  row: Record<string, any>,
  viewerRole: ViewerRole,
  currentAgreementId?: string,
) {
  return {
    agreementId: row._id,
    dealRoomId: row.dealRoomId,
    buyerId: row.buyerId,
    type: row.type,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sentAt: row.sentAt,
    signedAt: row.signedAt,
    canceledAt: row.canceledAt,
    supersededAt: row.supersededAt,
    effectiveStartAt: row.effectiveStartAt,
    effectiveEndAt: row.effectiveEndAt,
    supersessionReason: row.supersessionReason,
    replacedById: row.replacedById,
    document: projectAgreementDocument(row, viewerRole),
    canAccessDocument: Boolean(row.documentStorageId),
    isCurrentGoverning: row._id === currentAgreementId,
  };
}

async function getAgreementViewerRole(
  ctx: Parameters<typeof requireAuth>[0],
  buyerId: string,
): Promise<{ user: Awaited<ReturnType<typeof requireAuth>>; viewerRole: ViewerRole | null }> {
  const user = await requireAuth(ctx);
  if (user._id === buyerId) {
    return { user, viewerRole: "buyer" };
  }
  if (user.role === "broker" || user.role === "admin") {
    return { user, viewerRole: user.role };
  }
  return { user, viewerRole: null };
}

async function recordAgreementEvent(
  ctx: { runMutation: any },
  params: {
    agreement: Record<string, any>;
    eventType:
      | "created"
      | "sent_for_signing"
      | "signed"
      | "canceled"
      | "replaced"
      | "document_accessed";
    visibility: "buyer" | "internal";
    actorUserId?: string;
    actorRole?: "buyer" | "broker" | "admin";
    previousStatus?: "draft" | "sent" | "signed" | "canceled" | "replaced";
    nextStatus?: "draft" | "sent" | "signed" | "canceled" | "replaced";
    successorAgreementId?: string;
    reason?: string;
    supersessionReason?:
      | "upgrade_to_full_representation"
      | "correction"
      | "amendment"
      | "renewal"
      | "replace_expired"
      | "broker_decision";
    accessScope?: "deal_room_list" | "current_governing" | "signed_document";
    accessOutcome?: "granted" | "denied";
    occurredAt: string;
    effectiveStartAt?: string;
    effectiveEndAt?: string;
  },
) {
  await ctx.runMutation((internal as any).agreementAudit.recordEventInternal, {
    agreementId: params.agreement._id,
    dealRoomId: params.agreement.dealRoomId,
    buyerId: params.agreement.buyerId,
    eventType: params.eventType,
    visibility: params.visibility,
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    previousStatus: params.previousStatus,
    nextStatus: params.nextStatus,
    successorAgreementId: params.successorAgreementId,
    documentStorageId: params.agreement.documentStorageId,
    documentFileName: params.agreement.documentFileName,
    documentContentType: params.agreement.documentContentType,
    documentSizeBytes: params.agreement.documentSizeBytes,
    reason: params.reason,
    supersessionReason: params.supersessionReason,
    accessScope: params.accessScope,
    accessOutcome: params.accessOutcome,
    effectiveStartAt:
      params.effectiveStartAt ?? params.agreement.effectiveStartAt,
    effectiveEndAt: params.effectiveEndAt ?? params.agreement.effectiveEndAt,
    occurredAt: params.occurredAt,
  });
}

function sortNewestFirst(a: Record<string, any>, b: Record<string, any>) {
  const aKey = a.signedAt ?? a.sentAt ?? a.createdAt ?? "";
  const bKey = b.signedAt ?? b.sentAt ?? b.createdAt ?? "";
  return bKey.localeCompare(aKey);
}

export const getByDealRoom = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.array(agreementReadModelValidator),
  handler: async (ctx, args) => {
    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) return [];

    const { viewerRole } = await getAgreementViewerRole(ctx, dealRoom.buyerId);
    if (!viewerRole) return [];

    const agreements = await ctx.db
      .query("agreements")
      .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
      .collect();
    const current = resolveCurrentGoverningFromRows(agreements);

    return agreements
      .sort(sortNewestFirst)
      .map((agreement) =>
        projectAgreement(agreement, viewerRole, current?._id),
      );
  },
});

export const getCurrentGoverning = query({
  args: { buyerId: v.id("users") },
  returns: v.union(agreementReadModelValidator, v.null()),
  handler: async (ctx, args) => {
    const { viewerRole } = await getAgreementViewerRole(ctx, args.buyerId);
    if (!viewerRole) {
      return null;
    }

    const agreements = await ctx.db
      .query("agreements")
      .withIndex("by_buyerId", (q) => q.eq("buyerId", args.buyerId))
      .collect();
    const current = resolveCurrentGoverningFromRows(agreements);
    return current ? projectAgreement(current, viewerRole, current._id) : null;
  },
});

export const getCurrentGoverningInternal = internalQuery({
  args: { buyerId: v.id("users") },
  returns: v.union(agreementReadModelValidator, v.null()),
  handler: async (ctx, args) => {
    const agreements = await ctx.db
      .query("agreements")
      .withIndex("by_buyerId", (q) => q.eq("buyerId", args.buyerId))
      .collect();
    const current = resolveCurrentGoverningFromRows(agreements);
    return current ? projectAgreement(current, "admin", current._id) : null;
  },
});

export const getInternal = internalQuery({
  args: { agreementId: v.id("agreements") },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agreementId);
  },
});

export const createDraft = mutation({
  args: {
    dealRoomId: v.id("dealRooms"),
    buyerId: v.id("users"),
    type: agreementType,
    effectiveStartAt: v.optional(v.string()),
    effectiveEndAt: v.optional(v.string()),
    ...agreementDocumentArgs,
  },
  returns: v.id("agreements"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can create agreements");
    }

    const now = new Date().toISOString();
    const documentFields = buildDocumentFields(args, user._id, now);
    const id = await ctx.db.insert("agreements", {
      dealRoomId: args.dealRoomId,
      buyerId: args.buyerId,
      type: args.type,
      status: "draft",
      effectiveStartAt: args.effectiveStartAt,
      effectiveEndAt: args.effectiveEndAt,
      createdAt: now,
      updatedAt: now,
      ...documentFields,
    });

    const agreement = await ctx.db.get(id);
    if (!agreement) {
      throw new Error("Agreement was not created");
    }

    await recordAgreementEvent(ctx, {
      agreement,
      eventType: "created",
      visibility: "buyer",
      actorUserId: user._id,
      actorRole: user.role,
      nextStatus: "draft",
      occurredAt: now,
      effectiveStartAt: agreement.effectiveStartAt,
      effectiveEndAt: agreement.effectiveEndAt,
    });

    await ctx.runMutation(internal.offerEligibility.recalculateEligibilityInternal, {
      buyerId: args.buyerId,
      dealRoomId: args.dealRoomId,
      actorUserId: user._id,
    });

    return id;
  },
});

export const sendForSigning = mutation({
  args: { agreementId: v.id("agreements") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can send agreements");
    }

    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) throw new Error("Agreement not found");
    if (agreement.status !== "draft") {
      throw new Error("Can only send draft agreements");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.agreementId, {
      status: "sent",
      sentAt: now,
      updatedAt: now,
    });

    const updatedAgreement = await ctx.db.get(args.agreementId);
    if (!updatedAgreement) {
      throw new Error("Agreement disappeared after send");
    }

    await recordAgreementEvent(ctx, {
      agreement: updatedAgreement,
      eventType: "sent_for_signing",
      visibility: "buyer",
      actorUserId: user._id,
      actorRole: user.role,
      previousStatus: "draft",
      nextStatus: "sent",
      occurredAt: now,
    });

    await ctx.runMutation(internal.offerEligibility.recalculateEligibilityInternal, {
      buyerId: agreement.buyerId,
      dealRoomId: agreement.dealRoomId,
      actorUserId: user._id,
    });

    await trackPosthogEvent(
      "agreement_signed",
      {
        agreementId: String(updatedAgreement._id),
        dealRoomId: String(updatedAgreement.dealRoomId),
        agreementType: updatedAgreement.type,
      },
      String(updatedAgreement.buyerId),
    );

    return null;
  },
});

export const recordSignature = mutation({
  args: {
    agreementId: v.id("agreements"),
    effectiveStartAt: v.optional(v.string()),
    effectiveEndAt: v.optional(v.string()),
    ...agreementDocumentArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can record signatures");
    }

    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) throw new Error("Agreement not found");
    if (agreement.status !== "sent") {
      throw new Error("Can only sign sent agreements");
    }

    const now = new Date().toISOString();
    const documentFields = buildDocumentFields(args, user._id, now, agreement);
    await ctx.db.patch(args.agreementId, {
      status: "signed",
      signedAt: now,
      updatedAt: now,
      effectiveStartAt: args.effectiveStartAt ?? agreement.effectiveStartAt ?? now,
      effectiveEndAt: args.effectiveEndAt ?? agreement.effectiveEndAt,
      ...documentFields,
    });

    const updatedAgreement = await ctx.db.get(args.agreementId);
    if (!updatedAgreement) {
      throw new Error("Agreement disappeared after signing");
    }

    await recordAgreementEvent(ctx, {
      agreement: updatedAgreement,
      eventType: "signed",
      visibility: "buyer",
      actorUserId: user._id,
      actorRole: user.role,
      previousStatus: "sent",
      nextStatus: "signed",
      occurredAt: now,
      effectiveStartAt: updatedAgreement.effectiveStartAt,
      effectiveEndAt: updatedAgreement.effectiveEndAt,
    });

    await ctx.runMutation(internal.offerEligibility.recalculateEligibilityInternal, {
      buyerId: agreement.buyerId,
      dealRoomId: agreement.dealRoomId,
      actorUserId: user._id,
    });

    return null;
  },
});

export const cancelAgreement = mutation({
  args: {
    agreementId: v.id("agreements"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can cancel agreements");
    }

    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) throw new Error("Agreement not found");
    if (agreement.status !== "signed") {
      throw new Error("Can only cancel signed agreements");
    }

    const now = new Date().toISOString();
    await ctx.db.patch(args.agreementId, {
      status: "canceled",
      canceledAt: now,
      updatedAt: now,
      effectiveEndAt: agreement.effectiveEndAt ?? now,
    });

    const updatedAgreement = await ctx.db.get(args.agreementId);
    if (!updatedAgreement) {
      throw new Error("Agreement disappeared after cancel");
    }

    await recordAgreementEvent(ctx, {
      agreement: updatedAgreement,
      eventType: "canceled",
      visibility: "buyer",
      actorUserId: user._id,
      actorRole: user.role,
      previousStatus: "signed",
      nextStatus: "canceled",
      reason: args.reason,
      occurredAt: now,
      effectiveStartAt: updatedAgreement.effectiveStartAt,
      effectiveEndAt: updatedAgreement.effectiveEndAt,
    });

    await ctx.runMutation(internal.offerEligibility.recalculateEligibilityInternal, {
      buyerId: agreement.buyerId,
      dealRoomId: agreement.dealRoomId,
      actorUserId: user._id,
    });

    return null;
  },
});

export const replaceAgreement = mutation({
  args: {
    currentAgreementId: v.id("agreements"),
    newType: agreementType,
    newEffectiveStartAt: v.optional(v.string()),
    newEffectiveEndAt: v.optional(v.string()),
    reason: v.optional(supersessionReason),
    ...agreementDocumentArgs,
  },
  returns: v.id("agreements"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    if (user.role !== "broker" && user.role !== "admin") {
      throw new Error("Only brokers and admins can replace agreements");
    }

    const current = await ctx.db.get(args.currentAgreementId);
    if (!current) throw new Error("Current agreement not found");
    if (current.status !== "signed") {
      throw new Error("Can only replace signed agreements");
    }

    const now = new Date().toISOString();
    const documentFields = buildDocumentFields(args, user._id, now);
    const newId = await ctx.db.insert("agreements", {
      dealRoomId: current.dealRoomId,
      buyerId: current.buyerId,
      type: args.newType,
      status: "draft",
      effectiveStartAt: args.newEffectiveStartAt,
      effectiveEndAt: args.newEffectiveEndAt,
      createdAt: now,
      updatedAt: now,
      ...documentFields,
    });

    const successor = await ctx.db.get(newId);
    if (!successor) {
      throw new Error("Replacement agreement was not created");
    }

    await recordAgreementEvent(ctx, {
      agreement: successor,
      eventType: "created",
      visibility: "buyer",
      actorUserId: user._id,
      actorRole: user.role,
      nextStatus: "draft",
      reason: "Created as replacement agreement",
      occurredAt: now,
      effectiveStartAt: successor.effectiveStartAt,
      effectiveEndAt: successor.effectiveEndAt,
    });

    await applySupersessionState(ctx, {
      predecessor: current,
      successor,
      reason: args.reason ?? "broker_decision",
      actorUserId: user._id,
    });

    await ctx.runMutation(internal.offerEligibility.recalculateEligibilityInternal, {
      buyerId: current.buyerId,
      dealRoomId: current.dealRoomId,
      actorUserId: user._id,
    });

    return newId;
  },
});

export const authorizeDocumentAccess = mutation({
  args: { agreementId: v.id("agreements") },
  returns: v.union(authorizedDocumentAccessValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const agreement = await ctx.db.get(args.agreementId);
    if (!agreement) {
      throw new Error("Agreement not found");
    }

    const now = new Date().toISOString();
    const isAllowed =
      agreement.buyerId === user._id ||
      user.role === "broker" ||
      user.role === "admin";

    if (!isAllowed) {
      await recordAgreementEvent(ctx, {
        agreement,
        eventType: "document_accessed",
        visibility: "internal",
        actorUserId: user._id,
        actorRole: user.role,
        accessScope: "signed_document",
        accessOutcome: "denied",
        reason: "not_authorized",
        occurredAt: now,
      });
      throw new Error("Not authorized to access this agreement document");
    }

    if (!agreement.documentStorageId) {
      await recordAgreementEvent(ctx, {
        agreement,
        eventType: "document_accessed",
        visibility: "internal",
        actorUserId: user._id,
        actorRole: user.role,
        accessScope: "signed_document",
        accessOutcome: "denied",
        reason: "missing_document",
        occurredAt: now,
      });
      throw new Error("No signed document is stored for this agreement");
    }

    await recordAgreementEvent(ctx, {
      agreement,
      eventType: "document_accessed",
      visibility: "internal",
      actorUserId: user._id,
      actorRole: user.role,
      accessScope: "signed_document",
      accessOutcome: "granted",
      occurredAt: now,
    });

    return {
      agreementId: agreement._id,
      dealRoomId: agreement.dealRoomId,
      fileId: agreement.documentStorageId,
    };
  },
});
