import { describe, expect, it } from "vitest";
import {
  buildIntakeReliabilityReport,
  formatIntakeSourceLabel,
  mergeSourceListingReliability,
  readSourceListingReliability,
} from "@/lib/intake/reliability";

describe("source listing reliability metadata", () => {
  it("merges reliability metadata without dropping the existing envelope", () => {
    const rawData = JSON.stringify({
      canonical: { formatted: "123 Main St, Miami, FL 33131" },
      match: { resolutionStatus: "matched" },
    });

    const merged = mergeSourceListingReliability(rawData, {
      resolutionStatus: "partial",
      failureMode: "partial_extraction",
      retryable: true,
      missingFields: ["hoaFee", "taxAnnual"],
      updatedAt: "2026-04-13T12:00:00.000Z",
    });

    expect(JSON.parse(merged)).toMatchObject({
      canonical: { formatted: "123 Main St, Miami, FL 33131" },
      reliability: {
        schemaVersion: 1,
        resolutionStatus: "partial",
        failureMode: "partial_extraction",
        retryable: true,
        missingFields: ["hoaFee", "taxAnnual"],
        updatedAt: "2026-04-13T12:00:00.000Z",
      },
    });

    expect(readSourceListingReliability(merged)).toEqual({
      schemaVersion: 1,
      resolutionStatus: "partial",
      failureMode: "partial_extraction",
      retryable: true,
      missingFields: ["hoaFee", "taxAnnual"],
      updatedAt: "2026-04-13T12:00:00.000Z",
      note: undefined,
    });
  });

  it("falls back to legacy match metadata when explicit reliability is absent", () => {
    const legacy = JSON.stringify({
      match: {
        resolutionStatus: "review_required",
        fallbackReason: "ambiguous_match",
      },
    });

    expect(readSourceListingReliability(legacy)).toEqual({
      schemaVersion: 1,
      resolutionStatus: "pending",
      failureMode: "ambiguous_match",
      retryable: true,
      missingFields: undefined,
      updatedAt: undefined,
      note: undefined,
    });
  });
});

describe("buildIntakeReliabilityReport", () => {
  it("keeps baseline sources visible and appends future sources", () => {
    const report = buildIntakeReliabilityReport([
      {
        sourcePlatform: "zillow",
        submittedAt: "2026-04-13T10:00:00.000Z",
        teaserViewedAt: "2026-04-13T10:00:05.000Z",
        dossierReadyAt: "2026-04-13T10:00:15.000Z",
        status: "ready",
      },
      {
        sourcePlatform: "manual",
        submittedAt: "2026-04-13T10:05:00.000Z",
        teaserViewedAt: "2026-04-13T10:05:04.000Z",
        dossierReadyAt: "2026-04-13T10:05:14.000Z",
        status: "ready",
      },
      {
        sourcePlatform: "mls_feed",
        submittedAt: "2026-04-13T10:10:00.000Z",
        status: "pending",
      },
    ]);

    expect(report.sources.map((source) => source.sourcePlatform)).toEqual([
      "zillow",
      "redfin",
      "realtor",
      "manual",
      "mls_feed",
    ]);

    expect(report.sources.find((source) => source.sourcePlatform === "redfin")).toMatchObject({
      sourceLabel: "Redfin",
      totalAttempts: 0,
      coverageStatus: "missing",
    });

    expect(report.sources.find((source) => source.sourcePlatform === "realtor")).toMatchObject({
      sourceLabel: "Realtor.com",
      totalAttempts: 0,
      coverageStatus: "missing",
    });

    expect(report.sources.find((source) => source.sourcePlatform === "mls_feed")).toMatchObject({
      sourceLabel: "Mls Feed",
      totalAttempts: 1,
      coverageStatus: "healthy",
    });

    expect(formatIntakeSourceLabel("future_source")).toBe("Future Source");
  });

  it("computes totals, medians, and failure-mode aggregation for reliability reporting", () => {
    const report = buildIntakeReliabilityReport([
      {
        sourcePlatform: "zillow",
        submittedAt: "2026-04-13T10:00:00.000Z",
        teaserViewedAt: "2026-04-13T10:00:05.000Z",
        dossierReadyAt: "2026-04-13T10:00:15.000Z",
        status: "ready",
      },
      {
        sourcePlatform: "zillow",
        submittedAt: "2026-04-13T10:01:00.000Z",
        teaserViewedAt: "2026-04-13T10:01:07.000Z",
        status: "partial",
        failureMode: "partial_extraction",
        retryable: true,
        missingFields: ["hoaFee"],
      },
      {
        sourcePlatform: "redfin",
        submittedAt: "2026-04-13T10:02:00.000Z",
        status: "failed",
        failureMode: "parser_failed",
        retryable: true,
      },
      {
        sourcePlatform: "realtor",
        submittedAt: "2026-04-13T10:03:00.000Z",
        status: "unsupported",
        failureMode: "unsupported_url",
        retryable: false,
      },
      {
        sourcePlatform: "manual",
        submittedAt: "2026-04-13T10:04:00.000Z",
        teaserViewedAt: "2026-04-13T10:04:04.000Z",
        dossierReadyAt: "2026-04-13T10:04:14.000Z",
        status: "ready",
      },
      {
        sourcePlatform: "future_feed",
        submittedAt: "2026-04-13T10:05:00.000Z",
        teaserViewedAt: "2026-04-13T10:05:10.000Z",
        status: "pending",
      },
    ]);

    expect(report.totals).toMatchObject({
      totalAttempts: 6,
      readyCount: 2,
      partialCount: 1,
      failedCount: 1,
      unsupportedCount: 1,
      pendingCount: 1,
      retryableFailureCount: 2,
      usableRate: 0.5,
      failureRate: 2 / 6,
      medianTimeToTeaserMs: 6000,
      medianTimeToDossierMs: 14500,
    });

    expect(report.sources.find((source) => source.sourcePlatform === "zillow")).toMatchObject({
      totalAttempts: 2,
      usableRate: 1,
      partialRate: 0.5,
      medianTimeToTeaserMs: 6000,
      medianTimeToDossierMs: 15000,
      coverageStatus: "needs_attention",
    });

    expect(report.sources.find((source) => source.sourcePlatform === "manual")).toMatchObject({
      totalAttempts: 1,
      usableRate: 1,
      failureRate: 0,
      coverageStatus: "healthy",
    });

    expect(report.failureModes).toEqual([
      { mode: "parser_failed", count: 1, retryableCount: 1 },
      { mode: "partial_extraction", count: 1, retryableCount: 1 },
      { mode: "unsupported_url", count: 1, retryableCount: 0 },
    ]);
  });
});
