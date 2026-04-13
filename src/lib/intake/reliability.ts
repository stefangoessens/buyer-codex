import type { LinkPastedSource } from "@buyer-codex/shared/launch-events";
import type { ParseErrorCode, SourcePlatform } from "./types";

export const INTAKE_BASELINE_SOURCE_PLATFORMS = [
  "zillow",
  "redfin",
  "realtor",
  "manual",
] as const;

export type IntakeSourcePlatform =
  | SourcePlatform
  | (typeof INTAKE_BASELINE_SOURCE_PLATFORMS)[number];

export const INTAKE_ATTEMPT_STATUSES = [
  "pending",
  "ready",
  "partial",
  "failed",
  "unsupported",
] as const;

export type IntakeAttemptStatus = (typeof INTAKE_ATTEMPT_STATUSES)[number];

export const INTAKE_FAILURE_MODES = [
  "unsupported_url",
  "malformed_url",
  "missing_listing_id",
  "parser_failed",
  "partial_extraction",
  "no_match",
  "ambiguous_match",
  "low_confidence_match",
  "unknown",
] as const;

export type IntakeFailureMode = (typeof INTAKE_FAILURE_MODES)[number];

export const INTAKE_ATTEMPT_CHANNELS = [
  "hero",
  "compact",
  "home",
  "blog",
  "city",
  "community",
  "newconstruction",
  "extension",
  "share_import",
  "sms",
  "manual_address",
  "unknown",
] as const;

export type IntakeAttemptChannel =
  | LinkPastedSource
  | (typeof INTAKE_ATTEMPT_CHANNELS)[number];

export interface SourceListingReliabilityMetadata {
  schemaVersion: 1;
  resolutionStatus?: Exclude<IntakeAttemptStatus, "unsupported">;
  failureMode?: IntakeFailureMode;
  retryable?: boolean;
  missingFields?: string[];
  updatedAt?: string;
  note?: string;
}

export interface SourceListingRawDataEnvelope {
  reliability?: SourceListingReliabilityMetadata;
  [key: string]: unknown;
}

export interface IntakeAttemptRecordLike {
  sourcePlatform?: string | null;
  submittedAt: string;
  teaserViewedAt?: string | null;
  dossierReadyAt?: string | null;
  status: IntakeAttemptStatus;
  failureMode?: IntakeFailureMode | null;
  retryable?: boolean | null;
  missingFields?: string[] | null;
}

export interface IntakeFailureModeSummary {
  mode: IntakeFailureMode;
  count: number;
  retryableCount: number;
}

export interface IntakeSourceCoverageSummary {
  sourcePlatform: string;
  sourceLabel: string;
  totalAttempts: number;
  readyCount: number;
  partialCount: number;
  failedCount: number;
  unsupportedCount: number;
  pendingCount: number;
  retryableFailureCount: number;
  usableRate: number | null;
  failureRate: number | null;
  partialRate: number | null;
  medianTimeToTeaserMs: number | null;
  medianTimeToDossierMs: number | null;
  coverageStatus: "healthy" | "needs_attention" | "missing";
}

export interface IntakeReliabilityReport {
  totals: {
    totalAttempts: number;
    readyCount: number;
    partialCount: number;
    failedCount: number;
    unsupportedCount: number;
    pendingCount: number;
    retryableFailureCount: number;
    usableRate: number | null;
    failureRate: number | null;
    medianTimeToTeaserMs: number | null;
    medianTimeToDossierMs: number | null;
  };
  sources: IntakeSourceCoverageSummary[];
  failureModes: IntakeFailureModeSummary[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string");
  return items.length > 0 ? items : [];
}

function normalizeFailureMode(value: unknown): IntakeFailureMode | undefined {
  if (typeof value !== "string") return undefined;
  return (INTAKE_FAILURE_MODES as readonly string[]).includes(value)
    ? (value as IntakeFailureMode)
    : undefined;
}

function normalizeResolutionStatus(
  value: unknown,
): SourceListingReliabilityMetadata["resolutionStatus"] {
  if (typeof value !== "string") return undefined;
  return (INTAKE_ATTEMPT_STATUSES as readonly string[]).includes(value) &&
    value !== "unsupported"
    ? (value as SourceListingReliabilityMetadata["resolutionStatus"])
    : undefined;
}

export function parseSourceListingRawData(
  rawData: string | undefined | null,
): SourceListingRawDataEnvelope {
  if (!rawData) return {};
  try {
    const parsed = JSON.parse(rawData) as unknown;
    return isObject(parsed) ? (parsed as SourceListingRawDataEnvelope) : {};
  } catch {
    return {};
  }
}

export function readSourceListingReliability(
  rawData: string | undefined | null,
): SourceListingReliabilityMetadata | null {
  const envelope = parseSourceListingRawData(rawData);
  const explicit = envelope.reliability;
  if (isObject(explicit)) {
    return {
      schemaVersion: 1,
      resolutionStatus: normalizeResolutionStatus(explicit.resolutionStatus),
      failureMode: normalizeFailureMode(explicit.failureMode),
      retryable:
        typeof explicit.retryable === "boolean" ? explicit.retryable : undefined,
      missingFields: asStringArray(explicit.missingFields),
      updatedAt: typeof explicit.updatedAt === "string" ? explicit.updatedAt : undefined,
      note: typeof explicit.note === "string" ? explicit.note : undefined,
    };
  }

  const match = isObject(envelope.match) ? envelope.match : null;
  if (!match) return null;

  const resolutionStatus =
    typeof match.resolutionStatus === "string" ? match.resolutionStatus : undefined;
  const fallbackReason = normalizeFailureMode(match.fallbackReason);

  if (resolutionStatus === "matched") {
    return { schemaVersion: 1, resolutionStatus: "ready" };
  }

  if (resolutionStatus === "review_required") {
    return {
      schemaVersion: 1,
      resolutionStatus: "pending",
      failureMode: fallbackReason,
      retryable: true,
    };
  }

  if (resolutionStatus === "no_match") {
    return {
      schemaVersion: 1,
      resolutionStatus: "failed",
      failureMode: fallbackReason ?? "no_match",
      retryable: true,
    };
  }

  return null;
}

export function mergeSourceListingReliability(
  rawData: string | undefined | null,
  patch: Partial<SourceListingReliabilityMetadata>,
): string {
  const envelope = parseSourceListingRawData(rawData);
  const current = readSourceListingReliability(rawData) ?? { schemaVersion: 1 };
  const next: SourceListingReliabilityMetadata = {
    ...current,
    ...patch,
    schemaVersion: 1,
    updatedAt: patch.updatedAt ?? current.updatedAt,
    missingFields: patch.missingFields ?? current.missingFields,
  };

  envelope.reliability = next;
  return JSON.stringify(envelope);
}

export function failureModeFromParseCode(
  code: ParseErrorCode,
): IntakeFailureMode {
  switch (code) {
    case "unsupported_url":
    case "malformed_url":
    case "missing_listing_id":
      return code;
    case "invalid_domain":
      return "unsupported_url";
  }
}

export function statusFromFailureMode(
  mode: IntakeFailureMode,
): Extract<IntakeAttemptStatus, "failed" | "unsupported"> {
  return mode === "unsupported_url" ? "unsupported" : "failed";
}

export function retryableFromFailureMode(mode: IntakeFailureMode): boolean {
  switch (mode) {
    case "malformed_url":
    case "missing_listing_id":
    case "parser_failed":
    case "partial_extraction":
    case "no_match":
    case "ambiguous_match":
    case "low_confidence_match":
    case "unknown":
      return true;
    case "unsupported_url":
      return false;
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (left === undefined || right === undefined) return null;
  return (left + right) / 2;
}

function durationMs(start: string, end: string | null | undefined): number | null {
  if (!end) return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return endMs - startMs;
}

function summarizeAttempts(
  attempts: IntakeAttemptRecordLike[],
): Omit<IntakeSourceCoverageSummary, "sourcePlatform" | "sourceLabel" | "coverageStatus"> {
  const readyCount = attempts.filter((attempt) => attempt.status === "ready").length;
  const partialCount = attempts.filter((attempt) => attempt.status === "partial").length;
  const failedCount = attempts.filter((attempt) => attempt.status === "failed").length;
  const unsupportedCount = attempts.filter(
    (attempt) => attempt.status === "unsupported",
  ).length;
  const pendingCount = attempts.filter((attempt) => attempt.status === "pending").length;
  const retryableFailureCount = attempts.filter(
    (attempt) =>
      attempt.status !== "pending" &&
      attempt.status !== "ready" &&
      attempt.retryable === true,
  ).length;
  const totalAttempts = attempts.length;

  const teaserLatencies = attempts
    .map((attempt) => durationMs(attempt.submittedAt, attempt.teaserViewedAt))
    .filter((value): value is number => value !== null);
  const dossierLatencies = attempts
    .map((attempt) => durationMs(attempt.submittedAt, attempt.dossierReadyAt))
    .filter((value): value is number => value !== null);
  const usableCount = readyCount + partialCount;

  return {
    totalAttempts,
    readyCount,
    partialCount,
    failedCount,
    unsupportedCount,
    pendingCount,
    retryableFailureCount,
    usableRate: totalAttempts > 0 ? usableCount / totalAttempts : null,
    failureRate:
      totalAttempts > 0 ? (failedCount + unsupportedCount) / totalAttempts : null,
    partialRate: totalAttempts > 0 ? partialCount / totalAttempts : null,
    medianTimeToTeaserMs: median(teaserLatencies),
    medianTimeToDossierMs: median(dossierLatencies),
  };
}

export function formatIntakeSourceLabel(sourcePlatform: string): string {
  switch (sourcePlatform) {
    case "zillow":
      return "Zillow";
    case "redfin":
      return "Redfin";
    case "realtor":
      return "Realtor.com";
    case "manual":
      return "Manual address";
    default:
      return sourcePlatform
        .split(/[_-]+/)
        .filter(Boolean)
        .map((token) => token[0]?.toUpperCase() + token.slice(1))
        .join(" ");
  }
}

export function buildIntakeReliabilityReport(
  attempts: IntakeAttemptRecordLike[],
): IntakeReliabilityReport {
  const totals = summarizeAttempts(attempts);
  const observedSources = new Set(
    attempts
      .map((attempt) => attempt.sourcePlatform)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );

  const sourcePlatforms = [
    ...INTAKE_BASELINE_SOURCE_PLATFORMS,
    ...Array.from(observedSources).filter(
      (value) =>
        !(INTAKE_BASELINE_SOURCE_PLATFORMS as readonly string[]).includes(value),
    ),
  ];

  const sources = sourcePlatforms.map((sourcePlatform) => {
    const rows = attempts.filter((attempt) => attempt.sourcePlatform === sourcePlatform);
    const summary = summarizeAttempts(rows);
    return {
      sourcePlatform,
      sourceLabel: formatIntakeSourceLabel(sourcePlatform),
      ...summary,
      coverageStatus:
        summary.totalAttempts === 0
          ? "missing"
          : summary.failedCount + summary.unsupportedCount + summary.partialCount > 0
            ? "needs_attention"
            : "healthy",
    } satisfies IntakeSourceCoverageSummary;
  });

  const failureModeMap = new Map<IntakeFailureMode, IntakeFailureModeSummary>();
  for (const attempt of attempts) {
    if (!attempt.failureMode) continue;
    const current = failureModeMap.get(attempt.failureMode) ?? {
      mode: attempt.failureMode,
      count: 0,
      retryableCount: 0,
    };
    current.count += 1;
    if (attempt.retryable) current.retryableCount += 1;
    failureModeMap.set(attempt.failureMode, current);
  }

  return {
    totals: {
      totalAttempts: totals.totalAttempts,
      readyCount: totals.readyCount,
      partialCount: totals.partialCount,
      failedCount: totals.failedCount,
      unsupportedCount: totals.unsupportedCount,
      pendingCount: totals.pendingCount,
      retryableFailureCount: totals.retryableFailureCount,
      usableRate: totals.usableRate,
      failureRate: totals.failureRate,
      medianTimeToTeaserMs: totals.medianTimeToTeaserMs,
      medianTimeToDossierMs: totals.medianTimeToDossierMs,
    },
    sources,
    failureModes: Array.from(failureModeMap.values()).sort(
      (left, right) => right.count - left.count || left.mode.localeCompare(right.mode),
    ),
  };
}
