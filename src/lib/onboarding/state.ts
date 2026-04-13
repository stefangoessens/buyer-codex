import type { BuyerFinancingType, BuyerMoveTimeline } from "@/lib/buyerProfile";
import type { SourcePlatform } from "@/lib/intake/types";

export const BUYER_ONBOARDING_DRAFT_VERSION = 1;

export type BuyerOnboardingStage =
  | "account"
  | "buyer_basics"
  | "first_property"
  | "completed";

export type BuyerOnboardingPropertyStatus =
  | "captured"
  | "pending_source_listing"
  | "source_listing_failed"
  | "deal_room_ready";

export interface BuyerOnboardingBasicsDraft {
  budgetMax: string;
  financingType: BuyerFinancingType | "";
  moveTimeline: BuyerMoveTimeline | "";
  preferredAreas: string[];
}

export interface BuyerOnboardingDraft {
  version: typeof BUYER_ONBOARDING_DRAFT_VERSION;
  stage: BuyerOnboardingStage;
  listingUrl: string;
  sourceListingId: string | null;
  sourcePlatform: SourcePlatform | null;
  authStatus: "anonymous" | "authenticated";
  property: {
    status: BuyerOnboardingPropertyStatus;
    propertyId: string | null;
    dealRoomId: string | null;
  };
  buyerBasics: BuyerOnboardingBasicsDraft;
  lastSavedAt: string;
  completedAt: string | null;
}

type BuyerOnboardingDraftPatch = Omit<
  Partial<BuyerOnboardingDraft>,
  "property" | "buyerBasics"
> & {
  property?: Partial<BuyerOnboardingDraft["property"]>;
  buyerBasics?: Partial<BuyerOnboardingBasicsDraft>;
};

export type BuyerOnboardingValidationError =
  | { code: "required"; field: "budgetMax" | "moveTimeline" }
  | { code: "invalid_number"; field: "budgetMax" }
  | { code: "non_positive"; field: "budgetMax" };

export interface BuyerOnboardingBasicsPayload {
  budgetMax: number;
  financingType?: BuyerFinancingType;
  moveTimeline: BuyerMoveTimeline;
  preferredAreas: string[];
}

export function createBuyerOnboardingDraft(params: {
  listingUrl: string;
  sourceListingId?: string | null;
  sourcePlatform?: SourcePlatform | null;
}): BuyerOnboardingDraft {
  const now = new Date().toISOString();
  return {
    version: BUYER_ONBOARDING_DRAFT_VERSION,
    stage: "account",
    listingUrl: params.listingUrl,
    sourceListingId: params.sourceListingId ?? null,
    sourcePlatform: params.sourcePlatform ?? null,
    authStatus: "anonymous",
    property: {
      status: "captured",
      propertyId: null,
      dealRoomId: null,
    },
    buyerBasics: {
      budgetMax: "",
      financingType: "",
      moveTimeline: "",
      preferredAreas: [],
    },
    lastSavedAt: now,
    completedAt: null,
  };
}

export function mergeBuyerOnboardingDraft(
  draft: BuyerOnboardingDraft,
  patch: BuyerOnboardingDraftPatch,
): BuyerOnboardingDraft {
  return {
    ...draft,
    ...patch,
    property: {
      ...draft.property,
      ...(patch.property ?? {}),
    },
    buyerBasics: {
      ...draft.buyerBasics,
      ...(patch.buyerBasics ?? {}),
      preferredAreas:
        patch.buyerBasics?.preferredAreas ?? draft.buyerBasics.preferredAreas,
    },
    lastSavedAt: new Date().toISOString(),
  };
}

export function setBuyerOnboardingAuthState(
  draft: BuyerOnboardingDraft,
  authStatus: BuyerOnboardingDraft["authStatus"],
): BuyerOnboardingDraft {
  return mergeBuyerOnboardingDraft(draft, {
    authStatus,
    stage: authStatus === "authenticated" ? "buyer_basics" : "account",
  });
}

export function setBuyerOnboardingPropertyStatus(
  draft: BuyerOnboardingDraft,
  property: BuyerOnboardingDraft["property"],
): BuyerOnboardingDraft {
  return mergeBuyerOnboardingDraft(draft, {
    property,
    stage:
      property.status === "deal_room_ready" ? "completed" : "first_property",
    completedAt:
      property.status === "deal_room_ready"
        ? new Date().toISOString()
        : null,
  });
}

export function validateBuyerOnboardingBasics(
  draft: BuyerOnboardingDraft,
):
  | { ok: true; value: BuyerOnboardingBasicsPayload }
  | { ok: false; errors: BuyerOnboardingValidationError[] } {
  const errors: BuyerOnboardingValidationError[] = [];
  const trimmedBudget = draft.buyerBasics.budgetMax.trim();

  if (!trimmedBudget) {
    errors.push({ code: "required", field: "budgetMax" });
  }

  const parsedBudget = Number(trimmedBudget);
  if (trimmedBudget) {
    if (!Number.isFinite(parsedBudget)) {
      errors.push({ code: "invalid_number", field: "budgetMax" });
    } else if (parsedBudget <= 0) {
      errors.push({ code: "non_positive", field: "budgetMax" });
    }
  }

  if (!draft.buyerBasics.moveTimeline) {
    errors.push({ code: "required", field: "moveTimeline" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      budgetMax: parsedBudget,
      financingType: draft.buyerBasics.financingType || undefined,
      moveTimeline: draft.buyerBasics.moveTimeline as BuyerMoveTimeline,
      preferredAreas: draft.buyerBasics.preferredAreas.filter(Boolean),
    },
  };
}

export function reviveBuyerOnboardingDraft(
  value: string,
): BuyerOnboardingDraft | null {
  try {
    const parsed = JSON.parse(value) as Partial<BuyerOnboardingDraft>;
    if (parsed.version !== BUYER_ONBOARDING_DRAFT_VERSION) {
      return null;
    }
    if (typeof parsed.listingUrl !== "string" || !parsed.listingUrl) {
      return null;
    }

    return {
      ...createBuyerOnboardingDraft({
        listingUrl: parsed.listingUrl,
        sourceListingId: parsed.sourceListingId ?? null,
        sourcePlatform: parsed.sourcePlatform ?? null,
      }),
      ...parsed,
      property: {
        propertyId: parsed.property?.propertyId ?? null,
        dealRoomId: parsed.property?.dealRoomId ?? null,
        status: parsed.property?.status ?? "captured",
      },
      buyerBasics: {
        budgetMax: parsed.buyerBasics?.budgetMax ?? "",
        financingType: parsed.buyerBasics?.financingType ?? "",
        moveTimeline: parsed.buyerBasics?.moveTimeline ?? "",
        preferredAreas: parsed.buyerBasics?.preferredAreas ?? [],
      },
      sourceListingId: parsed.sourceListingId ?? null,
      sourcePlatform: parsed.sourcePlatform ?? null,
      authStatus: parsed.authStatus ?? "anonymous",
      stage: parsed.stage ?? "account",
      completedAt: parsed.completedAt ?? null,
      lastSavedAt: parsed.lastSavedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
