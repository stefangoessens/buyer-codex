import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
}));

import * as advisoryBacktestingModule from "../../../convex/advisoryBacktesting";

type TableName =
  | "pricingCalibrationRecords"
  | "recommendationBacktestRecords"
  | "adjudicationCalibrationRecords";

type Tables = Record<TableName, Array<Record<string, unknown>>>;

type TestContext = {
  db: {
    query: (table: TableName) => {
      collect: () => Promise<Array<Record<string, unknown>>>;
    };
  };
};

function invokeRegisteredHandler<TResult>(
  registration: unknown,
  ctx: TestContext,
  args: Record<string, unknown>,
): Promise<TResult> {
  const handler = (
    registration as {
      _handler: (
        ctx: TestContext,
        args: Record<string, unknown>,
      ) => Promise<TResult> | TResult;
    }
  )._handler;

  return Promise.resolve(handler(ctx, args));
}

function createContext(initial: Partial<Tables> = {}) {
  const tables: Tables = {
    pricingCalibrationRecords: [...(initial.pricingCalibrationRecords ?? [])],
    recommendationBacktestRecords: [
      ...(initial.recommendationBacktestRecords ?? []),
    ],
    adjudicationCalibrationRecords: [
      ...(initial.adjudicationCalibrationRecords ?? []),
    ],
  };

  return {
    ctx: {
      db: {
        query(table: TableName) {
          return {
            async collect() {
              return tables[table].map((row) => ({ ...row }));
            },
          };
        },
      },
    } as TestContext,
  };
}

beforeEach(() => {
  sessionMocks.requireAuth.mockReset();
  sessionMocks.requireAuth.mockResolvedValue({
    _id: "user_broker",
    role: "broker",
  });
});

describe("advisoryBacktesting", () => {
  it("includes adjudication calibration signals alongside confidence and recommendation backtests", async () => {
    const { ctx } = createContext({
      pricingCalibrationRecords: [
        {
          propertyId: "property_1",
          engineOutputId: "output_pricing_1",
          promptVersion: "pricing-v1",
          modelId: "gpt-5.4",
          predictedFairValue: 600000,
          predictedLikelyAccepted: 610000,
          predictedStrongOpener: 590000,
          predictedWalkAway: 625000,
          actualAcceptedPrice: 608000,
          errorFairValue: 0.01,
          errorLikelyAccepted: 0.003,
          errorStrongOpener: 0.03,
          errorWalkAway: 0.02,
          meanAbsoluteError: 0.0158,
          highError: false,
          overallConfidence: 0.76,
          realizedScore: 0.92,
          confidenceDelta: -0.16,
          withinPredictedRange: true,
          primaryErrorCategory: "within_expected_range",
          errorCategories: ["within_expected_range"],
          daysToAccept: 5,
          countersMade: 1,
          acceptedAt: "2026-04-15T12:00:00.000Z",
          recordedAt: "2026-04-15T12:00:00.000Z",
        },
      ],
      recommendationBacktestRecords: [
        {
          propertyId: "property_1",
          dealRoomId: "deal_1",
          offerId: "offer_1",
          propertyCaseId: "case_1",
          synthesisVersion: "1.0.0",
          recommendationGeneratedAt: "2026-04-13T12:00:00.000Z",
          recommendationConfidence: 0.78,
          recommendedOpeningPrice: 600000,
          recommendedRiskLevel: "medium",
          recommendedContingencies: ["inspection"],
          sourceOutputIds: ["output_offer_1"],
          actualOfferPrice: 603000,
          actualAcceptedPrice: 605000,
          actualOutcome: "accepted",
          actualContingencies: ["inspection"],
          priceDeltaPct: 0.005,
          contingencyMatchRatio: 1,
          adoptionScore: 0.875,
          followedRecommendation: true,
          realizedScore: 0.875,
          confidenceDelta: -0.095,
          primaryErrorCategory: "followed_recommendation",
          errorCategories: ["followed_recommendation"],
          countersMade: 1,
          outcomeRecordedAt: "2026-04-15T12:00:00.000Z",
        },
      ],
      adjudicationCalibrationRecords: [
        {
          propertyId: "property_1",
          dealRoomId: "deal_1",
          propertyCaseId: "case_1",
          engineOutputId: "output_offer_1",
          adjudicationId: "adj_1",
          engineType: "offer",
          action: "adjust",
          visibility: "buyer_safe",
          reasonCategory: "human_judgment",
          outputConfidence: 0.82,
          confidenceBucket: "high",
          promptVersion: "offer-v2",
          modelId: "gpt-5.4",
          reviewStateBefore: "pending",
          reviewStateAfter: "approved",
          confidenceSignal: "review_required",
          recommendationSignal: "recommendation_adjusted",
          revisionType: "reviewed_conclusion",
          calibrationTargets: ["confidence", "recommendation"],
          linkedClaimCount: 1,
          linkedClaimTopics: ["offer_recommendation"],
          recommendationLinkedClaimCount: 1,
          recommendationRelevant: true,
          reviewedConclusionPresent: true,
          buyerExplanationPresent: true,
          internalNotesPresent: false,
          generatedAt: "2026-04-13T18:00:00.000Z",
          adjudicatedAt: "2026-04-13T18:20:00.000Z",
          reviewLatencyMs: 1200000,
        },
      ],
    });

    const result = (await invokeRegisteredHandler(
      advisoryBacktestingModule.getCalibrationSnapshot,
      ctx,
      {
        dealRoomId: "deal_1",
        limit: 5,
      },
    )) as any;

    expect(result.pricingSummary.totalRecords).toBe(1);
    expect(result.recommendationSummary.totalRecords).toBe(1);
    expect(result.adjudicationSignals.overallSummary.totalRecords).toBe(1);
    expect(result.adjudicationSignals.confidenceSummary.totalRecords).toBe(1);
    expect(result.adjudicationSignals.recommendationSummary.totalRecords).toBe(1);
    expect(result.adjudicationSignals.recent[0]).toMatchObject({
      engineOutputId: "output_offer_1",
      recommendationSignal: "recommendation_adjusted",
      confidenceSignal: "review_required",
    });
  });
});
