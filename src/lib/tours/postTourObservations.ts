import type {
  PostTourLeverageSignal,
  PostTourOfferReadiness,
  PostTourPricingSignal,
  PostTourSentiment,
} from "./postTourSignals";

export type PostTourActorRole = "buyer" | "broker" | "admin";

export interface PostTourObservationInput {
  sentiment: PostTourSentiment;
  concerns: string[];
  offerReadiness: PostTourOfferReadiness;
  buyerVisibleNote?: string;
  internalNote?: string;
  pricingSignal?: PostTourPricingSignal;
  leverageSignal?: PostTourLeverageSignal;
  actionItems?: string[];
}

export interface NormalizedPostTourObservationInput
  extends Omit<PostTourObservationInput, "actionItems"> {
  actionItems?: string[];
}

export type PostTourObservationValidationCode =
  | "missing_concern"
  | "buyer_visible_note_too_long"
  | "internal_note_too_long"
  | "buyer_internal_fields_disallowed";

export type PostTourObservationValidationResult =
  | {
      ok: true;
      sanitized: NormalizedPostTourObservationInput;
    }
  | {
      ok: false;
      code: PostTourObservationValidationCode;
      message: string;
    };

export function trimOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeStringList(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed.length === 0) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

export function validatePostTourObservationInput(
  input: PostTourObservationInput,
  actorRole: PostTourActorRole,
): PostTourObservationValidationResult {
  const buyerVisibleNote = trimOptionalText(input.buyerVisibleNote);
  const internalNote = trimOptionalText(input.internalNote);
  const concerns = normalizeStringList(input.concerns);
  const actionItems = normalizeStringList(input.actionItems ?? []);

  if (concerns.length === 0) {
    return {
      ok: false,
      code: "missing_concern",
      message: "At least one structured concern is required",
    };
  }

  if (buyerVisibleNote && buyerVisibleNote.length > 2000) {
    return {
      ok: false,
      code: "buyer_visible_note_too_long",
      message: "Buyer-visible note must be 2000 characters or fewer",
    };
  }

  if (internalNote && internalNote.length > 2000) {
    return {
      ok: false,
      code: "internal_note_too_long",
      message: "Internal note must be 2000 characters or fewer",
    };
  }

  if (
    actorRole === "buyer" &&
    (internalNote ||
      input.pricingSignal ||
      input.leverageSignal ||
      actionItems.length > 0)
  ) {
    return {
      ok: false,
      code: "buyer_internal_fields_disallowed",
      message: "Buyer submissions cannot include internal-only fields",
    };
  }

  return {
    ok: true,
    sanitized: {
      sentiment: input.sentiment,
      concerns,
      offerReadiness: input.offerReadiness,
      buyerVisibleNote,
      internalNote,
      pricingSignal: input.pricingSignal,
      leverageSignal: input.leverageSignal,
      actionItems: actionItems.length > 0 ? actionItems : undefined,
    },
  };
}
