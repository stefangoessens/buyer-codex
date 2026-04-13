import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
}));

import * as fileAnalysisModule from "../../../convex/fileAnalysis";

type TableName =
  | "dealRooms"
  | "fileAnalysisJobs"
  | "fileAnalysisFindings"
  | "auditLog";

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
        unique: () => Promise<Record<string, unknown> | null>;
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

function createTables(initial: Partial<Tables> = {}) {
  const tables: Tables = {
    dealRooms: [...(initial.dealRooms ?? [])],
    fileAnalysisJobs: [...(initial.fileAnalysisJobs ?? [])],
    fileAnalysisFindings: [...(initial.fileAnalysisFindings ?? [])],
    auditLog: [...(initial.auditLog ?? [])],
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

  return { tables, byId };
}

function createContext(initial: Partial<Tables> = {}) {
  const { tables, byId } = createTables(initial);
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

const BROKER_USER = {
  _id: "user_broker",
  _creationTime: 2,
  email: "broker@example.com",
  name: "Broker",
  role: "broker" as const,
};

const baseDealRoom = {
  _id: "deal_1",
  buyerId: BUYER_USER._id,
  propertyId: "property_1",
  updatedAt: "2026-04-13T09:00:00.000Z",
};

const runningJob = (overrides: Partial<Record<string, unknown>> = {}) => ({
  _id: "job_1",
  dealRoomId: baseDealRoom._id,
  propertyId: baseDealRoom.propertyId,
  fileStorageId: "storage_1",
  fileName: "seller-disclosure.pdf",
  docType: "unknown",
  status: "running",
  errorCount: 0,
  uploadedBy: BUYER_USER._id,
  createdAt: "2026-04-13T09:00:00.000Z",
  updatedAt: "2026-04-13T09:00:00.000Z",
  ...overrides,
});

beforeEach(() => {
  sessionMocks.requireAuth.mockReset();
  sessionMocks.requireAuth.mockResolvedValue(BROKER_USER);
});

describe("fileAnalysis pipeline", () => {
  it("persists a completed result and keeps buyer responses buyer-safe", async () => {
    const { ctx, tables } = createContext({
      dealRooms: [baseDealRoom],
      fileAnalysisJobs: [
        runningJob({
          payload: "{\"internalFacts\":\"secret\"}",
        }),
      ],
    });

    await invokeRegisteredHandler(fileAnalysisModule.recordAnalysisResult, ctx, {
      jobId: "job_1",
      docType: "seller_disclosure",
      payload: JSON.stringify({
        buyerFacts: ["Roof age 12 years", "Flood zone X"],
        plainEnglishSummary: "Analyzed seller disclosure.",
      }),
      overallSeverity: "low",
      overallConfidence: 0.91,
      engineVersion: "1.0.0",
      findings: [
        {
          rule: "flood_zone_risk",
          severity: "low",
          label: "Flood zone X - moderate/minimal risk",
          summary: "Flood insurance is optional.",
          confidence: 0.9,
          requiresReview: false,
        },
      ],
    });

    const job = tables.fileAnalysisJobs[0];
    expect(job?.status).toBe("completed");
    expect(job?.requiresBrokerReview).toBe(false);
    expect(job?.payload).toContain("buyerFacts");
    expect(tables.fileAnalysisFindings).toHaveLength(1);

    sessionMocks.requireAuth.mockResolvedValue(BUYER_USER);
    const buyerView = await invokeRegisteredHandler<{
      job: Record<string, unknown>;
      findings: Array<Record<string, unknown>>;
    }>(fileAnalysisModule.getWithFindings, ctx, {
      jobId: "job_1",
    });

    expect(buyerView.job.payload).toBeUndefined();
    expect(buyerView.job.overallConfidence).toBeUndefined();
    expect(buyerView.findings).toHaveLength(1);
    expect(buyerView.findings[0]?.summary).toBe("Flood insurance is optional.");
  });

  it("routes review-required results through explicit broker resolution", async () => {
    const { ctx, tables } = createContext({
      dealRooms: [baseDealRoom],
      fileAnalysisJobs: [runningJob()],
    });

    await invokeRegisteredHandler(fileAnalysisModule.recordAnalysisResult, ctx, {
      jobId: "job_1",
      docType: "title_commitment",
      payload: JSON.stringify({
        buyerFacts: ["Two liens require review"],
        plainEnglishSummary: "Title commitment needs broker review.",
      }),
      overallSeverity: "critical",
      overallConfidence: 0.74,
      engineVersion: "1.0.0",
      findings: [
        {
          rule: "lien_or_encumbrance",
          severity: "critical",
          label: "2 liens on title",
          summary: "Two liens must be cleared before closing.",
          confidence: 0.95,
          requiresReview: true,
        },
      ],
    });

    expect(tables.fileAnalysisJobs[0]?.status).toBe("review_required");

    sessionMocks.requireAuth.mockResolvedValue(BUYER_USER);
    const buyerBeforeResolve = await invokeRegisteredHandler<{
      job: Record<string, unknown>;
      findings: Array<Record<string, unknown>>;
    }>(fileAnalysisModule.getWithFindings, ctx, {
      jobId: "job_1",
    });
    expect(buyerBeforeResolve.findings).toEqual([]);

    sessionMocks.requireAuth.mockResolvedValue(BROKER_USER);
    await invokeRegisteredHandler(fileAnalysisModule.resolveJob, ctx, {
      jobId: "job_1",
      notes: "Confirmed title cure plan with closing agent.",
    });

    expect(tables.fileAnalysisJobs[0]?.status).toBe("resolved");
    expect(tables.fileAnalysisJobs[0]?.reviewedBy).toBe(BROKER_USER._id);
    expect(tables.fileAnalysisFindings[0]?.resolvedBy).toBe(BROKER_USER._id);

    sessionMocks.requireAuth.mockResolvedValue(BUYER_USER);
    const buyerAfterResolve = await invokeRegisteredHandler<{
      job: Record<string, unknown>;
      findings: Array<Record<string, unknown>>;
    }>(fileAnalysisModule.getWithFindings, ctx, {
      jobId: "job_1",
    });
    expect(buyerAfterResolve.findings).toHaveLength(1);
    expect(buyerAfterResolve.findings[0]?.resolutionNotes).toBeUndefined();
  });

  it("supports deterministic failed -> queued retries for brokers", async () => {
    const { ctx, tables } = createContext({
      dealRooms: [baseDealRoom],
      fileAnalysisJobs: [runningJob()],
    });

    await invokeRegisteredHandler(fileAnalysisModule.recordFailure, ctx, {
      jobId: "job_1",
      errorMessage: "OCR provider timed out",
    });

    expect(tables.fileAnalysisJobs[0]?.status).toBe("failed");
    expect(tables.fileAnalysisJobs[0]?.errorCount).toBe(1);
    expect(tables.fileAnalysisJobs[0]?.errorMessage).toBe(
      "OCR provider timed out",
    );

    await invokeRegisteredHandler(fileAnalysisModule.retryJob, ctx, {
      jobId: "job_1",
    });

    expect(tables.fileAnalysisJobs[0]?.status).toBe("queued");
    expect(tables.fileAnalysisJobs[0]?.errorCount).toBe(1);
    expect(tables.fileAnalysisJobs[0]?.errorMessage).toBeUndefined();
  });
});
