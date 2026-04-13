import { describe, expect, it } from "vitest";
import {
  buildTrustProofSurfaceReadModel,
  buildHomepageTrustProofReadModel,
  buildPricingTrustProofReadModel,
} from "@/lib/trustProof/readModel";
import type { CaseStudy, ProofBlock } from "@/lib/trustProof/types";

function makeIllustrativeCase(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: "case_demo",
    slug: "case-demo",
    source: "illustrative",
    headline: "Saved $18,000 on a first home",
    summary: "Illustrative summary",
    body: "Illustrative body",
    outcomes: {
      purchasePrice: 500_000,
      buyerSavings: 18_000,
    },
    buyer: {
      displayName: "Maria G.",
      location: "First-time buyer, Tampa",
    },
    visibility: "public",
    ...overrides,
  };
}

function makeLiveCase(overrides: Partial<CaseStudy> = {}): CaseStudy {
  return {
    id: "case_live",
    slug: "case-live",
    source: "liveTransaction",
    headline: "Live savings case",
    summary: "Live case summary",
    body: "Live case body",
    outcomes: {
      purchasePrice: 650_000,
      buyerSavings: 14_500,
    },
    buyer: {
      displayName: "Pilar S.",
      location: "Relocating buyer, Miami",
    },
    visibility: "public",
    verification: {
      closingDate: "2026-03-15",
      transactionRef: "txn_live_1",
      buyerConsent: true,
    },
    ...overrides,
  };
}

function makeBlock(overrides: Partial<ProofBlock> = {}): ProofBlock {
  return {
    id: "proof_demo",
    source: "illustrative",
    value: "$49.6K",
    label: "Illustrative savings across 3 scenarios",
    visibility: "public",
    ...overrides,
  };
}

const TEST_NOW = new Date("2026-04-12T12:00:00.000Z");

describe("buildTrustProofSurfaceReadModel", () => {
  it("keeps illustrative-only surfaces labeled", () => {
    const result = buildTrustProofSurfaceReadModel({
      caseStudies: [makeIllustrativeCase()],
      proofBlocks: [makeBlock()],
      now: TEST_NOW,
    });

    expect(result.sliceLabelingMode.kind).toBe("allIllustrative");
    expect(result.sectionBadge).toBe("Illustrative example");
    expect(result.caseStudies[0]?.badge).toBe("Illustrative example");
    expect(result.stats[0]?.badge).toBe("Illustrative example");
  });

  it("keeps mixed-state surfaces distinct", () => {
    const result = buildTrustProofSurfaceReadModel({
      caseStudies: [
        makeIllustrativeCase(),
        makeLiveCase(),
      ],
      proofBlocks: [
        makeBlock(),
        makeBlock({
          id: "proof_live",
          source: "liveTransaction",
          value: "$128K",
          label: "Closed buyer savings",
        }),
      ],
      now: TEST_NOW,
    });

    expect(result.sliceLabelingMode.kind).toBe("mixed");
    expect(result.sectionBadge).toBeNull();
    expect(result.caseStudies.find((study) => study.isIllustrative)?.badge).toBe(
      "Illustrative example",
    );
    expect(
      result.caseStudies.find((study) => !study.isIllustrative)?.badge,
    ).toBeNull();
    expect(result.summary.liveCaseStudies).toBe(1);
  });

  it("drops missing-proof records from the public surface", () => {
    const result = buildTrustProofSurfaceReadModel({
      caseStudies: [
        makeLiveCase({
          verification: {
            closingDate: "2099-01-01",
            transactionRef: "txn_future",
            buyerConsent: true,
          },
        }),
        makeIllustrativeCase({
          id: "internal_case",
          visibility: "internal",
        }),
      ],
      proofBlocks: [
        makeBlock({
          id: "internal_block",
          visibility: "internal",
        }),
      ],
      now: TEST_NOW,
    });

    expect(result.caseStudies).toEqual([]);
    expect(result.stats).toEqual([]);
    expect(result.summary.totalCaseStudies).toBe(0);
    expect(result.summary.totalProofBlocks).toBe(0);
  });
});

describe("surface wrappers", () => {
  it("builds homepage and pricing read models from the shared catalog", () => {
    const home = buildHomepageTrustProofReadModel(TEST_NOW);
    const pricing = buildPricingTrustProofReadModel(TEST_NOW);

    expect(home.stats.length).toBeGreaterThan(0);
    expect(home.caseStudies.length).toBeGreaterThan(0);
    expect(pricing.stats.length).toBeLessThanOrEqual(home.stats.length);
    expect(pricing.caseStudies.length).toBeLessThanOrEqual(
      home.caseStudies.length,
    );
  });
});
