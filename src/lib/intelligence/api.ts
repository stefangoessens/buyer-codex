import type { Id } from "../../../convex/_generated/dataModel";
import { makeFunctionReference } from "convex/server";

export type AlertStatus = "ok" | "warn" | "alert" | "unavailable";

export interface IntelligenceOverview {
  generatedAt: string;
  window: {
    start: string;
    end: string;
    days: number;
  };
  summary: {
    propertiesReviewed: number;
    deterministicSuccessRate: number;
    overallCompletenessScore: number;
    parserSchemaRate: number;
    crossSourceConflictRate: number;
    staleOrMissingRate: number;
  };
  alerts: Array<{
    key: string;
    label: string;
    note: string;
    value: number | null;
    status: AlertStatus;
  }>;
  extractionHealth: Array<{
    source: string;
    path: "deterministic_intake" | "browser_use_hosted" | "aggregated_baseline";
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    failureRate: number;
    topFailureCodes: Array<{ code: string; count: number }>;
    driftSignals: Array<{ code: string; count: number }>;
  }>;
  driftIndicators: Array<{
    key: string;
    label: string;
    count: number;
    denominator: number;
    rate: number;
  }>;
  completeness: {
    overallAverage: number;
    sections: Array<{
      key: string;
      label: string;
      averageScore: number;
      propertiesBelowReviewThreshold: number;
      criticalMissingRate: number;
    }>;
    lowestProperties: Array<{
      propertyId: Id<"properties">;
      canonicalId: string;
      sourcePlatform: string;
      address: string;
      updatedAt: string;
      overallScore: number;
      sectionsNeedingReview: string[];
      staleSources: string[];
      sectionScores: Array<{
        key: string;
        label: string;
        score: number;
        filledFields: number;
        totalFields: number;
        missingFields: string[];
        criticalMissingFields: string[];
      }>;
    }>;
  };
  conflicts: Array<{
    comparison: string;
    label: string;
    comparableFields: number;
    conflictingFields: number;
    conflictRate: number;
    sampleFields: string[];
  }>;
  freshness: Array<{
    source: string;
    ttlHours: number;
    fresh: number;
    stale: number;
    missing: number;
    staleRate: number;
  }>;
}

export const getIntelligenceOverviewReference = makeFunctionReference<
  "query",
  { windowDays?: number; propertyLimit?: number },
  IntelligenceOverview
>("intelligenceMonitoring:getOverview");
