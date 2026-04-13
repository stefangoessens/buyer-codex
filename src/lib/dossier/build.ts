import type { CaseSynthesisInput } from "@/lib/ai/engines/caseSynthesis";
import {
  buildCompCandidatesFromRecentSales,
  buildLeverageInputFromEnrichment,
  buildPricingInputFromEnrichment,
} from "@/lib/enrichment/engineContext";
import type { PortalEstimate, RecentComparableSale } from "@/lib/enrichment/types";
import { BUILDER_VERSION } from "@/lib/negotiation/brief";
import type { NegotiationBriefInputs } from "@/lib/negotiation/types";
import {
  DOSSIER_SOURCE_CATEGORIES,
  PROPERTY_DOSSIER_VERSION,
  RECOMMENDATION_EVIDENCE_SECTION_KEYS,
  type DossierBuildInput,
  type DossierSection,
  type DossierSourceCategory,
  type DossierSourceRef,
  type DossierVisibility,
  type EvidenceGraphNode,
  type DownstreamInputsSectionData,
  type LatestOutputsSectionData,
  type PropertyDossier,
  type PropertyEvidenceGraph,
  type PropertyDossierSectionKey,
  type PropertyDossierSections,
  type RecommendationConfidenceBand,
  type RecommendationConfidenceReasonCode,
  type RecommendationEvidenceSection,
  type RecommendationEvidenceSectionKey,
} from "./types";

export function buildPropertyDossier(
  input: DossierBuildInput,
): PropertyDossier {
  const latestOutputs = input.latestOutputs ?? {};
  const engineInputs = buildDownstreamInputs(input, latestOutputs);
  const sections: PropertyDossierSections = {
    propertyFacts: createSection({
      key: "propertyFacts",
      title: "Canonical listing facts",
      visibility: "buyer_safe",
      sourceCategories: sourceCategoryUnion([
        "deterministic_extracted",
        input.browserUseRuns.some(hasBrowserFacts)
          ? "browser_extracted_interactive"
          : null,
      ]),
      confidence: propertyFactsConfidence(input),
      lastRefreshedAt: latestTimestamp([
        input.property.updatedAt,
        input.property.extractedAt,
        ...input.sourceListings.map((row) => row.extractedAt),
        ...input.browserUseRuns.map((run) => run.completedAt),
      ]),
      provenance: [
        ...input.sourceListings.map((row) => ({
          label: `${row.sourcePlatform} listing`,
          category: "deterministic_extracted" as const,
          citation: row.sourceUrl,
          capturedAt: row.extractedAt,
        })),
        ...input.browserUseRuns
          .filter(hasBrowserFacts)
          .map((run) => ({
            label: `Browser Use ${run.portal ?? "listing"} run`,
            category: "browser_extracted_interactive" as const,
            citation: run.sourceUrl,
            capturedAt: run.completedAt ?? run.requestedAt,
          })),
      ],
      data: {
        canonicalId: input.property.canonicalId,
        sourcePlatform: input.property.sourcePlatform,
        sourceListings: [...input.sourceListings].sort((a, b) =>
          compareDesc(a.extractedAt, b.extractedAt),
        ),
        facts: input.property,
      },
    }),
    portalSignals: createSection({
      key: "portalSignals",
      title: "Portal estimate signals",
      visibility: "buyer_safe",
      sourceCategories: ["deterministic_extracted"],
      confidence: portalSignalsConfidence(input.portalEstimates),
      lastRefreshedAt: latestTimestamp(input.portalEstimates.map((row) => row.capturedAt)),
      provenance: input.portalEstimates.map((estimate) => ({
        label: `${estimate.portal} estimate`,
        category: "deterministic_extracted" as const,
        citation: estimate.provenance.source,
        capturedAt: estimate.capturedAt,
      })),
      data: buildPortalSignals(input.portalEstimates),
    }),
    marketContext: createSection({
      key: "marketContext",
      title: "Market context",
      visibility: "buyer_safe",
      sourceCategories: input.marketContext
        ? ["market_baseline_aggregated"]
        : [],
      confidence: marketContextConfidence(input.marketContext),
      lastRefreshedAt:
        input.marketContext?.generatedAt ??
        latestTimestamp(
          input.marketContext?.baselines.map((row) => row.lastRefreshedAt) ?? [],
        ),
      provenance: (input.marketContext?.baselines ?? []).map((baseline) => ({
        label: `${baseline.geoKind} baseline`,
        category: "market_baseline_aggregated" as const,
        citation: baseline.provenance.source,
        capturedAt: baseline.lastRefreshedAt,
      })),
      data: {
        marketContext: input.marketContext,
      },
    }),
    recentSales: createSection({
      key: "recentSales",
      title: "Recent comparable sales",
      visibility: "buyer_safe",
      sourceCategories: input.recentSales.length
        ? ["market_baseline_aggregated"]
        : [],
      confidence: comparableSalesConfidence(input.recentSales),
      lastRefreshedAt: latestTimestamp(input.recentSales.map((row) => row.capturedAt)),
      provenance: input.recentSales.map((sale) => ({
        label: `${sale.portal} comparable sale`,
        category: "market_baseline_aggregated" as const,
        citation: sale.provenance.source,
        capturedAt: sale.capturedAt,
      })),
      data: [...input.recentSales].sort((a, b) => compareDesc(a.soldDate, b.soldDate)),
    }),
    riskHooks: createSection({
      key: "riskHooks",
      title: "Risk hooks",
      visibility: "buyer_safe",
      sourceCategories: sourceCategoryUnion([
        hasRiskHooks(input) ? "deterministic_extracted" : null,
        (input.documentBuyerSummaries?.length ?? 0) > 0 ? "document_derived" : null,
      ]),
      confidence: riskHooksConfidence(input),
      lastRefreshedAt: latestTimestamp([
        input.property.updatedAt,
        ...(input.documentBuyerSummaries ?? []).map((row) => row.uploadedAt),
      ]),
      provenance: sourceCategoryUnion([
        hasRiskHooks(input) ? "deterministic_extracted" : null,
        (input.documentBuyerSummaries?.length ?? 0) > 0 ? "document_derived" : null,
      ]).map((category) => ({
        label:
          category === "document_derived"
            ? "Analyzed property documents"
            : "Canonical property record",
        category,
        capturedAt:
          category === "document_derived"
            ? latestTimestamp(
                (input.documentBuyerSummaries ?? []).map((row) => row.uploadedAt),
              ) ?? undefined
            : input.property.updatedAt,
      })),
      data: {
        floodZone: input.property.floodZone,
        hurricaneZone: input.property.hurricaneZone,
        hoaFee: input.property.hoaFee,
        hoaFrequency: input.property.hoaFrequency,
        taxAnnual: input.property.taxAnnual,
        taxAssessedValue: input.property.taxAssessedValue,
        yearBuilt: input.property.yearBuilt,
        roofYear: input.property.roofYear,
        roofMaterial: input.property.roofMaterial,
        impactWindows: input.property.impactWindows,
        stormShutters: input.property.stormShutters,
        constructionType: input.property.constructionType,
        gatedCommunity: input.property.gatedCommunity,
        seniorCommunity: input.property.seniorCommunity,
        shortTermRentalAllowed: input.property.shortTermRentalAllowed,
      },
    }),
    documents: createSection({
      key: "documents",
      title: "Buyer-safe document findings",
      visibility: "buyer_safe",
      sourceCategories:
        (input.documentBuyerSummaries?.length ?? 0) > 0
          ? ["document_derived"]
          : [],
      confidence: documentConfidence(input.documentBuyerSummaries),
      lastRefreshedAt: latestTimestamp(
        (input.documentBuyerSummaries ?? []).map((row) => row.uploadedAt),
      ),
      provenance: (input.documentBuyerSummaries ?? []).map((summary) => ({
        label: summary.fileName,
        category: "document_derived" as const,
        citation: summary.documentId,
        capturedAt: summary.uploadedAt,
      })),
      data: {
        scope:
          (input.documentBuyerSummaries?.length ?? 0) > 0 ? "deal_room" : "property",
        available: (input.documentBuyerSummaries?.length ?? 0) > 0,
        summaries: input.documentBuyerSummaries ?? [],
      },
    }),
    documentReview: createSection({
      key: "documentReview",
      title: "Internal document review",
      visibility: "internal_only",
      sourceCategories:
        (input.documentInternalSummaries?.length ?? 0) > 0
          ? ["document_derived"]
          : [],
      confidence: documentConfidence(
        input.documentInternalSummaries?.map((summary) => ({
          ...summary,
          uploadedAt: summary.uploadedAt,
        })),
      ),
      lastRefreshedAt: latestTimestamp(
        (input.documentInternalSummaries ?? []).map((row) => row.uploadedAt),
      ),
      provenance: (input.documentInternalSummaries ?? []).map((summary) => ({
        label: summary.fileName,
        category: "document_derived" as const,
        citation: summary.documentId,
        capturedAt: summary.uploadedAt,
      })),
      data: {
        scope:
          (input.documentInternalSummaries?.length ?? 0) > 0
            ? "deal_room"
            : "property",
        available: (input.documentInternalSummaries?.length ?? 0) > 0,
        summaries: input.documentInternalSummaries ?? [],
      },
    }),
    browserUse: createSection({
      key: "browserUse",
      title: "Browser Use enrichment",
      visibility: "internal_only",
      sourceCategories:
        input.browserUseRuns.length > 0
          ? ["browser_extracted_interactive"]
          : [],
      confidence: browserUseConfidence(input.browserUseRuns),
      lastRefreshedAt: latestTimestamp(
        input.browserUseRuns.map((run) => run.completedAt ?? run.requestedAt),
      ),
      provenance: input.browserUseRuns.map((run) => ({
        label: `Browser Use ${run.runState}`,
        category: "browser_extracted_interactive" as const,
        citation: run.sourceUrl,
        capturedAt: run.completedAt ?? run.requestedAt,
      })),
      data: {
        runs: [...input.browserUseRuns].sort((a, b) =>
          compareDesc(
            a.completedAt ?? a.requestedAt ?? "",
            b.completedAt ?? b.requestedAt ?? "",
          ),
        ),
      },
    }),
    enrichmentArtifacts: createSection({
      key: "enrichmentArtifacts",
      title: "Enrichment artifacts",
      visibility: "internal_only",
      sourceCategories: sourceCategoryUnion([
        input.snapshots.length > 0 ? "deterministic_extracted" : null,
        input.listingAgents.length > 0 ? "market_baseline_aggregated" : null,
      ]),
      confidence: enrichmentArtifactsConfidence(input),
      lastRefreshedAt: latestTimestamp([
        ...input.snapshots.map((row) => row.lastRefreshedAt),
        ...input.listingAgents.map((row) => row.lastRefreshedAt),
      ]),
      provenance: [
        ...input.snapshots.map((snapshot) => ({
          label: snapshot.source,
          category: "deterministic_extracted" as const,
          citation: snapshot.provenance.source,
          capturedAt: snapshot.lastRefreshedAt,
        })),
        ...input.listingAgents.map((agent) => ({
          label: `Listing agent ${agent.name}`,
          category: "market_baseline_aggregated" as const,
          capturedAt: agent.lastRefreshedAt,
        })),
      ],
      data: {
        snapshots: [...input.snapshots].sort((a, b) =>
          compareDesc(a.lastRefreshedAt, b.lastRefreshedAt),
        ),
        listingAgents: [...input.listingAgents].sort((a, b) =>
          compareDesc(a.lastRefreshedAt, b.lastRefreshedAt),
        ),
      },
    }),
    downstreamInputs: createSection({
      key: "downstreamInputs",
      title: "Downstream composition inputs",
      visibility: "internal_only",
      sourceCategories: sourceCategoryUnion([
        "deterministic_extracted",
        input.marketContext ? "market_baseline_aggregated" : null,
        input.browserUseRuns.some(hasBrowserFacts)
          ? "browser_extracted_interactive"
          : null,
        (input.documentInternalSummaries?.length ?? 0) > 0
          ? "document_derived"
          : null,
        hasAnyLatestOutputs(latestOutputs) ? "inferred_model_generated" : null,
      ]),
      confidence: downstreamInputsConfidence(input, latestOutputs),
      lastRefreshedAt: latestTimestamp([
        input.property.updatedAt,
        input.marketContext?.generatedAt,
        ...Object.values(latestOutputs)
          .filter(Boolean)
          .map((row) => row!.generatedAt),
      ]),
      provenance: [
        {
          label: "Canonical property facts",
          category: "deterministic_extracted",
          capturedAt: input.property.updatedAt,
        },
        ...(input.marketContext
          ? [
              {
                label: "Market context baselines",
                category: "market_baseline_aggregated" as const,
                capturedAt: input.marketContext.generatedAt,
              },
            ]
          : []),
        ...(input.browserUseRuns.some(hasBrowserFacts)
          ? [
              {
                label: "Browser Use enrichment",
                category: "browser_extracted_interactive" as const,
                capturedAt: latestTimestamp(
                  input.browserUseRuns.map((run) => run.completedAt ?? run.requestedAt),
                ) ?? undefined,
              },
            ]
          : []),
        ...(hasAnyLatestOutputs(latestOutputs)
          ? [
              {
                label: "Latest AI engine outputs",
                category: "inferred_model_generated" as const,
                capturedAt: latestTimestamp(
                  Object.values(latestOutputs)
                    .filter(Boolean)
                    .map((row) => row!.generatedAt),
                ) ?? undefined,
              },
            ]
          : []),
      ],
      data: engineInputs,
    }),
    latestOutputs: createSection({
      key: "latestOutputs",
      title: "Latest model outputs",
      visibility: "internal_only",
      sourceCategories: hasAnyLatestOutputs(latestOutputs)
        ? ["inferred_model_generated"]
        : [],
      confidence: latestOutputsConfidence(latestOutputs),
      lastRefreshedAt: latestTimestamp(
        Object.values(latestOutputs)
          .filter(Boolean)
          .map((row) => row!.generatedAt),
      ),
      provenance: Object.values(latestOutputs)
        .filter(Boolean)
        .map((output) => ({
          label: `${output!.engineType} output`,
          category: "inferred_model_generated" as const,
          citation: output!.outputId,
          capturedAt: output!.generatedAt,
        })),
      data: latestOutputs,
    }),
  };
  const evidenceGraph = buildEvidenceGraph({
    input,
    sections,
    latestOutputs,
  });

  const buyerSafeSectionKeys = Object.entries(sections)
    .filter(([, section]) => section.visibility === "buyer_safe")
    .map(([key]) => key as PropertyDossierSectionKey);
  const internalSectionKeys = Object.entries(sections)
    .filter(([, section]) => section.visibility === "internal_only")
    .map(([key]) => key as PropertyDossierSectionKey);
  const lastSourceUpdatedAt = latestTimestamp(
    Object.values(sections).map((section) => section.freshness.lastRefreshedAt),
  );
  const fingerprint = hashStableValue({
    compositionVersion: PROPERTY_DOSSIER_VERSION,
    sections: Object.fromEntries(
      Object.entries(sections).map(([key, section]) => [
        key,
        section.freshness.fingerprint,
      ]),
    ),
    evidenceGraph: evidenceGraph.fingerprint,
  });

  return {
    propertyId: input.property._id,
    canonicalId: input.property.canonicalId,
    compositionVersion: PROPERTY_DOSSIER_VERSION,
    generatedAt: input.generatedAt,
    lastSourceUpdatedAt,
    fingerprint,
    replayKey: `${PROPERTY_DOSSIER_VERSION}:${fingerprint}`,
    buyerSafeSectionKeys,
    internalSectionKeys,
    sections,
    evidenceGraph,
  };
}

export function projectBuyerSafeDossier(
  dossier: PropertyDossier,
): PropertyDossier {
  return {
    ...dossier,
    internalSectionKeys: [],
    sections: Object.fromEntries(
      Object.entries(dossier.sections).filter(
        ([, section]) => section.visibility === "buyer_safe",
      ),
    ) as PropertyDossierSections,
    evidenceGraph: projectBuyerSafeEvidenceGraph(dossier.evidenceGraph),
  };
}

const EVIDENCE_GRAPH_VERSION = "1.0.0";

const BROWSER_PRICING_FIELDS = new Set([
  "listPrice",
  "zestimate",
  "redfinEstimate",
  "realtorEstimate",
]);

const BROWSER_LEVERAGE_FIELDS = new Set([
  "daysOnMarket",
  "priceReductions",
  "wasRelisted",
  "wasWithdrawn",
  "wasPendingFellThrough",
]);

function buildEvidenceGraph(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
}): PropertyEvidenceGraph {
  const nodes: Record<string, EvidenceGraphNode> = {};
  const sections = {
    pricing: buildPricingEvidenceSection({ ...args, nodes }),
    comps: buildCompsEvidenceSection({ ...args, nodes }),
    leverage: buildLeverageEvidenceSection({ ...args, nodes }),
    risk: buildRiskEvidenceSection({ ...args, nodes }),
    offer_recommendation: buildOfferEvidenceSection({ ...args, nodes }),
  };
  const fingerprint = hashStableValue({
    graphVersion: EVIDENCE_GRAPH_VERSION,
    nodes,
    sections,
  });

  return {
    graphVersion: EVIDENCE_GRAPH_VERSION,
    fingerprint,
    replayKey: `${EVIDENCE_GRAPH_VERSION}:${fingerprint}`,
    sectionKeys: [...RECOMMENDATION_EVIDENCE_SECTION_KEYS],
    nodes,
    sections,
  };
}

function projectBuyerSafeEvidenceGraph(
  graph: PropertyEvidenceGraph,
): PropertyEvidenceGraph {
  return {
    ...graph,
    nodes: Object.fromEntries(
      Object.entries(graph.nodes).map(([nodeId, node]) => [
        nodeId,
        {
          ...node,
          internal: undefined,
        },
      ]),
    ),
    sections: Object.fromEntries(
      Object.entries(graph.sections).map(([sectionKey, section]) => [
        sectionKey,
        {
          ...section,
          availableDetailLevels: ["buyer_safe_summary"],
          confidenceInputs: {
            ...section.confidenceInputs,
            reasonCodes: undefined,
          },
          internalTrace: undefined,
        },
      ]),
    ) as PropertyEvidenceGraph["sections"],
  };
}

function buildPricingEvidenceSection(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
  nodes: Record<string, EvidenceGraphNode>;
}): RecommendationEvidenceSection {
  const support: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: RecommendationConfidenceReasonCode[] = [];
  const pricingOutput = args.latestOutputs.pricing;

  if (typeof args.sections.propertyFacts.data.facts.listPrice === "number") {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "listing-facts",
        label: "listing facts",
        summary: "Canonical facts extracted from the live listing record.",
        kind: "listing_facts",
        sourceCategory: "deterministic_extracted",
        sectionKey: "propertyFacts",
        section: args.sections.propertyFacts,
      }),
    );
    reasons.push("verified_listing_facts");
  }

  const estimateCount = args.sections.portalSignals.data.estimates.length;
  if (estimateCount > 0) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "portal-estimates",
        label: "portal estimates",
        summary: "Portal estimate signals from the supported listing sources.",
        kind: "portal_signals",
        sourceCategory: "deterministic_extracted",
        sectionKey: "portalSignals",
        section: args.sections.portalSignals,
      }),
    );
    reasons.push("portal_estimate_consensus");
    if (estimateCount === 1) {
      missing.push(
        ensureIssueNode({
          nodes: args.nodes,
          id: "pricing-sparse-portal-estimates",
          label: "more portal estimate coverage",
          summary: "Only one portal estimate is available, so pricing confidence stays narrower than it should.",
          kind: "missing_evidence",
          sourceSectionKey: "portalSignals",
          sourceCategory: "deterministic_extracted",
          provenance: args.sections.portalSignals.provenance,
          capturedAt: args.sections.portalSignals.freshness.lastRefreshedAt ?? undefined,
        }),
      );
      reasons.push("sparse_portal_estimates");
    }
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "pricing-missing-portal-estimates",
        label: "portal estimates",
        summary: "Pricing still needs portal estimate signals to anchor the recommendation.",
        kind: "missing_evidence",
        sourceSectionKey: "portalSignals",
      }),
    );
    reasons.push("missing_portal_estimates");
  }

  if (args.sections.marketContext.data.marketContext) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "market-context",
        label: "neighborhood baselines",
        summary: "Neighborhood baselines for price, DOM, and sale-to-list behavior.",
        kind: "market_context",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "marketContext",
        section: args.sections.marketContext,
      }),
    );
    reasons.push("market_context_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "pricing-missing-market-context",
        label: "fresh neighborhood baselines",
        summary: "Pricing is waiting on market baselines for the local area.",
        kind: "missing_evidence",
        sourceSectionKey: "marketContext",
      }),
    );
    reasons.push("missing_market_context");
  }

  if (args.sections.recentSales.data.length > 0) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "recent-sales",
        label: "local sold comps",
        summary: "Recent sold comps in the local market.",
        kind: "recent_sales",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "recentSales",
        section: args.sections.recentSales,
      }),
    );
    reasons.push("recent_sales_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "pricing-missing-recent-sales",
        label: "local sold comps",
        summary: "Pricing is waiting on recent comparable sales instead of leaning only on estimates.",
        kind: "missing_evidence",
        sourceSectionKey: "recentSales",
      }),
    );
    reasons.push("missing_recent_sales");
  }

  if (hasBrowserSupport(args.input.browserUseRuns, BROWSER_PRICING_FIELDS)) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "browser-verification",
        label: "interactive listing review",
        summary: "Interactive listing review filled or checked fields the parser could not confirm on its own.",
        kind: "browser_verification",
        sourceCategory: "browser_extracted_interactive",
        sectionKey: "browserUse",
        section: args.sections.browserUse,
      }),
    );
    reasons.push("browser_verification_available");
  }

  if (pricingOutput) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "pricing-output",
        label: "pricing model output",
        summary: "The pricing model turned the grounded inputs into fair-value and opener ranges.",
        engineType: "pricing",
        output: pricingOutput,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "pricing-missing-output",
        label: "pricing model output",
        summary: "The pricing recommendation has not been generated yet.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_pricing_output");
  }

  if (pricingOutput?.output?.reviewFallback?.reviewRequired) {
    reasons.push("pricing_requires_review");
    if (
      pricingOutput.output.reviewFallback.reasons.includes("estimate_disagreement")
    ) {
      conflicts.push(
        ensureIssueNode({
          nodes: args.nodes,
          id: "pricing-conflicting-portal-estimates",
          label: "conflicting portal estimates",
          summary: "The available portal estimates disagree enough to keep pricing confidence tempered.",
          kind: "conflicting_evidence",
          sourceSectionKey: "portalSignals",
          sourceCategory: "deterministic_extracted",
          provenance: args.sections.portalSignals.provenance,
          capturedAt: args.sections.portalSignals.freshness.lastRefreshedAt ?? undefined,
        }),
      );
      reasons.push("conflicting_portal_estimates");
    }
  }

  if (hasBrowserConflicts(args.input.browserUseRuns, BROWSER_PRICING_FIELDS)) {
    conflicts.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "pricing-conflicting-browser-fields",
        label: "conflicting listing-price inputs",
        summary: "Interactive verification and deterministic extraction disagree on pricing-adjacent fields.",
        kind: "conflicting_evidence",
        sourceSectionKey: "browserUse",
        sourceCategory: "browser_extracted_interactive",
        provenance: args.sections.browserUse.provenance,
        capturedAt: args.sections.browserUse.freshness.lastRefreshedAt ?? undefined,
      }),
    );
    reasons.push("conflicting_browser_fields");
  }

  return createRecommendationEvidenceSection({
    key: "pricing",
    title: "Pricing guidance",
    nodes: args.nodes,
    supportingNodeIds: support,
    missingNodeIds: missing,
    conflictingNodeIds: conflicts,
    score:
      pricingOutput?.confidence ??
      averageScore([
        args.sections.portalSignals.confidence,
        args.sections.marketContext.confidence,
        args.sections.recentSales.confidence,
      ]),
    reasonCodes: reasons,
    dependsOnInference: Boolean(pricingOutput),
  });
}

function buildCompsEvidenceSection(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
  nodes: Record<string, EvidenceGraphNode>;
}): RecommendationEvidenceSection {
  const support: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: RecommendationConfidenceReasonCode[] = [];
  const compsOutput = args.latestOutputs.comps;

  support.push(
    ensureSectionNode({
      nodes: args.nodes,
      id: "listing-facts",
      label: "listing facts",
      summary: "Canonical facts extracted from the live listing record.",
      kind: "listing_facts",
      sourceCategory: "deterministic_extracted",
      sectionKey: "propertyFacts",
      section: args.sections.propertyFacts,
    }),
  );
  reasons.push("verified_listing_facts");

  const recentSalesCount = args.sections.recentSales.data.length;
  if (recentSalesCount > 0) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "recent-sales",
        label: "local sold comps",
        summary: "Recent sold comps in the local market.",
        kind: "recent_sales",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "recentSales",
        section: args.sections.recentSales,
      }),
    );
    reasons.push("recent_sales_available");
    if (recentSalesCount < 3) {
      missing.push(
        ensureIssueNode({
          nodes: args.nodes,
          id: "comps-insufficient-recent-sales",
          label: "enough local sold comps",
          summary: "Comparable-sales coverage is still thin, so comp confidence remains provisional.",
          kind: "missing_evidence",
          sourceSectionKey: "recentSales",
          sourceCategory: "market_baseline_aggregated",
          provenance: args.sections.recentSales.provenance,
          capturedAt: args.sections.recentSales.freshness.lastRefreshedAt ?? undefined,
        }),
      );
      reasons.push("insufficient_recent_sales");
    }
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "comps-missing-recent-sales",
        label: "local sold comps",
        summary: "Comparable-sales reasoning is waiting on recent sold comps.",
        kind: "missing_evidence",
        sourceSectionKey: "recentSales",
      }),
    );
    reasons.push("missing_recent_sales");
  }

  if (args.sections.marketContext.data.marketContext) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "market-context",
        label: "neighborhood baselines",
        summary: "Neighborhood baselines for price, DOM, and sale-to-list behavior.",
        kind: "market_context",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "marketContext",
        section: args.sections.marketContext,
      }),
    );
    reasons.push("market_context_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "comps-missing-market-context",
        label: "fresh neighborhood baselines",
        summary: "Comparable-sales reasoning is missing the local market baseline context.",
        kind: "missing_evidence",
        sourceSectionKey: "marketContext",
      }),
    );
    reasons.push("missing_market_context");
  }

  if (compsOutput) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "comps-output",
        label: "comparable-sales model output",
        summary: "The comps engine ranked candidates and produced the comparison set.",
        engineType: "comps",
        output: compsOutput,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "comps-missing-output",
        label: "comparable-sales model output",
        summary: "The comparable-sales engine has not generated its selected comp set yet.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_comps_output");
  }

  if (
    compsOutput?.output?.comps.some(
      (comp) => (comp.candidate.conflicts?.length ?? 0) > 0,
    )
  ) {
    conflicts.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "comps-conflicting-sales-records",
        label: "conflicting sold-price records",
        summary: "At least one selected comparable sale has conflicting source records.",
        kind: "conflicting_evidence",
        sourceSectionKey: "recentSales",
        sourceCategory: "market_baseline_aggregated",
        provenance: args.sections.recentSales.provenance,
        capturedAt: args.sections.recentSales.freshness.lastRefreshedAt ?? undefined,
      }),
    );
  }

  return createRecommendationEvidenceSection({
    key: "comps",
    title: "Comparable-sales evidence",
    nodes: args.nodes,
    supportingNodeIds: support,
    missingNodeIds: missing,
    conflictingNodeIds: conflicts,
    score:
      compsOutput?.confidence ??
      averageScore([
        args.sections.recentSales.confidence,
        args.sections.marketContext.confidence,
      ]),
    reasonCodes: reasons,
    dependsOnInference: Boolean(compsOutput),
  });
}

function buildLeverageEvidenceSection(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
  nodes: Record<string, EvidenceGraphNode>;
}): RecommendationEvidenceSection {
  const support: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: RecommendationConfidenceReasonCode[] = [];
  const leverageOutput = args.latestOutputs.leverage;

  if (hasListingHistory(args.input.property)) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "listing-facts",
        label: "listing facts",
        summary: "Canonical facts extracted from the live listing record.",
        kind: "listing_facts",
        sourceCategory: "deterministic_extracted",
        sectionKey: "propertyFacts",
        section: args.sections.propertyFacts,
      }),
    );
    reasons.push("verified_listing_facts");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "leverage-missing-listing-history",
        label: "listing history and DOM detail",
        summary: "Leverage reasoning still needs listing-history fields such as DOM or price-cut history.",
        kind: "missing_evidence",
        sourceSectionKey: "propertyFacts",
      }),
    );
    reasons.push("missing_listing_history");
  }

  if (hasBrowserSupport(args.input.browserUseRuns, BROWSER_LEVERAGE_FIELDS)) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "browser-verification",
        label: "interactive listing review",
        summary: "Interactive listing review filled or checked fields the parser could not confirm on its own.",
        kind: "browser_verification",
        sourceCategory: "browser_extracted_interactive",
        sectionKey: "browserUse",
        section: args.sections.browserUse,
      }),
    );
    reasons.push("browser_verification_available");
  }

  if (args.sections.marketContext.data.marketContext) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "market-context",
        label: "neighborhood baselines",
        summary: "Neighborhood baselines for price, DOM, and sale-to-list behavior.",
        kind: "market_context",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "marketContext",
        section: args.sections.marketContext,
      }),
    );
    reasons.push("market_context_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "leverage-missing-market-context",
        label: "fresh neighborhood baselines",
        summary: "Leverage signals need neighborhood DOM and sale-to-list context.",
        kind: "missing_evidence",
        sourceSectionKey: "marketContext",
      }),
    );
    reasons.push("missing_market_context");
  }

  if (args.sections.recentSales.data.length > 0) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "recent-sales",
        label: "local sold comps",
        summary: "Recent sold comps in the local market.",
        kind: "recent_sales",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "recentSales",
        section: args.sections.recentSales,
      }),
    );
    reasons.push("recent_sales_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "leverage-missing-recent-sales",
        label: "local sold comps",
        summary: "Leverage reasoning still needs recent local sales to anchor market pressure.",
        kind: "missing_evidence",
        sourceSectionKey: "recentSales",
      }),
    );
    reasons.push("missing_recent_sales");
  }

  if (args.sections.enrichmentArtifacts.data.listingAgents.length > 0) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "agent-signals",
        label: "listing history and agent signals",
        summary: "Listing-agent track record and activity help contextualize leverage.",
        kind: "enrichment_artifacts",
        sourceCategory: "market_baseline_aggregated",
        sectionKey: "enrichmentArtifacts",
        section: args.sections.enrichmentArtifacts,
      }),
    );
  }

  if (leverageOutput) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "leverage-output",
        label: "leverage model output",
        summary: "The leverage engine combined listing history and market pressure signals.",
        engineType: "leverage",
        output: leverageOutput,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "leverage-missing-output",
        label: "leverage model output",
        summary: "The leverage engine has not produced its pressure signals yet.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_leverage_output");
  }

  if (hasBrowserConflicts(args.input.browserUseRuns, BROWSER_LEVERAGE_FIELDS)) {
    conflicts.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "leverage-conflicting-browser-fields",
        label: "conflicting listing-history inputs",
        summary: "Interactive verification and deterministic extraction disagree on DOM or listing-history fields.",
        kind: "conflicting_evidence",
        sourceSectionKey: "browserUse",
        sourceCategory: "browser_extracted_interactive",
        provenance: args.sections.browserUse.provenance,
        capturedAt: args.sections.browserUse.freshness.lastRefreshedAt ?? undefined,
      }),
    );
    reasons.push("conflicting_browser_fields");
  }

  return createRecommendationEvidenceSection({
    key: "leverage",
    title: "Negotiation leverage",
    nodes: args.nodes,
    supportingNodeIds: support,
    missingNodeIds: missing,
    conflictingNodeIds: conflicts,
    score:
      leverageOutput?.confidence ??
      averageScore([
        args.sections.propertyFacts.confidence,
        args.sections.marketContext.confidence,
        args.sections.recentSales.confidence,
        args.sections.browserUse.confidence,
        args.sections.enrichmentArtifacts.confidence,
      ]),
    reasonCodes: reasons,
    dependsOnInference: Boolean(leverageOutput),
  });
}

function buildRiskEvidenceSection(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
  nodes: Record<string, EvidenceGraphNode>;
}): RecommendationEvidenceSection {
  const support: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: RecommendationConfidenceReasonCode[] = [];

  if (hasRiskHookFacts(args.sections.riskHooks.data)) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "risk-hooks",
        label: "property risk facts",
        summary: "Structured risk hooks from the canonical property record.",
        kind: "risk_hooks",
        sourceCategory: "deterministic_extracted",
        sectionKey: "riskHooks",
        section: args.sections.riskHooks,
      }),
    );
    reasons.push("risk_facts_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "risk-missing-hooks",
        label: "core risk facts",
        summary: "Risk explanation is still missing core property facts such as flood, tax, or structural hooks.",
        kind: "missing_evidence",
        sourceSectionKey: "riskHooks",
      }),
    );
    reasons.push("missing_risk_facts");
  }

  if (args.sections.documents.data.available) {
    support.push(
      ensureSectionNode({
        nodes: args.nodes,
        id: "document-findings",
        label: "document findings",
        summary: "Buyer-safe findings extracted from uploaded property documents.",
        kind: "documents",
        sourceCategory: "document_derived",
        sectionKey: "documents",
        section: args.sections.documents,
      }),
    );
    reasons.push("document_findings_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "risk-missing-documents",
        label: "document findings",
        summary: "Risk explanation is still waiting on document findings or uploaded files.",
        kind: "missing_evidence",
        sourceSectionKey: "documents",
      }),
    );
    reasons.push("missing_documents");
  }

  return createRecommendationEvidenceSection({
    key: "risk",
    title: "Risk posture",
    nodes: args.nodes,
    supportingNodeIds: support,
    missingNodeIds: missing,
    conflictingNodeIds: conflicts,
    score: averageScore([
      args.sections.riskHooks.confidence,
      args.sections.documents.confidence,
    ]),
    reasonCodes: reasons,
    dependsOnInference: false,
  });
}

function buildOfferEvidenceSection(args: {
  input: DossierBuildInput;
  sections: PropertyDossierSections;
  latestOutputs: LatestOutputsSectionData;
  nodes: Record<string, EvidenceGraphNode>;
}): RecommendationEvidenceSection {
  const support: string[] = [];
  const missing: string[] = [];
  const conflicts: string[] = [];
  const reasons: RecommendationConfidenceReasonCode[] = [];
  const offerOutput = args.latestOutputs.offer;

  if (args.latestOutputs.pricing) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "pricing-output",
        label: "pricing model output",
        summary: "The pricing model turned the grounded inputs into fair-value and opener ranges.",
        engineType: "pricing",
        output: args.latestOutputs.pricing,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "offer-missing-pricing-output",
        label: "pricing guidance",
        summary: "Offer strategy is waiting on pricing guidance.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_pricing_output");
  }

  if (args.latestOutputs.comps) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "comps-output",
        label: "comparable-sales model output",
        summary: "The comps engine ranked candidates and produced the comparison set.",
        engineType: "comps",
        output: args.latestOutputs.comps,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "offer-missing-comps-output",
        label: "comparable-sales context",
        summary: "Offer strategy is waiting on comparable-sales context.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_comps_output");
  }

  if (args.latestOutputs.leverage) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "leverage-output",
        label: "leverage model output",
        summary: "The leverage engine combined listing history and market pressure signals.",
        engineType: "leverage",
        output: args.latestOutputs.leverage,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "offer-missing-leverage-output",
        label: "leverage context",
        summary: "Offer strategy is waiting on leverage context.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_leverage_output");
    reasons.push("offer_requires_pricing_and_leverage");
  }

  if (offerOutput) {
    support.push(
      ensureOutputNode({
        nodes: args.nodes,
        id: "offer-output",
        label: "offer scenario model output",
        summary: "The offer engine produced scenario recommendations from the pricing and leverage stack.",
        engineType: "offer",
        output: offerOutput,
        latestOutputsSection: args.sections.latestOutputs,
      }),
    );
    reasons.push("model_output_available");
  } else {
    missing.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "offer-missing-output",
        label: "offer scenarios",
        summary: "The offer engine has not generated its scenarios yet.",
        kind: "missing_evidence",
        sourceSectionKey: "latestOutputs",
      }),
    );
    reasons.push("missing_offer_output");
  }

  if (
    args.latestOutputs.pricing?.output?.reviewFallback?.reviewRequired &&
    args.latestOutputs.pricing.output.reviewFallback.reasons.includes(
      "estimate_disagreement",
    )
  ) {
    conflicts.push(
      ensureIssueNode({
        nodes: args.nodes,
        id: "offer-conflicting-pricing",
        label: "conflicting pricing inputs",
        summary: "Offer strategy is inheriting a pricing disagreement upstream.",
        kind: "conflicting_evidence",
        sourceSectionKey: "latestOutputs",
        sourceCategory: "inferred_model_generated",
        provenance: args.sections.latestOutputs.provenance,
        capturedAt: args.sections.latestOutputs.freshness.lastRefreshedAt ?? undefined,
      }),
    );
    reasons.push("conflicting_portal_estimates");
    reasons.push("pricing_requires_review");
  }

  if (!args.latestOutputs.pricing || !args.latestOutputs.leverage) {
    reasons.push("offer_requires_pricing_and_leverage");
  }

  return createRecommendationEvidenceSection({
    key: "offer_recommendation",
    title: "Offer recommendation",
    nodes: args.nodes,
    supportingNodeIds: support,
    missingNodeIds: missing,
    conflictingNodeIds: conflicts,
    score:
      offerOutput?.confidence ??
      averageScore([
        args.latestOutputs.pricing?.confidence,
        args.latestOutputs.comps?.confidence,
        args.latestOutputs.leverage?.confidence,
      ]),
    reasonCodes: reasons,
    dependsOnInference: support.length > 0,
  });
}

function createRecommendationEvidenceSection(args: {
  key: RecommendationEvidenceSectionKey;
  title: string;
  nodes: Record<string, EvidenceGraphNode>;
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
  score: number | null;
  reasonCodes: RecommendationConfidenceReasonCode[];
  dependsOnInference: boolean;
}): RecommendationEvidenceSection {
  const supportingNodeIds = uniqueIds(args.supportingNodeIds);
  const missingNodeIds = uniqueIds(args.missingNodeIds);
  const conflictingNodeIds = uniqueIds(args.conflictingNodeIds);
  const supportLabels = supportingNodeIds.map((nodeId) => args.nodes[nodeId]?.label).filter(
    (value): value is string => Boolean(value),
  );
  const missingLabels = missingNodeIds.map((nodeId) => args.nodes[nodeId]?.label).filter(
    (value): value is string => Boolean(value),
  );
  const conflictingLabels = conflictingNodeIds
    .map((nodeId) => args.nodes[nodeId]?.label)
    .filter((value): value is string => Boolean(value));
  const sourceCategories = sourceCategoryUnion(
    supportingNodeIds.map((nodeId) => args.nodes[nodeId]?.sourceCategory ?? null),
  );
  const status = resolveEvidenceTraceStatus({
    supportingNodeIds,
    missingNodeIds,
    conflictingNodeIds,
    dependsOnInference: args.dependsOnInference,
  });
  const confidenceInputs = {
    score: args.score,
    band: resolveConfidenceBand(args.score, status),
    sourceCategories,
    supportLabels,
    missingLabels,
    conflictingLabels,
    dependsOnInference: args.dependsOnInference,
    reasonCodes: uniqueReasonCodes(
      args.dependsOnInference && needsInferenceReason(supportingNodeIds, sourceCategories)
        ? [...args.reasonCodes, "inference_heavy"]
        : args.reasonCodes,
    ),
  };

  return {
    key: args.key,
    title: args.title,
    availableDetailLevels: ["buyer_safe_summary", "internal_deep_trace"],
    status,
    supportingNodeIds,
    missingNodeIds,
    conflictingNodeIds,
    buyerSummary: {
      detailLevel: "buyer_safe_summary",
      headline: buildBuyerHeadline(supportLabels),
      supportLabels,
      caution: buildBuyerCaution({
        missingLabels,
        conflictingLabels,
        dependsOnInference: args.dependsOnInference,
      }),
      status,
      dependsOnInference: args.dependsOnInference,
    },
    confidenceInputs,
    internalTrace: {
      detailLevel: "internal_deep_trace",
      summary: buildInternalTraceSummary({
        title: args.title,
        supportLabels,
        missingLabels,
        conflictingLabels,
        dependsOnInference: args.dependsOnInference,
      }),
      sourceCategories,
      reasonCodes: confidenceInputs.reasonCodes ?? [],
      supportingNodeIds,
      missingNodeIds,
      conflictingNodeIds,
    },
  };
}

function ensureSectionNode(args: {
  nodes: Record<string, EvidenceGraphNode>;
  id: string;
  label: string;
  summary: string;
  kind: EvidenceGraphNode["kind"];
  sourceCategory: DossierSourceCategory;
  sectionKey: PropertyDossierSectionKey;
  section: DossierSection<unknown>;
}): string {
  return ensureNode(args.nodes, {
    id: args.id,
    label: args.label,
    summary: args.summary,
    kind: args.kind,
    sourceCategory: args.sourceCategory,
    confidence: args.section.confidence > 0 ? args.section.confidence : null,
    internal: {
      sourceSectionKey: args.sectionKey,
      citations: args.section.provenance
        .map((entry) => entry.citation)
        .filter((value): value is string => Boolean(value)),
      capturedAt: args.section.freshness.lastRefreshedAt ?? undefined,
      provenance: args.section.provenance,
    },
  });
}

function ensureOutputNode(args: {
  nodes: Record<string, EvidenceGraphNode>;
  id: string;
  label: string;
  summary: string;
  engineType: NonNullable<LatestOutputsSectionData[keyof LatestOutputsSectionData]>["engineType"];
  output: NonNullable<LatestOutputsSectionData[keyof LatestOutputsSectionData]>;
  latestOutputsSection: DossierSection<LatestOutputsSectionData>;
}): string {
  const provenance: DossierSourceRef[] = [
    {
      label: `${args.engineType} output`,
      category: "inferred_model_generated",
      citation: args.output.outputId,
      capturedAt: args.output.generatedAt,
    },
  ];

  return ensureNode(args.nodes, {
    id: args.id,
    label: args.label,
    summary: args.summary,
    kind: "model_output",
    sourceCategory: "inferred_model_generated",
    confidence: args.output.confidence > 0 ? args.output.confidence : null,
    internal: {
      sourceSectionKey: "latestOutputs",
      engineType: args.engineType,
      citations: [
        args.output.outputId,
        ...args.output.citations.filter((value): value is string => Boolean(value)),
      ],
      capturedAt:
        args.output.generatedAt ??
        args.latestOutputsSection.freshness.lastRefreshedAt ??
        undefined,
      provenance,
    },
  });
}

function ensureIssueNode(args: {
  nodes: Record<string, EvidenceGraphNode>;
  id: string;
  label: string;
  summary: string;
  kind: "missing_evidence" | "conflicting_evidence";
  sourceSectionKey?: PropertyDossierSectionKey;
  sourceCategory?: DossierSourceCategory;
  provenance?: DossierSourceRef[];
  capturedAt?: string;
}): string {
  return ensureNode(args.nodes, {
    id: args.id,
    label: args.label,
    summary: args.summary,
    kind: args.kind,
    sourceCategory: args.sourceCategory,
    confidence: null,
    internal: {
      sourceSectionKey: args.sourceSectionKey,
      citations: (args.provenance ?? [])
        .map((entry) => entry.citation)
        .filter((value): value is string => Boolean(value)),
      capturedAt: args.capturedAt,
      provenance: args.provenance ?? [],
    },
  });
}

function ensureNode(
  nodes: Record<string, EvidenceGraphNode>,
  node: EvidenceGraphNode,
): string {
  if (!nodes[node.id]) {
    nodes[node.id] = node;
  }
  return node.id;
}

function hasBrowserSupport(
  runs: DossierBuildInput["browserUseRuns"],
  fields: Set<string>,
): boolean {
  return runs.some((run) => browserRunTouchesFields(run.canonicalFields, fields));
}

function hasBrowserConflicts(
  runs: DossierBuildInput["browserUseRuns"],
  fields: Set<string>,
): boolean {
  return runs.some(
    (run) =>
      run.conflictingFields.some((field) => fields.has(field)) ||
      run.conflicts.some((entry) =>
        typeof entry?.field === "string" ? fields.has(entry.field) : false,
      ),
  );
}

function browserRunTouchesFields(
  canonicalFields: Record<string, unknown>,
  fields: Set<string>,
): boolean {
  return Object.keys(canonicalFields).some((field) => fields.has(field));
}

function hasListingHistory(property: DossierBuildInput["property"]): boolean {
  return Boolean(
    typeof property.daysOnMarket === "number" ||
      (property.priceReductions?.length ?? 0) > 0 ||
      property.wasRelisted ||
      property.wasWithdrawn ||
      property.wasPendingFellThrough,
  );
}

function hasRiskHookFacts(
  riskHooks: PropertyDossierSections["riskHooks"]["data"],
): boolean {
  return Object.values(riskHooks).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null,
  );
}

function resolveEvidenceTraceStatus(args: {
  supportingNodeIds: string[];
  missingNodeIds: string[];
  conflictingNodeIds: string[];
  dependsOnInference: boolean;
}) {
  if (args.conflictingNodeIds.length > 0) return "conflicting_evidence";
  if (args.supportingNodeIds.length === 0) return "waiting_on_evidence";
  if (args.missingNodeIds.length > 0 || args.dependsOnInference) return "mixed";
  return "supported";
}

function resolveConfidenceBand(
  score: number | null,
  status: ReturnType<typeof resolveEvidenceTraceStatus>,
): RecommendationConfidenceBand {
  if (score === null || status === "waiting_on_evidence") {
    return "waiting";
  }

  if (score >= 0.75) {
    return status === "conflicting_evidence" ? "medium" : "high";
  }
  if (score >= 0.6) {
    return status === "conflicting_evidence" ? "low" : "medium";
  }
  return "low";
}

function buildBuyerHeadline(supportLabels: string[]): string {
  if (supportLabels.length === 0) {
    return "Waiting on verified evidence for this section.";
  }

  return `Based on ${joinList(supportLabels)}.`;
}

function buildBuyerCaution(args: {
  missingLabels: string[];
  conflictingLabels: string[];
  dependsOnInference: boolean;
}): string | null {
  if (args.conflictingLabels.length > 0) {
    return `${capitalize(joinList(args.conflictingLabels))} lowered confidence.`;
  }
  if (args.missingLabels.length > 0) {
    return `Still waiting on ${joinList(args.missingLabels)}.`;
  }
  if (args.dependsOnInference) {
    return "This section still depends on model-generated synthesis.";
  }
  return null;
}

function buildInternalTraceSummary(args: {
  title: string;
  supportLabels: string[];
  missingLabels: string[];
  conflictingLabels: string[];
  dependsOnInference: boolean;
}): string {
  const parts = [
    args.supportLabels.length > 0
      ? `${args.title} is currently backed by ${joinList(args.supportLabels)}.`
      : `${args.title} has no grounded evidence yet.`,
  ];

  if (args.missingLabels.length > 0) {
    parts.push(`Missing: ${joinList(args.missingLabels)}.`);
  }
  if (args.conflictingLabels.length > 0) {
    parts.push(`Conflicts: ${joinList(args.conflictingLabels)}.`);
  }
  if (args.dependsOnInference) {
    parts.push("A model-generated layer is part of this section.");
  }

  return parts.join(" ");
}

function needsInferenceReason(
  supportingNodeIds: string[],
  sourceCategories: DossierSourceCategory[],
): boolean {
  if (!sourceCategories.includes("inferred_model_generated")) {
    return false;
  }

  const groundedCategoryCount = sourceCategories.filter(
    (category) => category !== "inferred_model_generated",
  ).length;
  return supportingNodeIds.length <= 2 || groundedCategoryCount < 2;
}

function averageScore(values: Array<number | null | undefined>): number | null {
  const normalized = values.filter(
    (value): value is number => typeof value === "number" && value > 0,
  );
  if (normalized.length === 0) return null;
  return round2(normalized.reduce((sum, value) => sum + value, 0) / normalized.length);
}

function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values));
}

function uniqueReasonCodes(
  values: RecommendationConfidenceReasonCode[],
): RecommendationConfidenceReasonCode[] {
  return Array.from(new Set(values));
}

function joinList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0]!;
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildDownstreamInputs(
  input: DossierBuildInput,
  latestOutputs: LatestOutputsSectionData,
): DownstreamInputsSectionData {
  const pricing = buildPricingInputFromEnrichment({
    property: {
      propertyId: input.property._id,
      listPrice: input.property.listPrice,
      address: {
        formatted: input.property.address.formatted,
        zip: input.property.zip ?? input.property.address.zip,
      },
      beds: input.property.beds,
      bathsFull: input.property.bathsFull,
      bathsHalf: input.property.bathsHalf,
      sqftLiving: input.property.sqftLiving,
      yearBuilt: input.property.yearBuilt,
      propertyType: input.property.propertyType,
      zestimate: input.property.zestimate,
      redfinEstimate: input.property.redfinEstimate,
      realtorEstimate: input.property.realtorEstimate,
    },
    estimates: input.portalEstimates,
    marketContext: input.marketContext,
    contexts: input.marketContext?.baselines,
    recentSales: input.recentSales,
  });

  const comps = {
    subject: {
      address: input.property.address.formatted ?? "Unknown",
      beds: input.property.beds ?? 0,
      baths:
        (input.property.bathsFull ?? 0) + (input.property.bathsHalf ?? 0) * 0.5,
      sqft: input.property.sqftLiving ?? 0,
      yearBuilt: input.property.yearBuilt ?? 0,
      lotSize: input.property.lotSize,
      propertyType: input.property.propertyType ?? "Unknown",
      waterfront: input.property.waterfrontType
        ? input.property.waterfrontType !== "none"
        : false,
      pool: input.property.pool,
      hoaFee: input.property.hoaFee,
      subdivision: input.property.subdivision,
      schoolDistrict: input.property.schoolDistrict,
      zip: input.property.zip ?? input.property.address.zip,
      listPrice: input.property.listPrice ?? 0,
      garageSpaces: input.property.garageSpaces,
    },
    candidates: buildCompCandidatesFromRecentSales(input.recentSales),
  };

  const leverage = buildLeverageInputFromEnrichment({
    property: {
      propertyId: input.property._id,
      listPrice: input.property.listPrice,
      daysOnMarket: input.property.daysOnMarket,
      description: input.property.description,
      sqftLiving: input.property.sqftLiving,
      wasRelisted: input.property.wasRelisted,
      wasWithdrawn: input.property.wasWithdrawn,
      wasPendingFellThrough: input.property.wasPendingFellThrough,
      priceReductions: input.property.priceReductions,
      address: {
        formatted: input.property.address.formatted,
        zip: input.property.zip ?? input.property.address.zip,
      },
    },
    marketContext: input.marketContext,
    contexts: input.marketContext?.baselines,
    listingAgent:
      input.listingAgents.find((agent) => agent.canonicalAgentId.length > 0) ?? null,
    recentSales: input.recentSales,
  });

  const caseSynthesis: CaseSynthesisInput = {
    pricing: latestOutputs.pricing?.output
      ? {
          output: latestOutputs.pricing.output,
          citationId: latestOutputs.pricing.outputId,
        }
      : undefined,
    comps: latestOutputs.comps?.output
      ? {
          output: latestOutputs.comps.output,
          citationId: latestOutputs.comps.outputId,
        }
      : undefined,
    leverage: latestOutputs.leverage?.output
      ? {
          output: latestOutputs.leverage.output,
          citationId: latestOutputs.leverage.outputId,
        }
      : undefined,
    offer: latestOutputs.offer?.output
      ? {
          output: latestOutputs.offer.output,
          citationId: latestOutputs.offer.outputId,
        }
      : undefined,
    listPrice: input.property.listPrice ?? 0,
  };

  const negotiationBrief: NegotiationBriefInputs = {
    subject: {
      propertyId: input.property._id,
      address: input.property.address.formatted ?? "Unknown",
      listPrice: input.property.listPrice ?? 0,
    },
    pricing:
      latestOutputs.pricing?.output && latestOutputs.pricing.promptVersion
        ? {
            version: latestOutputs.pricing.promptVersion,
            output: latestOutputs.pricing.output,
          }
        : undefined,
    comps:
      latestOutputs.comps?.output && latestOutputs.comps.promptVersion
        ? {
            version: latestOutputs.comps.promptVersion,
            output: latestOutputs.comps.output,
          }
        : undefined,
    leverage:
      latestOutputs.leverage?.output && latestOutputs.leverage.promptVersion
        ? {
            version: latestOutputs.leverage.promptVersion,
            output: latestOutputs.leverage.output,
          }
        : undefined,
    offer:
      latestOutputs.offer?.output && latestOutputs.offer.promptVersion
        ? {
            version: latestOutputs.offer.promptVersion,
            output: latestOutputs.offer.output,
          }
        : undefined,
    generatedAt: input.generatedAt,
  };

  return {
    engineInputs: {
      pricing,
      comps,
      leverage,
    },
    caseSynthesis,
    negotiationBrief: {
      ...negotiationBrief,
      generatedAt: input.generatedAt,
    },
  };
}

function buildPortalSignals(estimates: PortalEstimate[]) {
  const latestByPortal: Partial<Record<PortalEstimate["portal"], PortalEstimate>> = {};
  for (const estimate of estimates) {
    const current = latestByPortal[estimate.portal];
    if (!current || compareDesc(estimate.capturedAt, current.capturedAt) < 0) {
      latestByPortal[estimate.portal] = estimate;
    }
  }

  const values = Object.values(latestByPortal)
    .map((estimate) => estimate?.estimateValue)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return {
    estimates: [...estimates].sort((a, b) => compareDesc(a.capturedAt, b.capturedAt)),
    latestByPortal,
    consensusValue: values.length
      ? round2(values.reduce((sum, value) => sum + value, 0) / values.length)
      : null,
    spread: values.length >= 2 ? round2(Math.max(...values) - Math.min(...values)) : null,
  };
}

function createSection<T>(args: {
  key: string;
  title: string;
  visibility: DossierVisibility;
  sourceCategories: DossierSourceCategory[];
  confidence: number;
  lastRefreshedAt: string | null;
  provenance: DossierSourceRef[];
  data: T;
}): DossierSection<T> {
  const fingerprint = hashStableValue({
    key: args.key,
    sourceCategories: args.sourceCategories,
    provenance: args.provenance,
    data: args.data,
  });

  return {
    key: args.key,
    title: args.title,
    visibility: args.visibility,
    sourceCategories: args.sourceCategories,
    confidence: clamp01(args.confidence),
    freshness: {
      lastRefreshedAt: args.lastRefreshedAt,
      fingerprint,
      replayKey: `${PROPERTY_DOSSIER_VERSION}:${args.key}:${fingerprint}`,
    },
    provenance: args.provenance,
    data: args.data,
  };
}

function propertyFactsConfidence(input: DossierBuildInput): number {
  const sourceBoost = Math.min(input.sourceListings.length, 3) * 0.08;
  const browserConfidence = Math.max(
    0,
    ...input.browserUseRuns
      .map((run) => run.confidence ?? 0)
      .filter((value) => Number.isFinite(value)),
  );
  return Math.max(0.62 + sourceBoost, browserConfidence || 0.78);
}

function portalSignalsConfidence(estimates: PortalEstimate[]): number {
  const latest = new Set(estimates.map((estimate) => estimate.portal)).size;
  if (latest === 0) return 0;
  if (latest === 1) return 0.55;
  if (latest === 2) return 0.72;
  return 0.84;
}

function marketContextConfidence(
  marketContext: DossierBuildInput["marketContext"],
): number {
  if (!marketContext) return 0;
  const confidences = marketContext.windows.map((window) => window.confidence);
  return confidences.length
    ? round2(confidences.reduce((sum, value) => sum + value, 0) / confidences.length)
    : 0;
}

function comparableSalesConfidence(sales: RecentComparableSale[]): number {
  if (sales.length === 0) return 0;
  return Math.min(0.9, 0.42 + sales.length * 0.08);
}

function hasRiskHooks(input: DossierBuildInput): boolean {
  return Boolean(
    input.property.floodZone ||
      input.property.hurricaneZone ||
      input.property.hoaFee ||
      input.property.taxAnnual ||
      input.property.taxAssessedValue ||
      input.property.yearBuilt ||
      input.property.roofYear ||
      input.property.roofMaterial,
  );
}

function riskHooksConfidence(input: DossierBuildInput): number {
  let score = hasRiskHooks(input) ? 0.64 : 0;
  if ((input.documentBuyerSummaries?.length ?? 0) > 0) {
    score = Math.max(score, 0.76);
  }
  return score;
}

function documentConfidence(
  summaries:
    | Array<{
        uploadedAt: string;
        severity?: string;
      }>
    | undefined,
): number {
  if (!summaries || summaries.length === 0) return 0;
  return Math.min(0.9, 0.55 + summaries.length * 0.07);
}

function browserUseConfidence(runs: DossierBuildInput["browserUseRuns"]): number {
  const values = runs
    .map((run) => run.confidence)
    .filter((value): value is number => typeof value === "number");
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function enrichmentArtifactsConfidence(input: DossierBuildInput): number {
  const count = input.snapshots.length + input.listingAgents.length;
  if (count === 0) return 0;
  return Math.min(0.88, 0.46 + count * 0.08);
}

function downstreamInputsConfidence(
  input: DossierBuildInput,
  latestOutputs: LatestOutputsSectionData,
): number {
  const values = [
    propertyFactsConfidence(input),
    marketContextConfidence(input.marketContext),
    latestOutputsConfidence(latestOutputs),
  ].filter((value) => value > 0);
  if (values.length === 0) return 0;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function latestOutputsConfidence(outputs: LatestOutputsSectionData): number {
  const values = Object.values(outputs)
    .filter(Boolean)
    .map((output) => output!.confidence);
  if (values.length === 0) return 0;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function hasAnyLatestOutputs(outputs: LatestOutputsSectionData): boolean {
  return Object.values(outputs).some(Boolean);
}

function hasBrowserFacts(run: DossierBuildInput["browserUseRuns"][number]): boolean {
  return Object.keys(run.canonicalFields).length > 0;
}

function latestTimestamp(values: Array<string | undefined | null>): string | null {
  const normalized = values.filter((value): value is string => Boolean(value));
  if (normalized.length === 0) return null;
  return [...normalized].sort(compareDesc)[0] ?? null;
}

function sourceCategoryUnion(
  values: Array<DossierSourceCategory | null>,
): DossierSourceCategory[] {
  const found = new Set<DossierSourceCategory>();
  for (const value of values) {
    if (value) found.add(value);
  }

  return DOSSIER_SOURCE_CATEGORIES.filter((category) => found.has(category));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, inner]) => [key, stableValue(inner)]),
    );
  }
  return value;
}

export function hashStableValue(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compareDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return round2(value);
}

export const NEGOTIATION_BRIEF_SOURCE_VERSION = BUILDER_VERSION;
