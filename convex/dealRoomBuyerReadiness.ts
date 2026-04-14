import { v } from "convex/values";
import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getCurrentUser } from "./lib/session";
import { loadBuyerProfileView } from "./lib/buyerProfile";
import { computeOfferEligibility, type AgreementSnapshot } from "./lib/offerEligibilityCompute";
import {
  buildBuyerReadiness,
  type BuyerReadinessConfidenceSectionInput,
  type BuyerReadinessContractInput,
  type BuyerReadinessDocumentInput,
  type BuyerReadinessEligibilityInput,
  type BuyerReadinessMilestoneInput,
  type BuyerReadinessOfferInput,
} from "../src/lib/dealroom/buyer-readiness";

function mapEligibility(
  persisted: Doc<"offerEligibilityState"> | null,
  agreements: AgreementSnapshot[],
  dealRoomId: string,
): BuyerReadinessEligibilityInput {
  if (persisted) {
    return {
      isEligible: persisted.isEligible,
      currentAgreementType: persisted.currentAgreementType,
      blockingReasonCode: persisted.blockingReasonCode ?? null,
      blockingReasonMessage: persisted.blockingReasonMessage ?? null,
      requiredAction: persisted.requiredAction,
    };
  }

  const computed = computeOfferEligibility(agreements, dealRoomId);
  if (computed.isEligible) {
    return {
      isEligible: true,
      currentAgreementType: "full_representation",
      blockingReasonCode: null,
      blockingReasonMessage: null,
      requiredAction: "none",
    };
  }

  return {
    isEligible: false,
    currentAgreementType: computed.currentAgreementType,
    blockingReasonCode: computed.blockingReasonCode,
    blockingReasonMessage: computed.blockingReasonMessage,
    requiredAction: computed.requiredAction,
  };
}

function normalizeAgreementSnapshots(
  agreements: Array<Doc<"agreements">>,
): AgreementSnapshot[] {
  return agreements.map((agreement) => ({
    _id: String(agreement._id),
    dealRoomId: String(agreement.dealRoomId),
    buyerId: String(agreement.buyerId),
    type: agreement.type,
    status: agreement.status,
    signedAt: agreement.signedAt,
  }));
}

function normalizeDocument(
  job: Doc<"fileAnalysisJobs">,
): BuyerReadinessDocumentInput {
  const status = mapDocumentStatus(job);
  const documentType = normalizeDocumentType(job.docType);
  return {
    id: String(job._id),
    documentType,
    status,
    headline: buildDocumentHeadline(documentType, status),
    reason: buildDocumentReason(job, status),
    severity: job.overallSeverity ?? "info",
    reviewNotes: job.reviewNotes ?? null,
  };
}

function normalizeDocumentType(
  docType: Doc<"fileAnalysisJobs">["docType"],
): BuyerReadinessDocumentInput["documentType"] {
  if (docType === "unknown") return "other";
  return docType;
}

function mapDocumentStatus(
  job: Doc<"fileAnalysisJobs">,
): BuyerReadinessDocumentInput["status"] {
  switch (job.status) {
    case "queued":
    case "running":
      return "pending";
    case "review_required":
      return "review_required";
    case "failed":
      return "unavailable";
    case "completed":
    case "resolved":
      return "available";
    default:
      return "pending";
  }
}

function buildDocumentHeadline(
  docType: BuyerReadinessDocumentInput["documentType"],
  status: BuyerReadinessDocumentInput["status"],
): string {
  const label =
    docType === "hoa_document"
      ? "HOA document"
      : docType === "seller_disclosure"
        ? "Seller disclosure"
        : docType === "inspection_report"
          ? "Inspection report"
          : docType === "title_commitment"
            ? "Title commitment"
            : docType === "loan_estimate"
              ? "Loan estimate"
              : docType === "purchase_contract"
                ? "Purchase contract"
                : docType === "appraisal"
                  ? "Appraisal"
                  : docType === "survey"
                    ? "Survey"
                    : "Document";

  if (status === "review_required") return `${label} waiting on review`;
  if (status === "unavailable") return `${label} unavailable`;
  if (status === "pending" || status === "partial") return `${label} still processing`;
  return `${label} ready`;
}

function buildDocumentReason(
  job: Doc<"fileAnalysisJobs">,
  status: BuyerReadinessDocumentInput["status"],
): string | null {
  if (status === "available") return null;
  if (status === "review_required") {
    return (
      job.reviewNotes ??
      "The document extraction still needs broker review before it should drive readiness."
    );
  }
  if (status === "unavailable") {
    return "The document analysis failed and needs a fresh source file or rerun.";
  }
  return "The document pipeline is still running and has not cleared this step yet.";
}

function normalizeConfidenceSections(
  dossier: any,
): BuyerReadinessConfidenceSectionInput[] {
  const sections = dossier?.evidenceGraph?.sections;
  if (!sections) return [];

  return Object.values(sections).map((section: any) => ({
    key: section.key,
    title: section.title,
    status: section.status,
    band: section.confidenceInputs.band,
    score: section.confidenceInputs.score,
    missingLabels: [...(section.confidenceInputs.missingLabels ?? [])],
    conflictingLabels: [...(section.confidenceInputs.conflictingLabels ?? [])],
    whatWouldIncreaseConfidence: [
      ...(section.buyerSummary?.supportLabels ?? []),
      ...(section.confidenceInputs.missingLabels ?? []).map(
        (label: string) => `Add ${label}`,
      ),
      ...(section.confidenceInputs.conflictingLabels ?? []).map(
        (label: string) => `Resolve ${label}`,
      ),
    ],
  }));
}

function normalizeMilestones(
  milestones: Array<Doc<"contractMilestones">>,
): BuyerReadinessMilestoneInput[] {
  return milestones.map((milestone) => ({
    id: String(milestone._id),
    name: milestone.name,
    workstream: milestone.workstream,
    status: milestone.status,
    dueDate: milestone.dueDate,
    flaggedForReview: milestone.flaggedForReview,
    reviewReason: milestone.reviewReason,
  }));
}

function normalizeOffer(offers: Array<Doc<"offers">>): BuyerReadinessOfferInput | null {
  const latest = [...offers].sort((left, right) =>
    String(right.submittedAt ?? right._creationTime).localeCompare(
      String(left.submittedAt ?? left._creationTime),
    ),
  )[0];

  if (!latest) return null;
  return {
    latestStatus: latest.status,
  };
}

function normalizeContract(
  contracts: Array<Doc<"contracts">>,
): BuyerReadinessContractInput | null {
  const latest = [...contracts].sort((left, right) =>
    (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""),
  )[0];
  if (!latest) return null;
  return {
    status: latest.status,
  };
}

export const getReadiness = query({
  args: { dealRoomId: v.id("dealRooms") },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const dealRoom = await ctx.db.get(args.dealRoomId);
    if (!dealRoom) return null;

    const isOwner = dealRoom.buyerId === user._id;
    const isStaff = user.role === "broker" || user.role === "admin";
    if (!isOwner && !isStaff) return null;

    const property = await ctx.db.get(dealRoom.propertyId);
    if (!property) return null;

    const buyerId = dealRoom.buyerId;

    const [
      agreements,
      persistedEligibility,
      lenderValidation,
      fileAnalysisJobs,
      offers,
      contracts,
      milestones,
      buyerProfile,
      dossier,
    ] = await Promise.all([
      ctx.db
        .query("agreements")
        .withIndex("by_buyerId", (q) => q.eq("buyerId", buyerId))
        .collect(),
      ctx.db
        .query("offerEligibilityState")
        .withIndex("by_buyerId_and_dealRoomId", (q) =>
          q.eq("buyerId", buyerId).eq("dealRoomId", args.dealRoomId),
        )
        .unique(),
      ctx.db
        .query("lenderCreditValidations")
        .withIndex("by_dealRoomId_and_createdAt", (q) =>
          q.eq("dealRoomId", args.dealRoomId),
        )
        .order("desc")
        .first(),
      ctx.db
        .query("fileAnalysisJobs")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      ctx.db
        .query("offers")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      ctx.db
        .query("contracts")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      ctx.db
        .query("contractMilestones")
        .withIndex("by_dealRoomId", (q) => q.eq("dealRoomId", args.dealRoomId))
        .collect(),
      loadBuyerProfileView(ctx, buyerId, isStaff),
      ctx.runQuery(internal.propertyDossiers.getForPropertyInternal, {
        propertyId: dealRoom.propertyId,
        dealRoomId: args.dealRoomId,
      }),
    ]);

    const agreementSnapshots = normalizeAgreementSnapshots(agreements);
    const readiness = buildBuyerReadiness(
      {
        dealRoomId: String(args.dealRoomId),
        propertyId: String(dealRoom.propertyId),
        dealStatus: dealRoom.status,
        generatedAt: new Date().toISOString(),
        listPrice: property.listPrice ?? null,
        eligibility: mapEligibility(
          persistedEligibility,
          agreementSnapshots,
          String(args.dealRoomId),
        ),
        financing: {
          financingType: buyerProfile.financing.financingType,
          preApproved: buyerProfile.financing.preApproved,
          preApprovalAmount: buyerProfile.financing.preApprovalAmount,
          preApprovalExpiry: buyerProfile.financing.preApprovalExpiry,
          lenderName: buyerProfile.financing.lenderName,
        },
        lenderValidation: lenderValidation
          ? {
              validationOutcome: lenderValidation.validationOutcome,
              blockingReasonCode: lenderValidation.blockingReasonCode ?? null,
              blockingReasonMessage:
                lenderValidation.blockingReasonMessage ?? null,
              reviewNotes: lenderValidation.reviewNotes ?? null,
            }
          : null,
        documents: fileAnalysisJobs.map(normalizeDocument),
        confidenceSections: normalizeConfidenceSections(dossier),
        offer: normalizeOffer(offers),
        contract: normalizeContract(contracts),
        milestones: normalizeMilestones(milestones),
      },
      { forRole: isStaff ? user.role : "buyer" },
    );

    return readiness;
  },
});
