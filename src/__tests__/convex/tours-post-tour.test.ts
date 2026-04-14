import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
}));

import {
  getPostTourSignalSummary,
  listPostTourObservationsForBuyer,
  listPostTourObservationsInternal,
  submitPostTourObservation,
} from "../../../convex/tours";

type Row = {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
};

class FakeQuery {
  private filters = new Map<string, unknown>();

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  withIndex(
    _indexName: string,
    build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
  ) {
    const state = {
      eq: (field: string, value: unknown) => {
        this.filters.set(field, value);
        return state;
      },
    };
    build(state);
    return this;
  }

  async collect() {
    return this.run();
  }

  async first() {
    return this.run()[0] ?? null;
  }

  async unique() {
    const rows = this.run();
    if (rows.length > 1) {
      throw new Error(
        `Expected at most one ${this.table} row for indexed lookup, received ${rows.length}`,
      );
    }
    return rows[0] ?? null;
  }

  private run() {
    return this.db
      .tableRows(this.table)
      .filter((row) =>
        [...this.filters.entries()].every(([field, value]) => row[field] === value),
      );
  }
}

class FakeDb {
  private readonly tables = new Map<string, Row[]>();
  private nextId = 1;

  seed(
    table: string,
    row: Omit<Row, "_id" | "_creationTime"> & {
      _id?: string;
      _creationTime?: number;
    },
  ) {
    const seeded: Row = {
      _id: row._id ?? `${table}_${this.nextId += 1}`,
      _creationTime: row._creationTime ?? Date.now(),
      ...row,
    };
    const rows = this.tables.get(table) ?? [];
    rows.push(seeded);
    this.tables.set(table, rows);
    return seeded;
  }

  query(table: string) {
    return new FakeQuery(this, table);
  }

  async get(id: string) {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) return row;
    }
    return null;
  }

  async insert(table: string, value: Record<string, unknown>) {
    const row = this.seed(table, {
      _id: `${table}_${this.nextId += 1}`,
      ...value,
    });
    return row._id;
  }

  tableRows(table: string) {
    return [...(this.tables.get(table) ?? [])];
  }
}

const submitPostTourObservationHandler = (
  submitPostTourObservation as unknown as {
    _handler: (
      ctx: { db: FakeDb },
      args: {
        tourId: string;
        sentiment: "positive" | "mixed" | "negative";
        concerns: string[];
        offerReadiness: "not_ready" | "considering" | "ready_soon" | "ready_now";
        buyerVisibleNote?: string;
        internalNote?: string;
        pricingSignal?: "below_expectations" | "at_expectations" | "above_expectations";
        leverageSignal?: "strong" | "neutral" | "weak";
        actionItems?: string[];
      },
    ) => Promise<string>;
  }
)._handler;

const listPostTourObservationsForBuyerHandler = (
  listPostTourObservationsForBuyer as unknown as {
    _handler: (
      ctx: { db: FakeDb },
      args: { tourId: string },
    ) => Promise<unknown[]>;
  }
)._handler;

const listPostTourObservationsInternalHandler = (
  listPostTourObservationsInternal as unknown as {
    _handler: (
      ctx: { db: FakeDb },
      args: { tourId: string },
    ) => Promise<unknown[]>;
  }
)._handler;

const getPostTourSignalSummaryHandler = (
  getPostTourSignalSummary as unknown as {
    _handler: (
      ctx: { db: FakeDb },
      args: { tourId?: string; tourRequestId?: string; propertyId?: string },
    ) => Promise<Record<string, unknown> | null>;
  }
)._handler;

function seedTour(db: FakeDb, overrides: Record<string, unknown> = {}) {
  return db.seed("tours", {
    _id: "tour_1",
    dealRoomId: "deal_1",
    propertyId: "property_1",
    buyerId: "buyer_1",
    tourRequestId: "request_1",
    status: "confirmed",
    ...overrides,
  });
}

describe("convex/tours post-tour capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores a buyer submission linked to the tour request and property", async () => {
    const db = new FakeDb();
    seedTour(db);
    sessionMocks.requireAuth.mockResolvedValue({
      _id: "buyer_1",
      role: "buyer",
    });

    const observationId = await submitPostTourObservationHandler(
      { db },
      {
        tourId: "tour_1",
        sentiment: "mixed",
        concerns: ["pricing", " commute "],
        offerReadiness: "considering",
        buyerVisibleNote: "Loved the lot but commute felt long.",
      },
    );

    const rows = db.tableRows("tourPostObservations");
    expect(observationId).toBe(rows[0]?._id);
    expect(rows[0]).toMatchObject({
      tourId: "tour_1",
      tourRequestId: "request_1",
      propertyId: "property_1",
      buyerId: "buyer_1",
      submittedByRole: "buyer",
      concerns: ["pricing", "commute"],
      buyerVisibleNote: "Loved the lot but commute felt long.",
      internalNote: undefined,
    });
  });

  it("allows an internal submission with mixed visibility while buyer reads stay safe", async () => {
    const db = new FakeDb();
    seedTour(db);
    sessionMocks.requireAuth.mockResolvedValue({
      _id: "broker_1",
      role: "broker",
    });

    await submitPostTourObservationHandler(
      { db },
      {
        tourId: "tour_1",
        sentiment: "negative",
        concerns: ["pricing", "hoa"],
        offerReadiness: "ready_soon",
        buyerVisibleNote: "Buyer wants HOA docs before deciding.",
        internalNote: "Likely asks for seller credit once HOA minutes land.",
        pricingSignal: "above_expectations",
        leverageSignal: "strong",
        actionItems: ["review comps", "call listing agent"],
      },
    );

    sessionMocks.requireAuth.mockResolvedValue({
      _id: "buyer_1",
      role: "buyer",
    });
    const buyerRows = await listPostTourObservationsForBuyerHandler(
      { db },
      { tourId: "tour_1" },
    );
    expect(buyerRows).toEqual([
      {
        submittedAt: expect.any(String),
        submittedByRole: "broker",
        sentiment: "negative",
        concerns: ["pricing", "hoa"],
        offerReadiness: "ready_soon",
        buyerVisibleNote: "Buyer wants HOA docs before deciding.",
      },
    ]);

    sessionMocks.requireAuth.mockResolvedValue({
      _id: "broker_1",
      role: "broker",
    });
    const internalRows = await listPostTourObservationsInternalHandler(
      { db },
      { tourId: "tour_1" },
    );
    expect(internalRows[0]).toMatchObject({
      internalNote: "Likely asks for seller credit once HOA minutes land.",
      pricingSignal: "above_expectations",
      leverageSignal: "strong",
    });
  });

  it("returns a typed downstream signal summary", async () => {
    const db = new FakeDb();
    seedTour(db);
    db.seed("tourPostObservations", {
      _id: "obs_1",
      tourId: "tour_1",
      tourRequestId: "request_1",
      propertyId: "property_1",
      buyerId: "buyer_1",
      submittedById: "buyer_1",
      submittedByRole: "buyer",
      sentiment: "mixed",
      concerns: ["pricing"],
      offerReadiness: "considering",
      buyerVisibleNote: "Still deciding.",
      createdAt: "2028-05-01T12:00:00.000Z",
    });
    db.seed("tourPostObservations", {
      _id: "obs_2",
      tourId: "tour_1",
      tourRequestId: "request_1",
      propertyId: "property_1",
      buyerId: "buyer_1",
      submittedById: "broker_1",
      submittedByRole: "broker",
      sentiment: "negative",
      concerns: ["hoa", "pricing"],
      offerReadiness: "ready_soon",
      buyerVisibleNote: "Needs HOA docs.",
      internalNote: "Pricing feels rich for current DOM.",
      leverageSignal: "strong",
      pricingSignal: "above_expectations",
      actionItems: ["review comps"],
      createdAt: "2028-05-02T12:00:00.000Z",
    });
    sessionMocks.requireAuth.mockResolvedValue({
      _id: "broker_1",
      role: "broker",
    });

    const summary = await getPostTourSignalSummaryHandler(
      { db },
      { tourId: "tour_1" },
    );

    expect(summary).toMatchObject({
      tourId: "tour_1",
      tourRequestId: "request_1",
      propertyId: "property_1",
      buyerId: "buyer_1",
      entryCount: 2,
      latestSentiment: "negative",
      latestOfferReadiness: "ready_soon",
      concernTags: ["hoa", "pricing"],
      pricingSignalCounts: {
        below_expectations: 0,
        at_expectations: 0,
        above_expectations: 1,
      },
      leverageSignalCounts: {
        strong: 1,
        neutral: 0,
        weak: 0,
      },
    });
  });

  it("rejects capture when the tour is missing its tour-request linkage", async () => {
    const db = new FakeDb();
    seedTour(db, { tourRequestId: undefined });
    sessionMocks.requireAuth.mockResolvedValue({
      _id: "broker_1",
      role: "broker",
    });

    await expect(
      submitPostTourObservationHandler(
        { db },
        {
          tourId: "tour_1",
          sentiment: "positive",
          concerns: ["layout"],
          offerReadiness: "ready_now",
        },
      ),
    ).rejects.toThrow(/MISSING_TOUR_LINKAGE/);
  });
});
