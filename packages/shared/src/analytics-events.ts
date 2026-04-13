import {
  CURRENT_LAUNCH_EVENT_CONTRACT_DATE,
  CURRENT_LAUNCH_EVENT_CONTRACT_VERSION,
  LAUNCH_EVENT_CONTRACT,
  type LaunchEventMap,
  type LaunchEventName,
  type LaunchEventPropSpec,
  type LaunchEventPropType,
  MESSAGE_CHANNELS,
} from "./launch-events";

export const EXTENSION_INTAKE_PLATFORMS = [
  "zillow",
  "redfin",
  "realtor",
] as const;

export type ExtensionIntakePlatform =
  (typeof EXTENSION_INTAKE_PLATFORMS)[number];

export const EXTENSION_INTAKE_OUTCOMES = ["created", "duplicate"] as const;

export type ExtensionIntakeOutcome =
  (typeof EXTENSION_INTAKE_OUTCOMES)[number];

export const AUTH_STATES = ["signed_in", "signed_out"] as const;

export type AuthState = (typeof AUTH_STATES)[number];

export const DASHBOARD_ROLES = ["buyer", "agent", "broker", "ops"] as const;

export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export const DASHBOARD_SURFACE_MODULES = [
  "hero",
  "task_list",
  "pipeline",
  "recent_activity",
] as const;

export type DashboardSurfaceModule =
  (typeof DASHBOARD_SURFACE_MODULES)[number];

export const DASHBOARD_TARGET_SURFACES = [
  "deal_room",
  "document_upload",
  "tour",
  "offer",
  "closing",
  "communication",
] as const;

export type DashboardTargetSurface =
  (typeof DASHBOARD_TARGET_SURFACES)[number];

export const AI_ANALYSIS_ENGINE_TYPES = [
  "pricing",
  "comps",
  "leverage",
  "cost",
  "offer",
  "case_synthesis",
] as const;

export type AiAnalysisEngineType =
  (typeof AI_ANALYSIS_ENGINE_TYPES)[number];

export const DOCUMENT_UPLOAD_SOURCES = ["buyer", "broker"] as const;

export type DocumentUploadSource = (typeof DOCUMENT_UPLOAD_SOURCES)[number];

export const TOUR_SIDES = ["buyer", "agent", "system"] as const;

export type TourSide = (typeof TOUR_SIDES)[number];

export const TOUR_ATTENDEE_SIDES = ["buyer", "agent"] as const;

export type TourAttendeeSide = (typeof TOUR_ATTENDEE_SIDES)[number];

export const AGENT_ASSIGNMENT_ROUTING_PATHS = [
  "network",
  "showami",
  "manual",
] as const;

export type AgentAssignmentRoutingPath =
  (typeof AGENT_ASSIGNMENT_ROUTING_PATHS)[number];

export const CALCULATOR_TYPES = [
  "affordability",
  "cost",
  "pricing",
] as const;

export type CalculatorType = (typeof CALCULATOR_TYPES)[number];

export interface AnalyticsEventMap extends LaunchEventMap {
  extension_intake_succeeded: {
    platform: ExtensionIntakePlatform;
    outcome: ExtensionIntakeOutcome;
    authState: AuthState;
  };
  extension_intake_failed: {
    code:
      | "invalid_request"
      | "backend_unavailable"
      | "malformed_url"
      | "missing_listing_id"
      | "unsupported_url";
    stage: "request" | "submit";
  };
  dashboard_viewed: {
    role: DashboardRole;
    activeDealCount: number;
    pendingTaskCount: number;
  };
  dashboard_deal_selected: {
    dealRoomId: string;
    propertyId: string;
    rank: number;
    sourceModule: DashboardSurfaceModule;
  };
  dashboard_next_step_clicked: {
    targetSurface: DashboardTargetSurface;
    sourceModule: DashboardSurfaceModule;
    dealRoomId?: string;
  };
  deal_room_exited: { dealRoomId: string; timeSpentMs: number };
  leverage_analysis_viewed: {
    dealRoomId: string;
    propertyId: string;
    score: number;
  };
  cost_breakdown_viewed: {
    dealRoomId: string;
    propertyId: string;
    totalMonthlyMid: number;
  };
  comps_expanded: { dealRoomId: string; compCount: number };
  ai_analysis_viewed: {
    dealRoomId: string;
    engineType: AiAnalysisEngineType;
    confidence: number;
  };
  document_uploaded: {
    documentId: string;
    fileType: string;
    sizeBytes: number;
    source: DocumentUploadSource;
  };
  document_downloaded: { documentId: string; fileType: string };
  document_parsed: {
    documentId: string;
    parser: string;
    durationMs: number;
  };
  document_parse_failed: {
    documentId: string;
    parser: string;
    error: string;
  };
  tour_canceled: {
    tourId: string;
    reason: string;
    side: TourSide;
  };
  tour_no_show: {
    tourId: string;
    side: TourAttendeeSide;
  };
  offer_started: { dealRoomId: string; propertyId: string };
  offer_scenario_selected: {
    dealRoomId: string;
    scenarioIndex: number;
    offerPrice: number;
  };
  offer_countered: { offerId: string; counterPrice: number };
  offer_rejected: { offerId: string; reason: string };
  offer_withdrawn: { offerId: string; reason: string };
  contract_amended: { contractId: string; amendmentType: string };
  milestone_completed: { contractId: string; milestoneName: string };
  message_delivered: {
    messageId: string;
    channel: (typeof MESSAGE_CHANNELS)[number];
  };
  message_opened: {
    messageId: string;
    channel: (typeof MESSAGE_CHANNELS)[number];
  };
  message_clicked: {
    messageId: string;
    channel: (typeof MESSAGE_CHANNELS)[number];
    link: string;
  };
  agent_coverage_created: { agentId: string; areaCount: number };
  agent_assigned: {
    assignmentId: string;
    tourId: string;
    routingPath: AgentAssignmentRoutingPath;
  };
  payout_created: { payoutId: string; amount: number };
  payout_approved: { payoutId: string };
  payout_paid: { payoutId: string; batchMonth: string };
  calculator_used: { calculator: CalculatorType; durationMs?: number };
  pricing_faq_viewed: { source: string };
  error_boundary_hit: { error: string; location?: string; url?: string };
  health_check_failed: { check: string; status: number };
  worker_job_failed: { jobId: string; jobType: string; error: string };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;
export type AnalyticsEvent = AnalyticsEventName;
export type AnalyticsEventProps<K extends AnalyticsEventName> =
  AnalyticsEventMap[K];

export type AnalyticsEventCategory =
  | "funnel"
  | "dashboard"
  | "deal_room"
  | "documents"
  | "tour"
  | "offer"
  | "closing"
  | "communication"
  | "agent_ops"
  | "engagement"
  | "system";

export type AnalyticsEventPropType = LaunchEventPropType;
export type AnalyticsEventPropSpec = LaunchEventPropSpec;

export interface AnalyticsEventDefinition<Name extends string = string> {
  name: Name;
  category: AnalyticsEventCategory;
  description: string;
  owner: string;
  source: string;
  whenFired: string;
  semantics: string;
  piiSafe: boolean;
  introducedIn: string;
  props: Record<string, AnalyticsEventPropSpec>;
}

export interface AnalyticsEventMetadata {
  category: AnalyticsEventCategory;
  owner: string;
  source: string;
  whenFired: string;
  semantics: string;
  piiSafe: boolean;
}

export interface AnalyticsEventContract<EventName extends string = string> {
  version: string;
  lastUpdated: string;
  events: Record<EventName, AnalyticsEventDefinition<EventName>>;
}

export type CanonicalAnalyticsEventContract =
  AnalyticsEventContract<AnalyticsEventName>;

export interface AnalyticsEventContractRelease {
  version: string;
  releasedOn: string;
  summary: string;
  changes: readonly string[];
}

export const CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION = "1.1.0" as const;
export const CURRENT_ANALYTICS_EVENT_CONTRACT_DATE = "2026-04-13" as const;

export const ANALYTICS_EVENT_CONTRACT_CHANGELOG = [
  {
    version: CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION,
    releasedOn: CURRENT_ANALYTICS_EVENT_CONTRACT_DATE,
    summary:
      "Introduced the comprehensive shared analytics taxonomy for dashboard, deal workflow, communications, ops, and launch funnel events.",
    changes: [
      `Inherited the launch-critical funnel contract from ${CURRENT_LAUNCH_EVENT_CONTRACT_VERSION} (${CURRENT_LAUNCH_EVENT_CONTRACT_DATE}).`,
      "Added dashboard event coverage and promoted non-funnel analytics definitions into @buyer-codex/shared.",
      "Documented per-event source, when-fired rules, semantics, and PII posture in a serializable contract.",
      "Preserved typed event-call enforcement for web code while making the full catalog consumable by backend and iOS tooling.",
      "Added the KIN-942 public paste-link funnel event taxonomy and stage metadata for homepage-to-agreement tracking.",
    ],
  },
] as const satisfies readonly AnalyticsEventContractRelease[];

const launchEventMetadata = {
  paste_submitted: {
    category: "funnel",
    source: "web.marketing.paste_link_cta",
    whenFired:
      "Buyer submits a supported listing URL from the homepage or another paste-link CTA.",
    semantics:
      "Represents the top-of-funnel paste action after the shared parser confirms the URL is a supported portal link.",
    piiSafe: true,
  },
  parse_succeeded: {
    category: "funnel",
    source: "web.marketing.shared_parser",
    whenFired:
      "The shared listing parser successfully classifies and normalizes a submitted URL.",
    semantics:
      "Represents a typed parser success before the intake teaser and registration gate render.",
    piiSafe: true,
  },
  teaser_rendered: {
    category: "funnel",
    source: "web.marketing.intake_teaser",
    whenFired:
      "The anonymous teaser / onboarding gate first renders after intake navigation completes.",
    semantics:
      "Represents the first buyer-visible listing context after a successful paste-link submission.",
    piiSafe: true,
  },
  registration_prompted: {
    category: "funnel",
    source: "web.auth.registration_gate",
    whenFired:
      "The teaser surface prompts the buyer to create or resume an account.",
    semantics:
      "Represents the transition from anonymous teaser to the registration decision point.",
    piiSafe: true,
  },
  link_pasted: {
    category: "funnel",
    source: "web.marketing.intake",
    whenFired: "Buyer submits a property URL from a public intake surface.",
    semantics:
      "Represents top-of-funnel listing intent before any account or deal-room conversion step.",
    piiSafe: true,
  },
  teaser_viewed: {
    category: "funnel",
    source: "web.marketing.teaser",
    whenFired:
      "Teaser page or gated listing preview first renders after intake resolves.",
    semantics:
      "Represents a buyer seeing the first personalized listing context prior to registration.",
    piiSafe: true,
  },
  registration_started: {
    category: "funnel",
    source: "web.auth.registration_gate",
    whenFired:
      "Registration modal or gated sign-up flow opens from a marketing or teaser surface.",
    semantics:
      "Represents the start of buyer account creation tied to a known acquisition surface.",
    piiSafe: true,
  },
  registration_completed: {
    category: "funnel",
    source: "web.auth.registration_gate",
    whenFired: "Buyer account creation succeeds and the app receives a user id.",
    semantics:
      "Represents a completed acquisition conversion from anonymous visitor to registered buyer.",
    piiSafe: true,
  },
  deal_room_unlocked: {
    category: "funnel",
    source: "web.deal_room.first_view",
    whenFired:
      "The buyer lands on the first unlocked deal-room view after completing onboarding.",
    semantics:
      "Represents the first buyer-visible deal-room step in the paste-link conversion funnel.",
    piiSafe: true,
  },
  agreement_prompted: {
    category: "funnel",
    source: "web.offer.eligibility_gate",
    whenFired:
      "The offer-entry gate prompts the buyer to review or sign their representation agreement.",
    semantics:
      "Represents the agreement-entry boundary in the paste-link conversion funnel.",
    piiSafe: true,
  },
  agreement_signed: {
    category: "funnel",
    source: "backend.agreements",
    whenFired:
      "The agreement lifecycle reaches signed state for the buyer's deal room.",
    semantics:
      "Represents the agreement completion step that unlocks the next conversion workflow.",
    piiSafe: true,
  },
  deal_room_entered: {
    category: "deal_room",
    source: "web.deal_room.page",
    whenFired:
      "Authenticated or gated user lands on a deal-room route with a resolved access level.",
    semantics:
      "Represents a successful entry into the property-specific deal workspace.",
    piiSafe: true,
  },
  pricing_panel_viewed: {
    category: "deal_room",
    source: "web.deal_room.pricing_panel",
    whenFired:
      "Pricing panel first paints with a real model result rather than a loading placeholder.",
    semantics:
      "Represents exposure to AI-assisted valuation guidance inside a deal room.",
    piiSafe: true,
  },
  tour_requested: {
    category: "tour",
    source: "web.deal_room.tour_request",
    whenFired: "Buyer submits the request-tour flow successfully.",
    semantics:
      "Represents explicit buyer intent to schedule an in-person or virtual showing.",
    piiSafe: true,
  },
  tour_confirmed: {
    category: "tour",
    source: "backend.tour_ops",
    whenFired: "Scheduling operations confirm a specific tour slot and agent.",
    semantics:
      "Represents a tour progressing from requested to committed on the ops side.",
    piiSafe: true,
  },
  tour_completed: {
    category: "tour",
    source: "backend.tour_ops",
    whenFired:
      "Tour status transitions to completed after the scheduled window has passed.",
    semantics:
      "Represents a showing that actually happened, not just one that was booked.",
    piiSafe: true,
  },
  offer_submitted: {
    category: "offer",
    source: "backend.offer_pipeline",
    whenFired: "Offer creation mutation succeeds and the offer is persisted.",
    semantics:
      "Represents the first seller-facing offer state for a property negotiation.",
    piiSafe: true,
  },
  offer_accepted: {
    category: "offer",
    source: "backend.offer_pipeline",
    whenFired: "Listing side marks the offer as accepted.",
    semantics:
      "Represents the negotiation reaching an accepted deal state before closing execution.",
    piiSafe: true,
  },
  contract_signed: {
    category: "closing",
    source: "backend.closing_pipeline",
    whenFired: "Purchase contract is fully executed by all required parties.",
    semantics:
      "Represents the transaction moving from offer negotiation into an enforceable contract state.",
    piiSafe: true,
  },
  deal_closed: {
    category: "closing",
    source: "backend.closing_pipeline",
    whenFired: "Deal transitions into its terminal closed state.",
    semantics:
      "Represents a successfully completed transaction, not merely a signed contract.",
    piiSafe: true,
  },
  message_sent: {
    category: "communication",
    source: "backend.communication_dispatch",
    whenFired: "Outbound message is queued successfully for downstream delivery.",
    semantics:
      "Represents the system initiating buyer-facing communication on a named template/channel.",
    piiSafe: true,
  },
} satisfies Record<
  LaunchEventName,
  Omit<AnalyticsEventMetadata, "owner">
>;

function defineLaunchAnalyticsEvent<Name extends LaunchEventName>(
  name: Name,
): AnalyticsEventDefinition<Name> {
  const baseEvent = LAUNCH_EVENT_CONTRACT.events[name];
  const metadata = launchEventMetadata[name];

  return {
    ...baseEvent,
    category: metadata.category,
    source: metadata.source,
    whenFired: metadata.whenFired,
    semantics: metadata.semantics,
    piiSafe: metadata.piiSafe,
  } as unknown as AnalyticsEventDefinition<Name>;
}

export const ANALYTICS_EVENT_CONTRACT = {
  version: CURRENT_ANALYTICS_EVENT_CONTRACT_VERSION,
  lastUpdated: CURRENT_ANALYTICS_EVENT_CONTRACT_DATE,
  events: {
    paste_submitted: defineLaunchAnalyticsEvent("paste_submitted"),
    parse_succeeded: defineLaunchAnalyticsEvent("parse_succeeded"),
    teaser_rendered: defineLaunchAnalyticsEvent("teaser_rendered"),
    registration_prompted: defineLaunchAnalyticsEvent("registration_prompted"),
    link_pasted: defineLaunchAnalyticsEvent("link_pasted"),
    teaser_viewed: defineLaunchAnalyticsEvent("teaser_viewed"),
    registration_started: defineLaunchAnalyticsEvent("registration_started"),
    registration_completed: defineLaunchAnalyticsEvent("registration_completed"),
    deal_room_unlocked: defineLaunchAnalyticsEvent("deal_room_unlocked"),
    agreement_prompted: defineLaunchAnalyticsEvent("agreement_prompted"),
    agreement_signed: defineLaunchAnalyticsEvent("agreement_signed"),
    extension_intake_succeeded: {
      name: "extension_intake_succeeded",
      category: "funnel",
      description:
        "Chrome extension intake resolves successfully for a supported listing URL.",
      owner: "growth",
      source: "extension.intake_api",
      whenFired:
        "Extension intake API returns either a newly created or duplicate intake result.",
      semantics:
        "Represents extension-origin acquisition intent that successfully entered the buyer-codex funnel.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        platform: {
          type: "enum",
          required: true,
          description: "Listing portal detected from the pasted URL.",
          enumValues: EXTENSION_INTAKE_PLATFORMS,
        },
        outcome: {
          type: "enum",
          required: true,
          description: "Whether intake created a new record or matched an existing one.",
          enumValues: EXTENSION_INTAKE_OUTCOMES,
        },
        authState: {
          type: "enum",
          required: true,
          description: "Whether the extension request came from an authenticated user.",
          enumValues: AUTH_STATES,
        },
      },
    },
    extension_intake_failed: {
      name: "extension_intake_failed",
      category: "system",
      description:
        "Chrome extension intake rejects because the request cannot be processed.",
      owner: "growth",
      source: "extension.intake_api",
      whenFired:
        "Extension intake API returns a deterministic validation or backend-availability failure.",
      semantics:
        "Represents a blocked funnel entry from the extension path and should be analyzed as an intake defect, not a buyer action.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        code: {
          type: "enum",
          required: true,
          description: "Stable failure code for intake rejection.",
          enumValues: [
            "invalid_request",
            "backend_unavailable",
            "malformed_url",
            "missing_listing_id",
            "unsupported_url",
          ],
        },
        stage: {
          type: "enum",
          required: true,
          description: "Which step of intake failed.",
          enumValues: ["request", "submit"],
        },
      },
    },
    dashboard_viewed: {
      name: "dashboard_viewed",
      category: "dashboard",
      description:
        "Authenticated dashboard home renders with actionable pipeline context.",
      owner: "dashboard",
      source: "web.dashboard.home",
      whenFired:
        "Dashboard home finishes loading the current role-specific hero, tasks, and pipeline summary.",
      semantics:
        "Represents a user landing on the orchestrating dashboard surface before choosing a specific workflow.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        role: {
          type: "enum",
          required: true,
          description: "Role-specific dashboard variant that rendered.",
          enumValues: DASHBOARD_ROLES,
        },
        activeDealCount: {
          type: "integer",
          required: true,
          description: "Count of active deals visible on first render.",
          min: 0,
        },
        pendingTaskCount: {
          type: "integer",
          required: true,
          description: "Count of pending tasks or next actions visible on first render.",
          min: 0,
        },
      },
    },
    dashboard_deal_selected: {
      name: "dashboard_deal_selected",
      category: "dashboard",
      description:
        "User opens a specific deal from the dashboard list or recents module.",
      owner: "dashboard",
      source: "web.dashboard.pipeline",
      whenFired:
        "User clicks a deal-room entry card from the dashboard shell before route navigation completes.",
      semantics:
        "Represents dashboard-to-deal-room navigation intent, distinct from the eventual deal_room_entered arrival event.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id selected from the dashboard.",
        },
        propertyId: {
          type: "string",
          required: true,
          description: "Property id associated with the selected deal room.",
        },
        rank: {
          type: "integer",
          required: true,
          description: "1-based ordering of the selected item within the module.",
          min: 1,
        },
        sourceModule: {
          type: "enum",
          required: true,
          description: "Dashboard module that contained the selected deal.",
          enumValues: DASHBOARD_SURFACE_MODULES,
        },
      },
    },
    dashboard_next_step_clicked: {
      name: "dashboard_next_step_clicked",
      category: "dashboard",
      description:
        "User clicks a dashboard CTA that launches the next workflow step.",
      owner: "dashboard",
      source: "web.dashboard.next_step",
      whenFired:
        "Dashboard CTA or task row is clicked to enter a downstream workflow such as documents, tours, offers, or messaging.",
      semantics:
        "Represents an orchestrated workflow handoff from the dashboard shell into a concrete brokerage action.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        targetSurface: {
          type: "enum",
          required: true,
          description: "Downstream workflow the CTA is intended to open.",
          enumValues: DASHBOARD_TARGET_SURFACES,
        },
        sourceModule: {
          type: "enum",
          required: true,
          description: "Dashboard module that surfaced the CTA.",
          enumValues: DASHBOARD_SURFACE_MODULES,
        },
        dealRoomId: {
          type: "string",
          required: false,
          description:
            "Deal room id attached to the CTA, when the next step belongs to a specific property workflow.",
        },
      },
    },
    deal_room_entered: defineLaunchAnalyticsEvent("deal_room_entered"),
    deal_room_exited: {
      name: "deal_room_exited",
      category: "deal_room",
      description:
        "User leaves a deal room and the client records total time spent.",
      owner: "dashboard",
      source: "web.deal_room.page",
      whenFired:
        "Deal-room route unmounts after the page was active long enough to measure dwell time.",
      semantics:
        "Represents the end of a deal-room session and enables engagement analysis without relying on page timers downstream.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id that was exited.",
        },
        timeSpentMs: {
          type: "integer",
          required: true,
          description: "Measured dwell time in milliseconds.",
          min: 0,
        },
      },
    },
    pricing_panel_viewed: defineLaunchAnalyticsEvent("pricing_panel_viewed"),
    leverage_analysis_viewed: {
      name: "leverage_analysis_viewed",
      category: "deal_room",
      description:
        "Leverage analysis module becomes visible inside the deal room.",
      owner: "ai",
      source: "web.deal_room.leverage_analysis",
      whenFired:
        "Leverage analysis section scrolls into view with a resolved scoring payload.",
      semantics:
        "Represents buyer exposure to financing and leverage guidance generated for the property.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id for the viewed analysis.",
        },
        propertyId: {
          type: "string",
          required: true,
          description: "Property id associated with the analysis.",
        },
        score: {
          type: "number",
          required: true,
          description: "Rendered leverage score for the property scenario.",
          min: 0,
        },
      },
    },
    cost_breakdown_viewed: {
      name: "cost_breakdown_viewed",
      category: "deal_room",
      description:
        "Monthly cost breakdown section becomes visible inside the deal room.",
      owner: "ai",
      source: "web.deal_room.cost_breakdown",
      whenFired:
        "Cost breakdown section scrolls into view with an actual monthly estimate.",
      semantics:
        "Represents exposure to monthly carrying-cost guidance for the property.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id for the viewed cost breakdown.",
        },
        propertyId: {
          type: "string",
          required: true,
          description: "Property id associated with the estimate.",
        },
        totalMonthlyMid: {
          type: "integer",
          required: true,
          description: "Midpoint monthly cost estimate in whole dollars.",
          min: 0,
        },
      },
    },
    comps_expanded: {
      name: "comps_expanded",
      category: "deal_room",
      description: "Buyer expands the comps module inside the deal room.",
      owner: "ai",
      source: "web.deal_room.comps",
      whenFired:
        "Comparable-sales section transitions from collapsed to expanded state.",
      semantics:
        "Represents active buyer interest in supporting comparable-sale evidence, not just passive exposure.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id for the expanded comps module.",
        },
        compCount: {
          type: "integer",
          required: true,
          description: "Number of comparable properties available in the section.",
          min: 0,
        },
      },
    },
    ai_analysis_viewed: {
      name: "ai_analysis_viewed",
      category: "deal_room",
      description:
        "Buyer sees an AI-generated analysis or recommendation inside the deal room.",
      owner: "ai",
      source: "web.deal_room.ai_module",
      whenFired:
        "Any AI analysis card first renders with a resolved engine payload and confidence score.",
      semantics:
        "Represents exposure to a specific AI-generated explanation or recommendation for the property.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id that surfaced the AI result.",
        },
        engineType: {
          type: "enum",
          required: true,
          description: "AI engine that produced the rendered output.",
          enumValues: AI_ANALYSIS_ENGINE_TYPES,
        },
        confidence: {
          type: "number",
          required: true,
          description: "Confidence score attached to the AI output.",
          min: 0,
          max: 1,
        },
      },
    },
    tour_requested: defineLaunchAnalyticsEvent("tour_requested"),
    document_uploaded: {
      name: "document_uploaded",
      category: "documents",
      description: "Document upload completes successfully.",
      owner: "ops",
      source: "web.deal_room.documents",
      whenFired:
        "Upload flow returns a persisted document id after the file has been accepted.",
      semantics:
        "Represents a document becoming part of the shared deal-room packet, regardless of who uploaded it.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        documentId: {
          type: "string",
          required: true,
          description: "Persisted document id returned by the backend.",
        },
        fileType: {
          type: "string",
          required: true,
          description: "Normalized file type or extension.",
        },
        sizeBytes: {
          type: "integer",
          required: true,
          description: "Uploaded file size in bytes.",
          min: 0,
        },
        source: {
          type: "enum",
          required: true,
          description: "Who initiated the upload.",
          enumValues: DOCUMENT_UPLOAD_SOURCES,
        },
      },
    },
    document_downloaded: {
      name: "document_downloaded",
      category: "documents",
      description: "User initiates a document download.",
      owner: "ops",
      source: "web.deal_room.documents",
      whenFired:
        "Download button or signed URL action is clicked for a persisted document.",
      semantics:
        "Represents an explicit request to inspect or export a deal-room document.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        documentId: {
          type: "string",
          required: true,
          description: "Persisted document id being downloaded.",
        },
        fileType: {
          type: "string",
          required: true,
          description: "Normalized file type or extension.",
        },
      },
    },
    document_parsed: {
      name: "document_parsed",
      category: "documents",
      description:
        "Document parsing or extraction pipeline completes successfully.",
      owner: "ops",
      source: "backend.document_pipeline",
      whenFired:
        "Structured extraction job finishes successfully for an uploaded document.",
      semantics:
        "Represents backend readiness of a document for downstream review, search, or workflow automation.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        documentId: {
          type: "string",
          required: true,
          description: "Persisted document id that was parsed.",
        },
        parser: {
          type: "string",
          required: true,
          description: "Parser or extraction strategy that ran.",
        },
        durationMs: {
          type: "integer",
          required: true,
          description: "End-to-end parse duration in milliseconds.",
          min: 0,
        },
      },
    },
    document_parse_failed: {
      name: "document_parse_failed",
      category: "documents",
      description:
        "Document parsing or extraction pipeline fails permanently.",
      owner: "ops",
      source: "backend.document_pipeline",
      whenFired:
        "Structured extraction job throws or returns a terminal validation failure.",
      semantics:
        "Represents backend inability to turn an uploaded document into structured data, not a client-side upload problem.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        documentId: {
          type: "string",
          required: true,
          description: "Persisted document id that failed parsing.",
        },
        parser: {
          type: "string",
          required: true,
          description: "Parser or extraction strategy that failed.",
        },
        error: {
          type: "string",
          required: true,
          description: "Stable or raw failure message; scrubbed before export.",
        },
      },
    },
    tour_confirmed: defineLaunchAnalyticsEvent("tour_confirmed"),
    tour_completed: defineLaunchAnalyticsEvent("tour_completed"),
    tour_canceled: {
      name: "tour_canceled",
      category: "tour",
      description: "A scheduled tour is canceled before it happens.",
      owner: "brokerage",
      source: "backend.tour_ops",
      whenFired:
        "Tour status transitions to canceled by a buyer, agent, or system workflow.",
      semantics:
        "Represents a scheduled showing falling out of the active pipeline before completion.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        tourId: {
          type: "string",
          required: true,
          description: "Tour id that was canceled.",
        },
        reason: {
          type: "string",
          required: true,
          description: "Cancellation reason; scrubbed before export.",
        },
        side: {
          type: "enum",
          required: true,
          description: "Which side or system initiated the cancellation.",
          enumValues: TOUR_SIDES,
        },
      },
    },
    tour_no_show: {
      name: "tour_no_show",
      category: "tour",
      description: "A no-show is recorded after the tour window.",
      owner: "brokerage",
      source: "backend.tour_ops",
      whenFired:
        "Tour status transitions to no_show after attendance is marked missing.",
      semantics:
        "Represents a scheduled showing failing operationally after it should have occurred.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        tourId: {
          type: "string",
          required: true,
          description: "Tour id marked as a no-show.",
        },
        side: {
          type: "enum",
          required: true,
          description: "Which attendee side did not show up.",
          enumValues: TOUR_ATTENDEE_SIDES,
        },
      },
    },
    offer_started: {
      name: "offer_started",
      category: "offer",
      description:
        "Buyer opens the offer-building flow from a deal-room surface.",
      owner: "brokerage",
      source: "web.deal_room.offer_builder",
      whenFired:
        "Offer builder page or modal opens with a resolved property context.",
      semantics:
        "Represents the start of an offer-authoring workflow before any price or terms are submitted.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id the buyer is negotiating from.",
        },
        propertyId: {
          type: "string",
          required: true,
          description: "Property id being negotiated.",
        },
      },
    },
    offer_scenario_selected: {
      name: "offer_scenario_selected",
      category: "offer",
      description:
        "Buyer chooses a modeled offer scenario from the offer engine output.",
      owner: "brokerage",
      source: "web.deal_room.offer_builder",
      whenFired:
        "Buyer clicks a scenario card or recommendation inside the offer builder.",
      semantics:
        "Represents selection of a specific modeled negotiation path before submission.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        dealRoomId: {
          type: "string",
          required: true,
          description: "Deal room id the scenario belongs to.",
        },
        scenarioIndex: {
          type: "integer",
          required: true,
          description: "0-based scenario index in the rendered list.",
          min: 0,
        },
        offerPrice: {
          type: "integer",
          required: true,
          description: "Scenario offer price in whole dollars.",
          min: 0,
        },
      },
    },
    offer_submitted: defineLaunchAnalyticsEvent("offer_submitted"),
    offer_countered: {
      name: "offer_countered",
      category: "offer",
      description: "Seller issues a counter-offer.",
      owner: "brokerage",
      source: "backend.offer_pipeline",
      whenFired:
        "Offer state transitions to countered with a recorded counter price.",
      semantics:
        "Represents the seller side continuing negotiation with revised financial terms.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        offerId: {
          type: "string",
          required: true,
          description: "Offer id that received the counter.",
        },
        counterPrice: {
          type: "integer",
          required: true,
          description: "Counter-offer price in whole dollars.",
          min: 0,
        },
      },
    },
    offer_accepted: defineLaunchAnalyticsEvent("offer_accepted"),
    offer_rejected: {
      name: "offer_rejected",
      category: "offer",
      description: "Offer is rejected by the listing side.",
      owner: "brokerage",
      source: "backend.offer_pipeline",
      whenFired:
        "Offer state transitions to rejected with an optional human-readable reason.",
      semantics:
        "Represents a negotiation terminating without contract execution.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        offerId: {
          type: "string",
          required: true,
          description: "Offer id that was rejected.",
        },
        reason: {
          type: "string",
          required: true,
          description: "Free-form rejection reason; scrubbed before export.",
        },
      },
    },
    offer_withdrawn: {
      name: "offer_withdrawn",
      category: "offer",
      description: "Buyer withdraws an active offer before acceptance.",
      owner: "brokerage",
      source: "backend.offer_pipeline",
      whenFired:
        "Offer state transitions to withdrawn by buyer-side action.",
      semantics:
        "Represents a buyer-initiated termination of negotiation before seller acceptance.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        offerId: {
          type: "string",
          required: true,
          description: "Offer id that was withdrawn.",
        },
        reason: {
          type: "string",
          required: true,
          description: "Free-form withdrawal reason; scrubbed before export.",
        },
      },
    },
    contract_signed: defineLaunchAnalyticsEvent("contract_signed"),
    contract_amended: {
      name: "contract_amended",
      category: "closing",
      description: "Post-signature contract amendment is recorded.",
      owner: "brokerage",
      source: "backend.closing_pipeline",
      whenFired:
        "Amendment is executed and attached to an already signed contract.",
      semantics:
        "Represents a contract changing after execution while the deal remains live.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        contractId: {
          type: "string",
          required: true,
          description: "Contract id that was amended.",
        },
        amendmentType: {
          type: "string",
          required: true,
          description: "Normalized amendment classification.",
        },
      },
    },
    milestone_completed: {
      name: "milestone_completed",
      category: "closing",
      description:
        "A closing checklist milestone is completed after contract execution.",
      owner: "brokerage",
      source: "web.closing_checklist",
      whenFired:
        "Closing timeline milestone transitions to completed from the checklist or backend sync.",
      semantics:
        "Represents progress through the post-contract closing workflow toward final settlement.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        contractId: {
          type: "string",
          required: true,
          description: "Contract id associated with the milestone.",
        },
        milestoneName: {
          type: "string",
          required: true,
          description: "Stable milestone slug or display name.",
        },
      },
    },
    deal_closed: defineLaunchAnalyticsEvent("deal_closed"),
    message_sent: defineLaunchAnalyticsEvent("message_sent"),
    message_delivered: {
      name: "message_delivered",
      category: "communication",
      description:
        "Delivery provider confirms that a message reached the recipient channel.",
      owner: "platform",
      source: "backend.communication_webhook",
      whenFired:
        "Delivery webhook or provider acknowledgement marks an outbound message as delivered.",
      semantics:
        "Represents successful transmission to the channel endpoint, not proof that the buyer engaged with the message.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        messageId: {
          type: "string",
          required: true,
          description: "Outbound message id in buyer-codex.",
        },
        channel: {
          type: "enum",
          required: true,
          description: "Delivery channel confirmed by the provider.",
          enumValues: MESSAGE_CHANNELS,
        },
      },
    },
    message_opened: {
      name: "message_opened",
      category: "communication",
      description:
        "Recipient opens a previously delivered message or receives a push-open callback.",
      owner: "platform",
      source: "backend.communication_webhook",
      whenFired:
        "Open pixel, push-open receipt, or equivalent provider signal is recorded.",
      semantics:
        "Represents recipient engagement with delivered communication, not just delivery success.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        messageId: {
          type: "string",
          required: true,
          description: "Outbound message id in buyer-codex.",
        },
        channel: {
          type: "enum",
          required: true,
          description: "Channel where the open was observed.",
          enumValues: MESSAGE_CHANNELS,
        },
      },
    },
    message_clicked: {
      name: "message_clicked",
      category: "communication",
      description: "Recipient clicks a tracked link from a sent message.",
      owner: "platform",
      source: "backend.communication_redirect",
      whenFired:
        "Tracked redirect or provider callback records a link click from a message.",
      semantics:
        "Represents deep engagement with buyer communication and a handoff into another workflow or surface.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        messageId: {
          type: "string",
          required: true,
          description: "Outbound message id in buyer-codex.",
        },
        channel: {
          type: "enum",
          required: true,
          description: "Channel where the click was observed.",
          enumValues: MESSAGE_CHANNELS,
        },
        link: {
          type: "string",
          required: true,
          description: "Clicked link URL or stable redirect target.",
        },
      },
    },
    agent_coverage_created: {
      name: "agent_coverage_created",
      category: "agent_ops",
      description:
        "A new agent coverage record is created for one or more service areas.",
      owner: "brokerage",
      source: "backend.agent_ops",
      whenFired:
        "Coverage creation workflow persists a new agent-service-area mapping.",
      semantics:
        "Represents expansion or refresh of the available showing-agent supply network.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        agentId: {
          type: "string",
          required: true,
          description: "Showing agent id gaining coverage.",
        },
        areaCount: {
          type: "integer",
          required: true,
          description: "Number of service areas included in the new record.",
          min: 0,
        },
      },
    },
    agent_assigned: {
      name: "agent_assigned",
      category: "agent_ops",
      description:
        "A specific showing assignment is routed to an agent or partner.",
      owner: "brokerage",
      source: "backend.agent_ops",
      whenFired:
        "Assignment workflow persists a tour-to-agent routing decision.",
      semantics:
        "Represents operational staffing of a requested tour, regardless of routing path.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        assignmentId: {
          type: "string",
          required: true,
          description: "Assignment id created for the routing decision.",
        },
        tourId: {
          type: "string",
          required: true,
          description: "Tour id being staffed.",
        },
        routingPath: {
          type: "enum",
          required: true,
          description: "Routing mechanism that produced the assignment.",
          enumValues: AGENT_ASSIGNMENT_ROUTING_PATHS,
        },
      },
    },
    payout_created: {
      name: "payout_created",
      category: "agent_ops",
      description:
        "A showing payout obligation is created for operational settlement.",
      owner: "brokerage",
      source: "backend.agent_ops",
      whenFired:
        "Ops workflow records a new payout row tied to a completed showing or assignment.",
      semantics:
        "Represents money owed to the showing network before approval or payment.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        payoutId: {
          type: "string",
          required: true,
          description: "Payout obligation id.",
        },
        amount: {
          type: "integer",
          required: true,
          description: "Payout amount in whole dollars.",
          min: 0,
        },
      },
    },
    payout_approved: {
      name: "payout_approved",
      category: "agent_ops",
      description:
        "Broker or ops approves a payout obligation for payment processing.",
      owner: "brokerage",
      source: "backend.agent_ops",
      whenFired: "Payout approval state changes from pending to approved.",
      semantics:
        "Represents the control point where owed funds are cleared for payment.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        payoutId: {
          type: "string",
          required: true,
          description: "Payout obligation id.",
        },
      },
    },
    payout_paid: {
      name: "payout_paid",
      category: "agent_ops",
      description: "Approved payout is marked paid in a settlement batch.",
      owner: "brokerage",
      source: "backend.agent_ops",
      whenFired:
        "Payout row transitions to paid with a recorded monthly settlement batch.",
      semantics:
        "Represents the final settlement step for an operational payout obligation.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        payoutId: {
          type: "string",
          required: true,
          description: "Payout obligation id.",
        },
        batchMonth: {
          type: "string",
          required: true,
          description: "Settlement batch month in YYYY-MM format.",
        },
      },
    },
    calculator_used: {
      name: "calculator_used",
      category: "engagement",
      description:
        "Buyer interacts meaningfully with a marketing-site calculator.",
      owner: "growth",
      source: "web.marketing.calculators",
      whenFired:
        "Calculator submits or slider interaction settles after a meaningful input change.",
      semantics:
        "Represents mid-funnel engagement with planning tools outside the authenticated workflow.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        calculator: {
          type: "enum",
          required: true,
          description: "Calculator surface the buyer engaged with.",
          enumValues: CALCULATOR_TYPES,
        },
        durationMs: {
          type: "integer",
          required: false,
          description: "Optional interaction duration in milliseconds.",
          min: 0,
        },
      },
    },
    pricing_faq_viewed: {
      name: "pricing_faq_viewed",
      category: "engagement",
      description:
        "Buyer expands a pricing FAQ entry on the public marketing site.",
      owner: "growth",
      source: "web.marketing.pricing_faq",
      whenFired:
        "FAQ disclosure is expanded from collapsed to visible state.",
      semantics:
        "Represents intent to understand pricing and objections before entering the product.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        source: {
          type: "string",
          required: true,
          description: "Marketing page or module that contained the FAQ.",
        },
      },
    },
    error_boundary_hit: {
      name: "error_boundary_hit",
      category: "system",
      description: "React error boundary catches a client-render failure.",
      owner: "platform",
      source: "web.runtime",
      whenFired:
        "Client-side error boundary catches an exception and renders a fallback.",
      semantics:
        "Represents a user-visible frontend failure, regardless of whether the session recovers.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        error: {
          type: "string",
          required: true,
          description: "Error message or code; scrubbed before export.",
        },
        location: {
          type: "string",
          required: false,
          description: "Optional component or route hint for the crash site.",
        },
        url: {
          type: "string",
          required: false,
          description: "Optional current URL when the error occurred.",
        },
      },
    },
    health_check_failed: {
      name: "health_check_failed",
      category: "system",
      description: "Health endpoint or downstream dependency reports failure.",
      owner: "platform",
      source: "backend.health",
      whenFired:
        "Health probe returns a non-200 status for a named dependency or service.",
      semantics:
        "Represents infrastructure or dependency degradation rather than an end-user product interaction.",
      piiSafe: true,
      introducedIn: "1.0.0",
      props: {
        check: {
          type: "string",
          required: true,
          description: "Named subsystem or dependency that failed.",
        },
        status: {
          type: "integer",
          required: true,
          description: "Observed HTTP-style failure status code.",
          min: 100,
          max: 599,
        },
      },
    },
    worker_job_failed: {
      name: "worker_job_failed",
      category: "system",
      description:
        "Background worker reports a permanent job failure after retries or validation.",
      owner: "platform",
      source: "workers.extraction",
      whenFired:
        "Python worker or job runner posts a final failure signal for a tracked job.",
      semantics:
        "Represents durable backend failure that should be operationally actionable, not a transient retry signal.",
      piiSafe: false,
      introducedIn: "1.0.0",
      props: {
        jobId: {
          type: "string",
          required: true,
          description: "Background job id that failed.",
        },
        jobType: {
          type: "string",
          required: true,
          description: "Worker job classification.",
        },
        error: {
          type: "string",
          required: true,
          description: "Failure detail or message; scrubbed before export.",
        },
      },
    },
  },
} satisfies CanonicalAnalyticsEventContract;

export const ANALYTICS_EVENT_NAMES: ReadonlySet<AnalyticsEventName> = new Set(
  Object.keys(ANALYTICS_EVENT_CONTRACT.events) as AnalyticsEventName[],
);

export const EVENT_METADATA: Record<AnalyticsEventName, AnalyticsEventMetadata> =
  Object.fromEntries(
    Object.entries(ANALYTICS_EVENT_CONTRACT.events).map(([name, event]) => [
      name,
      {
        category: event.category,
        owner: event.owner,
        source: event.source,
        whenFired: event.whenFired,
        semantics: event.semantics,
        piiSafe: event.piiSafe,
      },
    ]),
  ) as Record<AnalyticsEventName, AnalyticsEventMetadata>;

export function isAnalyticsEventName(name: string): name is AnalyticsEventName {
  return ANALYTICS_EVENT_NAMES.has(name as AnalyticsEventName);
}

export function serializeAnalyticsEventContract(
  contract: AnalyticsEventContract = ANALYTICS_EVENT_CONTRACT,
): string {
  return JSON.stringify(contract, null, 2);
}
