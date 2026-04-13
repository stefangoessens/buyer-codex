import type { CaseSynthesisInput } from "@/lib/ai/engines/caseSynthesis";
import {
  buildCompCandidatesFromRecentSales,
  buildLeverageInputFromEnrichment,
  buildPricingInputFromEnrichment,
} from "@/lib/enrichment/engineContext";
import { pickResolvedMarketContext } from "@/lib/enrichment/marketContext";
import type { PortalEstimate, RecentComparableSale } from "@/lib/enrichment/types";
import { BUILDER_VERSION } from "@/lib/negotiation/brief";
import type { NegotiationBriefInputs } from "@/lib/negotiation/types";
import {
  DOSSIER_SOURCE_CATEGORIES,
  PROPERTY_DOSSIER_VERSION,
  type DossierBuildInput,
  type DossierSection,
  type DossierSourceCategory,
  type DossierSourceRef,
  type DossierVisibility,
  type DownstreamInputsSectionData,
  type LatestOutputsSectionData,
  type PropertyDossier,
  type PropertyDossierSectionKey,
  type PropertyDossierSections,
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
  };
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
