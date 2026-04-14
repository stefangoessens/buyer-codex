import { describe, expect, it } from "vitest";

import {
  parseEngineInputSnapshot,
  serializeEngineInputSnapshot,
} from "@/lib/ai/engines/runtime";

describe("engine input snapshots", () => {
  it("serializes snapshots with stable key ordering", () => {
    const snapshot = serializeEngineInputSnapshot("offer", {
      competingOffers: 2,
      listPrice: 500000,
      pricing: {
        sourceOutputId: "pricing-output-1",
        fairValue: 485000,
      },
    });

    expect(snapshot).toBe(
      JSON.stringify({
        engineType: "offer",
        input: {
          competingOffers: 2,
          listPrice: 500000,
          pricing: {
            fairValue: 485000,
            sourceOutputId: "pricing-output-1",
          },
        },
        schemaVersion: "ai-engine-input.v1",
      }),
    );
  });

  it("parses versioned snapshots back into the typed input", () => {
    const input = parseEngineInputSnapshot<{
      listPrice: number;
      fairValue: number;
    }>(
      serializeEngineInputSnapshot("offer", {
        listPrice: 500000,
        fairValue: 485000,
      }),
      "offer",
    );

    expect(input).toEqual({
      listPrice: 500000,
      fairValue: 485000,
    });
  });

  it("keeps backward compatibility with historical plain JSON snapshots", () => {
    const input = parseEngineInputSnapshot<{ listPrice: number; leverageScore: number }>(
      JSON.stringify({
        listPrice: 500000,
        leverageScore: 62,
      }),
      "offer",
    );

    expect(input).toEqual({
      listPrice: 500000,
      leverageScore: 62,
    });
  });
});
