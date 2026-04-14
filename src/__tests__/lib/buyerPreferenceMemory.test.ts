import { describe, expect, it } from "vitest";
import {
  buildBuyerPreferenceFitView,
  buildBuyerPreferenceMemorySnapshot,
  projectBuyerPreferenceFeatures,
  type BuyerPreferenceEventInput,
  type BuyerPreferencePropertyInput,
} from "@/lib/buyerPreferenceMemory";

function property(
  overrides: Partial<BuyerPreferencePropertyInput>,
): BuyerPreferencePropertyInput {
  return {
    id: overrides.id ?? "property-1",
    city: overrides.city ?? "Miami",
    subdivision: overrides.subdivision ?? null,
    propertyType: overrides.propertyType ?? "Single Family",
    hoaFee: overrides.hoaFee ?? 0,
    floodZone: overrides.floodZone ?? "X",
    listPrice: overrides.listPrice ?? 640_000,
    pool: overrides.pool ?? false,
    waterfrontType: overrides.waterfrontType ?? null,
    gatedCommunity: overrides.gatedCommunity ?? false,
  };
}

function event(
  input: Omit<BuyerPreferenceEventInput, "features"> & {
    property: BuyerPreferencePropertyInput;
  },
): BuyerPreferenceEventInput {
  return {
    propertyId: input.propertyId,
    occurredAt: input.occurredAt,
    eventKind: input.eventKind,
    sentiment: input.sentiment,
    strength: input.strength,
    summary: input.summary,
    features: projectBuyerPreferenceFeatures(input.property),
  };
}

describe("buyer preference memory", () => {
  it("stores durable repeated signals and suppresses one-off noise", () => {
    const events = [
      event({
        propertyId: "single-1",
        occurredAt: "2026-04-10T00:00:00.000Z",
        eventKind: "watchlist_saved",
        sentiment: "positive",
        strength: 0.6,
        summary: "Saved a single-family home.",
        property: property({
          id: "single-1",
          propertyType: "Single Family",
          hoaFee: 0,
          floodZone: "X",
        }),
      }),
      event({
        propertyId: "single-2",
        occurredAt: "2026-04-11T00:00:00.000Z",
        eventKind: "tour_feedback",
        sentiment: "positive",
        strength: 1,
        summary: "Loved another single-family home.",
        property: property({
          id: "single-2",
          propertyType: "Single Family",
          hoaFee: 0,
          floodZone: "X",
          city: "Coral Gables",
        }),
      }),
      event({
        propertyId: "condo-1",
        occurredAt: "2026-04-12T00:00:00.000Z",
        eventKind: "tour_feedback",
        sentiment: "negative",
        strength: 0.95,
        summary: "Rejected a condo with a heavy HOA.",
        property: property({
          id: "condo-1",
          propertyType: "Condo",
          hoaFee: 700,
          floodZone: "AE",
          city: "Miami Beach",
        }),
      }),
      event({
        propertyId: "condo-2",
        occurredAt: "2026-04-13T00:00:00.000Z",
        eventKind: "advisory_feedback",
        sentiment: "negative",
        strength: 0.7,
        summary: "Marked another condo as not fitting the plan.",
        property: property({
          id: "condo-2",
          propertyType: "Condo",
          hoaFee: 820,
          floodZone: "AE",
          city: "Sunny Isles",
        }),
      }),
      event({
        propertyId: "noise-1",
        occurredAt: "2026-04-13T00:00:00.000Z",
        eventKind: "watchlist_saved",
        sentiment: "positive",
        strength: 0.3,
        summary: "Saved one waterfront home once.",
        property: property({
          id: "noise-1",
          propertyType: "Single Family",
          waterfrontType: "bay",
        }),
      }),
    ];

    const snapshot = buildBuyerPreferenceMemorySnapshot({
      explicitPreferences: {
        preferredAreas: ["Coral Gables"],
        propertyTypes: ["single-family"],
        mustHaves: ["pool"],
        dealbreakers: ["hoa"],
      },
      events,
      now: "2026-04-13T12:00:00.000Z",
    });

    expect(snapshot.history.state).toBe("durable");
    expect(snapshot.history.distinctPropertyCount).toBe(5);

    const singleFamily = snapshot.inferredSignals.find(
      (signal) => signal.key === "property_type:single_family",
    );
    expect(singleFamily).toMatchObject({
      direction: "prefer",
      status: "durable",
    });

    const condo = snapshot.inferredSignals.find(
      (signal) => signal.key === "property_type:condo",
    );
    expect(condo).toMatchObject({
      direction: "avoid",
      status: "emerging",
    });

    const hoa = snapshot.inferredSignals.find(
      (signal) => signal.key === "hoa_burden:high",
    );
    expect(hoa).toMatchObject({
      direction: "avoid",
      status: "emerging",
    });

    const flood = snapshot.inferredSignals.find(
      (signal) => signal.key === "flood_risk:low",
    );
    expect(flood).toMatchObject({
      direction: "prefer",
      status: "durable",
    });

    const waterfront = snapshot.inferredSignals.find(
      (signal) => signal.key === "amenity:waterfront",
    );
    expect(waterfront?.status).toBe("suppressed");
  });

  it("builds buyer-safe fit output without overclaiming on thin histories", () => {
    const snapshot = buildBuyerPreferenceMemorySnapshot({
      explicitPreferences: {
        preferredAreas: ["Coral Gables"],
        propertyTypes: ["single-family"],
        mustHaves: [],
        dealbreakers: ["hoa"],
      },
      events: [
        event({
          propertyId: "single-1",
          occurredAt: "2026-04-12T00:00:00.000Z",
          eventKind: "watchlist_saved",
          sentiment: "positive",
          strength: 0.55,
          summary: "Saved a single-family home.",
          property: property({
            id: "single-1",
            propertyType: "Single Family",
            hoaFee: 0,
            floodZone: "X",
            city: "Coral Gables",
          }),
        }),
        event({
          propertyId: "single-2",
          occurredAt: "2026-04-13T00:00:00.000Z",
          eventKind: "tour_feedback",
          sentiment: "positive",
          strength: 1,
          summary: "Loved another single-family home.",
          property: property({
            id: "single-2",
            propertyType: "Single Family",
            hoaFee: 0,
            floodZone: "X",
            city: "Coral Gables",
          }),
        }),
      ],
      now: "2026-04-13T12:00:00.000Z",
    });

    const goodFit = buildBuyerPreferenceFitView({
      snapshot,
      property: property({
        id: "fit-1",
        propertyType: "Single Family",
        hoaFee: 0,
        floodZone: "X",
        city: "Coral Gables",
      }),
    });

    expect(goodFit.scoreLabel).toBe("Stronger fit than recent history");
    expect(goodFit.shouldInfluenceRecommendations).toBe(true);
    expect(goodFit.supportingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "explicit",
          label: "Matches your stated property type",
        }),
        expect.objectContaining({
          source: "inferred",
          kind: "supports",
        }),
      ]),
    );

    const badFit = buildBuyerPreferenceFitView({
      snapshot: buildBuyerPreferenceMemorySnapshot({
        explicitPreferences: {
          preferredAreas: [],
          propertyTypes: [],
          mustHaves: [],
          dealbreakers: ["hoa", "condo"],
        },
        events: [
          event({
            propertyId: "condo-1",
            occurredAt: "2026-04-11T00:00:00.000Z",
            eventKind: "tour_feedback",
            sentiment: "negative",
            strength: 1,
            summary: "Rejected a condo with a heavy HOA.",
            property: property({
              id: "condo-1",
              propertyType: "Condo",
              hoaFee: 700,
              floodZone: "AE",
            }),
          }),
          event({
            propertyId: "condo-2",
            occurredAt: "2026-04-13T00:00:00.000Z",
            eventKind: "advisory_feedback",
            sentiment: "negative",
            strength: 0.7,
            summary: "Rejected another condo with a heavy HOA.",
            property: property({
              id: "condo-2",
              propertyType: "Condo",
              hoaFee: 780,
              floodZone: "AE",
            }),
          }),
        ],
        now: "2026-04-13T12:00:00.000Z",
      }),
      property: property({
        id: "fit-2",
        propertyType: "Condo",
        hoaFee: 720,
        floodZone: "AE",
      }),
    });

    expect(badFit.scoreLabel).toBe("Repeats patterns usually rejected");
    expect(badFit.conflictingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "inferred",
          kind: "conflicts",
        }),
        expect.objectContaining({
          source: "explicit",
          label: "Conflicts with an explicit dealbreaker",
        }),
      ]),
    );
  });
});
