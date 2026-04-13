import { describe, expect, it } from "vitest";
import {
  BROWSER_USE_SKIP_LABELS,
  buildBrowserUseDedupeKey,
  decideBrowserUseRun,
  errorCodeToBrowserUseTrigger,
  normalizeBrowserUseHostedResult,
} from "@/lib/enrichment/fallback";
import {
  BROWSER_USE_TRIGGER_LABELS,
  BROWSER_USE_TRIGGER_TYPES,
} from "@/lib/enrichment/types";

const NOW = new Date("2026-04-12T12:00:00Z");
const BASE_RESULT = {
  sourceUrl: "https://zillow.com/homedetails/123",
  portal: "zillow" as const,
  canonicalFields: {
    listPrice: 500_000,
    beds: 3,
  },
  fieldMetadata: {
    listPrice: {
      confidence: 0.91,
      citations: [{ url: "https://portal.example/list-price", label: "List price" }],
    },
  },
  confidence: 0.82,
  citations: [{ url: "https://portal.example/root", label: "Listing page" }],
  trace: {
    runId: "run_123",
    sessionId: "session_456",
    steps: [{ label: "Open listing", status: "completed" as const }],
    artifacts: [
      { kind: "screenshot" as const, url: "s3://bucket/browser-use.png" },
    ],
  },
  reviewState: "needs_review" as const,
  trigger: "parser_failure" as const,
  capturedAt: "2026-04-12T12:05:00Z",
};

function baseInput(overrides = {}) {
  return {
    propertyId: "p1",
    sourceUrl: "https://zillow.com/homedetails/123",
    portal: "zillow" as const,
    extractorErrorCode: "parse_error" as const,
    priorBrowserUseAttempts: 0,
    maxBrowserUseAttempts: 2,
    now: NOW,
    ...overrides,
  };
}

describe("enrichment/browserUse", () => {
  describe("errorCodeToBrowserUseTrigger", () => {
    it("maps parse_error to parser_failure", () => {
      expect(errorCodeToBrowserUseTrigger("parse_error")).toBe("parser_failure");
    });

    it("does not map access-layer or opaque failures", () => {
      expect(errorCodeToBrowserUseTrigger("network_error")).toBeNull();
      expect(errorCodeToBrowserUseTrigger("rate_limited")).toBeNull();
      expect(errorCodeToBrowserUseTrigger("timeout")).toBeNull();
      expect(errorCodeToBrowserUseTrigger("unauthorized")).toBeNull();
      expect(errorCodeToBrowserUseTrigger("not_found")).toBeNull();
      expect(errorCodeToBrowserUseTrigger("unknown")).toBeNull();
    });
  });

  describe("decideBrowserUseRun", () => {
    it("queues parser_failure when deterministic parsing fails", () => {
      const decision = decideBrowserUseRun(baseInput());
      expect(decision.eligible).toBe(true);
      if (decision.eligible) {
        expect(decision.trigger).toBe("parser_failure");
        expect(decision.runState).toBe("queued");
        expect(decision.dedupeKey).toContain("browser_use_hosted");
      }
    });

    it("queues low_confidence_parse when confidence is below threshold", () => {
      const decision = decideBrowserUseRun(
        baseInput({
          extractorErrorCode: undefined,
          parseConfidence: 0.41,
          minimumParseConfidence: 0.7,
        }),
      );
      expect(decision.eligible).toBe(true);
      if (decision.eligible) {
        expect(decision.trigger).toBe("low_confidence_parse");
      }
    });

    it("queues missing_critical_fields when required fields are absent", () => {
      const decision = decideBrowserUseRun(
        baseInput({
          extractorErrorCode: undefined,
          missingCriticalFields: ["hoaFee", "taxAnnual"],
        }),
      );
      expect(decision.eligible).toBe(true);
      if (decision.eligible) {
        expect(decision.trigger).toBe("missing_critical_fields");
      }
    });

    it("queues conflicting_portal_data when explicit conflicts exist", () => {
      const decision = decideBrowserUseRun(
        baseInput({
          extractorErrorCode: undefined,
          conflictingFields: ["listPrice"],
        }),
      );
      expect(decision.eligible).toBe(true);
      if (decision.eligible) {
        expect(decision.trigger).toBe("conflicting_portal_data");
      }
    });

    it("queues operator_requested_deep_extract when the operator explicitly asks", () => {
      const decision = decideBrowserUseRun(
        baseInput({
          extractorErrorCode: "not_found",
          operatorRequestedDeepExtract: true,
        }),
      );
      expect(decision.eligible).toBe(true);
      if (decision.eligible) {
        expect(decision.trigger).toBe("operator_requested_deep_extract");
      }
    });

    it("does not use Browser Use as an access-layer escape hatch", () => {
      const decision = decideBrowserUseRun(
        baseInput({ extractorErrorCode: "rate_limited" }),
      );
      expect(decision.eligible).toBe(false);
      if (!decision.eligible) {
        expect(decision.skipReason).toBe("access_layer_error:rate_limited");
        expect(decision.runState).toBeUndefined();
      }
    });

    it("escalates instead of queuing once the attempt budget is exhausted", () => {
      const decision = decideBrowserUseRun(
        baseInput({
          priorBrowserUseAttempts: 2,
          maxBrowserUseAttempts: 2,
          missingCriticalFields: ["hoaFee"],
          extractorErrorCode: undefined,
        }),
      );
      expect(decision.eligible).toBe(false);
      if (!decision.eligible) {
        expect(decision.skipReason).toBe("max_browser_use_attempts_exceeded");
        expect(decision.runState).toBe("escalated");
        expect(decision.trigger).toBe("missing_critical_fields");
      }
    });
  });

  describe("buildBrowserUseDedupeKey", () => {
    it("is deterministic for the same inputs", () => {
      const a = buildBrowserUseDedupeKey(
        "p1",
        "https://a.com/x",
        "parser_failure",
        0,
        NOW,
      );
      const b = buildBrowserUseDedupeKey(
        "p1",
        "https://a.com/x",
        "parser_failure",
        0,
        NOW,
      );
      expect(a).toBe(b);
    });

    it("differs per trigger and attempt", () => {
      const a = buildBrowserUseDedupeKey(
        "p1",
        "https://a.com/x",
        "parser_failure",
        0,
        NOW,
      );
      const b = buildBrowserUseDedupeKey(
        "p1",
        "https://a.com/x",
        "missing_critical_fields",
        1,
        NOW,
      );
      expect(a).not.toBe(b);
    });
  });

  describe("normalizeBrowserUseHostedResult", () => {
    it("unwraps the worker payload and strips empty canonical fields", () => {
      const normalized = normalizeBrowserUseHostedResult({
        result: {
          ...BASE_RESULT,
          canonicalFields: {
            ...BASE_RESULT.canonicalFields,
            hoaFee: null,
            description: "",
            taxAnnual: undefined,
          },
          trace: {
            ...BASE_RESULT.trace,
            artifacts: [
              ...BASE_RESULT.trace.artifacts,
              { kind: "bad-kind", url: "s3://bucket/skip-me.png" },
            ],
          },
        },
      });

      expect(normalized).not.toBeNull();
      expect(normalized?.canonicalFields).toEqual({
        listPrice: 500_000,
        beds: 3,
      });
      expect(normalized?.fieldMetadata.listPrice).toEqual(
        BASE_RESULT.fieldMetadata.listPrice,
      );
      expect(normalized?.fieldMetadata.beds).toEqual({
        confidence: 0.82,
        citations: [{ url: "https://portal.example/root", label: "Listing page" }],
      });
      expect(normalized?.trace.artifacts).toEqual([
        { kind: "screenshot", url: "s3://bucket/browser-use.png", label: undefined },
      ]);
    });

    it("defaults per-field metadata from overall confidence and citations", () => {
      const normalized = normalizeBrowserUseHostedResult({
        ...BASE_RESULT,
        fieldMetadata: {},
      });

      expect(normalized?.fieldMetadata.beds).toEqual({
        confidence: 0.82,
        citations: [{ url: "https://portal.example/root", label: "Listing page" }],
      });
    });

    it("accepts a flat Browser Use result payload", () => {
      const normalized = normalizeBrowserUseHostedResult(BASE_RESULT);

      expect(normalized?.portal).toBe("zillow");
      expect(normalized?.trigger).toBe("parser_failure");
      expect(normalized?.canonicalFields.listPrice).toBe(500_000);
    });

    it("returns null for malformed payloads", () => {
      expect(
        normalizeBrowserUseHostedResult({
          result: {
            ...BASE_RESULT,
            confidence: Number.NaN,
          },
        }),
      ).toBeNull();
      expect(
        normalizeBrowserUseHostedResult({
          result: {
            ...BASE_RESULT,
            portal: "unknown",
          },
        }),
      ).toBeNull();
      expect(
        normalizeBrowserUseHostedResult({
          result: {
            ...BASE_RESULT,
            trigger: "not-a-real-trigger",
          },
        }),
      ).toBeNull();
    });
  });

  describe("labels", () => {
    it("exposes a label for every Browser Use trigger", () => {
      for (const trigger of BROWSER_USE_TRIGGER_TYPES) {
        expect(BROWSER_USE_TRIGGER_LABELS[trigger]).toBeDefined();
        expect(BROWSER_USE_TRIGGER_LABELS[trigger]!.length).toBeGreaterThan(0);
      }
    });

    it("exposes labels for the standard skip reasons", () => {
      expect(
        BROWSER_USE_SKIP_LABELS["max_browser_use_attempts_exceeded"],
      ).toBeDefined();
      expect(
        BROWSER_USE_SKIP_LABELS["access_layer_error:rate_limited"],
      ).toBeDefined();
    });
  });
});
