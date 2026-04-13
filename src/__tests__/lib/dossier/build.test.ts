import { describe, expect, it } from "vitest";

import {
  buildPropertyDossier,
  projectBuyerSafeDossier,
} from "@/lib/dossier";
import type { DossierBuildInput } from "@/lib/dossier";

describe("buildPropertyDossier", () => {
  function createInput(): DossierBuildInput {
    return {
      generatedAt: "2026-04-13T23:00:00.000Z",
      property: {
        _id: "property_1",
        canonicalId: "canonical-1",
        address: {
          street: "123 Palm Ave",
          city: "Miami",
          state: "FL",
          zip: "33101",
          formatted: "123 Palm Ave, Miami, FL 33101",
        },
        status: "active",
        listPrice: 650000,
        daysOnMarket: 28,
        propertyType: "Single Family",
        beds: 4,
        bathsFull: 3,
        bathsHalf: 1,
        sqftLiving: 2400,
        yearBuilt: 2001,
        hoaFee: 350,
        floodZone: "AE",
        hurricaneZone: "HVHZ",
        subdivision: "Palm Estates",
        schoolDistrict: "Miami-Dade",
        sourcePlatform: "zillow",
        extractedAt: "2026-04-13T21:30:00.000Z",
        updatedAt: "2026-04-13T22:00:00.000Z",
      },
      sourceListings: [
        {
          sourcePlatform: "zillow",
          sourceUrl: "https://www.zillow.com/homedetails/1",
          status: "merged",
          extractedAt: "2026-04-13T21:30:00.000Z",
        },
      ],
      marketContext: {
        propertyId: "property_1",
        baselines: [
          {
            geoKey: "Palm Estates",
            geoKind: "subdivision",
            windowDays: 90,
            avgPricePerSqft: 280,
            medianDom: 36,
            medianPricePerSqft: 275,
            medianListPrice: 640000,
            avgSaleToListRatio: 0.97,
            medianSaleToListRatio: 0.96,
            priceReductionFrequency: 0.34,
            avgReductionPct: 0.03,
            medianReductionPct: 0.025,
            inventoryCount: 11,
            pendingCount: 3,
            salesVelocity: 1.1,
            trajectory: "flat",
            sampleSize: {
              total: 12,
              sold: 6,
              active: 4,
              pending: 2,
              pricePerSqft: 6,
              dom: 6,
              saleToList: 6,
              reduction: 4,
            },
            provenance: {
              source: "bright-data://market/palm-estates/90",
              fetchedAt: "2026-04-13T22:30:00.000Z",
            },
            lastRefreshedAt: "2026-04-13T22:30:00.000Z",
          },
        ],
        windows: [
          {
            windowDays: 90,
            selectedContext: {
              geoKey: "Palm Estates",
              geoKind: "subdivision",
              windowDays: 90,
              avgPricePerSqft: 280,
              medianDom: 36,
              medianPricePerSqft: 275,
              medianListPrice: 640000,
              avgSaleToListRatio: 0.97,
              medianSaleToListRatio: 0.96,
              priceReductionFrequency: 0.34,
              avgReductionPct: 0.03,
              medianReductionPct: 0.025,
              inventoryCount: 11,
              pendingCount: 3,
              salesVelocity: 1.1,
              trajectory: "flat",
              sampleSize: {
                total: 12,
                sold: 6,
                active: 4,
                pending: 2,
                pricePerSqft: 6,
                dom: 6,
                saleToList: 6,
                reduction: 4,
              },
              provenance: {
                source: "bright-data://market/palm-estates/90",
                fetchedAt: "2026-04-13T22:30:00.000Z",
              },
              lastRefreshedAt: "2026-04-13T22:30:00.000Z",
            },
            selectedGeoKind: "subdivision",
            selectedGeoKey: "Palm Estates",
            downgradeReasons: [],
            confidence: 0.88,
          },
        ],
        generatedAt: "2026-04-13T22:30:00.000Z",
      },
      portalEstimates: [
        {
          propertyId: "property_1",
          portal: "zillow",
          estimateValue: 648000,
          provenance: {
            source: "zillow://estimate/1",
            fetchedAt: "2026-04-13T22:10:00.000Z",
          },
          capturedAt: "2026-04-13T22:10:00.000Z",
        },
        {
          propertyId: "property_1",
          portal: "redfin",
          estimateValue: 655000,
          provenance: {
            source: "redfin://estimate/1",
            fetchedAt: "2026-04-13T22:11:00.000Z",
          },
          capturedAt: "2026-04-13T22:11:00.000Z",
        },
      ],
      recentSales: [
        {
          propertyId: "property_1",
          portal: "zillow",
          canonicalId: "comp-1",
          address: "125 Palm Ave, Miami, FL 33101",
          soldPrice: 625000,
          soldDate: "2026-03-18",
          listPrice: 640000,
          beds: 4,
          baths: 3,
          sqft: 2350,
          yearBuilt: 2000,
          subdivision: "Palm Estates",
          schoolDistrict: "Miami-Dade",
          zip: "33101",
          provenance: {
            source: "zillow://sale/comp-1",
            fetchedAt: "2026-04-13T22:25:00.000Z",
          },
          capturedAt: "2026-04-13T22:25:00.000Z",
        },
      ],
      browserUseRuns: [
        {
          jobId: "job_1",
          runState: "succeeded",
          reviewState: "approved",
          trigger: "missing_critical_fields",
          sourceUrl: "https://www.zillow.com/homedetails/1",
          portal: "zillow",
          confidence: 0.86,
          citations: [
            { url: "https://www.zillow.com/homedetails/1", label: "listing page" },
          ],
          trace: {
            summary: "Recovered HOA notes and price cut history",
            steps: [{ label: "Open listing", status: "completed" }],
            artifacts: [{ kind: "screenshot", url: "https://example.com/shot.png" }],
          },
          canonicalFields: {
            priceReductions: [{ amount: 15000, date: "2026-04-01" }],
          },
          fieldMetadata: {
            priceReductions: {
              confidence: 0.86,
              citations: [{ url: "https://www.zillow.com/homedetails/1" }],
            },
          },
          mergeProvenance: {
            priceReductions: {
              source: "browser_use_hosted",
              fetchedAt: "2026-04-13T22:40:00.000Z",
            },
          },
          conflicts: [],
          requestedAt: "2026-04-13T22:35:00.000Z",
          completedAt: "2026-04-13T22:40:00.000Z",
          missingCriticalFields: ["priceReductions"],
          conflictingFields: [],
        },
      ],
      snapshots: [
        {
          propertyId: "property_1",
          source: "fema_flood",
          payload: { zone: "AE" },
          provenance: {
            source: "fema://zone/property_1",
            fetchedAt: "2026-04-13T22:20:00.000Z",
          },
          lastRefreshedAt: "2026-04-13T22:20:00.000Z",
        },
      ],
      listingAgents: [
        {
          canonicalAgentId: "agent-1",
          name: "Alex Agent",
          brokerage: "Kind Realty",
          activeListings: 5,
          soldCount: 18,
          avgDaysOnMarket: 34,
          medianListToSellRatio: 0.97,
          priceCutFrequency: 0.22,
          recentActivityCount: 6,
          provenance: {
            activeListings: {
              source: "zillow://agent/1",
              fetchedAt: "2026-04-13T22:18:00.000Z",
            },
          },
          lastRefreshedAt: "2026-04-13T22:18:00.000Z",
        },
      ],
      documentBuyerSummaries: [
        {
          documentId: "doc-1",
          fileName: "hoa-budget.pdf",
          documentType: "hoa_document",
          status: "available",
          severity: "medium",
          headline: "HOA document analyzed",
          keyFacts: ["Reserve contribution increased 8% year over year."],
          progress: null,
          reason: null,
          uploadedAt: "2026-04-13T22:45:00.000Z",
        },
      ],
      documentInternalSummaries: [
        {
          documentId: "doc-1",
          fileName: "hoa-budget.pdf",
          documentType: "hoa_document",
          status: "available",
          severity: "medium",
          headline: "HOA document analyzed",
          keyFacts: ["Reserve contribution increased 8% year over year."],
          progress: null,
          reason: null,
          uploadedAt: "2026-04-13T22:45:00.000Z",
          reviewState: "approved",
          reviewNotes: null,
          confidence: 0.72,
          rawFactsPayload: "{\"buyerFacts\":[\"Reserve contribution increased 8% year over year.\"]}",
          analysisStatus: "succeeded",
          analyzedAt: "2026-04-13T22:46:00.000Z",
          reviewedAt: "2026-04-13T22:47:00.000Z",
        },
      ],
      latestOutputs: {
        pricing: {
          outputId: "pricing_1",
          engineType: "pricing" as const,
          promptVersion: "pricing-v1",
          reviewState: "approved",
          confidence: 0.81,
          citations: ["zillow://estimate/1", "redfin://estimate/1"],
          generatedAt: "2026-04-13T22:50:00.000Z",
          output: {
            fairValue: {
              value: 642000,
              deltaVsListPrice: -0.01,
              deltaVsConsensus: -0.01,
              confidence: 0.81,
            },
            likelyAccepted: {
              value: 638000,
              deltaVsListPrice: -0.02,
              deltaVsConsensus: -0.02,
              confidence: 0.78,
            },
            strongOpener: {
              value: 628000,
              deltaVsListPrice: -0.03,
              deltaVsConsensus: -0.03,
              confidence: 0.74,
            },
            walkAway: {
              value: 610000,
              deltaVsListPrice: -0.06,
              deltaVsConsensus: -0.05,
              confidence: 0.69,
            },
            consensusEstimate: 651500,
            estimateSpread: 0.02,
            estimateSources: ["zillow", "redfin"],
            overallConfidence: 0.81,
          },
        },
      },
    };
  }

  it("labels source categories on the evidence graph and strips internal trace from buyers", () => {
    const dossier = buildPropertyDossier(createInput());

    expect(dossier.sections.propertyFacts.sourceCategories).toEqual([
      "deterministic_extracted",
      "browser_extracted_interactive",
    ]);
    expect(dossier.sections.marketContext.sourceCategories).toEqual([
      "market_baseline_aggregated",
    ]);
    expect(dossier.sections.documents.sourceCategories).toEqual([
      "document_derived",
    ]);
    expect(dossier.sections.latestOutputs.sourceCategories).toEqual([
      "inferred_model_generated",
    ]);
    expect(dossier.sections.browserUse.provenance[0]).toMatchObject({
      category: "browser_extracted_interactive",
      citation: "https://www.zillow.com/homedetails/1",
    });
    expect(dossier.evidenceGraph.nodes["portal-estimates"]).toMatchObject({
      sourceCategory: "deterministic_extracted",
      kind: "portal_signals",
    });
    expect(dossier.evidenceGraph.nodes["market-context"]).toMatchObject({
      sourceCategory: "market_baseline_aggregated",
      kind: "market_context",
    });
    expect(dossier.evidenceGraph.nodes["browser-verification"]).toMatchObject({
      sourceCategory: "browser_extracted_interactive",
      kind: "browser_verification",
    });
    expect(dossier.evidenceGraph.nodes["pricing-output"]).toMatchObject({
      sourceCategory: "inferred_model_generated",
      kind: "model_output",
    });
    expect(dossier.evidenceGraph.sections.leverage.confidenceInputs.sourceCategories).toEqual([
      "deterministic_extracted",
      "browser_extracted_interactive",
      "market_baseline_aggregated",
    ]);
    expect(dossier.evidenceGraph.sections.pricing.availableDetailLevels).toEqual([
      "buyer_safe_summary",
      "internal_deep_trace",
    ]);
    expect(dossier.evidenceGraph.sections.pricing.internalTrace?.reasonCodes).toEqual(
      expect.arrayContaining(["model_output_available"]),
    );
    expect(dossier.evidenceGraph.nodes["pricing-output"].internal).toMatchObject({
      engineType: "pricing",
    });

    const buyerSafe = projectBuyerSafeDossier(dossier);
    expect(buyerSafe.internalSectionKeys).toEqual([]);
    expect(Object.keys(buyerSafe.sections)).toContain("documents");
    expect(Object.keys(buyerSafe.sections)).not.toContain("browserUse");
    expect(Object.keys(buyerSafe.sections)).not.toContain("downstreamInputs");
    expect(buyerSafe.evidenceGraph.sections.pricing.availableDetailLevels).toEqual([
      "buyer_safe_summary",
    ]);
    expect(buyerSafe.evidenceGraph.sections.pricing.internalTrace).toBeUndefined();
    expect(buyerSafe.evidenceGraph.sections.pricing.confidenceInputs.reasonCodes).toBeUndefined();
    expect(buyerSafe.evidenceGraph.nodes["pricing-output"].internal).toBeUndefined();
  });

  it("tracks missing and conflicting evidence separately for downstream confidence consumers", () => {
    const input = createInput();
    input.marketContext = null;
    input.recentSales = [];
    input.browserUseRuns[0] = {
      ...input.browserUseRuns[0],
      canonicalFields: {
        listPrice: 645000,
        priceReductions: [{ amount: 15000, date: "2026-04-01" }],
      },
      conflictingFields: ["listPrice", "priceReductions"],
    };
    input.latestOutputs = {
      pricing: {
        ...input.latestOutputs!.pricing!,
        output: {
          ...input.latestOutputs!.pricing!.output!,
          reviewFallback: {
            reviewRequired: true,
            reasons: ["estimate_disagreement"],
            summary: "Portal estimates disagree",
          },
        },
      },
    };

    const dossier = buildPropertyDossier(input);
    const pricing = dossier.evidenceGraph.sections.pricing;
    const leverage = dossier.evidenceGraph.sections.leverage;

    expect(pricing.status).toBe("conflicting_evidence");
    expect(pricing.confidenceInputs.missingLabels).toEqual(
      expect.arrayContaining(["fresh neighborhood baselines", "local sold comps"]),
    );
    expect(pricing.confidenceInputs.conflictingLabels).toEqual(
      expect.arrayContaining([
        "conflicting portal estimates",
        "conflicting listing-price inputs",
      ]),
    );
    expect(pricing.confidenceInputs.reasonCodes).toEqual(
      expect.arrayContaining([
        "conflicting_portal_estimates",
        "conflicting_browser_fields",
        "missing_market_context",
        "missing_recent_sales",
        "pricing_requires_review",
      ]),
    );
    expect(leverage.confidenceInputs.missingLabels).toEqual(
      expect.arrayContaining(["fresh neighborhood baselines", "local sold comps"]),
    );
    expect(leverage.confidenceInputs.conflictingLabels).toContain(
      "conflicting listing-history inputs",
    );
  });

  it("keeps refresh/replay fingerprints deterministic and changes them when source data changes", () => {
    const first = buildPropertyDossier(createInput());
    const second = buildPropertyDossier(createInput());

    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.replayKey).toBe(first.replayKey);
    expect(second.evidenceGraph.fingerprint).toBe(first.evidenceGraph.fingerprint);
    expect(second.sections.portalSignals.freshness.fingerprint).toBe(
      first.sections.portalSignals.freshness.fingerprint,
    );

    const refreshedInput = createInput();
    refreshedInput.portalEstimates[0] = {
      ...refreshedInput.portalEstimates[0],
      estimateValue: 660000,
      capturedAt: "2026-04-13T23:10:00.000Z",
    };

    const refreshed = buildPropertyDossier(refreshedInput);

    expect(refreshed.fingerprint).not.toBe(first.fingerprint);
    expect(refreshed.replayKey).not.toBe(first.replayKey);
    expect(refreshed.evidenceGraph.fingerprint).not.toBe(
      first.evidenceGraph.fingerprint,
    );
    expect(refreshed.sections.portalSignals.freshness.fingerprint).not.toBe(
      first.sections.portalSignals.freshness.fingerprint,
    );
  });
});
