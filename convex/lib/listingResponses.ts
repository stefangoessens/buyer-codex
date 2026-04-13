import type { Doc, Id } from "../_generated/dataModel"
import type {
  ExternalAccessAction,
  ExternalAccessResource,
  ExternalAccessSession,
  TokenDenialReason,
} from "../../packages/shared/src/external-access"
import { authorizeExternalAccessSession } from "./externalAccessSession"

const DEDUPE_WINDOW_MS = 60_000

type ListingResponseDoc = Doc<"listingResponses">
type ExternalTokenDoc = Doc<"externalAccessTokens">
type ListingResponseAccessAction = Exclude<ExternalAccessAction, "view_offer">

export interface ListingResponseAccessContext {
  kind: "external_access"
  tokenId: Id<"externalAccessTokens">
  resource: ExternalAccessResource
  action: ListingResponseAccessAction
  dealRoomId: Id<"dealRooms">
  offerId?: Id<"offers">
  role: ExternalTokenDoc["role"]
  allowedActions: ExternalAccessAction[]
  expiresAt: string
}

export interface ListingResponseReviewModel {
  id: ListingResponseDoc["_id"]
  createdAt: number
  dealRoomId: Id<"dealRooms">
  offerId?: Id<"offers">
  propertyId: Id<"properties">
  responseType: ListingResponseDoc["responseType"]
  counterpartyRole: ListingResponseDoc["counterpartyRole"]
  submittedAt: string
  accessContext: ListingResponseAccessContext
  payload: {
    message?: string
    counterOffer?: {
      counterPrice?: number
      counterEarnestMoney?: number
      counterClosingDate?: string
      requestedConcessions?: string
      sellerCreditsRequested?: number
    }
    compensation?: {
      confirmedPct?: number
      confirmedFlat?: number
      disputeReason?: string
    }
  }
  review: {
    status: ListingResponseDoc["reviewStatus"]
    reviewedBy?: Id<"users">
    reviewedAt?: string
    notes?: string
  }
}

export type AuthorizeListingResponseSubmissionResult =
  | {
      ok: true
      token: ExternalTokenDoc
      session: ExternalAccessSession
      action: ListingResponseAccessAction
      accessContext: ListingResponseAccessContext
    }
  | {
      ok: false
      kind: "denied"
      reason: TokenDenialReason
      token: ExternalTokenDoc | null
    }
  | {
      ok: false
      kind: "duplicate_submission"
      token: ExternalTokenDoc
    }

export function buildListingResponseAccessContext(args: {
  action: ListingResponseAccessAction
  token: ExternalTokenDoc
  session: ExternalAccessSession
}): ListingResponseAccessContext {
  return {
    kind: "external_access",
    tokenId: args.token._id,
    resource: args.session.scope.resource,
    action: args.action,
    dealRoomId: args.session.scope.dealRoomId as Id<"dealRooms">,
    offerId: args.session.scope.offerId as Id<"offers"> | undefined,
    role: args.token.role,
    allowedActions: [...args.session.scope.allowedActions],
    expiresAt: args.session.scope.expiresAt,
  }
}

export function getListingResponseAccessAction(
  responseType: ListingResponseDoc["responseType"],
): ListingResponseAccessAction {
  switch (responseType) {
    case "offer_acknowledged":
    case "generic_acknowledged":
      return "acknowledge_receipt"
    case "compensation_confirmed":
    case "compensation_disputed":
      return "confirm_compensation"
    case "offer_countered":
    case "offer_rejected":
      return "submit_response"
  }
}

export function buildListingResponseReviewModel(
  response: ListingResponseDoc,
): ListingResponseReviewModel {
  const hasCounterOffer =
    response.counterPrice !== undefined ||
    response.counterEarnestMoney !== undefined ||
    response.counterClosingDate !== undefined ||
    response.requestedConcessions !== undefined ||
    response.sellerCreditsRequested !== undefined

  const hasCompensation =
    response.confirmedPct !== undefined ||
    response.confirmedFlat !== undefined ||
    response.disputeReason !== undefined

  return {
    id: response._id,
    createdAt: response._creationTime,
    dealRoomId: response.dealRoomId,
    offerId: response.offerId,
    propertyId: response.propertyId,
    responseType: response.responseType,
    counterpartyRole: response.counterpartyRole,
    submittedAt: response.submittedAt,
    accessContext: {
      kind: response.accessKind ?? "external_access",
      tokenId: response.tokenId,
      resource: response.accessResource ?? "offer",
      action:
        response.accessAction ??
        getListingResponseAccessAction(response.responseType),
      dealRoomId: response.dealRoomId,
      offerId: response.offerId,
      role: response.counterpartyRole,
      allowedActions: response.accessAllowedActions
        ? [...response.accessAllowedActions]
        : [],
      expiresAt: response.accessExpiresAt ?? response.submittedAt,
    },
    payload: {
      message: response.message,
      counterOffer: hasCounterOffer
        ? {
            counterPrice: response.counterPrice,
            counterEarnestMoney: response.counterEarnestMoney,
            counterClosingDate: response.counterClosingDate,
            requestedConcessions: response.requestedConcessions,
            sellerCreditsRequested: response.sellerCreditsRequested,
          }
        : undefined,
      compensation: hasCompensation
        ? {
            confirmedPct: response.confirmedPct,
            confirmedFlat: response.confirmedFlat,
            disputeReason: response.disputeReason,
          }
        : undefined,
    },
    review: {
      status: response.reviewStatus,
      reviewedBy: response.reviewedBy,
      reviewedAt: response.reviewedAt,
      notes: response.reviewNotes,
    },
  }
}

export function authorizeListingResponseSubmission(args: {
  token: ExternalTokenDoc | null
  hashedToken: string
  dealRoomId: Id<"dealRooms">
  offerId?: Id<"offers">
  responseType: ListingResponseDoc["responseType"]
  now: string
  existingResponses: Array<{
    responseType: ListingResponseDoc["responseType"]
    submittedAt: string
  }>
}): AuthorizeListingResponseSubmissionResult {
  const action = getListingResponseAccessAction(args.responseType)
  const authorized = authorizeExternalAccessSession({
    token: args.token,
    hashedToken: args.hashedToken,
    intendedAction: action,
    intendedDealRoomId: args.dealRoomId,
    intendedOfferId: args.offerId,
    now: args.now,
  })

  if (!authorized.ok) {
    return {
      ok: false,
      kind: "denied",
      reason: authorized.reason,
      token: authorized.token,
    }
  }

  const nowMs = Date.parse(args.now)
  const duplicate = args.existingResponses.some((existing) => {
    if (existing.responseType !== args.responseType) return false
    const submittedMs = Date.parse(existing.submittedAt)
    if (Number.isNaN(nowMs) || Number.isNaN(submittedMs)) return false
    return nowMs - submittedMs < DEDUPE_WINDOW_MS
  })

  if (duplicate) {
    return {
      ok: false,
      kind: "duplicate_submission",
      token: authorized.token,
    }
  }

  return {
    ok: true,
    token: authorized.token,
    session: authorized.session,
    action,
    accessContext: buildListingResponseAccessContext({
      action,
      token: authorized.token,
      session: authorized.session,
    }),
  }
}
