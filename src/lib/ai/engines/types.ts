/** Input to the pricing engine */
export interface PricingInput {
  propertyId: string;
  listPrice: number;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  propertyType: string;
  // Portal estimates (any may be absent)
  zestimate?: number;
  redfinEstimate?: number;
  realtorEstimate?: number;
  // Neighborhood context
  neighborhoodMedianPsf?: number;
  compAvgPsf?: number;
}

/** Single price point in the output */
export interface PricePoint {
  value: number;
  deltaVsListPrice: number; // percentage
  deltaVsConsensus: number; // percentage
  deltaVsNeighborhoodMedian?: number | null; // percentage
  deltaVsCompAverage?: number | null; // percentage
  confidence: number; // 0-1
}

export type PricingReviewReason =
  | "estimate_disagreement"
  | "sparse_estimates"
  | "missing_estimates";

export interface PricingReviewFallback {
  reviewRequired: boolean;
  reasons: PricingReviewReason[];
  summary: string | null;
}

/** Full pricing engine output */
export interface PricingOutput {
  fairValue: PricePoint;
  likelyAccepted: PricePoint;
  strongOpener: PricePoint;
  walkAway: PricePoint;
  consensusEstimate: number;
  estimateSpread: number; // std dev / mean — high = low confidence
  estimateSources: string[]; // which estimates were available
  overallConfidence: number;
  marketReferences?: {
    listPrice: number;
    consensusEstimate: number;
    neighborhoodMedianPrice: number | null;
    compAveragePrice: number | null;
  };
  reviewFallback?: PricingReviewFallback;
}

// ═══ Comps Engine Types ═══

export const COMP_SOURCE_PLATFORMS = ["redfin", "zillow", "realtor"] as const;

export type CompSourcePlatform = (typeof COMP_SOURCE_PLATFORMS)[number];

export type CompCondition = "renovated" | "original" | "unknown";

export type CompSelectionBasis = "subdivision" | "zip" | "school_zone";

export interface CompSourceAttribution {
  portal: CompSourcePlatform;
  citation: string;
  qualityScore: number;
  soldPrice: number;
  soldDate: string;
  selected: boolean;
}

export interface CompConflict {
  field: "soldPrice";
  note: string;
  chosenPortal: CompSourcePlatform;
  values: Array<{
    portal: CompSourcePlatform;
    citation: string;
    value: number;
  }>;
}

export interface CompAdjustmentSummary {
  bedsDelta: number;
  bathsDelta: number;
  sqftDelta: number;
  yearBuiltDelta: number;
  lotSizeDelta?: number;
  garageSpacesDelta?: number;
  locationMatch: CompSelectionBasis | "broader";
  locationScore: number;
}

/** Comparable property candidate from sold listings */
export interface CompCandidate {
  canonicalId: string;
  address: string;
  soldPrice: number;
  soldDate: string;
  listPrice?: number;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSize?: number;
  propertyType: string;
  waterfront?: boolean;
  pool?: boolean;
  hoaFee?: number;
  subdivision?: string;
  schoolDistrict?: string;
  zip: string;
  sourcePlatform: string;
  sourceCitation?: string;
  sourceQualityScore?: number;
  sourcePlatforms?: CompSourcePlatform[];
  sourceCitations?: CompSourceAttribution[];
  conflicts?: CompConflict[];
  garageSpaces?: number;
  condition?: CompCondition;
  dom?: number;
}

/** Subject property for comps comparison */
export interface CompsSubject {
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotSize?: number;
  propertyType: string;
  waterfront?: boolean;
  pool?: boolean;
  hoaFee?: number;
  subdivision?: string;
  schoolDistrict?: string;
  zip: string;
  listPrice: number;
  garageSpaces?: number;
  condition?: CompCondition;
}

export interface CompsInput {
  subject: CompsSubject;
  candidates: CompCandidate[];
  maxComps?: number;
}

export interface CompResult {
  candidate: CompCandidate;
  similarityScore: number;
  explanation: string;
  sourceCitation: string;
  sourceCitations?: CompSourceAttribution[];
  adjustments?: CompAdjustmentSummary;
}

export interface CompsAggregates {
  medianSoldPrice: number;
  medianPricePerSqft: number;
  medianDom: number;
  medianSaleToListRatio: number;
}

export interface CompsOutput {
  comps: CompResult[];
  aggregates: CompsAggregates;
  selectionBasis: CompSelectionBasis;
  selectionReason: string;
  totalCandidates: number;
  dedupedCandidates: number;
}

// ═══ Leverage Engine Types ═══

export interface LeverageInput {
  propertyId: string;
  listPrice: number;
  daysOnMarket: number;
  description?: string;
  priceReductions?: Array<{ amount: number; date: string }>;
  neighborhoodMedianDom?: number;
  neighborhoodMedianPsf?: number;
  neighborhoodSalesVelocity?: number;
  neighborhoodInventoryCount?: number;
  neighborhoodMarketTrajectory?: "rising" | "flat" | "falling";
  neighborhoodMedianSaleToListRatio?: number;
  neighborhoodMedianPriceCutFrequency?: number;
  neighborhoodMedianReductionPct?: number;
  sqft: number;
  wasRelisted?: boolean;
  wasWithdrawn?: boolean;
  wasPendingFellThrough?: boolean;
  listingAgentAvgDom?: number;
  listingAgentAvgSaleToList?: number;
  listingAgentPriceCutFrequency?: number;
  sellerEquityPct?: number;
  occupancyStatus?: "owner_occupied" | "tenant_occupied" | "vacant";
}

export interface LeverageSignal {
  name: string;
  value: number | string;
  marketReference: number | string;
  delta: number;
  confidence: number;
  citation: string;
  direction: "bullish" | "bearish" | "neutral";
  explanation?: string;
}

export interface LeverageOutput {
  score: number; // 0-100, higher = more seller pressure
  signals: LeverageSignal[];
  overallConfidence: number;
  signalCount: number;
  summary?: string;
  rationale?: string[];
}

// ═══ Cost Engine Types ═══

export interface CostAssumptions {
  interestRate: number;       // e.g., 0.065 for 6.5%
  downPaymentPct: number;     // e.g., 0.20 for 20%
  propertyTaxRate: number;    // e.g., 0.0185 for FL avg
  maintenancePct: number;     // e.g., 0.01 for 1% of value/yr
  pmiRate: number;            // e.g., 0.005 for 0.5%/yr
  closingCostPct: number;     // e.g., 0.03 for 3%
  closingCostRangeSpreadPct: number; // e.g., 0.15 for +/- 15%
  floridaHomesteadExemptionValue: number; // e.g., 50000
  floridaHomesteadNonSchoolPortion: number; // e.g., 0.7 for second $25k
}

export interface CostInput {
  purchasePrice: number;
  state?: string;
  county?: string;
  ownerOccupied?: boolean;
  applyHomesteadExemption?: boolean;
  taxAnnual?: number;
  taxAssessedValue?: number;
  hoaFee?: number;
  hoaFrequency?: string;
  roofYear?: number;
  yearBuilt: number;
  impactWindows?: boolean;
  stormShutters?: boolean;
  constructionType?: string;
  floodZone?: string;
  waterfrontType?: string;
  coastDistanceMiles?: number;
  elevationFeet?: number;
  assumptions?: Partial<CostAssumptions>;
}

export interface CostRange {
  low: number;
  mid: number;
  high: number;
}

export interface CostLineItem {
  category: string;
  label: string;
  monthlyLow: number;
  monthlyMid: number;
  monthlyHigh: number;
  annualLow: number;
  annualMid: number;
  annualHigh: number;
  source: "fact" | "assumption" | "estimate";
  notes: string;
  basis?: Record<string, string | number | boolean>;
}

export interface CostOutput {
  lineItems: CostLineItem[];
  totalMonthlyLow: number;
  totalMonthlyMid: number;
  totalMonthlyHigh: number;
  totalAnnual: number;
  totalAnnualLow: number;
  totalAnnualHigh: number;
  annualRange: CostRange;
  upfrontCosts: {
    downPayment: number;
    closingCosts: number;
    total: number;
    closingCostsRange: CostRange;
    totalRange: CostRange;
  };
  assumptions: CostAssumptions;
  disclaimers: string[];
}

// ═══ Offer Engine Types ═══

export interface OfferInput {
  listPrice: number;
  fairValue?: number;
  leverageScore?: number; // 0-100 from leverage engine
  buyerMaxBudget?: number;
  daysOnMarket?: number;
  competingOffers?: number;
  isNewConstruction?: boolean;
  sellerMotivated?: boolean;
}

export interface OfferScenario {
  name: string;
  price: number;
  priceVsListPct: number;
  earnestMoney: number;
  closingDays: number;
  contingencies: string[];
  competitivenessScore: number; // 0-100
  riskLevel: "low" | "medium" | "high";
  explanation: string;
}

export interface OfferOutput {
  scenarios: OfferScenario[];
  recommendedIndex: number;
  inputSummary: string;
  refreshable: boolean;
}

// ═══ Calibration ═══

export const CONFIDENCE_BUCKETS = ["low", "medium", "high"] as const;

export type ConfidenceBucket = (typeof CONFIDENCE_BUCKETS)[number];

export const CALIBRATION_CONSUMERS = [
  "confidence",
  "telemetry",
  "override_learning",
] as const;

export type CalibrationConsumer = (typeof CALIBRATION_CONSUMERS)[number];

export const ADJUDICATION_CALIBRATION_TARGETS = [
  "confidence",
  "recommendation",
] as const;

export type AdjudicationCalibrationTarget =
  (typeof ADJUDICATION_CALIBRATION_TARGETS)[number];

export const ADJUDICATION_CONFIDENCE_SIGNALS = [
  "review_required",
  "confidence_overstated",
] as const;

export type AdjudicationConfidenceSignal =
  (typeof ADJUDICATION_CONFIDENCE_SIGNALS)[number];

export const ADJUDICATION_RECOMMENDATION_SIGNALS = [
  "not_applicable",
  "recommendation_adjusted",
  "recommendation_overridden",
] as const;

export type AdjudicationRecommendationSignal =
  (typeof ADJUDICATION_RECOMMENDATION_SIGNALS)[number];

export const ADJUDICATION_REVISION_TYPES = [
  "rationale_only",
  "buyer_explanation_only",
  "reviewed_conclusion",
] as const;

export type AdjudicationRevisionType =
  (typeof ADJUDICATION_REVISION_TYPES)[number];

export const ADJUDICATION_LINKED_CLAIM_TOPICS = [
  "pricing",
  "comps",
  "days_on_market",
  "leverage",
  "offer_recommendation",
] as const;

export type AdjudicationLinkedClaimTopic =
  (typeof ADJUDICATION_LINKED_CLAIM_TOPICS)[number];

export const PRICING_ERROR_CATEGORIES = [
  "within_expected_range",
  "accepted_below_strong_opener",
  "accepted_below_fair_value",
  "accepted_above_likely_accepted",
  "accepted_above_walk_away",
  "confidence_overstated",
  "required_heavy_negotiation",
] as const;

export type PricingCalibrationErrorCategory =
  (typeof PRICING_ERROR_CATEGORIES)[number];

export const RECOMMENDATION_OUTCOMES = [
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
] as const;

export type RecommendationBacktestOutcome =
  (typeof RECOMMENDATION_OUTCOMES)[number];

export const RECOMMENDATION_ERROR_CATEGORIES = [
  "followed_recommendation",
  "opened_above_recommendation",
  "opened_below_recommendation",
  "contingencies_mismatch",
  "followed_but_unsuccessful",
  "accepted_after_override",
  "confidence_overstated",
] as const;

export type RecommendationBacktestErrorCategory =
  (typeof RECOMMENDATION_ERROR_CATEGORIES)[number];

export interface CalibrationBucketSummary {
  bucket: ConfidenceBucket;
  totalRecords: number;
  averageConfidence: number | null;
  averageRealizedScore: number | null;
  averageConfidenceDelta: number | null;
}

/** Pricing calibration record for accuracy tracking against accepted deals. */
export interface PricingCalibrationRecord {
  propertyId: string;
  engineOutputId: string;
  predictedFairValue: number;
  predictedLikelyAccepted: number;
  predictedStrongOpener: number;
  predictedWalkAway: number;
  actualAcceptedPrice: number;
  errorFairValue: number; // percentage
  errorLikelyAccepted: number; // percentage
  errorStrongOpener: number; // percentage
  errorWalkAway: number; // percentage
  meanAbsoluteError: number; // percentage
  highError: boolean;
  overallConfidence: number;
  realizedScore: number;
  confidenceDelta: number;
  withinPredictedRange: boolean;
  primaryErrorCategory: PricingCalibrationErrorCategory;
  errorCategories: PricingCalibrationErrorCategory[];
  daysToAccept: number | null;
  countersMade: number;
  acceptedAt: string;
  promptVersion: string;
  modelId: string;
  recordedAt: string;
}

/** Backward-compatible alias for existing pricing calibration call sites. */
export type CalibrationRecord = PricingCalibrationRecord;

/** Recommendation backtest record for advisory outputs against later actions. */
export interface RecommendationBacktestRecord {
  propertyId: string;
  dealRoomId: string;
  offerId: string;
  propertyCaseId: string;
  synthesisVersion: string;
  recommendationGeneratedAt: string;
  recommendationConfidence: number;
  recommendedOpeningPrice: number;
  recommendedRiskLevel: OfferScenario["riskLevel"];
  recommendedContingencies: string[];
  sourceOutputIds: string[];
  actualOfferPrice: number;
  actualAcceptedPrice: number | null;
  actualOutcome: RecommendationBacktestOutcome;
  actualContingencies: string[];
  priceDeltaPct: number;
  contingencyMatchRatio: number;
  adoptionScore: number;
  followedRecommendation: boolean;
  realizedScore: number;
  confidenceDelta: number;
  primaryErrorCategory: RecommendationBacktestErrorCategory;
  errorCategories: RecommendationBacktestErrorCategory[];
  countersMade: number;
  outcomeRecordedAt: string;
}

export interface PricingCalibrationSummary {
  kind: "pricing";
  totalRecords: number;
  meanAbsoluteError: number | null;
  highErrorRate: number | null;
  withinPredictedRangeRate: number | null;
  averageDaysToAccept: number | null;
  averageCountersMade: number | null;
  confidenceBuckets: CalibrationBucketSummary[];
  categoryCounts: Array<{
    category: PricingCalibrationErrorCategory;
    count: number;
  }>;
  consumers: CalibrationConsumer[];
}

export interface RecommendationCalibrationSummary {
  kind: "recommendation";
  totalRecords: number;
  followedRecommendationRate: number | null;
  acceptedOutcomeRate: number | null;
  acceptedWhenFollowedRate: number | null;
  averagePriceDeltaPct: number | null;
  averageContingencyMatchRatio: number | null;
  averageAdoptionScore: number | null;
  confidenceBuckets: CalibrationBucketSummary[];
  categoryCounts: Array<{
    category: RecommendationBacktestErrorCategory;
    count: number;
  }>;
  consumers: CalibrationConsumer[];
}

export interface AdjudicationCalibrationRecord {
  propertyId: string;
  dealRoomId: string | null;
  propertyCaseId: string | null;
  engineOutputId: string;
  adjudicationId: string;
  engineType: string;
  action: "adjust" | "override";
  visibility: "buyer_safe" | "internal_only";
  reasonCategory: string | null;
  outputConfidence: number;
  confidenceBucket: ConfidenceBucket;
  promptVersion: string;
  modelId: string;
  reviewStateBefore: "pending" | "approved" | "rejected";
  reviewStateAfter: "pending" | "approved" | "rejected";
  confidenceSignal: AdjudicationConfidenceSignal;
  recommendationSignal: AdjudicationRecommendationSignal;
  revisionType: AdjudicationRevisionType;
  calibrationTargets: AdjudicationCalibrationTarget[];
  linkedClaimCount: number;
  linkedClaimTopics: AdjudicationLinkedClaimTopic[];
  recommendationLinkedClaimCount: number;
  recommendationRelevant: boolean;
  reviewedConclusionPresent: boolean;
  buyerExplanationPresent: boolean;
  internalNotesPresent: boolean;
  generatedAt: string;
  adjudicatedAt: string;
  reviewLatencyMs: number;
}

export interface AdjudicationCalibrationSummary {
  kind: "adjudication_calibration";
  target: AdjudicationCalibrationTarget | "all";
  totalRecords: number;
  uniqueOutputs: number;
  averageOutputConfidence: number | null;
  internalOnlyRate: number | null;
  reviewedConclusionRate: number | null;
  recommendationRelevantRate: number | null;
  confidenceBuckets: CalibrationBucketSummary[];
  engineTypeCounts: Array<{
    engineType: string;
    count: number;
  }>;
  reasonCategoryCounts: Array<{
    reasonCategory: string;
    count: number;
  }>;
  actionCounts: Array<{
    action: AdjudicationCalibrationRecord["action"];
    count: number;
  }>;
  confidenceSignalCounts: Array<{
    signal: AdjudicationConfidenceSignal;
    count: number;
  }>;
  recommendationSignalCounts: Array<{
    signal: AdjudicationRecommendationSignal;
    count: number;
  }>;
  revisionTypeCounts: Array<{
    revisionType: AdjudicationRevisionType;
    count: number;
  }>;
  linkedClaimTopicCounts: Array<{
    topic: AdjudicationLinkedClaimTopic;
    count: number;
  }>;
  consumers: CalibrationConsumer[];
}

export type CalibrationSummary =
  | PricingCalibrationSummary
  | RecommendationCalibrationSummary
  | AdjudicationCalibrationSummary;
