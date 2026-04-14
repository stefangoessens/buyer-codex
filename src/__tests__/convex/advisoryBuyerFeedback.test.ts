import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackPosthogEvent: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
}));

vi.mock("../../../convex/lib/analytics", () => ({
  trackPosthogEvent: analyticsMocks.trackPosthogEvent,
}));

import * as advisoryBuyerFeedbackModule from "../../../convex/advisoryBuyerFeedback";

type Row = Record<string, unknown>;

type TableName =
  | "dealRooms"
  | "advisoryBuyerFeedback"
  | "auditLog"
  | "buyerProfiles"
  | "watchlistEntries"
  | "tourPostObservations"
  | "buyerPreferenceMemories";

type Tables = Record<TableName, Row[]>;

type TestContext = {
  db: {
    get: (id: string) => Promise<Row | null>;
    insert: (table: string, value: Row) => Promise<string>;
    query: (table: string) => {
      withIndex: (
        indexName: string,
        builder: (q: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown,
      ) => {
        collect: () => Promise<Row[]>;
        unique: () => Promise<Row | null>;
      };
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

function cloneRow<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) return row;
  return { ...row } as T;
}

function createContext(initial: Partial<Tables> = {}) {
  const tables: Tables = {
    dealRooms: [...(initial.dealRooms ?? [])],
    advisoryBuyerFeedback: [...(initial.advisoryBuyerFeedback ?? [])],
    auditLog: [...(initial.auditLog ?? [])],
    buyerProfiles: [...(initial.buyerProfiles ?? [])],
    watchlistEntries: [...(initial.watchlistEntries ?? [])],
    tourPostObservations: [...(initial.tourPostObservations ?? [])],
    buyerPreferenceMemories: [...(initial.buyerPreferenceMemories ?? [])],
  };

  const byId = new Map<
    string,
    { table: string; row: Row }
  >();

  for (const [tableName, rows] of Object.entries(tables) as Array<[string, Row[]]>) {
    for (const row of rows) {
      byId.set(String(row._id), { table: tableName, row });
    }
  }

  let nextId = 1;
  let nextCreationTime = 100;

  const db = {
    async get(id: string) {
      return cloneRow(byId.get(id)?.row ?? null);
    },
    async insert(table: string, value: Row) {
      const id = String(value._id ?? `${table}_${nextId++}`);
      const row = {
        ...value,
        _id: id,
        _creationTime: value._creationTime ?? nextCreationTime++,
      };
      const existingRows = tables[table as TableName];
      if (existingRows) {
        existingRows.push(row);
      }
      byId.set(id, { table, row });
      return id;
    },
    query(table: string) {
      return {
        withIndex(
          _indexName: string,
          builder: (q: {
            eq: (field: string, value: unknown) => unknown;
          }) => unknown,
        ) {
          const conditions: Array<{ field: string; value: unknown }> = [];
          const queryBuilder = {
            eq(field: string, value: unknown) {
              conditions.push({ field, value });
              return queryBuilder;
            },
          };

          builder(queryBuilder);

          const rows = Object.values(tables)
            .flat()
            .filter((row) => {
              const entry = byId.get(String(row._id));
              return (
                entry?.table === table &&
                conditions.every(({ field, value }) => row[field] === value)
              );
            });

          return {
            async collect() {
              return rows.map((row) => cloneRow(row)).filter(Boolean) as Row[];
            },
            async unique() {
              if (rows.length > 1) {
                throw new Error(
                  `Expected unique row in ${table}, found ${rows.length}`,
                );
              }
              return cloneRow(rows[0] ?? null);
            },
          };
        },
      };
    },
  };

  return { ctx: { db } as TestContext, tables };
}

const BUYER_USER = {
  _id: "user_buyer",
  _creationTime: 1,
  email: "buyer@example.com",
  name: "Buyer",
  role: "buyer" as const,
};

beforeEach(() => {
  sessionMocks.requireAuth.mockReset();
  analyticsMocks.trackPosthogEvent.mockReset();
  sessionMocks.requireAuth.mockResolvedValue(BUYER_USER);
  analyticsMocks.trackPosthogEvent.mockResolvedValue(true);
});

describe("advisoryBuyerFeedback submit", () => {
  it("persists structured buyer feedback and emits per-dimension telemetry", async () => {
    const { ctx, tables } = createContext({
      dealRooms: [
        {
          _id: "deal_1",
          buyerId: BUYER_USER._id,
          propertyId: "property_1",
        },
      ],
    });

    const id = await invokeRegisteredHandler<string>(
      advisoryBuyerFeedbackModule.submit,
      ctx,
      {
        dealRoomId: "deal_1",
        propertyId: "property_1",
        surface: "deal_room_overview",
        artifact: "recommendation",
        synthesisVersion: "1.0.0",
        artifactGeneratedAt: "2026-04-13T19:00:00.000Z",
        viewState: "partial",
        overallConfidence: 0.82,
        recommendationConfidence: 0.78,
        claimCount: 2,
        sourceCount: 3,
        missingSignalCount: 1,
        coverageAvailableCount: 3,
        coveragePendingCount: 1,
        coverageUncertainCount: 0,
        coverageMissingCount: 0,
        responses: [
          { dimension: "clarity", sentiment: "negative" },
          { dimension: "trust", sentiment: "negative" },
        ],
        reasonCodes: ["missing_evidence", "too_vague", "not_relevant"],
      },
    );

    expect(id).toBe("advisoryBuyerFeedback_1");
    expect(tables.advisoryBuyerFeedback[0]).toMatchObject({
      artifact: "recommendation",
      synthesisVersion: "1.0.0",
      buyerId: BUYER_USER._id,
      responses: [
        { dimension: "trust", sentiment: "negative" },
        { dimension: "clarity", sentiment: "negative" },
      ],
      reasonCodes: ["missing_evidence", "too_vague"],
    });
    expect(tables.auditLog[0]).toMatchObject({
      action: "advisory_buyer_feedback_submitted",
      entityType: "advisoryBuyerFeedback",
    });
    expect(analyticsMocks.trackPosthogEvent).toHaveBeenCalledTimes(2);
    expect(analyticsMocks.trackPosthogEvent).toHaveBeenNthCalledWith(
      1,
      "advisory_buyer_feedback_submitted",
      expect.objectContaining({
        artifact: "recommendation",
        dimension: "trust",
        sentiment: "negative",
        responseCount: 2,
        reasonCount: 2,
        reasonCodeKey: "missing_evidence|too_vague",
      }),
      BUYER_USER._id,
    );
    expect(analyticsMocks.trackPosthogEvent).toHaveBeenNthCalledWith(
      2,
      "advisory_buyer_feedback_submitted",
      expect.objectContaining({
        dimension: "clarity",
        sentiment: "negative",
      }),
      BUYER_USER._id,
    );
  });

  it("rejects feedback for another buyer's deal room", async () => {
    const { ctx } = createContext({
      dealRooms: [
        {
          _id: "deal_1",
          buyerId: "someone_else",
          propertyId: "property_1",
        },
      ],
    });

    await expect(
      invokeRegisteredHandler(advisoryBuyerFeedbackModule.submit, ctx, {
        dealRoomId: "deal_1",
        propertyId: "property_1",
        surface: "deal_room_overview",
        artifact: "memo",
        viewState: "ready",
        claimCount: 1,
        sourceCount: 1,
        missingSignalCount: 0,
        coverageAvailableCount: 1,
        coveragePendingCount: 0,
        coverageUncertainCount: 0,
        coverageMissingCount: 0,
        responses: [{ dimension: "usefulness", sentiment: "positive" }],
        reasonCodes: [],
      }),
    ).rejects.toThrow("Cannot submit advisory feedback for another buyer.");
  });
});
