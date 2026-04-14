"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { LeverageInput } from "../../src/lib/ai/engines/types";
import { evaluateLeverageAnalysis } from "../../src/lib/ai/engines/leverage";
import { serializeEngineInputSnapshot } from "../../src/lib/ai/engines/runtime";

export const runLeverageEngine = internalAction({
  args: {
    propertyId: v.id("properties"),
    promptVersion: v.string(),
  },
  returns: v.union(v.id("aiEngineOutputs"), v.null()),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.promptRegistry.syncCatalogPrompts, {
      activateMissing: true,
    });

    const property: any = await ctx.runQuery(internal.properties.getInternal, {
      propertyId: args.propertyId,
    });
    if (!property) return null;

    const dossier: any = await ctx.runMutation(
      internal.propertyDossiers.syncForProperty,
      { propertyId: args.propertyId },
    );
    const prompt: any = await ctx.runQuery(
      internal.promptRegistry.getByVersion,
      {
        engineType: "leverage",
        promptKey: "default",
        version: args.promptVersion,
      },
    );
    if (!prompt) {
      throw new Error(`Unknown leverage prompt version: ${args.promptVersion}`);
    }

    const input: LeverageInput =
      dossier?.sections?.downstreamInputs?.data?.engineInputs?.leverage ?? {
        propertyId: args.propertyId,
        listPrice: property.listPrice ?? 0,
        daysOnMarket: property.daysOnMarket ?? 0,
        description: property.description,
        sqft: property.sqftLiving ?? 0,
        neighborhoodMedianDom: property.neighborhoodMedianDom,
        neighborhoodMedianPsf: property.neighborhoodMedianPsf,
        wasRelisted: property.wasRelisted,
        wasWithdrawn: property.wasWithdrawn,
        wasPendingFellThrough: property.wasPendingFellThrough,
      };
    const inputSnapshot = serializeEngineInputSnapshot("leverage", input);
    const execution = evaluateLeverageAnalysis(input);

    const outputId: any = await ctx.runMutation(
      internal.aiEngineOutputs.createOutput,
      {
        propertyId: args.propertyId,
        engineType: "leverage",
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
