import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hashPhone,
  normalizePhone,
  verifySignedIntakeLink,
} from "../../../convex/lib/smsIntakeCompute";

const rateLimitMocks = vi.hoisted(() => ({
  checkAndPersistRateLimit: vi.fn(),
  recordRateLimitOutcome: vi.fn(),
}));

vi.mock("../../../convex/lib/rateLimitBuckets", () => ({
  checkAndPersistRateLimit: rateLimitMocks.checkAndPersistRateLimit,
  recordRateLimitOutcome: rateLimitMocks.recordRateLimitOutcome,
}));

import { processInboundSms } from "../../../convex/smsIntake";

type ProcessInboundSmsArgs = {
  messageSid: string;
  fromPhone: string;
  toPhone: string;
  body: string;
};

type ProcessInboundSmsResult = {
  outcome: string;
  intakeId: string;
  replyBody: string;
  replySent: boolean;
  dealRoomId?: string;
  sourceListingId?: string;
  replyLink?: string;
  rateLimitState?: "retry_later" | "blocked";
  retryAt?: string;
};

const processInboundSmsHandler = (
  processInboundSms as unknown as {
    _handler: (
      ctx: unknown,
      args: ProcessInboundSmsArgs,
    ) => Promise<ProcessInboundSmsResult>;
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

  async unique() {
    return this.run()[0] ?? null;
  }

  async first() {
    return this.run()[0] ?? null;
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

describe("convex/smsIntake.processInboundSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://buyer-codex.app");
    vi.stubEnv(
      "SMS_SIGNED_LINK_SECRET",
      "buyer-codex-test-secret-1234567890",
    );
    rateLimitMocks.checkAndPersistRateLimit.mockResolvedValue({
      state: { allowed: true },
      throttleKey: "sms:test",
    });
    rateLimitMocks.recordRateLimitOutcome.mockResolvedValue(undefined);
  });

  it("creates intake state and replies with a signed intake link", async () => {
    const db = new FakeDb();

    const result = await processInboundSmsHandler({ db } as never, {
      messageSid: "SM-success",
      fromPhone: "+13055551234",
      toPhone: "+13055550000",
      body: "Check this out https://www.zillow.com/homedetails/Test/123456_zpid/?utm_source=sms",
    });

    expect(result.outcome).toBe("url_processed");
    expect(result.replySent).toBe(true);
    expect(result.replyLink).toBeTruthy();
    expect(result.replyBody).toContain("Continue your intake here:");

    const verified = await verifySignedIntakeLink(
      result.replyLink!,
      process.env.SMS_SIGNED_LINK_SECRET!,
    );
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.listingUrl).toBe(
        "https://zillow.com/homedetails/Test/123456_zpid/",
      );
      expect(verified.source).toBe("sms");
    }

    expect(db.tableRows("sourceListings")).toHaveLength(1);
    expect(db.tableRows("sourceListings")[0]?.sourceUrl).toBe(
      "https://zillow.com/homedetails/Test/123456_zpid/",
    );
    expect(db.tableRows("smsConsent")).toHaveLength(1);
    expect(db.tableRows("smsConsent")[0]?.status).toBe("opted_in");
    expect(rateLimitMocks.recordRateLimitOutcome).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: "sms",
        outcome: "success",
      }),
    );
  });

  it("returns an explicit invalid reply state for unsupported text input", async () => {
    const db = new FakeDb();

    const result = await processInboundSmsHandler({ db } as never, {
      messageSid: "SM-invalid",
      fromPhone: "+13055551234",
      toPhone: "+13055550000",
      body: "hello there",
    });

    expect(result.outcome).toBe("invalid_url");
    expect(result.replySent).toBe(true);
    expect(result.replyBody).toContain("We couldn't find a listing link");
    expect(db.tableRows("sourceListings")).toHaveLength(0);
    expect(rateLimitMocks.recordRateLimitOutcome).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        channel: "sms",
        outcome: "failure",
      }),
    );
  });

  it("suppresses outbound replies when the number is already opted out", async () => {
    const db = new FakeDb();
    const phoneHash = await hashPhone(normalizePhone("+13055551234")!);

    db.seed("smsConsent", {
      _id: "consent_1",
      phoneHash,
      status: "opted_out",
      createdAt: "2026-04-13T00:00:00.000Z",
      updatedAt: "2026-04-13T00:00:00.000Z",
    });

    const result = await processInboundSmsHandler({ db } as never, {
      messageSid: "SM-suppressed",
      fromPhone: "+13055551234",
      toPhone: "+13055550000",
      body: "https://www.zillow.com/homedetails/Test/123456_zpid/",
    });

    expect(result.outcome).toBe("suppressed");
    expect(result.replySent).toBe(false);
    expect(result.replyBody).toBe("");
    expect(db.tableRows("sourceListings")).toHaveLength(0);
    expect(rateLimitMocks.checkAndPersistRateLimit).not.toHaveBeenCalled();
  });

  it("returns duplicate on Twilio retry without inserting a second message row", async () => {
    const db = new FakeDb();
    const args = {
      messageSid: "SM-duplicate",
      fromPhone: "+13055551234",
      toPhone: "+13055550000",
      body: "https://www.redfin.com/FL/Miami/home/99999",
    };

    const first = await processInboundSmsHandler(
      { db } as never,
      args,
    );
    const second = await processInboundSmsHandler(
      { db } as never,
      args,
    );

    expect(first.outcome).toBe("url_processed");
    expect(second.outcome).toBe("duplicate");
    expect(second.intakeId).toBe(first.intakeId);
    expect(second.replyLink).toBe(first.replyLink);
    expect(db.tableRows("smsIntakeMessages")).toHaveLength(1);
    expect(db.tableRows("sourceListings")).toHaveLength(1);
    expect(rateLimitMocks.recordRateLimitOutcome).toHaveBeenCalledTimes(1);
  });
});
