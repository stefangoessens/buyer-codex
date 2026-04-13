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
  sqft: number;
  wasRelisted?: boolean;
  wasWithdrawn?: boolean;
  wasPendingFellThrough?: boolean;
  listingAgentAvgDom?: number;
  listingAgentAvgSaleToList?: number;
}

export interface LeverageSignal {
  name: string;
  value: number | string;
  marketReference: number | string;
  delta: number;
  confidence: number;
  citation: string;
  direction: "bullish" | "bearish" | "neutral";
}

export interface LeverageOutput {
  score: number; // 0-100, higher = more seller pressure
  signals: LeverageSignal[];
  overallConfidence: number;
  signalCount: number;
}

// ═══ Cost Engine Types ═══

export interface CostAssumptions {
  interestRate: number;       // e.g., 0.065 for 6.5%
  downPaymentPct: number;     // e.g., 0.20 for 20%
  propertyTaxRate: number;    // e.g., 0.0185 for FL avg
  maintenancePct: number;     // e.g., 0.01 for 1% of value/yr
  pmiRate: number;            // e.g., 0.005 for 0.5%/yr
  closingCostPct: number;     // e.g., 0.03 for 3%
}

export interface CostInput {
  purchasePrice: number;
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
  assumptions?: Partial<CostAssumptions>;
}

export interface CostLineItem {
  category: string;
  label: string;
  monthlyLow: number;
  monthlyMid: number;
  monthlyHigh: number;
  annualMid: number;
  source: "fact" | "assumption" | "estimate";
  notes: string;
}

export interface CostOutput {
  lineItems: CostLineItem[];
  totalMonthlyLow: number;
  totalMonthlyMid: number;
  totalMonthlyHigh: number;
  totalAnnual: number;
  upfrontCosts: {
    downPayment: number;
    closingCosts: number;
    total: number;
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

/** Calibration record for accuracy tracking */
export interface CalibrationRecord {
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
  daysToAccept: number | null;
  countersMade: number;
  acceptedAt: string;
  promptVersion: string;
  modelId: string;
  recordedAt: string;
}
