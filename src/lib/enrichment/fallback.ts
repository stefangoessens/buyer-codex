/**
 * Browser Use hosted trigger logic and payload normalization (KIN-1019).
 *
 * Browser Use is a first-class typed enrichment path, but it is still not a
 * hidden access-layer escape hatch. Bright Data remains the place for access,
 * rendering, proxying, and unblock concerns. Browser Use runs only for
 * explicit extraction triggers.
 */

import {
  BROWSER_USE_TRIGGER_TYPES,
  type BrowserUseCitation,
  type BrowserUseFieldMetadata,
  type BrowserUseHostedResult,
  type BrowserUseReviewState,
  type BrowserUseRunState,
  type BrowserUseTrace,
  type BrowserUseTraceArtifact,
  type BrowserUseTraceStep,
  type BrowserUseTriggerType,
  type EnrichmentErrorCode,
  type PortalName,
  buildDedupeKey,
} from "./types";

export type BrowserUseDecision =
  | {
      eligible: true;
      trigger: BrowserUseTriggerType;
      runState: Extract<BrowserUseRunState, "queued">;
      dedupeKey: string;
      reviewState: BrowserUseReviewState;
    }
  | {
      eligible: false;
      skipReason: string;
      runState?: Extract<BrowserUseRunState, "escalated">;
      trigger?: BrowserUseTriggerType;
      dedupeKey?: string;
      reviewState?: BrowserUseReviewState;
    };

export interface BrowserUseDecisionInput {
  propertyId: string;
  sourceUrl: string;
  portal: PortalName;
  extractorErrorCode?: EnrichmentErrorCode;
  parseConfidence?: number;
  minimumParseConfidence?: number;
  missingCriticalFields?: string[];
  conflictingFields?: string[];
  operatorRequestedDeepExtract?: boolean;
  priorBrowserUseAttempts: number;
  maxBrowserUseAttempts: number;
  now?: Date;
}

export interface NormalizedBrowserUseHostedResult
  extends Omit<BrowserUseHostedResult, "canonicalFields" | "fieldMetadata"> {
  canonicalFields: Record<string, unknown>;
  fieldMetadata: Record<string, BrowserUseFieldMetadata>;
}

export function decideBrowserUseRun(
  input: BrowserUseDecisionInput,
): BrowserUseDecision {
  const trigger = resolveTrigger(input);
  if (!trigger) {
    return {
      eligible: false,
      skipReason: resolveSkipReason(input),
    };
  }

  const dedupeKey = buildBrowserUseDedupeKey(
    input.propertyId,
    input.sourceUrl,
    trigger,
    input.priorBrowserUseAttempts,
    input.now,
  );

  if (input.priorBrowserUseAttempts >= input.maxBrowserUseAttempts) {
    return {
      eligible: false,
      skipReason: "max_browser_use_attempts_exceeded",
      runState: "escalated",
      trigger,
      dedupeKey,
      reviewState: "needs_review",
    };
  }

  return {
    eligible: true,
    trigger,
    runState: "queued",
    dedupeKey,
    reviewState: defaultReviewState(trigger),
  };
}

export function errorCodeToBrowserUseTrigger(
  code: EnrichmentErrorCode,
): Extract<BrowserUseTriggerType, "parser_failure"> | null {
  return code === "parse_error" ? "parser_failure" : null;
}

export function buildBrowserUseDedupeKey(
  propertyId: string,
  sourceUrl: string,
  trigger: BrowserUseTriggerType,
  priorAttempts: number,
  now: Date = new Date(),
): string {
  const hourBucket = now.toISOString().slice(0, 13);
  const urlHash = simpleHash(sourceUrl);
  return buildDedupeKey(
    propertyId,
    "browser_use_hosted",
    `${trigger}::${urlHash}::${priorAttempts}::${hourBucket}`,
  );
}

export function normalizeBrowserUseHostedResult(
  payload: unknown,
): NormalizedBrowserUseHostedResult | null {
  const candidate = unwrapBrowserUseHostedResult(payload);
  if (!candidate) return null;

  const {
    sourceUrl,
    portal,
    canonicalFields,
    fieldMetadata,
    confidence,
    citations,
    trace,
    reviewState,
    trigger,
    capturedAt,
    evidence,
  } = candidate;

  if (typeof sourceUrl !== "string" || sourceUrl.length === 0) return null;
  if (!isPortal(portal)) return null;
  if (!isPlainObject(canonicalFields)) return null;
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) return null;
  if (!isBrowserUseTrigger(trigger)) return null;
  if (typeof capturedAt !== "string" || capturedAt.length === 0) return null;

  const normalizedFields = compactCanonicalFields(canonicalFields);
  const normalizedCitations = normalizeCitations(citations);
  const normalizedTrace = normalizeTrace(trace, evidence);
  const normalizedFieldMetadata = normalizeFieldMetadata(
    fieldMetadata,
    normalizedFields,
    confidence,
    normalizedCitations,
  );

  return {
    sourceUrl,
    portal,
    canonicalFields: normalizedFields,
    fieldMetadata: normalizedFieldMetadata,
    confidence,
    citations: normalizedCitations,
    trace: normalizedTrace,
    reviewState: isReviewState(reviewState) ? reviewState : "pending",
    trigger,
    capturedAt,
  };
}

export const BROWSER_USE_SKIP_LABELS: Record<string, string> = {
  max_browser_use_attempts_exceeded:
    "Browser Use hosted hit the attempt cap and escalated to operator review",
  "access_layer_error:network_error":
    "Network failures stay on the Bright Data/access layer and do not trigger Browser Use",
  "access_layer_error:rate_limited":
    "Rate limiting is an access-layer concern and does not silently trigger Browser Use",
  "access_layer_error:timeout":
    "Timeouts stay on the access layer and require Bright Data remediation first",
  "access_layer_error:unauthorized":
    "Authorization or unblock failures stay on the access layer, not Browser Use",
  "no_trigger:not_found":
    "Listing not found does not qualify for Browser Use hosted extraction",
  "no_trigger:unknown":
    "Unknown deterministic failures require operator triage before Browser Use",
  "no_trigger:none":
    "Browser Use hosted only runs for explicit trigger conditions",
};

function resolveTrigger(
  input: BrowserUseDecisionInput,
): BrowserUseTriggerType | null {
  if (input.operatorRequestedDeepExtract) {
    return "operator_requested_deep_extract";
  }

  if (
    typeof input.parseConfidence === "number" &&
    Number.isFinite(input.parseConfidence) &&
    typeof input.minimumParseConfidence === "number" &&
    Number.isFinite(input.minimumParseConfidence) &&
    input.parseConfidence < input.minimumParseConfidence
  ) {
    return "low_confidence_parse";
  }

  if ((input.missingCriticalFields ?? []).length > 0) {
    return "missing_critical_fields";
  }

  if ((input.conflictingFields ?? []).length > 0) {
    return "conflicting_portal_data";
  }

  if (input.extractorErrorCode) {
    return errorCodeToBrowserUseTrigger(input.extractorErrorCode);
  }

  return null;
}

function resolveSkipReason(input: BrowserUseDecisionInput): string {
  if (!input.extractorErrorCode) {
    return "no_trigger:none";
  }

  switch (input.extractorErrorCode) {
    case "network_error":
    case "rate_limited":
    case "timeout":
    case "unauthorized":
      return `access_layer_error:${input.extractorErrorCode}`;
    case "not_found":
    case "unknown":
      return `no_trigger:${input.extractorErrorCode}`;
    case "parse_error":
      return "no_trigger:parse_error";
    default: {
      const _exhaustive: never = input.extractorErrorCode;
      void _exhaustive;
      return "no_trigger:none";
    }
  }
}

function defaultReviewState(
  trigger: BrowserUseTriggerType,
): BrowserUseReviewState {
  return trigger === "operator_requested_deep_extract"
    ? "pending"
    : "needs_review";
}

function unwrapBrowserUseHostedResult(
  payload: unknown,
): Partial<BrowserUseHostedResult> & { evidence?: unknown } | null {
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.result)) {
    return payload.result as Partial<BrowserUseHostedResult> & {
      evidence?: unknown;
    };
  }
  return payload as Partial<BrowserUseHostedResult> & { evidence?: unknown };
}

function compactCanonicalFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    normalized[key] = value;
  }
  return normalized;
}

function normalizeFieldMetadata(
  fieldMetadata: unknown,
  canonicalFields: Record<string, unknown>,
  defaultConfidence: number,
  defaultCitations: BrowserUseCitation[],
): Record<string, BrowserUseFieldMetadata> {
  const metadataSource = isPlainObject(fieldMetadata) ? fieldMetadata : {};
  const normalized: Record<string, BrowserUseFieldMetadata> = {};

  for (const field of Object.keys(canonicalFields)) {
    const candidate = isPlainObject(metadataSource[field])
      ? metadataSource[field]
      : {};
    normalized[field] = {
      confidence:
        typeof candidate.confidence === "number" &&
        Number.isFinite(candidate.confidence)
          ? candidate.confidence
          : defaultConfidence,
      citations: normalizeCitations(candidate.citations ?? defaultCitations),
    };
  }

  return normalized;
}

function normalizeCitations(value: unknown): BrowserUseCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isPlainObject(entry)) return [];
    if (typeof entry.url !== "string" || entry.url.length === 0) return [];
    return [
      {
        url: entry.url,
        label:
          typeof entry.label === "string" && entry.label.length > 0
            ? entry.label
            : undefined,
      },
    ];
  });
}

function normalizeTrace(
  value: unknown,
  legacyEvidence: unknown,
): BrowserUseTrace {
  const traceValue = isPlainObject(value) ? value : {};
  const artifacts = normalizeArtifacts(
    traceValue.artifacts ?? traceValue.evidence ?? legacyEvidence,
  );
  const steps = normalizeSteps(traceValue.steps);

  return {
    runId: optionalString(traceValue.runId),
    sessionId: optionalString(traceValue.sessionId),
    summary: optionalString(traceValue.summary),
    steps,
    artifacts,
  };
}

function normalizeArtifacts(value: unknown): BrowserUseTraceArtifact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isPlainObject(entry)) return [];
    if (
      entry.kind !== "screenshot" &&
      entry.kind !== "html" &&
      entry.kind !== "json" &&
      entry.kind !== "console" &&
      entry.kind !== "network"
    ) {
      return [];
    }
    if (typeof entry.url !== "string" || entry.url.length === 0) return [];
    return [
      {
        kind: entry.kind,
        url: entry.url,
        label: optionalString(entry.label),
      },
    ];
  });
}

function normalizeSteps(value: unknown): BrowserUseTraceStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isPlainObject(entry)) return [];
    if (
      typeof entry.label !== "string" ||
      entry.label.length === 0 ||
      (entry.status !== "completed" &&
        entry.status !== "failed" &&
        entry.status !== "skipped")
    ) {
      return [];
    }
    return [
      {
        label: entry.label,
        status: entry.status,
        evidenceUrl: optionalString(entry.evidenceUrl),
      },
    ];
  });
}

function isBrowserUseTrigger(value: unknown): value is BrowserUseTriggerType {
  return (
    typeof value === "string" &&
    BROWSER_USE_TRIGGER_TYPES.includes(value as BrowserUseTriggerType)
  );
}

function isPortal(value: unknown): value is PortalName {
  return value === "zillow" || value === "redfin" || value === "realtor";
}

function isReviewState(value: unknown): value is BrowserUseReviewState {
  return value === "pending" || value === "needs_review" || value === "approved";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isPlainObject(
  value: unknown,
): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
