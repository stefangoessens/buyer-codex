export const portalPlatforms = [
  "zillow",
  "redfin",
  "realtor",
  "manual",
] as const;

export type SourcePlatform = (typeof portalPlatforms)[number];

export const dealStatuses = [
  "intake",
  "analysis",
  "tour_scheduled",
  "offer_prep",
  "offer_sent",
  "under_contract",
  "closing",
  "closed",
  "withdrawn",
] as const;

/** Status of a deal in the buyer-codex pipeline */
export type DealStatus = (typeof dealStatuses)[number];

export const aiReviewStates = ["pending", "approved", "rejected"] as const;

export type AIReviewState = (typeof aiReviewStates)[number];

export type FinancingType =
  | "cash"
  | "conventional"
  | "fha"
  | "va"
  | "other";

// ───────────────────────────────────────────────────────────────────────────
// Buyer fee ledger + reconciliation
// ───────────────────────────────────────────────────────────────────────────

export const compensationStatuses = [
  "unknown",
  "seller_disclosed_off_mls",
  "negotiated_in_offer",
  "buyer_paid",
] as const;

export type CompensationStatus = (typeof compensationStatuses)[number];

export const buyerFeeLedgerBuckets = ["projected", "actual"] as const;

export type BuyerFeeLedgerBucket = (typeof buyerFeeLedgerBuckets)[number];

export const buyerFeeLedgerDimensions = [
  "expectedBuyerFee",
  "sellerPaidAmount",
  "buyerPaidAmount",
  "projectedClosingCredit",
] as const;

export type BuyerFeeLedgerDimension =
  (typeof buyerFeeLedgerDimensions)[number];

export const buyerFeeLedgerSources = [
  "listing_agent",
  "offer_term",
  "contract",
  "closing_statement",
  "manual",
  "system",
] as const;

export type BuyerFeeLedgerSource = (typeof buyerFeeLedgerSources)[number];

export const buyerFeeLedgerInternalReviewStates = [
  "not_submitted",
  "pending_review",
  "approved",
  "rejected",
] as const;

export type BuyerFeeLedgerInternalReviewState =
  (typeof buyerFeeLedgerInternalReviewStates)[number];

export const offerLifecycleStatuses = [
  "draft",
  "pending_review",
  "approved",
  "submitted",
  "countered",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;

export type OfferLifecycleStatus = (typeof offerLifecycleStatuses)[number];

export const contractLifecycleStatuses = [
  "pending_signatures",
  "fully_executed",
  "amended",
  "terminated",
] as const;

export type ContractLifecycleStatus =
  (typeof contractLifecycleStatuses)[number];

export interface BuyerFeeLedgerRollup {
  expectedBuyerFee: number;
  sellerPaidAmount: number;
  buyerPaidAmount: number;
  projectedClosingCredit: number;
  netBrokerCompensation: number;
  fundingGap: number;
}

export interface BuyerFeeLedgerLifecycleLink<TId = string> {
  dealStatus: DealStatus;
  offerId?: TId;
  offerStatus?: OfferLifecycleStatus;
  contractId?: TId;
  contractStatus?: ContractLifecycleStatus;
  internalReviewState: BuyerFeeLedgerInternalReviewState;
  compensationStatus: CompensationStatus;
}

export interface BuyerFeeLedgerProvenance<TId = string> {
  actorId?: TId;
  triggeredBy?: string;
  sourceDocument?: string;
  changedAt: string;
}

export interface BuyerFeeLedgerEntryRecord<TId = string> {
  id: TId;
  dealRoomId: TId;
  bucket: BuyerFeeLedgerBucket;
  dimension: BuyerFeeLedgerDimension;
  amount: number;
  description: string;
  source: BuyerFeeLedgerSource;
  lifecycle: BuyerFeeLedgerLifecycleLink<TId>;
  provenance: BuyerFeeLedgerProvenance<TId>;
  createdAt: string;
}

export interface CompensationLedgerState<TId = string> {
  dealRoomId: TId;
  status: CompensationStatus;
  previousStatus?: CompensationStatus;
  transitionReason?: string;
  transitionActorId?: TId;
  lastTransitionAt: string;
  expectedBuyerFee: number;
  sellerPaidAmount: number;
  buyerPaidAmount: number;
  projectedClosingCredit: number;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerFeeLedgerEntryBuyerView<TId = string> {
  id: TId;
  bucket: BuyerFeeLedgerBucket;
  dimension: BuyerFeeLedgerDimension;
  amount: number;
  description: string;
  source: BuyerFeeLedgerSource;
  createdAt: string;
}

export interface BuyerFeeLedgerEntryInternalView<TId = string>
  extends BuyerFeeLedgerEntryBuyerView<TId> {
  lifecycle: BuyerFeeLedgerLifecycleLink<TId>;
  provenance: BuyerFeeLedgerProvenance<TId>;
}

export type BuyerFeeLedgerVariant = "buyer_safe" | "internal";

export interface BuyerFeeLedgerReadModelBase<TId = string> {
  dealRoomId: TId;
  variant: BuyerFeeLedgerVariant;
  compensation: CompensationLedgerState<TId>;
  projected: BuyerFeeLedgerRollup;
  actual: BuyerFeeLedgerRollup | null;
  latestActualAt: string | null;
}

export interface BuyerFeeLedgerBuyerReadModel<TId = string>
  extends BuyerFeeLedgerReadModelBase<TId> {
  variant: "buyer_safe";
  entries: BuyerFeeLedgerEntryBuyerView<TId>[];
}

export interface BuyerFeeLedgerInternalReadModel<TId = string>
  extends BuyerFeeLedgerReadModelBase<TId> {
  variant: "internal";
  entries: BuyerFeeLedgerEntryInternalView<TId>[];
}

export type BuyerFeeLedgerReadModel<TId = string> =
  | BuyerFeeLedgerBuyerReadModel<TId>
  | BuyerFeeLedgerInternalReadModel<TId>;

export interface BuyerFeeLedgerReconciliation {
  expected: BuyerFeeLedgerRollup;
  actual: BuyerFeeLedgerRollup | null;
  delta: BuyerFeeLedgerRollup | null;
  discrepancyAmount: number | null;
  discrepancyDimensions: BuyerFeeLedgerDimension[];
  discrepancyFlag: boolean;
  discrepancyDetails?: string;
}

const compensationTransitionGraph: Record<CompensationStatus, CompensationStatus[]> =
  {
    unknown: ["seller_disclosed_off_mls", "negotiated_in_offer", "buyer_paid"],
    seller_disclosed_off_mls: ["negotiated_in_offer", "buyer_paid"],
    negotiated_in_offer: ["buyer_paid"],
    buyer_paid: [],
  };

export function isValidCompensationTransition(
  from: CompensationStatus,
  to: CompensationStatus,
): boolean {
  return compensationTransitionGraph[from]?.includes(to) ?? false;
}

export function createEmptyBuyerFeeLedgerRollup(): BuyerFeeLedgerRollup {
  return {
    expectedBuyerFee: 0,
    sellerPaidAmount: 0,
    buyerPaidAmount: 0,
    projectedClosingCredit: 0,
    netBrokerCompensation: 0,
    fundingGap: 0,
  };
}

function finalizeBuyerFeeLedgerRollup(
  partial: Omit<BuyerFeeLedgerRollup, "netBrokerCompensation" | "fundingGap">,
): BuyerFeeLedgerRollup {
  const netBrokerCompensation =
    partial.sellerPaidAmount +
    partial.buyerPaidAmount -
    partial.projectedClosingCredit;

  return {
    ...partial,
    netBrokerCompensation,
    fundingGap: partial.expectedBuyerFee - netBrokerCompensation,
  };
}

export function rollupBuyerFeeLedgerEntries<TId>(
  entries: Array<
    Pick<BuyerFeeLedgerEntryRecord<TId>, "bucket" | "dimension" | "amount">
  >,
  bucket: BuyerFeeLedgerBucket,
): BuyerFeeLedgerRollup {
  const partial = {
    expectedBuyerFee: 0,
    sellerPaidAmount: 0,
    buyerPaidAmount: 0,
    projectedClosingCredit: 0,
  };

  for (const entry of entries) {
    if (entry.bucket !== bucket) continue;
    partial[entry.dimension] += entry.amount;
  }

  return finalizeBuyerFeeLedgerRollup(partial);
}

function buildDeltaRollup(
  expected: BuyerFeeLedgerRollup,
  actual: BuyerFeeLedgerRollup,
): BuyerFeeLedgerRollup {
  return finalizeBuyerFeeLedgerRollup({
    expectedBuyerFee: actual.expectedBuyerFee - expected.expectedBuyerFee,
    sellerPaidAmount: actual.sellerPaidAmount - expected.sellerPaidAmount,
    buyerPaidAmount: actual.buyerPaidAmount - expected.buyerPaidAmount,
    projectedClosingCredit:
      actual.projectedClosingCredit - expected.projectedClosingCredit,
  });
}

export function reconcileBuyerFeeLedger(
  expected: BuyerFeeLedgerRollup,
  actual: BuyerFeeLedgerRollup | null,
  threshold = 50,
): BuyerFeeLedgerReconciliation {
  if (!actual) {
    return {
      expected,
      actual: null,
      delta: null,
      discrepancyAmount: null,
      discrepancyDimensions: [],
      discrepancyFlag: false,
    };
  }

  const delta = buildDeltaRollup(expected, actual);
  const discrepancyDimensions = buyerFeeLedgerDimensions.filter(
    (dimension) => Math.abs(delta[dimension]) > threshold,
  );
  const discrepancyAmount = buyerFeeLedgerDimensions.reduce(
    (sum, dimension) => sum + Math.abs(delta[dimension]),
    0,
  );

  const detailSegments = discrepancyDimensions.map((dimension) => {
    const label = dimension
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (letter) => letter.toUpperCase());
    return `${label}: expected $${expected[dimension].toFixed(2)}, actual $${actual[
      dimension
    ].toFixed(2)} (${delta[dimension] >= 0 ? "+" : ""}$${delta[
      dimension
    ].toFixed(2)})`;
  });

  return {
    expected,
    actual,
    delta,
    discrepancyAmount,
    discrepancyDimensions,
    discrepancyFlag: discrepancyDimensions.length > 0,
    discrepancyDetails:
      detailSegments.length > 0 ? detailSegments.join("; ") : undefined,
  };
}

export function buildBuyerFeeLedgerReadModel<TId>(
  args: {
    dealRoomId: TId;
    compensation: CompensationLedgerState<TId>;
    entries: BuyerFeeLedgerEntryRecord<TId>[];
    forRole: "buyer" | "broker" | "admin";
  },
): BuyerFeeLedgerReadModel<TId> {
  const projected = rollupBuyerFeeLedgerEntries(args.entries, "projected");
  const actual = rollupBuyerFeeLedgerEntries(args.entries, "actual");
  const hasActualEntries = args.entries.some((entry) => entry.bucket === "actual");
  const latestActualAt = hasActualEntries
    ? args.entries
        .filter((entry) => entry.bucket === "actual")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.createdAt ??
      null
    : null;

  const buyerEntries: BuyerFeeLedgerEntryBuyerView<TId>[] = args.entries.map(
    (entry) => ({
      id: entry.id,
      bucket: entry.bucket,
      dimension: entry.dimension,
      amount: entry.amount,
      description: entry.description,
      source: entry.source,
      createdAt: entry.createdAt,
    }),
  );

  if (args.forRole === "buyer") {
    return {
      dealRoomId: args.dealRoomId,
      variant: "buyer_safe",
      compensation: args.compensation,
      projected,
      actual: hasActualEntries ? actual : null,
      latestActualAt,
      entries: buyerEntries,
    };
  }

  return {
    dealRoomId: args.dealRoomId,
    variant: "internal",
    compensation: args.compensation,
    projected,
    actual: hasActualEntries ? actual : null,
    latestActualAt,
    entries: args.entries.map((entry) => ({
      ...buyerEntries.find((buyerEntry) => buyerEntry.id === entry.id)!,
      lifecycle: entry.lifecycle,
      provenance: entry.provenance,
    })),
  };
}

export interface PropertyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

/** Normalized property record — system of record */
export interface PropertyRecord {
  id: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  address: PropertyAddress;
  listPrice?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  yearBuilt?: number;
  propertyType?: string;
  mlsNumber?: string;
  extractedAt: string;
}

/** AI engine output metadata — every engine must include this */
export interface AIEngineOutput {
  confidence: number;
  citations: string[];
  reviewState: AIReviewState;
  generatedAt: string;
  modelId: string;
}

export const agreementTypes = [
  "tour_pass",
  "full_representation",
] as const;

export type AgreementType = (typeof agreementTypes)[number];

export const agreementStatuses = [
  "draft",
  "sent",
  "signed",
  "canceled",
  "replaced",
] as const;

export type AgreementStatus = (typeof agreementStatuses)[number];

export const supersessionReasons = [
  "upgrade_to_full_representation",
  "correction",
  "amendment",
  "renewal",
  "replace_expired",
  "broker_decision",
] as const;

export type SupersessionReason = (typeof supersessionReasons)[number];

export const agreementDocumentSources = [
  "manual_upload",
  "signature_provider",
  "internal_generated",
] as const;

export type AgreementDocumentSource =
  (typeof agreementDocumentSources)[number];

export const agreementAuditEventTypes = [
  "created",
  "sent_for_signing",
  "signed",
  "canceled",
  "replaced",
  "document_accessed",
] as const;

export type AgreementAuditEventType =
  (typeof agreementAuditEventTypes)[number];

export const agreementAuditVisibilities = ["buyer", "internal"] as const;

export type AgreementAuditVisibility =
  (typeof agreementAuditVisibilities)[number];

export const agreementAccessScopes = [
  "deal_room_list",
  "current_governing",
  "signed_document",
] as const;

export type AgreementAccessScope = (typeof agreementAccessScopes)[number];

export const agreementAccessOutcomes = ["granted", "denied"] as const;

export type AgreementAccessOutcome = (typeof agreementAccessOutcomes)[number];

export interface AgreementDocumentMetadata {
  storageId?: string;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  checksumSha256?: string;
  source?: AgreementDocumentSource;
  uploadedAt?: string;
  uploadedByUserId?: string;
}

export interface AgreementReadModel {
  agreementId: string;
  dealRoomId: string;
  buyerId: string;
  type: AgreementType;
  status: AgreementStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  signedAt?: string;
  canceledAt?: string;
  supersededAt?: string;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  supersessionReason?: SupersessionReason;
  replacedById?: string;
  document?: AgreementDocumentMetadata;
  canAccessDocument: boolean;
  isCurrentGoverning: boolean;
}

export interface AgreementAuditEventReadModel {
  eventId: string;
  agreementId: string;
  dealRoomId: string;
  buyerId: string;
  eventType: AgreementAuditEventType;
  visibility: AgreementAuditVisibility;
  occurredAt: string;
  actorUserId?: string;
  actorRole?: "buyer" | "broker" | "admin";
  previousStatus?: AgreementStatus;
  nextStatus?: AgreementStatus;
  successorAgreementId?: string;
  reason?: string;
  supersessionReason?: SupersessionReason;
  accessScope?: AgreementAccessScope;
  accessOutcome?: AgreementAccessOutcome;
  effectiveStartAt?: string;
  effectiveEndAt?: string;
  document?: AgreementDocumentMetadata;
}

// ───────────────────────────────────────────────────────────────────────────
// Florida contract adapter
// ───────────────────────────────────────────────────────────────────────────

export const CONTRACT_PROVIDER = "form_simplicity" as const;
export const CONTRACT_SIGNATURE_PROVIDER = "sabal_sign" as const;
export const FLORIDA_FAR_BAR_TEMPLATE_KEY =
  "fl_far_bar_residential_purchase" as const;
export const FLORIDA_FAR_BAR_TEMPLATE_VERSION = "2026-01" as const;

export type ContractProvider = typeof CONTRACT_PROVIDER;
export type ContractSignatureProvider = typeof CONTRACT_SIGNATURE_PROVIDER;

export const floridaContractFormKeys = [
  "fl_far_bar_residential_contract",
  "fl_condominium_rider",
  "fl_homeowners_association_addendum",
  "fl_lead_based_paint_disclosure",
] as const;

export type FloridaContractFormKey =
  (typeof floridaContractFormKeys)[number];

export const floridaContractFieldKeys = [
  "streetAddress",
  "City",
  "State",
  "Zip",
  "countyName",
  "countyParcel",
  "legalDescription",
  "Subdivision",
  "yearBuilt",
  "propertyType",
  "listingPrice",
  "associationFees",
  "purchasePrice",
  "purchaseAgreementDate",
  "earnestMoneyDueDate",
  "dueDiligenceDate",
  "earnestMoney",
  "projectedClosingDate",
  "buyerParty1Name",
  "buyerParty1Address",
  "buyerParty1Email",
  "buyerParty1CellPhone",
  "sellerParty1Name",
  "sellerParty1Address",
  "sellerParty1Email",
  "sellerAgentName",
  "sellerBrokerageName",
] as const;

export type FloridaContractFieldKey =
  (typeof floridaContractFieldKeys)[number];

export type FloridaContractFieldValue = string | number | boolean;
export type FloridaContractFieldMap = Partial<
  Record<FloridaContractFieldKey, FloridaContractFieldValue>
>;

export const requiredFloridaContractFields = [
  "streetAddress",
  "City",
  "State",
  "Zip",
  "countyName",
  "purchasePrice",
  "purchaseAgreementDate",
  "earnestMoney",
  "projectedClosingDate",
  "buyerParty1Name",
  "buyerParty1Email",
] as const satisfies ReadonlyArray<FloridaContractFieldKey>;

export interface ContractPartyInput {
  fullName?: string;
  email?: string;
  phone?: string;
  mailingAddress?: string;
}

export interface ContractBrokerInput {
  fullName?: string;
  email?: string;
  phone?: string;
  brokerageName?: string;
  nrdsId?: string;
}

export interface ApprovedOfferContractSource {
  dealRoomId: string;
  offerId: string;
  propertyId: string;
  offerStatus: "approved" | "accepted";
  approvedAt?: string;
  purchasePrice: number;
  earnestMoney?: number;
  closingDate?: string;
  contingencies: string[];
  buyerCredits?: number;
  sellerCredits?: number;
  financingType?: FinancingType;
  property: {
    street?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    folioNumber?: string;
    legalDescription?: string;
    subdivision?: string;
    yearBuilt?: number;
    listPrice?: number;
    hoaFee?: number;
    propertyType?: string;
    listingAgentName?: string;
    listingBrokerage?: string;
  };
  buyer: ContractPartyInput;
  seller?: ContractPartyInput;
  buyerBroker?: ContractBrokerInput;
}

export interface ContractAdapterMissingField {
  field: string;
  label: string;
  reason: string;
}

export interface ContractAdapterWarning {
  code: string;
  message: string;
}

export interface ContractFormSelection {
  formKey: FloridaContractFormKey;
  required: boolean;
  reason: string;
}

export interface FormSimplicityAddTransactionRequest {
  transName: string;
  streetAddress: string;
  propertyType: "R" | "C" | "V" | "F";
  transactionType: "P";
  propertyStatus: "N" | "A" | "P" | "X" | "W" | "R";
}

export interface SabalSignatureRecipient {
  role: "buyer" | "broker";
  name: string;
  email: string;
}

export interface SabalSignatureRequest {
  packageName: string;
  recipients: SabalSignatureRecipient[];
}

export interface ContractAdapterResult {
  templateKey: typeof FLORIDA_FAR_BAR_TEMPLATE_KEY;
  templateVersion: typeof FLORIDA_FAR_BAR_TEMPLATE_VERSION;
  provider: ContractProvider;
  signatureProvider: ContractSignatureProvider;
  status: "ready" | "missing_fields";
  forms: ContractFormSelection[];
  fieldMap: FloridaContractFieldMap;
  missingFields: ContractAdapterMissingField[];
  warnings: ContractAdapterWarning[];
  formSimplicity: {
    addTransaction: FormSimplicityAddTransactionRequest;
    fieldMap: FloridaContractFieldMap;
  };
  sabalSign: SabalSignatureRequest;
}

export interface LegacyFieldValidation {
  valid: boolean;
  missingFields: string[];
  warnings: string[];
}

export interface LegacyAdapterRun {
  offerId: string;
  status: "mapped" | "validation_failed" | "submitted" | "error";
  mappedFieldCount: number;
  missingFields: string[];
  timestamp: string;
}

function isoDate(input: string | undefined, fallback: string): string {
  return (input ?? fallback).slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function joinAddress(
  street: string | undefined,
  unit: string | undefined,
  city: string | undefined,
  state: string | undefined,
  zip: string | undefined,
): string {
  const streetLine = [street, unit].filter(Boolean).join(" ").trim();
  const locality = [city, state].filter(Boolean).join(", ");
  const trailing = [locality, zip].filter(Boolean).join(" ")
    .trim();
  return [streetLine, trailing]
    .filter(Boolean)
    .join(", ");
}

function normalizePropertyType(
  propertyType: string | undefined,
): "R" | "C" | "V" | "F" {
  const normalized = propertyType?.toLowerCase() ?? "";
  if (normalized.includes("commercial")) return "C";
  if (normalized.includes("vacant") || normalized.includes("land")) return "V";
  if (normalized.includes("farm") || normalized.includes("ranch")) return "F";
  return "R";
}

function inferPropertyStatusCode(): "N" {
  return "N";
}

function requiredFieldLabel(
  field: string,
): string {
  switch (field) {
    case "streetAddress":
      return "Property street address";
    case "City":
      return "Property city";
    case "State":
      return "Property state";
    case "Zip":
      return "Property ZIP code";
    case "countyName":
      return "Property county";
    case "purchasePrice":
      return "Purchase price";
    case "purchaseAgreementDate":
      return "Agreement date";
    case "earnestMoney":
      return "Earnest money";
    case "projectedClosingDate":
      return "Projected closing date";
    case "buyerParty1Name":
      return "Buyer name";
    case "buyerParty1Email":
      return "Buyer email";
    default:
      return field;
  }
}

function buildMissingField(
  field: string,
  reason: string,
): ContractAdapterMissingField {
  return {
    field,
    label: requiredFieldLabel(field),
    reason,
  };
}

function determineForms(
  source: ApprovedOfferContractSource,
): ContractFormSelection[] {
  const forms: ContractFormSelection[] = [
    {
      formKey: "fl_far_bar_residential_contract",
      required: true,
      reason: "Primary FAR/BAR residential purchase contract.",
    },
  ];

  const propertyType = source.property.propertyType?.toLowerCase() ?? "";
  if (propertyType.includes("condo")) {
    forms.push({
      formKey: "fl_condominium_rider",
      required: true,
      reason: "Condominium transaction detected from property type.",
    });
  }

  if ((source.property.hoaFee ?? 0) > 0) {
    forms.push({
      formKey: "fl_homeowners_association_addendum",
      required: true,
      reason: "Association fees present on the property record.",
    });
  }

  if (
    typeof source.property.yearBuilt === "number" &&
    source.property.yearBuilt < 1978
  ) {
    forms.push({
      formKey: "fl_lead_based_paint_disclosure",
      required: true,
      reason: "Property year built is before 1978.",
    });
  }

  return forms;
}

export function mapApprovedOfferToFloridaContract(
  source: ApprovedOfferContractSource,
  nowIso: string = new Date().toISOString(),
): ContractAdapterResult {
  const agreementDate = isoDate(source.approvedAt, nowIso);
  const closingDate = isoDate(
    source.closingDate,
    addDays(agreementDate, 30),
  );
  const dueDiligenceDate = source.contingencies.includes("inspection")
    ? addDays(agreementDate, 15)
    : addDays(agreementDate, 5);
  const earnestMoneyDueDate = addDays(agreementDate, 3);
  const inferredFinancingType: FinancingType =
    source.financingType ??
    (source.contingencies.includes("financing") ? "conventional" : "cash");
  const address = joinAddress(
    source.property.street,
    source.property.unit,
    source.property.city,
    source.property.state,
    source.property.zip,
  );

  const fieldMap: FloridaContractFieldMap = {
    streetAddress: source.property.street,
    City: source.property.city,
    State: source.property.state,
    Zip: source.property.zip,
    countyName: source.property.county,
    countyParcel: source.property.folioNumber,
    legalDescription: source.property.legalDescription,
    Subdivision: source.property.subdivision,
    yearBuilt: source.property.yearBuilt,
    propertyType: source.property.propertyType,
    listingPrice: source.property.listPrice,
    associationFees: source.property.hoaFee,
    purchasePrice: source.purchasePrice,
    purchaseAgreementDate: agreementDate,
    earnestMoneyDueDate,
    dueDiligenceDate,
    earnestMoney:
      source.earnestMoney ?? Math.max(1000, Math.round(source.purchasePrice * 0.01)),
    projectedClosingDate: closingDate,
    buyerParty1Name: source.buyer.fullName,
    buyerParty1Address: source.buyer.mailingAddress,
    buyerParty1Email: source.buyer.email,
    buyerParty1CellPhone: source.buyer.phone,
    sellerParty1Name: source.seller?.fullName,
    sellerParty1Address: source.seller?.mailingAddress,
    sellerParty1Email: source.seller?.email,
    sellerAgentName: source.property.listingAgentName,
    sellerBrokerageName: source.property.listingBrokerage,
  };

  const missingFields: ContractAdapterMissingField[] = [];

  for (const field of requiredFloridaContractFields) {
    const value = fieldMap[field];
    if (value === undefined || value === null || value === "") {
      missingFields.push(
        buildMissingField(field, "Field is required before contract handoff."),
      );
    }
  }

  if (!address) {
    missingFields.push(
      buildMissingField(
        "streetAddress",
        "Property address is incomplete and cannot be handed off.",
      ),
    );
  }

  if (source.purchasePrice <= 0) {
    missingFields.push(
      buildMissingField(
        "purchasePrice",
        "Purchase price must be greater than zero.",
      ),
    );
  }

  if (
    source.property.yearBuilt === undefined &&
    normalizePropertyType(source.property.propertyType) === "R"
  ) {
    missingFields.push(
      buildMissingField(
        "yearBuilt",
        "Year built is required to determine whether lead-based paint disclosure applies.",
      ),
    );
  }

  const warnings: ContractAdapterWarning[] = [];
  if (!source.buyer.phone) {
    warnings.push({
      code: "buyer_phone_missing",
      message:
        "Buyer phone is missing; Form Simplicity can proceed, but signature reminders may be weaker.",
    });
  }
  if (
    inferredFinancingType !== "cash" &&
    !source.contingencies.includes("financing")
  ) {
    warnings.push({
      code: "financing_type_without_contingency",
      message:
        "Financing type is set but the offer contingencies do not include financing.",
    });
  }
  if (!source.seller?.fullName) {
    warnings.push({
      code: "seller_name_missing",
      message:
        "Seller party data is not currently populated in buyer-codex and may need ops follow-up inside Form Simplicity.",
    });
  }

  const forms = determineForms(source);
  const packageName = `${address || source.propertyId} • ${source.buyer.fullName ?? "Buyer"} • ${agreementDate}`;
  const recipients: SabalSignatureRecipient[] = [];
  if (source.buyer.fullName && source.buyer.email) {
    recipients.push({
      role: "buyer",
      name: source.buyer.fullName,
      email: source.buyer.email,
    });
  }
  if (source.buyerBroker?.fullName && source.buyerBroker.email) {
    recipients.push({
      role: "broker",
      name: source.buyerBroker.fullName,
      email: source.buyerBroker.email,
    });
  }

  return {
    templateKey: FLORIDA_FAR_BAR_TEMPLATE_KEY,
    templateVersion: FLORIDA_FAR_BAR_TEMPLATE_VERSION,
    provider: CONTRACT_PROVIDER,
    signatureProvider: CONTRACT_SIGNATURE_PROVIDER,
    status: missingFields.length === 0 ? "ready" : "missing_fields",
    forms,
    fieldMap,
    missingFields,
    warnings,
    formSimplicity: {
      addTransaction: {
        transName: packageName,
        streetAddress: source.property.street ?? address,
        propertyType: normalizePropertyType(source.property.propertyType),
        transactionType: "P",
        propertyStatus: inferPropertyStatusCode(),
      },
      fieldMap,
    },
    sabalSign: {
      packageName,
      recipients,
    },
  };
}

export function validateFloridaContractFields(
  fields: FloridaContractFieldMap,
): LegacyFieldValidation {
  const missingFields: string[] = [];
  for (const field of requiredFloridaContractFields) {
    const value = fields[field];
    if (value === undefined || value === null || value === "") {
      missingFields.push(field);
    }
  }

  const warnings: string[] = [];
  const earnestMoney = fields.earnestMoney;
  const purchasePrice = fields.purchasePrice;
  if (typeof earnestMoney === "number" && earnestMoney <= 0) {
    warnings.push("Earnest money is $0 — unusual for FL transactions");
  }
  if (
    typeof earnestMoney === "number" &&
    typeof purchasePrice === "number" &&
    earnestMoney > purchasePrice * 0.1
  ) {
    warnings.push("Earnest money above 10% is unusual for FL transactions");
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
  };
}

export function createLegacyAdapterRun(
  offerId: string,
  fields: FloridaContractFieldMap,
  validation: LegacyFieldValidation,
  timestamp: string = new Date().toISOString(),
): LegacyAdapterRun {
  return {
    offerId,
    status: validation.valid ? "mapped" : "validation_failed",
    mappedFieldCount: Object.values(fields).filter((value) => value !== undefined)
      .length,
    missingFields: validation.missingFields,
    timestamp,
  };
}
