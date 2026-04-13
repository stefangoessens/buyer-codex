import { describe, expect, it } from "vitest";
import {
  runEnrichmentJob,
  stubAdapters,
  type EnrichmentFetchAdapters,
} from "@/lib/ai/engines/enrichmentWorker";
import { normalizeBrowserUseHostedResult } from "@/lib/enrichment/fallback";
import type { BrowserUseHostedResult } from "@/lib/enrichment/types";

function adaptersWithBrowserUse(
  override: Partial<EnrichmentFetchAdapters> = {},
): EnrichmentFetchAdapters {
  return {
    ...stubAdapters,
    async browserUseHosted({
      propertyId,
      sourceUrl,
      portal,
      trigger,
      parseConfidence,
      missingCriticalFields,
    }) {
      const result: BrowserUseHostedResult = {
        sourceUrl,
        portal,
        canonicalFields: {
          listPrice: 500_000,
          beds: 3,
          baths: 2,
        },
        fieldMetadata: {
          listPrice: {
            confidence: 0.94,
            citations: [{ url: `${sourceUrl}#list-price`, label: "List price" }],
          },
        },
        confidence: parseConfidence ?? 0.82,
        citations: [{ url: sourceUrl, label: "Listing page" }],
        trace: {
          runId: "run_123",
          sessionId: `session_${propertyId}`,
          steps: [
            { label: "Open listing", status: "completed" },
            {
              label:
                missingCriticalFields && missingCriticalFields.length > 0
                  ? "Inspect missing fields"
                  : "Inspect facts panel",
              status: "completed",
            },
          ],
          artifacts: [
            { kind: "screenshot", url: "s3://bucket/screenshots/a.png" },
          ],
        },
        reviewState: "needs_review",
        trigger,
        capturedAt: "2026-04-12T12:05:00Z",
      };
      return {
        result,
        citation: `browser-use://${portal}/${propertyId}`,
      };
    },
    ...override,
  };
}

describe("enrichmentWorker — browser_use_hosted", () => {
  it("dispatches to the browserUseHosted adapter on success", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/999",
          portal: "zillow",
          trigger: "parser_failure",
        },
      },
      adaptersWithBrowserUse(),
    );

    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      expect(outcome.result.source).toBe("browser_use_hosted");
      expect(outcome.result.propertyId).toBe("p1");
      const payload = outcome.result.payload as { result: BrowserUseHostedResult };
      expect(payload.result.trigger).toBe("parser_failure");
      expect(payload.result.canonicalFields.listPrice).toBe(500_000);
    }
  });

  it("returns a payload shape that the canonical normalizer can merge", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/999",
          portal: "zillow",
          trigger: "missing_critical_fields",
          missingCriticalFields: ["hoaFee", "taxAnnual"],
        },
      },
      adaptersWithBrowserUse(),
    );

    expect(outcome.kind).toBe("success");
    if (outcome.kind === "success") {
      const normalized = normalizeBrowserUseHostedResult(outcome.result.payload);
      expect(normalized).not.toBeNull();
      expect(normalized?.sourceUrl).toBe("https://zillow.com/homedetails/999");
      expect(normalized?.trigger).toBe("missing_critical_fields");
      expect(normalized?.canonicalFields).toMatchObject({
        listPrice: 500_000,
        beds: 3,
        baths: 2,
      });
    }
  });

  it("returns parse_error when context.sourceUrl is missing", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: { portal: "zillow", trigger: "parser_failure" },
      },
      adaptersWithBrowserUse(),
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.error.code).toBe("parse_error");
    }
  });

  it("returns parse_error when context.trigger is invalid", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/1",
          portal: "zillow",
          trigger: "totally_made_up_reason",
        },
      },
      adaptersWithBrowserUse(),
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.error.code).toBe("parse_error");
    }
  });

  it("returns parse_error when context.portal is invalid", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/1",
          portal: "bogus",
          trigger: "parser_failure",
        },
      },
      adaptersWithBrowserUse(),
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.error.code).toBe("parse_error");
    }
  });

  it("stubAdapters.browserUseHosted throws not_found by default", async () => {
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/1",
          portal: "zillow",
          trigger: "parser_failure",
        },
      },
      stubAdapters,
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.error.code).toBe("not_found");
      expect(outcome.error.source).toBe("browser_use_hosted");
    }
  });

  it("forwards network errors as retryable failures", async () => {
    const adapters = adaptersWithBrowserUse({
      async browserUseHosted() {
        const err = new Error("ECONNRESET") as Error & { code?: string };
        err.code = "ECONNRESET";
        throw err;
      },
    });
    const outcome = await runEnrichmentJob(
      {
        propertyId: "p1",
        source: "browser_use_hosted",
        context: {
          sourceUrl: "https://zillow.com/homedetails/1",
          portal: "zillow",
          trigger: "parser_failure",
        },
      },
      adapters,
    );
    expect(outcome.kind).toBe("failure");
    if (outcome.kind === "failure") {
      expect(outcome.error.retryable).toBe(true);
    }
  });
});
