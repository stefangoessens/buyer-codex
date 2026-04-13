import type { AgreementType } from "@buyer-codex/shared/contracts";
import type {
  DealRoomAccessLevel,
  LinkPastedSource,
  ListingPortal,
} from "@buyer-codex/shared/launch-events";
import type { AnalyticsEventMap } from "@/lib/analytics";
import { trackFunnelStep } from "@/lib/analytics";

export const PASTE_LINK_FUNNEL_NAME = "paste_link_public_homepage";

export const PASTE_LINK_FUNNEL_STAGES = [
  { step: 1, event: "paste_submitted", label: "Paste submitted" },
  { step: 2, event: "parse_succeeded", label: "Parse succeeded" },
  { step: 3, event: "teaser_rendered", label: "Teaser rendered" },
  { step: 4, event: "registration_prompted", label: "Registration prompted" },
  { step: 5, event: "registration_completed", label: "Registration completed" },
  { step: 6, event: "deal_room_unlocked", label: "Deal room unlocked" },
  { step: 7, event: "agreement_prompted", label: "Agreement prompted" },
  { step: 8, event: "agreement_signed", label: "Agreement signed" },
] as const;

export const PASTE_TO_TEASER_SLO = {
  name: "paste_to_teaser",
  targetMs: 5_000,
  measurement: "teaser_rendered.latencyMs",
} as const;

export const PASTE_LINK_REGISTERED_DEAL_ROOM_KPI = {
  id: "product.paste_to_registered_deal_room_under_60s",
  targetWindowSeconds: 60,
  numeratorEvent: "deal_room_unlocked",
  denominatorEvent: "paste_submitted",
  prerequisiteEvent: "registration_completed",
} as const;

export const PASTE_LINK_DROP_OFF_ALERTS = [
  { stage: "parse_succeeded", previousStage: "paste_submitted", maxLossRatio: 0.15 },
  { stage: "teaser_rendered", previousStage: "parse_succeeded", maxLossRatio: 0.2 },
  { stage: "registration_completed", previousStage: "registration_prompted", maxLossRatio: 0.65 },
  { stage: "deal_room_unlocked", previousStage: "registration_completed", maxLossRatio: 0.3 },
] as const;

function trackPasteLinkStage<K extends keyof AnalyticsEventMap>(
  event: K,
  step: number,
  properties: AnalyticsEventMap[K],
) {
  trackFunnelStep(event, PASTE_LINK_FUNNEL_NAME, step, properties);
}

export function trackPasteSubmitted(props: {
  url: string;
  source: LinkPastedSource;
  platform: ListingPortal;
}) {
  trackPasteLinkStage("paste_submitted", 1, props);
}

export function trackParseSucceeded(props: {
  source: LinkPastedSource;
  platform: ListingPortal;
  listingId: string;
}) {
  trackPasteLinkStage("parse_succeeded", 2, props);
}

export function trackTeaserRendered(props: {
  source?: string;
  platform?: ListingPortal;
  sourceListingId?: string;
  latencyMs?: number;
}) {
  trackPasteLinkStage("teaser_rendered", 3, props);
}

export function trackRegistrationPrompted(source: string) {
  trackPasteLinkStage("registration_prompted", 4, { source });
}

export function trackRegistrationCompleted(props: {
  userId: string;
  source?: string;
}) {
  trackPasteLinkStage("registration_completed", 5, props);
}

export function trackDealRoomUnlocked(props: {
  dealRoomId: string;
  propertyId: string;
  accessLevel?: DealRoomAccessLevel;
}) {
  trackPasteLinkStage("deal_room_unlocked", 6, props);
}

export function trackAgreementPrompted(props: {
  dealRoomId: string;
  source?: string;
  requiredAction?: string;
}) {
  trackPasteLinkStage("agreement_prompted", 7, props);
}

export function trackAgreementSigned(props: {
  agreementId: string;
  dealRoomId: string;
  agreementType?: AgreementType;
}) {
  trackPasteLinkStage("agreement_signed", 8, props);
}
