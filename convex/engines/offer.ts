"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type {
  OfferInput,
  OfferLeverageContext,
  OfferPricingContext,
} from "../../src/lib/ai/engines/types";
import { evaluateOfferScenarios } from "../../src/lib/ai/engines/offer";
import { serializeEngineInputSnapshot } from "../../src/lib/ai/engines/runtime";

export const runOfferEngine = internalAction({
  args: {
    propertyId: v.id("properties"),
    promptVersion: v.string(),
    buyerMaxBudget: v.optional(v.number()),
    competingOffers: v.optional(v.number()),
  },
  returns: v.union(v.id("aiEngineOutputs"), v.null()),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.promptRegistry.syncCatalogPrompts, {
      activateMissing: true,
    });

    const property: any = await ctx.runQuery(internal.properties.getInternal, {
      propertyId: args.propertyId,
    });
    if (!property || !property.listPrice) return null;
    const prompt: any = await ctx.runQuery(
      internal.promptRegistry.getByVersion,
      {
        engineType: "offer",
        promptKey: "default",
        version: args.promptVersion,
      },
    );
    if (!prompt) {
      throw new Error(`Unknown offer prompt version: ${args.promptVersion}`);
    }

    // Get latest pricing output for explicit offer dependencies.
    const pricingOutput: any = await ctx.runQuery(
      api.aiEngineOutputs.getLatest,
      {
        propertyId: args.propertyId,
        engineType: "pricing",
      },
    );
    let pricingContext: OfferPricingContext | undefined;
    if (pricingOutput) {
      try {
        const parsed = JSON.parse(pricingOutput.output);
        const fairValue = parsed.fairValue?.value;
        if (typeof fairValue === "number") {
          pricingContext = {
            fairValue,
            likelyAccepted: parsed.likelyAccepted?.value,
            strongOpener: parsed.strongOpener?.value,
            walkAway: parsed.walkAway?.value,
            reviewRequired: parsed.reviewFallback?.reviewRequired,
            sourceOutputId: String(pricingOutput._id),
          };
        }
      } catch {
        // pricing output may not be parseable — proceed without fair value
      }
    }

    // Get latest leverage output for explicit offer dependencies.
    const leverageOutput: any = await ctx.runQuery(
      api.aiEngineOutputs.getLatest,
      {
        propertyId: args.propertyId,
        engineType: "leverage",
      },
    );
    let leverageContext: OfferLeverageContext | undefined;
    if (leverageOutput) {
      try {
        const parsed = JSON.parse(leverageOutput.output);
        if (typeof parsed.score === "number") {
          leverageContext = {
            score: parsed.score,
            summary: parsed.summary,
            signalCount: parsed.signalCount,
            signalNames: Array.isArray(parsed.signals)
              ? parsed.signals
                  .map((signal: { name?: unknown }) =>
                    typeof signal.name === "string" ? signal.name : null,
                  )
                  .filter((value: string | null): value is string => value !== null)
              : undefined,
            sourceOutputId: String(leverageOutput._id),
          };
        }
      } catch {
        // leverage output may not be parseable — proceed without leverage score
      }
    }

    const input: OfferInput = {
      listPrice: property.listPrice,
      pricing: pricingContext,
      leverage: leverageContext,
      fairValue: pricingContext?.fairValue,
      leverageScore: leverageContext?.score,
      buyerMaxBudget: args.buyerMaxBudget,
      daysOnMarket: property.daysOnMarket,
      competingOffers: args.competingOffers,
      sellerMotivated: leverageContext?.signalNames?.includes(
        "motivated_seller_language",
      ),
    };
    const execution = evaluateOfferScenarios(input);
    const inputSnapshot = serializeEngineInputSnapshot("offer", input);

    const outputId: any = await ctx.runMutation(
      internal.aiEngineOutputs.createOutput,
      {
        propertyId: args.propertyId,
        engineType: "offer",
        promptKey: "default",
        promptVersion: args.promptVersion,
        inputSnapshot,
        confidence: execution.confidence,
        citations: execution.citations,
        output: JSON.stringify(execution.output),
        modelId: execution.modelId,
      },
    );

    return outputId;
  },
});
