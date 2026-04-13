"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const runCompsEngine = internalAction({
  args: {
    propertyId: v.id("properties"),
    promptVersion: v.string(),
    candidates: v.optional(v.array(v.any())),
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

    const enrichment: any = await ctx.runQuery(
      internal.enrichment.getForPropertyInternal,
      { propertyId: args.propertyId },
    );
    const prompt: any = await ctx.runQuery(
      internal.promptRegistry.getByVersion,
      {
        engineType: "comps",
        promptKey: "default",
        version: args.promptVersion,
      },
    );
    if (!prompt) {
      throw new Error(`Unknown comps prompt version: ${args.promptVersion}`);
    }

    const { selectComps } = await import("../../src/lib/ai/engines/comps");

    const subject = {
      address: property.address?.formatted ?? "Unknown",
      beds: property.beds ?? 0,
      baths: (property.bathsFull ?? 0) + (property.bathsHalf ?? 0) * 0.5,
      sqft: property.sqftLiving ?? 0,
      yearBuilt: property.yearBuilt ?? 0,
      lotSize: property.lotSize,
      propertyType: property.propertyType ?? "Unknown",
      waterfront: property.waterfrontType
        ? property.waterfrontType !== "none"
        : false,
      pool: property.pool,
      hoaFee: property.hoaFee,
      subdivision: property.subdivision,
      schoolDistrict: property.schoolDistrict,
      zip: property.zip ?? property.address?.zip ?? "",
      listPrice: property.listPrice ?? 0,
      garageSpaces: property.garageSpaces,
    };

    const candidates =
      args.candidates && args.candidates.length > 0
        ? args.candidates
        : enrichment?.engineInputs?.compsCandidates ?? [];
    const inputSnapshot = JSON.stringify({ subject, candidates });

    const result = selectComps({ subject, candidates });
    const citations = Array.from(
      new Set(
        result.comps.flatMap((comp) =>
          comp.sourceCitations?.map((citation) => citation.citation) ??
          [comp.sourceCitation],
        ),
      ),
    );
    const confidenceBase =
      result.comps.length >= 3 ? 0.7 : result.comps.length >= 1 ? 0.52 : 0.3;
    const basisBoost =
      result.selectionBasis === "subdivision"
        ? 0.18
        : result.selectionBasis === "school_zone"
          ? 0.1
          : 0.04;
    const conflictPenalty = result.comps.some(
      (comp) => (comp.candidate.conflicts?.length ?? 0) > 0,
    )
      ? 0.04
      : 0;
    const confidence = Number(
      Math.max(0.3, Math.min(0.94, confidenceBase + basisBoost - conflictPenalty))
        .toFixed(2),
    );

    const outputId: any = await ctx.runMutation(
      internal.aiEngineOutputs.createOutput,
      {
        propertyId: args.propertyId,
        engineType: "comps",
        promptKey: "default",
        promptVersion: args.promptVersion,
        inputSnapshot,
        confidence,
        citations,
        output: JSON.stringify(result),
        modelId: prompt.model,
      },
    );

    return outputId;
  },
});
