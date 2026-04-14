import { describe, expect, it } from "vitest";

import {
  dedupCandidates,
  evaluateCompsSelection,
  scoreSimilarity,
  selectComps,
} from "@/lib/ai/engines/comps";
import type { CompCandidate, CompsSubject } from "@/lib/ai/engines/types";

const subject: CompsSubject = {
  address: "123 Main St",
  beds: 3,
  baths: 2,
  sqft: 1800,
  yearBuilt: 2020,
  lotSize: 2200,
  propertyType: "Condo",
  subdivision: "Las Olas Isles",
  schoolDistrict: "Broward County",
  zip: "33301",
  listPrice: 500000,
  garageSpaces: 2,
  hoaFee: 700,
  condition: "renovated",
};

const makeCandidate = (
  canonicalId: string,
  overrides: Partial<CompCandidate> = {},
): CompCandidate => ({
  canonicalId,
  address: `${canonicalId} Oak Ave`,
  soldPrice: 480000,
  soldDate: "2026-03-20",
  beds: 3,
  baths: 2,
  sqft: 1780,
  yearBuilt: 2019,
  lotSize: 2100,
  propertyType: "Condo",
  subdivision: "Las Olas Isles",
  schoolDistrict: "Broward County",
  zip: "33301",
  sourcePlatform: "zillow",
  sourceCitation: `zillow://${canonicalId}`,
  garageSpaces: 2,
  hoaFee: 680,
  condition: "renovated",
  dom: 18,
  ...overrides,
});

function reverse<T>(items: T[]): T[] {
  return [...items].reverse();
}

describe("scoreSimilarity", () => {
  it("scores near-identical properties highly", () => {
    const score = scoreSimilarity(subject, makeCandidate("comp-1"));
    expect(score).toBeGreaterThan(0.9);
  });

  it("scores dissimilar properties lower", () => {
    const score = scoreSimilarity(
      subject,
      makeCandidate("comp-2", {
        beds: 5,
        baths: 4,
        sqft: 3600,
        yearBuilt: 1980,
        lotSize: 9000,
        propertyType: "House",
        garageSpaces: 0,
        hoaFee: undefined,
        condition: "original",
      }),
    );

    expect(score).toBeLessThan(0.45);
  });
});

describe("dedupCandidates", () => {
  it("dedups exact portal duplicates and keeps source citations", () => {
    const deduped = dedupCandidates([
      makeCandidate("dup-1", {
        sourcePlatform: "zillow",
        sourceCitation: "zillow://dup-1",
      }),
      makeCandidate("dup-1", {
        sourcePlatform: "redfin",
        sourceCitation: "redfin://dup-1",
      }),
      makeCandidate("unique-1", {
        sourcePlatform: "realtor",
        sourceCitation: "realtor://unique-1",
      }),
    ]);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].sourceCitations?.map((citation) => citation.portal)).toEqual([
      "redfin",
      "zillow",
    ]);
  });

  it("resolves sold-price conflicts by source quality and flags the conflict", () => {
    const deduped = dedupCandidates([
      makeCandidate("conflict-1", {
        soldPrice: 500000,
        sourcePlatform: "zillow",
        sourceCitation: "zillow://conflict-1",
      }),
      makeCandidate("conflict-1", {
        soldPrice: 515000,
        sourcePlatform: "redfin",
        sourceCitation: "redfin://conflict-1",
      }),
      makeCandidate("conflict-1", {
        soldPrice: 497500,
        sourcePlatform: "realtor",
        sourceCitation: "realtor://conflict-1",
      }),
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].soldPrice).toBe(515000);
    expect(deduped[0].sourcePlatform).toBe("redfin");
    expect(deduped[0].conflicts).toHaveLength(1);
    expect(deduped[0].conflicts?.[0].values).toHaveLength(3);
  });
});

describe("selectComps", () => {
  it("computes median aggregates from the selected comps", () => {
    const result = selectComps({
      subject,
      candidates: [
        makeCandidate("agg-1", {
          soldPrice: 480000,
          sqft: 1800,
          dom: 30,
          listPrice: 500000,
        }),
        makeCandidate("agg-2", {
          soldPrice: 500000,
          sqft: 1900,
          dom: 20,
          listPrice: 510000,
        }),
        makeCandidate("agg-3", {
          soldPrice: 490000,
          sqft: 1850,
          dom: 25,
          listPrice: 500000,
        }),
      ],
    });

    expect(result.aggregates.medianSoldPrice).toBe(490000);
    expect(result.aggregates.medianDom).toBe(25);
    expect(result.aggregates.medianSaleToListRatio).toBeGreaterThan(0.95);
  });

  it("downgrades from subdivision to school-zone selection when subdivision is sparse", () => {
    const result = selectComps({
      subject: { ...subject, subdivision: "Rare Isle" },
      candidates: [
        makeCandidate("school-1", {
          subdivision: "Rare Isle",
          soldPrice: 485000,
        }),
        makeCandidate("school-2", {
          subdivision: "Harbor Beach",
          soldPrice: 490000,
        }),
        makeCandidate("school-3", {
          subdivision: "Colee Hammock",
          soldPrice: 495000,
        }),
        makeCandidate("school-4", {
          subdivision: "Victoria Park",
          soldPrice: 500000,
        }),
      ],
    });

    expect(result.selectionBasis).toBe("school_zone");
    expect(result.selectionReason).toContain("downgraded to school zone");
    expect(
      result.comps.every(
        (comp) => comp.candidate.schoolDistrict === subject.schoolDistrict,
      ),
    ).toBe(true);
  });

  it("falls back to zip when school-zone results are still sparse", () => {
    const result = selectComps({
      subject: { ...subject, subdivision: "Rare Isle", schoolDistrict: "Small District" },
      candidates: [
        makeCandidate("zip-1", {
          subdivision: "Rare Isle",
          schoolDistrict: "Small District",
        }),
        makeCandidate("zip-2", {
          subdivision: "Other",
          schoolDistrict: "Other District",
        }),
        makeCandidate("zip-3", {
          subdivision: "Other",
          schoolDistrict: "Other District",
        }),
      ],
    });

    expect(result.selectionBasis).toBe("zip");
    expect(result.selectionReason).toContain("downgraded to zip");
  });

  it("keeps ranking deterministic for representative sold-comp fixture sets", () => {
    const fixtureSet = [
      makeCandidate("det-1", {
        soldPrice: 498000,
        sqft: 1795,
        soldDate: "2026-04-01",
        sourcePlatform: "zillow",
      }),
      makeCandidate("det-1", {
        soldPrice: 498000,
        sqft: 1795,
        soldDate: "2026-04-01",
        sourcePlatform: "redfin",
        sourceCitation: "redfin://det-1",
      }),
      makeCandidate("det-2", {
        soldPrice: 492000,
        sqft: 1810,
        soldDate: "2026-03-28",
        sourcePlatform: "realtor",
        sourceCitation: "realtor://det-2",
      }),
      makeCandidate("det-3", {
        soldPrice: 510000,
        sqft: 1840,
        soldDate: "2026-03-25",
        subdivision: "Harbor Beach",
      }),
      makeCandidate("det-4", {
        soldPrice: 505000,
        sqft: 1760,
        soldDate: "2026-03-19",
        subdivision: "Victoria Park",
      }),
      makeCandidate("det-5", {
        soldPrice: 501000,
        sqft: 1805,
        soldDate: "2026-03-18",
        subdivision: "Las Olas Isles",
      }),
    ];

    const forward = selectComps({ subject, candidates: fixtureSet, maxComps: 4 });
    const backward = selectComps({
      subject,
      candidates: reverse(fixtureSet),
      maxComps: 4,
    });

    expect(forward.comps.map((comp) => comp.candidate.canonicalId)).toEqual(
      backward.comps.map((comp) => comp.candidate.canonicalId),
    );
    expect(forward.comps.map((comp) => comp.sourceCitation)).toEqual(
      backward.comps.map((comp) => comp.sourceCitation),
    );
  });

  it("returns explicit adjustment metadata and per-portal citations", () => {
    const result = selectComps({
      subject,
      candidates: [
        makeCandidate("meta-1", {
          sourcePlatform: "redfin",
          sourceCitation: "redfin://meta-1",
        }),
        makeCandidate("meta-1", {
          sourcePlatform: "zillow",
          sourceCitation: "zillow://meta-1",
        }),
        makeCandidate("meta-2"),
        makeCandidate("meta-3"),
      ],
    });

    expect(result.comps[0].adjustments?.locationMatch).toBe("subdivision");
    expect(result.comps[0].sourceCitations?.map((citation) => citation.portal)).toEqual([
      "redfin",
      "zillow",
    ]);
  });

  it("packages deterministic execution metadata for replay and persistence", () => {
    const execution = evaluateCompsSelection({
      subject,
      candidates: [
        makeCandidate("meta-1", {
          sourcePlatform: "redfin",
          sourceCitation: "redfin://meta-1",
        }),
        makeCandidate("meta-2", {
          sourcePlatform: "zillow",
          sourceCitation: "zillow://meta-2",
        }),
        makeCandidate("meta-3", {
          sourcePlatform: "realtor",
          sourceCitation: "realtor://meta-3",
        }),
      ],
    });

    expect(execution.modelId).toBe("deterministic-comps-v2");
    expect(execution.confidence).toBeGreaterThan(0.7);
    expect(execution.citations).toEqual([
      "redfin://meta-1",
      "zillow://meta-2",
      "realtor://meta-3",
    ]);
  });
});
