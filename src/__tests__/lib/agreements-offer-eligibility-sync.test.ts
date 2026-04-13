import { beforeEach, describe, expect, it, vi } from "vitest";
const sessionMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getSessionContext: vi.fn(),
}));

vi.mock("../../../convex/lib/session", () => ({
  requireAuth: sessionMocks.requireAuth,
  getSessionContext: sessionMocks.getSessionContext,
}));

import * as agreementsModule from "../../../convex/agreements";
import * as agreementAuditModule from "../../../convex/agreementAudit";
import * as offerEligibilityModule from "../../../convex/offerEligibility";

type TableName =
  | "dealRooms"
  | "agreements"
  | "agreementAuditEvents"
  | "offerEligibilityState"
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
  runMutation: (
    fnRef: unknown,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
};

type RunMutationCall = Parameters<TestContext["runMutation"]>;
type EligibilityMutationArgs = Record<string, unknown> & {
  buyerId: string;
  dealRoomId: string;
  actorUserId: string;
};
type EligibilityCall = [RunMutationCall[0], EligibilityMutationArgs];
type RunMutationSpy = {
  mock: {
    calls: RunMutationCall[];
  };
};

function invokeRegisteredMutation<TResult>(
  mutation: unknown,
  ctx: TestContext,
  args: Record<string, unknown>,
): Promise<TResult> {
  const handler = (
    mutation as {
      _handler: (
        ctx: TestContext,
        args: Record<string, unknown>,
      ) => Promise<TResult> | TResult;
    }
  )._handler;

  return Promise.resolve(handler(ctx, args));
}

function invokeRegisteredQuery<TResult>(
  query: unknown,
  ctx: TestContext,
  args: Record<string, unknown>,
): Promise<TResult> {
  const handler = (
    query as {
      _handler: (
        ctx: TestContext,
        args: Record<string, unknown>,
      ) => Promise<TResult> | TResult;
    }
  )._handler;

  return Promise.resolve(handler(ctx, args));
}

const BROKER_USER = {
  _id: "user_broker",
  _creationTime: 1,
  email: "broker@example.com",
  name: "Broker",
  role: "broker" as const,
};

function isEligibilityMutationArgs(
  args: Record<string, unknown>,
): args is EligibilityMutationArgs {
  return (
    "buyerId" in args &&
    "dealRoomId" in args &&
    "actorUserId" in args &&
    !("eventType" in args)
  );
}

function getEligibilityCalls(runMutationSpy: RunMutationSpy): EligibilityCall[] {
  return runMutationSpy.mock.calls.filter(
    (call): call is EligibilityCall => isEligibilityMutationArgs(call[1]),
  );
}

function cloneRow<T extends Record<string, unknown> | null>(row: T): T {
  if (!row) {
    return row;
  }

  return { ...row } as T;
}

function createTables(
  initial: Partial<Tables> = {},
): { tables: Tables; byId: Map<string, { table: TableName; row: Record<string, unknown> }> } {
  const tables: Tables = {
    dealRooms: [...(initial.dealRooms ?? [])],
    agreements: [...(initial.agreements ?? [])],
    agreementAuditEvents: [...(initial.agreementAuditEvents ?? [])],
    offerEligibilityState: [...(initial.offerEligibilityState ?? [])],
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
      if (!target) {
        throw new Error(`Missing row for ${id}`);
      }

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

  const ctx = { db } as TestContext;
  ctx.runMutation = async (_fnRef: unknown, args: Record<string, unknown>) => {
    if ("eventType" in args && "visibility" in args && "occurredAt" in args) {
      return await invokeRegisteredMutation(
        agreementAuditModule.recordEventInternal,
        ctx,
        args,
      );
    }
    if ("buyerId" in args && "dealRoomId" in args && "actorUserId" in args) {
      return await invokeRegisteredMutation(
        offerEligibilityModule.recalculateEligibilityInternal,
        ctx,
        args,
      );
    }
    throw new Error("Unexpected mutation reference");
  };

  const runMutationSpy = vi.spyOn(ctx, "runMutation");

  return { ctx, tables, runMutationSpy };
}

function makeDealRoom() {
  return {
    _id: "deal_room_1",
    _creationTime: 10,
    buyerId: "buyer_1",
  };
}

function makeAgreement(
  overrides: Partial<Record<string, unknown>> & { _id: string },
) {
  const { _id, ...rest } = overrides;

  return {
    _id,
    _creationTime: 20,
    buyerId: "buyer_1",
    dealRoomId: "deal_room_1",
    type: "full_representation",
    status: "draft",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...rest,
  };
}

function makeEligibilityState(
  overrides: Partial<Record<string, unknown>> = {},
) {
  const { _id = "eligibility_1", ...rest } = overrides;

  return {
    _id,
    _creationTime: 30,
    buyerId: "buyer_1",
    dealRoomId: "deal_room_1",
    isEligible: false,
    currentAgreementType: "none",
    governingAgreementId: undefined,
    blockingReasonCode: "no_signed_agreement",
    blockingReasonMessage:
      "No signed agreement found. Sign a Full Representation agreement to make offers.",
    requiredAction: "sign_agreement",
    computedAt: "2026-04-01T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...rest,
  };
}

beforeEach(() => {
  sessionMocks.requireAuth.mockReset();
  sessionMocks.getSessionContext.mockReset();
  sessionMocks.requireAuth.mockResolvedValue(BROKER_USER);
});

describe("agreement lifecycle eligibility sync", () => {
  it("recalculates after createDraft", async () => {
    const { ctx, tables, runMutationSpy } = createContext({
      dealRooms: [makeDealRoom()],
    });

    const agreementId = await invokeRegisteredMutation<string>(
      agreementsModule.createDraft,
      ctx,
      {
        buyerId: "buyer_1",
        dealRoomId: "deal_room_1",
        type: "full_representation",
      },
    );

    expect(agreementId).toBeDefined();
    const eligibilityCalls = getEligibilityCalls(runMutationSpy);
    expect(eligibilityCalls).toHaveLength(1);
    expect(eligibilityCalls[0]?.[1]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      actorUserId: BROKER_USER._id,
    });
    expect(tables.offerEligibilityState).toHaveLength(1);
    expect(tables.offerEligibilityState[0]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      isEligible: false,
      blockingReasonCode: "no_signed_agreement",
      requiredAction: "sign_agreement",
    });
    expect(tables.agreementAuditEvents).toHaveLength(1);
    expect(tables.agreementAuditEvents[0]).toMatchObject({
      agreementId,
      eventType: "created",
      nextStatus: "draft",
    });
  });

  it("recalculates after sendForSigning", async () => {
    const { ctx, tables, runMutationSpy } = createContext({
      dealRooms: [makeDealRoom()],
      agreements: [
        makeAgreement({
          _id: "agreement_draft",
          status: "draft",
        }),
      ],
      offerEligibilityState: [makeEligibilityState()],
    });

    await invokeRegisteredMutation(
      agreementsModule.sendForSigning,
      ctx,
      {
        agreementId: "agreement_draft",
      },
    );

    const eligibilityCalls = getEligibilityCalls(runMutationSpy);
    expect(eligibilityCalls).toHaveLength(1);
    expect(eligibilityCalls[0]?.[1]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      actorUserId: BROKER_USER._id,
    });
    expect(tables.agreements[0]).toMatchObject({ status: "sent" });
    expect(tables.offerEligibilityState[0]).toMatchObject({
      isEligible: false,
      blockingReasonCode: "no_signed_agreement",
      requiredAction: "sign_agreement",
    });
    expect(tables.agreementAuditEvents.find((row) => row.eventType === "sent_for_signing"))
      .toBeDefined();
  });

  it("recalculates after recordSignature and persists an eligible verdict", async () => {
    const { ctx, tables, runMutationSpy } = createContext({
      dealRooms: [makeDealRoom()],
      agreements: [
        makeAgreement({
          _id: "agreement_sent",
          status: "sent",
          type: "full_representation",
        }),
      ],
      offerEligibilityState: [makeEligibilityState()],
    });

    await invokeRegisteredMutation(
      agreementsModule.recordSignature,
      ctx,
      {
        agreementId: "agreement_sent",
        documentStorageId: "storage_signed",
        documentFileName: "buyer-agreement.pdf",
        documentContentType: "application/pdf",
        documentSizeBytes: 128000,
      },
    );

    const eligibilityCalls = getEligibilityCalls(runMutationSpy);
    expect(eligibilityCalls).toHaveLength(1);
    expect(tables.agreements[0]).toMatchObject({
      _id: "agreement_sent",
      status: "signed",
      type: "full_representation",
      documentStorageId: "storage_signed",
      documentFileName: "buyer-agreement.pdf",
      documentContentType: "application/pdf",
      documentSizeBytes: 128000,
    });
    expect(tables.offerEligibilityState[0]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      isEligible: true,
      currentAgreementType: "full_representation",
      governingAgreementId: "agreement_sent",
      blockingReasonCode: undefined,
      requiredAction: "none",
    });
    expect(
      tables.agreementAuditEvents.find((row) => row.eventType === "signed"),
    ).toMatchObject({
      agreementId: "agreement_sent",
      documentStorageId: "storage_signed",
    });

    const eligibilityAudit = tables.auditLog.find(
      (row) => row.action === "offer_eligibility_changed",
    );
    expect(eligibilityAudit).toBeDefined();
    expect(JSON.parse(String(eligibilityAudit?.details))).toMatchObject({
      previous: {
        isEligible: false,
        currentAgreementType: "none",
        blockingReasonCode: "no_signed_agreement",
        requiredAction: "sign_agreement",
      },
      next: {
        isEligible: true,
        currentAgreementType: "full_representation",
        blockingReasonCode: null,
        requiredAction: "none",
      },
    });
  });

  it("recalculates after cancelAgreement and persists an ineligible verdict", async () => {
    const { ctx, tables, runMutationSpy } = createContext({
      dealRooms: [makeDealRoom()],
      agreements: [
        makeAgreement({
          _id: "agreement_signed",
          status: "signed",
          type: "full_representation",
          signedAt: "2026-04-01T00:00:00.000Z",
        }),
      ],
      offerEligibilityState: [
        makeEligibilityState({
          isEligible: true,
          currentAgreementType: "full_representation",
          governingAgreementId: "agreement_signed",
          blockingReasonCode: undefined,
          blockingReasonMessage: undefined,
          requiredAction: "none",
        }),
      ],
    });

    await invokeRegisteredMutation(
      agreementsModule.cancelAgreement,
      ctx,
      {
        agreementId: "agreement_signed",
        reason: "buyer_requested",
      },
    );

    const eligibilityCalls = getEligibilityCalls(runMutationSpy);
    expect(eligibilityCalls).toHaveLength(1);
    expect(tables.agreements[0]).toMatchObject({
      _id: "agreement_signed",
      status: "canceled",
    });
    expect(tables.offerEligibilityState[0]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      isEligible: false,
      currentAgreementType: "none",
      governingAgreementId: "agreement_signed",
      blockingReasonCode: "agreement_canceled",
      requiredAction: "sign_agreement",
    });
    expect(
      tables.agreementAuditEvents.find((row) => row.eventType === "canceled"),
    ).toMatchObject({
      agreementId: "agreement_signed",
      reason: "buyer_requested",
    });

    const eligibilityAudit = tables.auditLog.findLast(
      (row) => row.action === "offer_eligibility_changed",
    );
    expect(eligibilityAudit).toBeDefined();
    expect(JSON.parse(String(eligibilityAudit?.details))).toMatchObject({
      previous: {
        isEligible: true,
        currentAgreementType: "full_representation",
        blockingReasonCode: null,
        requiredAction: "none",
      },
      next: {
        isEligible: false,
        currentAgreementType: "none",
        blockingReasonCode: "agreement_canceled",
        requiredAction: "sign_agreement",
      },
    });
  });

  it("recalculates after replaceAgreement", async () => {
    const { ctx, tables, runMutationSpy } = createContext({
      dealRooms: [makeDealRoom()],
      agreements: [
        makeAgreement({
          _id: "agreement_current",
          status: "signed",
          type: "full_representation",
          signedAt: "2026-04-01T00:00:00.000Z",
        }),
      ],
      offerEligibilityState: [
        makeEligibilityState({
          isEligible: true,
          currentAgreementType: "full_representation",
          governingAgreementId: "agreement_current",
          blockingReasonCode: undefined,
          blockingReasonMessage: undefined,
          requiredAction: "none",
        }),
      ],
    });

    const newAgreementId = await invokeRegisteredMutation<string>(
      agreementsModule.replaceAgreement,
      ctx,
      {
        currentAgreementId: "agreement_current",
        newType: "full_representation",
      },
    );

    expect(newAgreementId).toBeDefined();
    const eligibilityCalls = getEligibilityCalls(runMutationSpy);
    expect(eligibilityCalls).toHaveLength(1);
    expect(eligibilityCalls[0]?.[1]).toMatchObject({
      buyerId: "buyer_1",
      dealRoomId: "deal_room_1",
      actorUserId: BROKER_USER._id,
    });
    expect(tables.agreements[0]).toMatchObject({
      _id: "agreement_current",
      status: "replaced",
      replacedById: newAgreementId,
    });
    expect(
      tables.agreementAuditEvents.filter((row) => row.eventType === "created"),
    ).toHaveLength(1);
    expect(
      tables.agreementAuditEvents.find((row) => row.eventType === "replaced"),
    ).toMatchObject({
      agreementId: "agreement_current",
      successorAgreementId: newAgreementId,
    });
    expect(tables.offerEligibilityState[0]).toMatchObject({
      isEligible: false,
      blockingReasonCode: "no_signed_agreement",
      requiredAction: "sign_agreement",
    });
  });

  it("returns a typed current governing read model with role-aware document fields", async () => {
    const { ctx } = createContext({
      agreements: [
        makeAgreement({
          _id: "agreement_signed",
          status: "signed",
          signedAt: "2026-04-03T00:00:00.000Z",
          effectiveStartAt: "2026-04-03T00:00:00.000Z",
          documentStorageId: "storage_signed",
          documentFileName: "buyer-agreement.pdf",
          documentContentType: "application/pdf",
          documentSizeBytes: 128000,
          documentChecksumSha256: "abc123",
          documentSource: "manual_upload",
          documentUploadedAt: "2026-04-03T00:00:00.000Z",
          documentUploadedByUserId: BROKER_USER._id,
        }),
      ],
    });

    sessionMocks.requireAuth.mockResolvedValueOnce({
      ...BROKER_USER,
      role: "buyer",
      _id: "buyer_1",
    });

    const buyerView = await invokeRegisteredQuery<any>(
      agreementsModule.getCurrentGoverning,
      ctx,
      { buyerId: "buyer_1" },
    );
    expect(buyerView).toMatchObject({
      agreementId: "agreement_signed",
      isCurrentGoverning: true,
      canAccessDocument: true,
      document: {
        fileName: "buyer-agreement.pdf",
        contentType: "application/pdf",
        sizeBytes: 128000,
      },
    });
    expect(buyerView.document.storageId).toBeUndefined();
    expect(buyerView.document.checksumSha256).toBeUndefined();

    sessionMocks.requireAuth.mockResolvedValueOnce(BROKER_USER);
    const brokerView = await invokeRegisteredQuery<any>(
      agreementsModule.getCurrentGoverning,
      ctx,
      { buyerId: "buyer_1" },
    );
    expect(brokerView.document).toMatchObject({
      storageId: "storage_signed",
      checksumSha256: "abc123",
      source: "manual_upload",
      uploadedByUserId: BROKER_USER._id,
    });
  });

  it("audits document access and denies unauthorized viewers", async () => {
    const { ctx, tables } = createContext({
      agreements: [
        makeAgreement({
          _id: "agreement_signed",
          status: "signed",
          signedAt: "2026-04-03T00:00:00.000Z",
          documentStorageId: "storage_signed",
        }),
      ],
    });

    sessionMocks.requireAuth.mockResolvedValueOnce({
      ...BROKER_USER,
      role: "buyer",
      _id: "buyer_1",
    });
    const granted = await invokeRegisteredMutation<any>(
      agreementsModule.authorizeDocumentAccess,
      ctx,
      { agreementId: "agreement_signed" },
    );
    expect(granted).toMatchObject({
      agreementId: "agreement_signed",
      fileId: "storage_signed",
    });

    sessionMocks.requireAuth.mockResolvedValueOnce({
      ...BROKER_USER,
      role: "buyer",
      _id: "buyer_2",
    });
    await expect(
      invokeRegisteredMutation(
        agreementsModule.authorizeDocumentAccess,
        ctx,
        { agreementId: "agreement_signed" },
      ),
    ).rejects.toThrow("Not authorized to access this agreement document");

    expect(
      tables.agreementAuditEvents.filter((row) => row.eventType === "document_accessed"),
    ).toHaveLength(2);
    expect(
      tables.agreementAuditEvents.find((row) => row.accessOutcome === "denied"),
    ).toMatchObject({
      agreementId: "agreement_signed",
      reason: "not_authorized",
    });
  });
});
