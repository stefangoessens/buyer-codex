import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getCurrentUser: vi.fn(),
}));

const analyticsMocks = vi.hoisted(() => ({
  trackPosthogEvent: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireRole: sessionMocks.requireRole,
  getCurrentUser: sessionMocks.getCurrentUser,
}));

vi.mock("../../../convex/lib/analytics", () => ({
  trackPosthogEvent: analyticsMocks.trackPosthogEvent,
}));

import * as aiEngineOutputsModule from "../../../convex/aiEngineOutputs";

type TableName =
  | "aiEngineOutputs"
  | "aiOutputAdjudications"
  | "auditLog"
  | "propertyCases";

type Tables = Record<TableName, Array<Record<string, unknown>>>;

type TestContext = {
  db: {
    get: (id: string) => Promise<Record<string, unknown> | null>;
    insert: (table: TableName, value: Record<string, unknown>) => Promise<string>;
    patch: (id: string, value: Record<string, unknown>) => Promise<void>;
    query: (table: TableName) => {
      withIndex: (
        indexName: string,
        builder: (q: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown,
      ) => {
        collect: () => Promise<Array<Record<string, unknown>>>;
        take: (limit: number) => Promise<Array<Record<string, unknown>>>;
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
    aiEngineOutputs: [...(initial.aiEngineOutputs ?? [])],
    aiOutputAdjudications: [...(initial.aiOutputAdjudications ?? [])],
    auditLog: [...(initial.auditLog ?? [])],
    propertyCases: [...(initial.propertyCases ?? [])],
  };

  const byId = new Map<
    string,
    { table: TableName; row: Record<string, unknown> }
  >();

  for (const [tableName, rows] of Object.entries(tables) as Array<
    [TableName, Array<Record<string, unknown>>]
  >) {
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
    async insert(table: TableName, value: Record<string, unknown>) {
      const id = String(value._id ?? `${table}_${nextId++}`);
      const row = {
        ...value,
        _id: id,
        _creationTime: value._creationTime ?? nextCreationTime++,
      };
      tables[table].push(row);
      byId.set(id, { table, row });
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      const target = byId.get(id);
      if (!target) throw new Error(`Missing row for ${id}`);
      Object.assign(target.row, value);
    },
    query(table: TableName) {
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

          const rows = tables[table].filter((row) =>
            conditions.every(({ field, value }) => row[field] === value),
          );

          return {
            async collect() {
              return rows.map((row) => cloneRow(row));
            },
            async take(limit: number) {
              return rows.slice(0, limit).map((row) => cloneRow(row));
            },
          };
        },
      };
    },
  };

  return { ctx: { db } as TestContext, tables };
}

const BROKER_USER = {
  _id: "user_broker",
  _creationTime: 2,
  email: "broker@example.com",
  name: "Broker",
  role: "broker" as const,
};

beforeEach(() => {
  sessionMocks.requireRole.mockReset();
  sessionMocks.getCurrentUser.mockReset();
  analyticsMocks.trackPosthogEvent.mockReset();
  sessionMocks.requireRole.mockResolvedValue(BROKER_USER);
  sessionMocks.getCurrentUser.mockResolvedValue(BROKER_USER);
  analyticsMocks.trackPosthogEvent.mockResolvedValue(null);
});

describe("aiEngineOutputs adjudication", () => {
  it("writes a buyer-safe adjusted adjudication snapshot and history", async () => {
    const { ctx, tables } = createContext({
      aiEngineOutputs: [
        {
          _id: "output_1",
          propertyId: "property_1",
          engineType: "offer",
          confidence: 0.82,
          reviewState: "pending",
          output: JSON.stringify({
            scenarios: [{ name: "Strong opener", price: 615000 }],
            recommendedIndex: 0,
          }),
          modelId: "gpt-5.4",
          citations: [],
          generatedAt: "2026-04-13T18:00:00.000Z",
        },
      ],
      propertyCases: [
        {
          _id: "case_1",
          dealRoomId: "deal_1",
          payload: JSON.stringify({
            claims: [{ citation: "output_1" }],
          }),
          generatedAt: "2026-04-13T18:30:00.000Z",
        },
      ],
    });

    await invokeRegisteredHandler(aiEngineOutputsModule.submitAdjudication, ctx, {
      outputId: "output_1",
      dealRoomId: "deal_1",
      surface: "deal_room_overview",
      action: "adjust",
      visibility: "buyer_safe",
      rationale: "Tighten the recommendation to what a broker would actually say.",
      reasonCategory: "human_judgment",
      reviewedConclusion:
        "Open near $615,000 with clean terms and avoid leading with concessions.",
      buyerExplanation:
        "This recommendation was reviewed by your broker against comps and seller posture.",
      internalNotes: "Keep gap coverage optional until listing-side feedback lands.",
    });

    expect(tables.aiEngineOutputs[0]).toMatchObject({
      reviewState: "approved",
      reviewedBy: BROKER_USER._id,
      adjudication: {
        status: "adjusted",
        action: "adjust",
        visibility: "buyer_safe",
        rationale:
          "Tighten the recommendation to what a broker would actually say.",
        reviewedConclusion:
          "Open near $615,000 with clean terms and avoid leading with concessions.",
        buyerExplanation:
          "This recommendation was reviewed by your broker against comps and seller posture.",
      },
    });
    expect(tables.aiOutputAdjudications[0]).toMatchObject({
      engineOutputId: "output_1",
      action: "adjust",
      status: "adjusted",
      visibility: "buyer_safe",
      reviewStateBefore: "pending",
      reviewStateAfter: "approved",
    });
    expect(tables.auditLog[0]?.action).toBe("ai_output_adjudicated");
    expect(analyticsMocks.trackPosthogEvent).toHaveBeenCalledWith(
      "advisory_broker_override_submitted",
      expect.objectContaining({
        outputId: "output_1",
        reasonCategory: "human_judgment",
        linkedClaimCount: 1,
      }),
      BROKER_USER._id,
    );
  });

  it("rejects adjudication without rationale", async () => {
    const { ctx } = createContext({
      aiEngineOutputs: [
        {
          _id: "output_1",
          propertyId: "property_1",
          engineType: "pricing",
          confidence: 0.72,
          reviewState: "pending",
          output: "{}",
          modelId: "gpt-5.4",
          citations: [],
          generatedAt: "2026-04-13T18:00:00.000Z",
        },
      ],
    });

    await expect(
      invokeRegisteredHandler(aiEngineOutputsModule.submitAdjudication, ctx, {
        outputId: "output_1",
        action: "override",
        visibility: "internal_only",
        rationale: "   ",
      }),
    ).rejects.toThrow("Broker adjudication requires rationale.");
  });
});
