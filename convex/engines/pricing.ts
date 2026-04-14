"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { PricingInput } from "../../src/lib/ai/engines/types";
import { executePricingAnalysis } from "../../src/lib/ai/engines/pricing";
import { serializeEngineInputSnapshot } from "../../src/lib/ai/engines/runtime";

export const runPricingEngine = internalAction({
  args: {
    propertyId: v.id("properties"),
    promptVersion: v.string(),
  },
  returns: v.union(v.id("aiEngineOutputs"), v.null()),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.promptRegistry.syncCatalogPrompts, {
      activateMissing: true,
    });

    // 1. Load property data
    const property: any = await ctx.runQuery(
      internal.properties.getInternal,
      { propertyId: args.propertyId },
    );
    if (!property) return null;

    // 2. Load the explicitly requested prompt version
    const prompt: any = await ctx.runQuery(
      internal.promptRegistry.getByVersion,
      {
        engineType: "pricing",
        promptKey: "default",
        version: args.promptVersion,
      },
    );
    if (!prompt) {
      throw new Error(`Unknown pricing prompt version: ${args.promptVersion}`);
    }

    const dossier: any = await ctx.runMutation(
      internal.propertyDossiers.syncForProperty,
      { propertyId: args.propertyId },
    );

    // 3. Build and run the pricing engine
    const input: PricingInput =
      dossier?.sections?.downstreamInputs?.data?.engineInputs?.pricing ?? {
        propertyId: args.propertyId,
        listPrice: property.listPrice ?? 0,
        address: property.address?.formatted ?? "Unknown",
        beds: property.beds ?? 0,
        baths: (property.bathsFull ?? 0) + (property.bathsHalf ?? 0) * 0.5,
        sqft: property.sqftLiving ?? 0,
        yearBuilt: property.yearBuilt ?? 0,
        propertyType: property.propertyType ?? "Unknown",
        zestimate: property.zestimate,
        redfinEstimate: property.redfinEstimate,
        realtorEstimate: property.realtorEstimate,
      };
    const inputSnapshot = serializeEngineInputSnapshot("pricing", input);
    const { output: pricingOutput, usage } = await executePricingAnalysis({
      input,
      promptTemplate: prompt.prompt,
      systemPrompt: prompt.systemPrompt,
      promptKey: "default",
      promptVersion: prompt.version,
      promptModel: prompt.model,
    });

    // 4. Store the engine output
    const outputId: any = await ctx.runMutation(
      internal.aiEngineOutputs.createOutput,
      {
        propertyId: args.propertyId,
        engineType: "pricing",
        promptKey: "default",
        promptVersion: args.promptVersion,
        inputSnapshot,
        confidence: pricingOutput.overallConfidence,
        citations: pricingOutput.estimateSources,
        output: JSON.stringify(pricingOutput),
        modelId: usage.model,
      },
    );

    return outputId;
  },
});
