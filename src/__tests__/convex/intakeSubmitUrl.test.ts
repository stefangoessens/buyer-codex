import { describe, expect, it } from "vitest";
import { submitUrl } from "../../../convex/intake";
import { buildListingIntakeHref } from "@/lib/intake/pasteLink";

type SubmitUrlArgs = {
  url: string;
  source?: "hero" | "compact" | "home" | "unknown";
  submittedAt?: string;
};

type SubmitUrlResult =
  | {
      success: true;
      outcome: "created" | "duplicate";
      sourceListingId: string;
      attemptId: string;
      platform: "zillow" | "redfin" | "realtor";
      listingId: string;
      normalizedUrl: string;
    }
  | {
      success: false;
      error: string;
      code: "malformed_url" | "missing_listing_id" | "unsupported_url";
    };

const submitUrlHandler = (
  submitUrl as unknown as {
    _handler: (ctx: unknown, args: SubmitUrlArgs) => Promise<SubmitUrlResult>;
  }
)._handler;

type Row = {
  _id: string;
  _creationTime: number;
  [key: string]: unknown;
};

class FakeQuery {
  private field?: string;
  private value?: unknown;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  withIndex(
    _indexName: string,
    build: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
  ) {
    const state: { field?: string; value?: unknown } = {};
    build({
      eq: (field: string, value: unknown) => {
        state.field = field;
        state.value = value;
        return state;
      },
    });
    this.field = state.field;
    this.value = state.value;
    return this;
  }

  async first() {
    return this.run()[0] ?? null;
  }

  async collect() {
    return this.run();
  }

  private run() {
    const rows = this.db.tableRows(this.table);
    if (!this.field) {
      return rows;
    }
    return rows.filter((row) => row[this.field!] === this.value);
  }
}

class FakeDb {
  private readonly tables = new Map<string, Row[]>();
  private nextId = 1;

  seed(
    table: string,
    row: Omit<Row, "_creationTime" | "_id"> & {
      _creationTime?: number;
      _id?: string;
    },
  ) {
    const seeded: Row = {
      _id: row._id ?? `${table}_seed_${this.nextId += 1}`,
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

  async insert(table: string, value: Record<string, unknown>) {
    const id = `${table}_${this.nextId += 1}`;
    this.seed(table, {
      _id: id,
      ...value,
    });
    return id;
  }

  async patch(id: string, patch: Record<string, unknown>) {
    for (const rows of this.tables.values()) {
      const row = rows.find((candidate) => candidate._id === id);
      if (row) {
        Object.assign(row, patch);
        return;
      }
    }
    throw new Error(`Row not found for patch: ${id}`);
  }

  tableRows(table: string) {
    return [...(this.tables.get(table) ?? [])];
  }
}

describe("convex/intake.submitUrl", () => {
  it("creates a canonical source listing row and returns a persisted handoff contract", async () => {
    const db = new FakeDb();

    const result = await submitUrlHandler({ db } as never, {
      url: "https://www.zillow.com/homedetails/Test/123456_zpid/?utm_source=ad",
      source: "hero",
      submittedAt: "2026-04-14T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      success: true,
      outcome: "created",
      platform: "zillow",
      listingId: "123456",
      normalizedUrl: "https://zillow.com/homedetails/Test/123456_zpid/",
    });
    if (!result.success) {
      throw new Error("expected submitUrl to succeed");
    }

    expect(db.tableRows("sourceListings")).toHaveLength(1);
    expect(db.tableRows("sourceListings")[0]).toMatchObject({
      _id: result.sourceListingId,
      sourcePlatform: "zillow",
      sourceUrl: "https://zillow.com/homedetails/Test/123456_zpid/",
      status: "pending",
    });

    expect(db.tableRows("intakeAttempts")).toHaveLength(1);
    expect(db.tableRows("intakeAttempts")[0]).toMatchObject({
      _id: result.attemptId,
      sourceListingId: result.sourceListingId,
      sourcePlatform: "zillow",
      intakeChannel: "hero",
      normalizedInput: "https://zillow.com/homedetails/Test/123456_zpid/",
      status: "pending",
    });

    const handoffHref = buildListingIntakeHref(result.normalizedUrl, {
      source: "hero",
      submittedAt: 123456789,
      platform: result.platform,
      sourceListingId: result.sourceListingId,
      attemptId: result.attemptId,
    });

    expect(handoffHref).toContain("sourceListingId=");
    expect(handoffHref).toContain("attemptId=");
    expect(handoffHref).toContain("platform=zillow");
  });

  it("deduplicates against the canonical existing source listing without inserting junk rows", async () => {
    const db = new FakeDb();

    db.seed("sourceListings", {
      _id: "source_listing_existing",
      sourcePlatform: "zillow",
      sourceUrl: "https://zillow.com/homedetails/Test/123456_zpid/",
      rawData: "{}",
      extractedAt: "2026-04-13T23:59:00.000Z",
      status: "pending",
    });

    const result = await submitUrlHandler({ db } as never, {
      url: "https://www.zillow.com/homedetails/Test/123456_zpid/?utm_campaign=retargeting",
      source: "hero",
      submittedAt: "2026-04-14T00:01:00.000Z",
    });

    expect(result).toMatchObject({
      success: true,
      outcome: "duplicate",
      sourceListingId: "source_listing_existing",
      platform: "zillow",
      listingId: "123456",
      normalizedUrl: "https://zillow.com/homedetails/Test/123456_zpid/",
    });

    expect(db.tableRows("sourceListings")).toHaveLength(1);
    expect(db.tableRows("intakeAttempts")).toHaveLength(1);
    expect(db.tableRows("intakeAttempts")[0]).toMatchObject({
      sourceListingId: "source_listing_existing",
      intakeChannel: "hero",
    });
  });

  it("returns a typed malformed-url failure without creating backend rows", async () => {
    const db = new FakeDb();

    const result = await submitUrlHandler({ db } as never, {
      url: "not actually a listing url",
      source: "hero",
    });

    expect(result).toMatchObject({
      success: false,
      code: "malformed_url",
    });
    expect(db.tableRows("sourceListings")).toHaveLength(0);
    expect(db.tableRows("intakeAttempts")).toHaveLength(0);
  });
});
