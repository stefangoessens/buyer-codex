import type {
  PricingInput,
  PricingOutput,
  PricePoint,
  PricingReviewFallback,
  PricingReviewReason,
} from "./types";
import { gateway, type GatewayDependencies } from "../gateway";
import type { GatewayRequest, GatewayUsage } from "../types";

const PRICING_REVIEW_CONFIDENCE_THRESHOLD = 0.8;
const HIGH_DISAGREEMENT_SPREAD = 0.12;

function roundPct(value: number): number {
  return Number(value.toFixed(1));
}

function computePercentDelta(
  value: number,
  reference: number | null | undefined,
): number | null {
  if (!reference || reference <= 0) return null;
  return roundPct(((value - reference) / reference) * 100);
}

function referencePriceFromPsf(
  pricePerSqft: number | undefined,
  sqft: number,
): number | null {
  if (!pricePerSqft || pricePerSqft <= 0 || sqft <= 0) return null;
  return Math.round(pricePerSqft * sqft);
}

function sourceCoverageConfidenceAdjustment(sourceCount: number): number {
  if (sourceCount >= 3) return 1;
  if (sourceCount === 2) return 0.92;
  if (sourceCount === 1) return 0.78;
  return 0.6;
}

function buildReviewFallback(args: {
  overallConfidence: number;
  spread: number;
  sourceCount: number;
}): PricingReviewFallback {
  const reasons: PricingReviewReason[] = [];

  if (args.sourceCount === 0) {
    reasons.push("missing_estimates");
  } else if (args.sourceCount < 3) {
    reasons.push("sparse_estimates");
  }

  if (args.spread >= HIGH_DISAGREEMENT_SPREAD) {
    reasons.push("estimate_disagreement");
  }

  const reviewRequired =
    args.overallConfidence < PRICING_REVIEW_CONFIDENCE_THRESHOLD ||
    reasons.length > 0;

  if (!reviewRequired) {
    return {
      reviewRequired: false,
      reasons: [],
      summary: null,
    };
  }

  const summaryParts: string[] = [];
  if (reasons.includes("missing_estimates")) {
    summaryParts.push("No portal estimates were available");
  } else if (reasons.includes("sparse_estimates")) {
    summaryParts.push("Portal coverage was incomplete");
  }
  if (reasons.includes("estimate_disagreement")) {
    summaryParts.push("portal estimates disagreed materially");
  }
  if (summaryParts.length === 0) {
    summaryParts.push("Confidence is below the auto-approval threshold");
  }

  return {
    reviewRequired: true,
    reasons,
    summary: `${summaryParts.join(" and ")}; broker review required.`,
  };
}

/**
 * Compute consensus estimate from available portal estimates.
 * Uses median of available values.
 */
export function computeConsensus(input: PricingInput): {
  consensus: number;
  spread: number;
  sources: string[];
} {
  const estimates: { value: number; source: string }[] = [];
  if (input.zestimate) estimates.push({ value: input.zestimate, source: "zillow" });
  if (input.redfinEstimate) estimates.push({ value: input.redfinEstimate, source: "redfin" });
  if (input.realtorEstimate) estimates.push({ value: input.realtorEstimate, source: "realtor" });

  if (estimates.length === 0) {
    return { consensus: input.listPrice, spread: 0, sources: [] };
  }

  const values = estimates.map((e) => e.value).sort((a, b) => a - b);
  const sources = estimates.map((e) => e.source);

  // Median
  const mid = Math.floor(values.length / 2);
  const consensus =
    values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

  // Spread = coefficient of variation (std dev / mean)
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const spread = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return { consensus, spread, sources };
}

/**
 * Compute confidence adjustment based on estimate spread.
 * High disagreement between portals lowers confidence.
 */
export function spreadConfidenceAdjustment(spread: number): number {
  if (spread < 0.03) return 1.0; // < 3% spread — high agreement
  if (spread < 0.07) return 0.9; // 3-7% — moderate
  if (spread < 0.12) return 0.75; // 7-12% — some disagreement
  return 0.6; // > 12% — significant disagreement
}

/**
 * Build a price point with deltas.
 */
export function buildPricePoint(
  value: number,
  listPrice: number,
  consensus: number,
  baseConfidence: number,
  referencePrices: {
    neighborhoodMedianPrice?: number | null;
    compAveragePrice?: number | null;
  } = {},
): PricePoint {
  return {
    value: Math.round(value),
    deltaVsListPrice: listPrice > 0
      ? roundPct(((value - listPrice) / listPrice) * 100)
      : 0,
    deltaVsConsensus: consensus > 0
      ? roundPct(((value - consensus) / consensus) * 100)
      : 0,
    deltaVsNeighborhoodMedian: computePercentDelta(
      value,
      referencePrices.neighborhoodMedianPrice,
    ),
    deltaVsCompAverage: computePercentDelta(
      value,
      referencePrices.compAveragePrice,
    ),
    confidence: Number(baseConfidence.toFixed(2)),
  };
}

/**
 * Build the gateway request for the pricing engine.
 */
export function buildPricingRequest(
  input: PricingInput,
  promptTemplate: string,
  systemPrompt?: string,
): GatewayRequest {
  const { consensus, spread, sources } = computeConsensus(input);
  const spreadAdj = spreadConfidenceAdjustment(spread);

  const userMessage = promptTemplate
    .replace("{{address}}", input.address)
    .replace("{{listPrice}}", input.listPrice.toLocaleString())
    .replace("{{beds}}", String(input.beds))
    .replace("{{baths}}", String(input.baths))
    .replace("{{sqft}}", input.sqft.toLocaleString())
    .replace("{{yearBuilt}}", String(input.yearBuilt))
    .replace("{{propertyType}}", input.propertyType)
    .replace("{{consensus}}", consensus.toLocaleString())
    .replace("{{spread}}", (spread * 100).toFixed(1))
    .replace("{{sources}}", sources.join(", ") || "none")
    .replace(
      "{{neighborhoodMedianPsf}}",
      input.neighborhoodMedianPsf?.toLocaleString() ?? "N/A",
    )
    .replace(
      "{{compAvgPsf}}",
      input.compAvgPsf?.toLocaleString() ?? "N/A",
    );

  const messages: GatewayRequest["messages"] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: userMessage });

  return {
    messages,
    engineType: "pricing",
    maxTokens: 2048,
    temperature: 0,
  };
}

/**
 * Parse the AI response into a typed PricingOutput.
 * Expects JSON in the response.
 */
export function parsePricingResponse(
  responseText: string,
  input: PricingInput,
  consensus: number,
  spread: number,
  sources: string[],
): PricingOutput | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required numeric fields
    const required = ["fairValue", "likelyAccepted", "strongOpener", "walkAway"];
    for (const field of required) {
      if (typeof parsed[field] !== "number" || !isFinite(parsed[field]) || parsed[field] <= 0) {
        return null;
      }
    }

    const spreadAdj = spreadConfidenceAdjustment(spread);
    const sourceCoverageAdj = sourceCoverageConfidenceAdjustment(sources.length);
    const confidenceMultiplier = spreadAdj * sourceCoverageAdj;
    const neighborhoodMedianPrice = referencePriceFromPsf(
      input.neighborhoodMedianPsf,
      input.sqft,
    );
    const compAveragePrice = referencePriceFromPsf(input.compAvgPsf, input.sqft);
    const overallConfidence = Number((0.9 * confidenceMultiplier).toFixed(2));

    const output: PricingOutput = {
      fairValue: buildPricePoint(
        parsed.fairValue,
        input.listPrice,
        consensus,
        0.85 * confidenceMultiplier,
        {
          neighborhoodMedianPrice,
          compAveragePrice,
        },
      ),
      likelyAccepted: buildPricePoint(
        parsed.likelyAccepted,
        input.listPrice,
        consensus,
        0.8 * confidenceMultiplier,
        {
          neighborhoodMedianPrice,
          compAveragePrice,
        },
      ),
      strongOpener: buildPricePoint(
        parsed.strongOpener,
        input.listPrice,
        consensus,
        0.75 * confidenceMultiplier,
        {
          neighborhoodMedianPrice,
          compAveragePrice,
        },
      ),
      walkAway: buildPricePoint(
        parsed.walkAway,
        input.listPrice,
        consensus,
        0.7 * confidenceMultiplier,
        {
          neighborhoodMedianPrice,
          compAveragePrice,
        },
      ),
      consensusEstimate: consensus,
      estimateSpread: Number(spread.toFixed(4)),
      estimateSources: sources,
      overallConfidence,
      marketReferences: {
        listPrice: input.listPrice,
        consensusEstimate: consensus,
        neighborhoodMedianPrice,
        compAveragePrice,
      },
    };

    output.reviewFallback = buildReviewFallback({
      overallConfidence,
      spread,
      sourceCount: sources.length,
    });

    return output;
  } catch {
    return null;
  }
}

export async function executePricingAnalysis(args: {
  input: PricingInput;
  promptTemplate: string;
  systemPrompt?: string;
  promptKey?: string;
  promptVersion?: string;
  promptModel?: string;
  dealRoomId?: string;
  gatewayDependencies?: Partial<GatewayDependencies>;
}): Promise<{ output: PricingOutput; usage: GatewayUsage }> {
  const {
    input,
    promptTemplate,
    systemPrompt,
    promptKey,
    promptVersion,
    promptModel,
    dealRoomId,
    gatewayDependencies,
  } = args;

  const request = buildPricingRequest(input, promptTemplate, systemPrompt);
  const response = await gateway(
    {
      ...request,
      dealRoomId,
      prompt:
        promptKey && promptVersion
          ? {
              promptKey,
              version: promptVersion,
              model: promptModel,
            }
          : undefined,
    },
    gatewayDependencies,
  );

  if (!response.success) {
    throw new Error(`Pricing analysis failed: ${response.error.message}`);
  }

  const { consensus, spread, sources } = computeConsensus(input);
  const parsed = parsePricingResponse(
    response.data.content,
    input,
    consensus,
    spread,
    sources,
  );

  if (!parsed) {
    throw new Error("Pricing analysis returned an invalid response payload");
  }

  return {
    output: parsed,
    usage: response.data.usage,
  };
}
