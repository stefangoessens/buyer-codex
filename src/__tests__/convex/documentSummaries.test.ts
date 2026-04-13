import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
}));

import * as documentSummariesModule from "../../../convex/documentSummaries";

type TableName =
  | "dealRooms"
  | "fileAnalysisJobs"
  | "fileAnalysisFindings";

type Tables = Record<TableName, Array<Record<string, unknown>>>;

type TestContext = {
  db: {
    get: (id: string) => Promise<Record<string, unknown> | null>;
    query: (table: TableName) => {
      withIndex: (
        indexName: string,
        builder: (q: {
          eq: (field: string, value: unknown) => unknown;
        }) => unknown,
      ) => {
        collect: () => Promise<Array<Record<string, unknown>>>;
        unique: () => Promise<Record<string, unknown> | null>;
      };
    };
  };
};

function invokeRegisteredQuery<TResult>(
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
    fileAnalysisJobs: [...(initial.fileAnalysisJobs ?? [])],
    fileAnalysisFindings: [...(initial.fileAnalysisFindings ?? [])],
  };

  const byId = new Map<string, Record<string, unknown>>();
  for (const rows of Object.values(tables)) {
    for (const row of rows) {
      byId.set(String(row._id), row);
    }
  }

  const db = {
    async get(id: string) {
      return cloneRow(byId.get(id) ?? null);
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

  return { ctx: { db } as TestContext };
}

const BUYER_USER = {
  _id: "user_buyer",
  _creationTime: 1,
  email: "buyer@example.com",
  name: "Buyer",
  role: "buyer" as const,
};

const BROKER_USER = {
  _id: "user_broker",
  _creationTime: 2,
  email: "broker@example.com",
  name: "Broker",
  role: "broker" as const,
};

beforeEach(() => {
  sessionMocks.requireAuth.mockReset();
});

describe("documentSummaries", () => {
  it("builds buyer-safe and internal rows from file-analysis jobs", async () => {
    const { ctx } = createContext({
      dealRooms: [
        {
          _id: "deal_1",
          buyerId: BUYER_USER._id,
          propertyId: "property_1",
          updatedAt: "2026-04-13T09:00:00.000Z",
        },
      ],
      fileAnalysisJobs: [
        {
          _id: "job_1",
          dealRoomId: "deal_1",
          propertyId: "property_1",
          fileStorageId: "storage_1",
          fileName: "hoa-budget.pdf",
          docType: "hoa_document",
          status: "review_required",
          payload: JSON.stringify({
            plainEnglishSummary: "HOA reserves are underfunded.",
            pageClassifications: [
              { pageNumber: 1, docType: "hoa_document", confidence: 0.9 },
            ],
          }),
          overallSeverity: "high",
          overallConfidence: 0.62,
          errorCount: 0,
          uploadedBy: BUYER_USER._id,
          createdAt: "2026-04-13T09:00:00.000Z",
          updatedAt: "2026-04-13T09:15:00.000Z",
          completedAt: "2026-04-13T09:15:00.000Z",
        },
      ],
      fileAnalysisFindings: [
        {
          _id: "finding_1",
          jobId: "job_1",
          dealRoomId: "deal_1",
          rule: "hoa_reserves_adequate",
          severity: "high",
          label: "HOA reserves 5% of annual budget",
          summary: "HOA reserves are underfunded.",
          confidence: 0.85,
          requiresReview: true,
          createdAt: "2026-04-13T09:15:00.000Z",
        },
      ],
    });

    sessionMocks.requireAuth.mockResolvedValue(BUYER_USER);
    const buyerResult = await invokeRegisteredQuery<{
      role: "buyer" | "internal";
      summaries: Array<Record<string, unknown>>;
    }>(documentSummariesModule.listByDealRoom, ctx, {
      dealRoomId: "deal_1",
    });

    expect(buyerResult.role).toBe("buyer");
    expect(buyerResult.summaries[0]).toMatchObject({
      documentId: "storage_1",
      documentType: "hoa_document",
      status: "review_required",
      severity: "info",
      keyFacts: ["HOA reserves are underfunded."],
    });
    expect(buyerResult.summaries[0]?.confidence).toBeUndefined();

    sessionMocks.requireAuth.mockResolvedValue(BROKER_USER);
    const internalResult = await invokeRegisteredQuery<{
      role: "buyer" | "internal";
      summaries: Array<Record<string, unknown>>;
    }>(documentSummariesModule.listByDealRoom, ctx, {
      dealRoomId: "deal_1",
    });

    expect(internalResult.role).toBe("internal");
    expect(internalResult.summaries[0]).toMatchObject({
      documentId: "storage_1",
      documentType: "hoa_document",
      status: "review_required",
      severity: "high",
      confidence: 0.62,
      analysisStatus: "review_required",
    });
  });
});
