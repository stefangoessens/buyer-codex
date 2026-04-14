export const FILE_ANALYSIS_SNAPSHOT_VERSION = "file_analysis/v1" as const;

export const FILE_ANALYSIS_JOB_STATUSES = [
  "queued",
  "running",
  "review_required",
  "completed",
  "failed",
  "resolved",
] as const;

export type FileAnalysisJobStatus = (typeof FILE_ANALYSIS_JOB_STATUSES)[number];

export type FileAnalysisDocType =
  | "unknown"
  | "seller_disclosure"
  | "hoa_document"
  | "inspection_report"
  | "title_commitment"
  | "survey"
  | "other";

export type FileAnalysisSeverity =
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type FileAnalysisRule =
  | "roof_age_insurability"
  | "hoa_reserves_adequate"
  | "sirs_inspection_status"
  | "flood_zone_risk"
  | "permit_irregularity"
  | "lien_or_encumbrance";

export interface FileAnalysisCitation {
  pageNumber?: number;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
}

export interface FileAnalysisPageClassification {
  pageNumber: number;
  docType: Exclude<FileAnalysisDocType, "unknown">;
  confidence: number;
}

export interface FileAnalysisFinding {
  rule: FileAnalysisRule;
  severity: FileAnalysisSeverity;
  label: string;
  summary: string;
  confidence: number;
  requiresReview: boolean;
  citation?: FileAnalysisCitation;
  observedData?: Record<string, unknown>;
}

export interface FileAnalysisFacts {
  docType: Exclude<FileAnalysisDocType, "unknown">;
  classifierConfidence: number;
  effectiveDate?: string;
  roofAgeYears?: number;
  roofReplacementYear?: number;
  floodZone?: string;
  knownLeaks?: boolean;
  priorClaimsCount?: number;
  permitsDisclosed?: "yes" | "no" | "unknown";
  unpermittedWorkMentioned?: boolean;
  hoaReserveBalance?: number;
  hoaAnnualBudget?: number;
  hoaSpecialAssessments?: Array<{ amount: number; purpose: string }>;
  hoaReserveStudyDate?: string;
  buildingYearBuilt?: number;
  buildingStories?: number;
  milestoneInspectionDate?: string;
  sirsCompletedDate?: string;
  titleExceptions?: string[];
  lienCount?: number;
  majorDefectCount?: number;
  recommendedRepairsCount?: number;
}

export interface FileAnalysisResult {
  docType: Exclude<FileAnalysisDocType, "unknown">;
  facts: FileAnalysisFacts;
  findings: FileAnalysisFinding[];
  overallSeverity: FileAnalysisSeverity;
  overallConfidence: number;
  requiresBrokerReview: boolean;
  plainEnglishSummary: string;
  buyerFacts: string[];
  pageClassifications: FileAnalysisPageClassification[];
  promptKey: string;
  promptVersion: string;
  engineVersion: string;
}

export type FileFactProjection =
  | {
      factSlug: string;
      valueKind: "numeric";
      valueNumeric: number;
      valueNumericUnit?: string;
      confidence?: number;
      internalOnly: boolean;
      citation?: FileAnalysisCitation;
    }
  | {
      factSlug: string;
      valueKind: "text";
      valueText: string;
      confidence?: number;
      internalOnly: boolean;
      citation?: FileAnalysisCitation;
    }
  | {
      factSlug: string;
      valueKind: "date";
      valueDate: string;
      confidence?: number;
      internalOnly: boolean;
      citation?: FileAnalysisCitation;
    }
  | {
      factSlug: string;
      valueKind: "boolean";
      valueBoolean: boolean;
      confidence?: number;
      internalOnly: boolean;
      citation?: FileAnalysisCitation;
    }
  | {
      factSlug: string;
      valueKind: "enum";
      valueEnum: string;
      valueEnumAllowed: string[];
      confidence?: number;
      internalOnly: boolean;
      citation?: FileAnalysisCitation;
    };

export interface FileAnalysisSnapshot {
  schemaVersion: typeof FILE_ANALYSIS_SNAPSHOT_VERSION;
  analysis: FileAnalysisResult;
  factProjections: FileFactProjection[];
}

export function assertAllowedJobTransition(
  current: FileAnalysisJobStatus,
  next: FileAnalysisJobStatus,
): void {
  const transitions: Record<FileAnalysisJobStatus, FileAnalysisJobStatus[]> = {
    queued: ["running"],
    running: ["failed", "completed", "review_required"],
    failed: ["queued", "running"],
    review_required: ["resolved"],
    completed: [],
    resolved: [],
  };

  if (!transitions[current].includes(next)) {
    throw new Error(`Illegal file analysis transition "${current}" -> "${next}"`);
  }
}

export function deriveJobOutcome(
  analysis: Pick<FileAnalysisResult, "findings" | "requiresBrokerReview">,
): {
  requiresBrokerReview: boolean;
  nextStatus: Extract<FileAnalysisJobStatus, "completed" | "review_required">;
} {
  const requiresBrokerReview =
    analysis.requiresBrokerReview ||
    analysis.findings.some((finding) => finding.requiresReview);
  return {
    requiresBrokerReview,
    nextStatus: requiresBrokerReview ? "review_required" : "completed",
  };
}

export function buildFactProjections(
  analysis: Pick<FileAnalysisResult, "facts">,
): FileFactProjection[] {
  const { facts } = analysis;
  const projections: FileFactProjection[] = [];
  const sharedConfidence = facts.classifierConfidence;

  const pushNumeric = (
    factSlug: string,
    value: number | undefined,
    unit?: string,
  ) => {
    if (typeof value !== "number" || Number.isNaN(value)) return;
    projections.push({
      factSlug,
      valueKind: "numeric",
      valueNumeric: value,
      valueNumericUnit: unit,
      confidence: sharedConfidence,
      internalOnly: false,
    });
  };

  const pushText = (factSlug: string, value: string | undefined) => {
    if (typeof value !== "string" || value.length === 0) return;
    projections.push({
      factSlug,
      valueKind: "text",
      valueText: value,
      confidence: sharedConfidence,
      internalOnly: false,
    });
  };

  const pushDate = (factSlug: string, value: string | undefined) => {
    if (typeof value !== "string" || value.length === 0) return;
    projections.push({
      factSlug,
      valueKind: "date",
      valueDate: value,
      confidence: sharedConfidence,
      internalOnly: false,
    });
  };

  const pushBoolean = (factSlug: string, value: boolean | undefined) => {
    if (typeof value !== "boolean") return;
    projections.push({
      factSlug,
      valueKind: "boolean",
      valueBoolean: value,
      confidence: sharedConfidence,
      internalOnly: false,
    });
  };

  const pushEnum = (
    factSlug: string,
    value: string | undefined,
    allowed: string[],
  ) => {
    if (typeof value !== "string" || value.length === 0) return;
    projections.push({
      factSlug,
      valueKind: "enum",
      valueEnum: value,
      valueEnumAllowed: allowed,
      confidence: sharedConfidence,
      internalOnly: false,
    });
  };

  pushDate("document.effective_date", facts.effectiveDate);
  pushNumeric("inspection.roof_age_years", facts.roofAgeYears, "years");
  pushNumeric("inspection.roof_replacement_year", facts.roofReplacementYear);
  pushText("flood.zone", facts.floodZone);
  pushBoolean("seller.known_leaks", facts.knownLeaks);
  pushNumeric("seller.prior_claims_count", facts.priorClaimsCount);
  pushEnum("permits.disclosed", facts.permitsDisclosed, ["yes", "no", "unknown"]);
  pushBoolean(
    "permits.unpermitted_work_mentioned",
    facts.unpermittedWorkMentioned,
  );
  pushNumeric("hoa.reserve_balance", facts.hoaReserveBalance, "USD");
  pushNumeric("hoa.annual_budget", facts.hoaAnnualBudget, "USD");
  pushDate("hoa.reserve_study_date", facts.hoaReserveStudyDate);
  pushNumeric("building.year_built", facts.buildingYearBuilt);
  pushNumeric("building.stories", facts.buildingStories);
  pushDate("building.milestone_inspection_date", facts.milestoneInspectionDate);
  pushDate("building.sirs_completed_date", facts.sirsCompletedDate);
  pushText(
    "title.exceptions",
    facts.titleExceptions?.filter((value) => value.length > 0).join("; "),
  );
  pushNumeric("title.lien_count", facts.lienCount);
  pushNumeric("inspection.major_defect_count", facts.majorDefectCount);
  pushNumeric(
    "inspection.recommended_repairs_count",
    facts.recommendedRepairsCount,
  );

  return projections;
}

export function buildAnalysisSnapshot(
  analysis: FileAnalysisResult,
): FileAnalysisSnapshot {
  return {
    schemaVersion: FILE_ANALYSIS_SNAPSHOT_VERSION,
    analysis,
    factProjections: buildFactProjections(analysis),
  };
}

export function serializeAnalysisSnapshot(
  snapshot: FileAnalysisSnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function parseAnalysisSnapshot(
  payload: string | undefined,
): FileAnalysisSnapshot | null {
  if (!payload) return null;

  try {
    const parsed = JSON.parse(payload) as unknown;

    if (
      parsed &&
      typeof parsed === "object" &&
      "schemaVersion" in parsed &&
      parsed.schemaVersion === FILE_ANALYSIS_SNAPSHOT_VERSION &&
      "analysis" in parsed
    ) {
      return parsed as FileAnalysisSnapshot;
    }

    if (
      parsed &&
      typeof parsed === "object" &&
      "docType" in parsed &&
      "facts" in parsed &&
      "findings" in parsed &&
      "pageClassifications" in parsed
    ) {
      return buildAnalysisSnapshot(parsed as FileAnalysisResult);
    }

    const legacy =
      parsed && typeof parsed === "object"
        ? (parsed as {
            buyerFacts?: unknown;
            plainEnglishSummary?: unknown;
            pageClassifications?: unknown;
          })
        : undefined;

    const buyerFacts = Array.isArray(legacy?.buyerFacts)
      ? legacy.buyerFacts.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [];
    const plainEnglishSummary =
      typeof legacy?.plainEnglishSummary === "string"
        ? legacy.plainEnglishSummary
        : "";
    const pageClassifications = Array.isArray(legacy?.pageClassifications)
      ? legacy.pageClassifications.filter(
          (value: unknown): value is FileAnalysisPageClassification =>
            Boolean(value) &&
            typeof value === "object" &&
            value !== null &&
            "pageNumber" in value &&
            typeof value.pageNumber === "number" &&
            "docType" in value &&
            typeof value.docType === "string" &&
            "confidence" in value &&
            typeof value.confidence === "number",
        )
      : [];

    return {
      schemaVersion: FILE_ANALYSIS_SNAPSHOT_VERSION,
      analysis: {
        docType: "other",
        facts: {
          docType: "other",
          classifierConfidence: 0,
        },
        findings: [],
        overallSeverity: "info",
        overallConfidence: 0,
        requiresBrokerReview: false,
        plainEnglishSummary,
        buyerFacts,
        pageClassifications,
        promptKey: "legacy",
        promptVersion: "legacy",
        engineVersion: "legacy",
      },
      factProjections: [],
    };
  } catch {
    return null;
  }
}
