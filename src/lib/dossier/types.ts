import type {
  CaseSynthesisInput,
} from "@/lib/ai/engines/caseSynthesis";
import type {
  CompsInput,
  CompsOutput,
  LeverageInput,
  LeverageOutput,
  OfferOutput,
  PricingInput,
  PricingOutput,
} from "@/lib/ai/engines/types";
import type {
  BuyerDocumentSummary,
  InternalDocumentSummary,
} from "@/lib/dealroom/document-summary";
import type {
  BrowserUseHostedResult,
  BrowserUseReviewState,
  BrowserUseTriggerType,
  ListingAgentProfile,
  PropertyEnrichmentSnapshot,
  PropertyMarketContext,
  PortalEstimate,
  RecentComparableSale,
} from "@/lib/enrichment/types";
import type { NegotiationBriefInputs } from "@/lib/negotiation/types";

export const PROPERTY_DOSSIER_VERSION = "1.1.0";

export const DOSSIER_SOURCE_CATEGORIES = [
  "deterministic_extracted",
  "browser_extracted_interactive",
  "market_baseline_aggregated",
  "document_derived",
  "inferred_model_generated",
] as const;

export type DossierSourceCategory =
  (typeof DOSSIER_SOURCE_CATEGORIES)[number];

export type DossierVisibility = "buyer_safe" | "internal_only";

export const RECOMMENDATION_EVIDENCE_SECTION_KEYS = [
  "pricing",
  "comps",
  "leverage",
  "risk",
  "offer_recommendation",
] as const;

export type RecommendationEvidenceSectionKey =
  (typeof RECOMMENDATION_EVIDENCE_SECTION_KEYS)[number];

export const EVIDENCE_TRACE_DETAIL_LEVELS = [
  "buyer_safe_summary",
  "internal_deep_trace",
] as const;

export type EvidenceTraceDetailLevel =
  (typeof EVIDENCE_TRACE_DETAIL_LEVELS)[number];

export const EVIDENCE_TRACE_STATUSES = [
  "supported",
  "mixed",
  "waiting_on_evidence",
  "conflicting_evidence",
] as const;

export type EvidenceTraceStatus = (typeof EVIDENCE_TRACE_STATUSES)[number];

export const EVIDENCE_GRAPH_NODE_KINDS = [
  "listing_facts",
  "portal_signals",
  "market_context",
  "recent_sales",
  "risk_hooks",
  "documents",
  "browser_verification",
  "enrichment_artifacts",
  "model_output",
  "missing_evidence",
  "conflicting_evidence",
] as const;

export type EvidenceGraphNodeKind = (typeof EVIDENCE_GRAPH_NODE_KINDS)[number];

export const RECOMMENDATION_CONFIDENCE_BANDS = [
  "high",
  "medium",
  "low",
  "waiting",
] as const;

export type RecommendationConfidenceBand =
  (typeof RECOMMENDATION_CONFIDENCE_BANDS)[number];

export const RECOMMENDATION_CONFIDENCE_REASON_CODES = [
  "verified_listing_facts",
  "portal_estimate_consensus",
  "market_context_available",
  "recent_sales_available",
  "risk_facts_available",
  "document_findings_available",
  "browser_verification_available",
  "model_output_available",
  "missing_portal_estimates",
  "sparse_portal_estimates",
  "missing_market_context",
  "missing_recent_sales",
  "insufficient_recent_sales",
  "missing_listing_history",
  "missing_risk_facts",
  "missing_documents",
  "missing_pricing_output",
  "missing_comps_output",
  "missing_leverage_output",
  "missing_offer_output",
  "conflicting_portal_estimates",
  "conflicting_browser_fields",
  "pricing_requires_review",
  "offer_requires_pricing_and_leverage",
  "inference_heavy",
] as const;

export type RecommendationConfidenceReasonCode =
  (typeof RECOMMENDATION_CONFIDENCE_REASON_CODES)[number];

export interface DossierSourceRef {
  label: string;
  category: DossierSourceCategory;
  citation?: string;
  capturedAt?: string;
}

export interface DossierFreshness {
  lastRefreshedAt: string | null;
  fingerprint: string;
  replayKey: string;
}

export interface DossierSection<T> {
  key: string;
  title: string;
  visibility: DossierVisibility;
  sourceCategories: DossierSourceCategory[];
  confidence: number;
  freshness: DossierFreshness;
  provenance: DossierSourceRef[];
  data: T;
}

export interface EvidenceGraphNode {
  id: string;
  label: string;
  summary: string;
  kind: EvidenceGraphNodeKind;
  sourceCategory?: DossierSourceCategory;
  confidence: number | null;
  internal?: {
    sourceSectionKey?: PropertyDossierSectionKey;
    engineType?: DossierLatestEngineOutput["engineType"];
    citations: string[];
    capturedAt?: string;
    provenance: DossierSourceRef[];
  };
}

export interface BuyerSafeEvidenceSummary {
  detailLevel: "buyer_safe_summary";
  headline: string;
  supportLabels: string[];
  caution: string | null;
  status: EvidenceTraceStatus;
  dependsOnInference: boolean;
}

export interface RecommendationConfidenceInputs {
  score: number | null;
  band: RecommendationConfidenceBand;
  sourceCategories: DossierSourceCategory[];
  supportLabels: string[];
  missingLabels: string[];
  conflictingLabels: string[];
  dependsOnInference: boolean;
  reasonCodes?: RecommendationConfidenceReasonCode[];
}

export interface InternalRecommendationEvidenceTrace {
  detailLevel: "internal_deep_trace";
  summary: string;
  sourceCategories: DossierSourceCategory[];
  reasonCodes: RecommendationConfidenceReasonCode[];
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
}

export interface RecommendationEvidenceSection {
  key: RecommendationEvidenceSectionKey;
  title: string;
  availableDetailLevels: EvidenceTraceDetailLevel[];
  status: EvidenceTraceStatus;
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
  buyerSummary: BuyerSafeEvidenceSummary;
  confidenceInputs: RecommendationConfidenceInputs;
  internalTrace?: InternalRecommendationEvidenceTrace;
}

export interface PropertyEvidenceGraphSections {
  pricing: RecommendationEvidenceSection;
  comps: RecommendationEvidenceSection;
  leverage: RecommendationEvidenceSection;
  risk: RecommendationEvidenceSection;
  offer_recommendation: RecommendationEvidenceSection;
}

export interface PropertyEvidenceGraph {
  graphVersion: string;
  fingerprint: string;
  replayKey: string;
  sectionKeys: RecommendationEvidenceSectionKey[];
  nodes: Record<string, EvidenceGraphNode>;
  sections: PropertyEvidenceGraphSections;
}

export interface DossierSourceListingRecord {
  sourcePlatform: string;
  sourceUrl: string;
  status: string;
  extractedAt: string;
}

export interface DossierPropertyRecord {
  _id: string;
  canonicalId: string;
  mlsNumber?: string;
  folioNumber?: string;
  address: {
    street: string;
    unit?: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
    formatted?: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  zip?: string;
  zillowId?: string;
  redfinId?: string;
  realtorId?: string;
  status: string;
  listPrice?: number;
  listDate?: string;
  daysOnMarket?: number;
  cumulativeDom?: number;
  propertyType?: string;
  beds?: number;
  bathsFull?: number;
  bathsHalf?: number;
  sqftLiving?: number;
  sqftTotal?: number;
  lotSize?: number;
  yearBuilt?: number;
  stories?: number;
  garageSpaces?: number;
  pool?: boolean;
  waterfrontType?: string;
  view?: string;
  constructionType?: string;
  roofYear?: number;
  roofMaterial?: string;
  impactWindows?: boolean;
  stormShutters?: boolean;
  floodZone?: string;
  hurricaneZone?: string;
  seniorCommunity?: boolean;
  shortTermRentalAllowed?: boolean;
  gatedCommunity?: boolean;
  hoaFee?: number;
  hoaFrequency?: string;
  taxAnnual?: number;
  taxAssessedValue?: number;
  listingAgentName?: string;
  listingBrokerage?: string;
  listingAgentPhone?: string;
  description?: string;
  photoUrls?: string[];
  photoCount?: number;
  virtualTourUrl?: string;
  elementarySchool?: string;
  middleSchool?: string;
  highSchool?: string;
  schoolDistrict?: string;
  subdivision?: string;
  neighborhood?: string;
  buildingName?: string;
  zestimate?: number;
  redfinEstimate?: number;
  realtorEstimate?: number;
  sourcePlatform: string;
  extractedAt: string;
  updatedAt: string;
  wasRelisted?: boolean;
  wasWithdrawn?: boolean;
  wasPendingFellThrough?: boolean;
  priceReductions?: Array<{ amount: number; date: string }>;
}

export interface DossierBrowserRun {
  jobId: string;
  runState: string;
  reviewState: BrowserUseReviewState | "pending";
  trigger?: BrowserUseTriggerType;
  sourceUrl?: string;
  portal?: string;
  note?: string;
  parseConfidence?: number;
  minimumParseConfidence?: number;
  missingCriticalFields: string[];
  conflictingFields: string[];
  confidence?: number;
  citations: Array<{ url: string; label?: string }>;
  trace: BrowserUseHostedResult["trace"];
  canonicalFields: Record<string, unknown>;
  fieldMetadata: BrowserUseHostedResult["fieldMetadata"];
  mergeProvenance: Record<string, unknown>;
  conflicts: Array<Record<string, unknown>>;
  requestedAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface DossierLatestEngineOutput<TOutput = unknown> {
  outputId: string;
  engineType: "pricing" | "comps" | "leverage" | "offer";
  promptVersion?: string;
  reviewState?: string;
  confidence: number;
  citations: string[];
  generatedAt: string;
  inputSnapshot?: string;
  output: TOutput | null;
}

export interface PropertyFactsSectionData {
  canonicalId: string;
  sourcePlatform: string;
  sourceListings: DossierSourceListingRecord[];
  facts: DossierPropertyRecord;
}

export interface PortalSignalsSectionData {
  estimates: PortalEstimate[];
  latestByPortal: Partial<Record<PortalEstimate["portal"], PortalEstimate>>;
  consensusValue: number | null;
  spread: number | null;
}

export interface MarketContextSectionData {
  marketContext: PropertyMarketContext | null;
}

export interface RiskHooksSectionData {
  floodZone?: string;
  hurricaneZone?: string;
  hoaFee?: number;
  hoaFrequency?: string;
  taxAnnual?: number;
  taxAssessedValue?: number;
  yearBuilt?: number;
  roofYear?: number;
  roofMaterial?: string;
  impactWindows?: boolean;
  stormShutters?: boolean;
  constructionType?: string;
  gatedCommunity?: boolean;
  seniorCommunity?: boolean;
  shortTermRentalAllowed?: boolean;
}

export interface BuyerDocumentSectionData {
  scope: "property" | "deal_room";
  available: boolean;
  summaries: BuyerDocumentSummary[];
}

export interface InternalDocumentSectionData {
  scope: "property" | "deal_room";
  available: boolean;
  summaries: InternalDocumentSummary[];
}

export interface BrowserUseSectionData {
  runs: DossierBrowserRun[];
}

export interface EnrichmentArtifactsSectionData {
  snapshots: PropertyEnrichmentSnapshot[];
  listingAgents: ListingAgentProfile[];
}

export interface DownstreamInputsSectionData {
  engineInputs: {
    pricing: PricingInput;
    comps: CompsInput;
    leverage: LeverageInput;
  };
  caseSynthesis: CaseSynthesisInput;
  negotiationBrief: NegotiationBriefInputs;
}

export interface LatestOutputsSectionData {
  pricing?: DossierLatestEngineOutput<PricingOutput>;
  comps?: DossierLatestEngineOutput<CompsOutput>;
  leverage?: DossierLatestEngineOutput<LeverageOutput>;
  offer?: DossierLatestEngineOutput<OfferOutput>;
}

export interface PropertyDossierSections {
  propertyFacts: DossierSection<PropertyFactsSectionData>;
  portalSignals: DossierSection<PortalSignalsSectionData>;
  marketContext: DossierSection<MarketContextSectionData>;
  recentSales: DossierSection<RecentComparableSale[]>;
  riskHooks: DossierSection<RiskHooksSectionData>;
  documents: DossierSection<BuyerDocumentSectionData>;
  documentReview: DossierSection<InternalDocumentSectionData>;
  browserUse: DossierSection<BrowserUseSectionData>;
  enrichmentArtifacts: DossierSection<EnrichmentArtifactsSectionData>;
  downstreamInputs: DossierSection<DownstreamInputsSectionData>;
  latestOutputs: DossierSection<LatestOutputsSectionData>;
}

export type PropertyDossierSectionKey = keyof PropertyDossierSections;

export interface PropertyDossier {
  propertyId: string;
  canonicalId: string;
  compositionVersion: string;
  generatedAt: string;
  lastSourceUpdatedAt: string | null;
  fingerprint: string;
  replayKey: string;
  buyerSafeSectionKeys: PropertyDossierSectionKey[];
  internalSectionKeys: PropertyDossierSectionKey[];
  sections: PropertyDossierSections;
  evidenceGraph: PropertyEvidenceGraph;
}

export interface DossierBuildInput {
  generatedAt: string;
  property: DossierPropertyRecord;
  sourceListings: DossierSourceListingRecord[];
  marketContext: PropertyMarketContext | null;
  portalEstimates: PortalEstimate[];
  recentSales: RecentComparableSale[];
  browserUseRuns: DossierBrowserRun[];
  snapshots: PropertyEnrichmentSnapshot[];
  listingAgents: ListingAgentProfile[];
  documentBuyerSummaries?: BuyerDocumentSummary[];
  documentInternalSummaries?: InternalDocumentSummary[];
  latestOutputs?: LatestOutputsSectionData;
}
