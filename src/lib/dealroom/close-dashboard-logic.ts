/**
 * Pure grouping / urgency / weekly-plan logic for the close dashboard.
 *
 * No Convex imports, no I/O, fully testable offline. The convex query
 * layer invokes these helpers after fetching milestones via the existing
 * contractMilestones module.
 */

import type {
  CloseDashboardBucket,
  CloseDashboardData,
  CloseDashboardMilestone,
  MilestoneStatus,
  NextStepSummary,
  ResponsibleParty,
  TrackState,
  Urgency,
  WeeklyPlan,
  WeeklyPlanItem,
  Workstream,
  WorkstreamGroup,
} from "./close-dashboard-types";
import {
  RESPONSIBLE_PARTY_LABELS,
  TRACK_STATE_LABELS,
  URGENCY_LABELS,
  WORKSTREAM_ORDER,
} from "./close-dashboard-types";

export interface RawMilestone {
  _id: string;
  name: string;
  workstream: Workstream;
  dueDate: string;
  status: MilestoneStatus;
  completedAt?: string;
}

export interface BuildDashboardInput {
  dealRoomId: string;
  propertyAddress: string;
  closeDate: string | null;
  milestones: RawMilestone[];
  now?: string; // ISO date, injected for deterministic tests
}

const MS_PER_DAY = 86_400_000;

function parseDateOnly(iso: string): number {
  // Treat ISO YYYY-MM-DD as midnight UTC to keep the day-math deterministic
  // regardless of local timezone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return Date.parse(`${iso}T00:00:00Z`);
  }
  return Date.parse(iso);
}

export function daysBetween(now: string, iso: string): number {
  const nowDay = parseDateOnly(now.slice(0, 10));
  const target = parseDateOnly(iso.slice(0, 10));
  return Math.round((target - nowDay) / MS_PER_DAY);
}

export function classifyUrgency(
  milestone: RawMilestone,
  days: number,
): Urgency {
  if (milestone.status === "completed") return "completed";
  if (days < 0) return "overdue";
  if (days <= 7) return "this_week";
  if (days <= 14) return "next_week";
  return "later";
}

const PARTY_BY_WORKSTREAM: Record<Workstream, ResponsibleParty> = {
  inspection: "inspector",
  financing: "lender",
  appraisal: "lender",
  title: "title_company",
  insurance: "buyer",
  escrow: "title_company",
  hoa: "hoa",
  walkthrough: "buyer",
  closing: "title_company",
  other: "unknown",
};

const BUYER_DRIVEN_KEYWORDS = [
  "buyer",
  "review",
  "sign",
  "schedule",
  "select",
  "pay",
  "deposit",
  "upload",
  "submit",
];

export function inferResponsibleParty(
  milestone: RawMilestone,
): ResponsibleParty {
  const nameLower = milestone.name.toLowerCase();
  for (const keyword of BUYER_DRIVEN_KEYWORDS) {
    if (nameLower.includes(keyword)) return "buyer";
  }
  return PARTY_BY_WORKSTREAM[milestone.workstream] ?? "unknown";
}

const dueDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const URGENCY_ORDER: readonly Urgency[] = [
  "overdue",
  "this_week",
  "next_week",
  "later",
  "completed",
];

function sentenceOwnerLabel(label: string): string {
  if (label === "You") return "you";
  if (label === "HOA") return "HOA";
  return label.toLowerCase();
}

function formatMilestoneDate(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return dueDateFormatter.format(parsed);
}

function buildBuyerSummary(
  milestone: Pick<
    CloseDashboardMilestone,
    | "completedAt"
    | "daysUntilDue"
    | "dueDate"
    | "ownerLabel"
    | "responsibleParty"
    | "status"
    | "urgency"
  >,
): string {
  if (milestone.status === "completed") {
    return milestone.completedAt
      ? `Completed ${formatMilestoneDate(milestone.completedAt)}`
      : "Completed";
  }

  const dateText = formatMilestoneDate(milestone.dueDate);
  if (milestone.daysUntilDue < 0) {
    const days = Math.abs(milestone.daysUntilDue);
    return `${dateText} · ${days} day${days === 1 ? "" : "s"} overdue`;
  }

  if (milestone.responsibleParty !== "buyer") {
    return `${dateText} · waiting on ${sentenceOwnerLabel(milestone.ownerLabel)}`;
  }

  if (milestone.daysUntilDue === 0) {
    return `${dateText} · due today`;
  }

  return `${dateText} · in ${milestone.daysUntilDue} day${milestone.daysUntilDue === 1 ? "" : "s"}`;
}

function getTrackState(
  milestone: Pick<CloseDashboardMilestone, "status" | "urgency">,
): TrackState {
  if (milestone.status === "completed") return "on_track";
  return milestone.urgency === "overdue" ? "off_track" : "on_track";
}

function getDashboardBucket(
  milestone: Pick<
    CloseDashboardMilestone,
    "responsibleParty" | "status" | "trackState" | "urgency"
  >,
): CloseDashboardBucket {
  if (milestone.status === "completed") return "on_track";
  if (milestone.trackState === "off_track") return "needs_attention";
  if (
    milestone.urgency === "this_week" &&
    milestone.responsibleParty === "buyer"
  ) {
    return "needs_attention";
  }
  if (milestone.responsibleParty !== "buyer") return "waiting_on_others";
  return "on_track";
}

export function toCloseDashboardMilestone(
  raw: RawMilestone,
  now: string,
): CloseDashboardMilestone {
  const days = daysBetween(now, raw.dueDate);
  const urgency = classifyUrgency(raw, days);
  const responsibleParty = inferResponsibleParty(raw);
  const ownerLabel = RESPONSIBLE_PARTY_LABELS[responsibleParty];
  const trackState = getTrackState({ status: raw.status, urgency });
  const dashboardBucket = getDashboardBucket({
    responsibleParty,
    status: raw.status,
    trackState,
    urgency,
  });
  const milestoneBase = {
    id: raw._id,
    name: raw.name,
    workstream: raw.workstream,
    dueDate: raw.dueDate,
    status: raw.status,
    completedAt: raw.completedAt,
    responsibleParty,
    ownerLabel,
    daysUntilDue: days,
    urgency,
    urgencyLabel: URGENCY_LABELS[urgency],
    dashboardBucket,
    trackState,
    trackLabel: TRACK_STATE_LABELS[trackState],
  } satisfies Omit<CloseDashboardMilestone, "buyerSummary">;

  return {
    ...milestoneBase,
    buyerSummary: buildBuyerSummary(milestoneBase),
  };
}

export function groupByWorkstream(
  milestones: CloseDashboardMilestone[],
): WorkstreamGroup[] {
  const byStream: Map<Workstream, CloseDashboardMilestone[]> = new Map();
  for (const m of milestones) {
    const list = byStream.get(m.workstream) ?? [];
    list.push(m);
    byStream.set(m.workstream, list);
  }
  const groups: WorkstreamGroup[] = [];
  for (const workstream of WORKSTREAM_ORDER) {
    const list = byStream.get(workstream);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const completed = list.filter((m) => m.status === "completed").length;
    const overdue = list.filter((m) => m.urgency === "overdue").length;
    const pending = Math.max(0, list.length - completed - overdue);
    const nextDue =
      list.find((m) => m.status !== "completed")?.dueDate ?? null;
    groups.push({
      workstream,
      milestones: list,
      pendingCount: pending,
      overdueCount: overdue,
      completedCount: completed,
      nextDueDate: nextDue,
    });
  }
  return groups;
}

export function groupByUrgency(
  milestones: CloseDashboardMilestone[],
): Array<{
  urgency: Urgency;
  label: string;
  count: number;
  milestones: CloseDashboardMilestone[];
}> {
  const byUrgency = new Map<Urgency, CloseDashboardMilestone[]>();
  for (const milestone of milestones) {
    const list = byUrgency.get(milestone.urgency) ?? [];
    list.push(milestone);
    byUrgency.set(milestone.urgency, list);
  }

  return URGENCY_ORDER.flatMap((urgency) => {
    const list = byUrgency.get(urgency);
    if (!list || list.length === 0) return [];
    const milestonesForUrgency = list
      .slice()
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
    return [
      {
        urgency,
        label: URGENCY_LABELS[urgency],
        count: milestonesForUrgency.length,
        milestones: milestonesForUrgency,
      },
    ];
  });
}

export function buildNextStep(
  milestones: CloseDashboardMilestone[],
): NextStepSummary {
  const overdue = milestones
    .filter((m) => m.trackState === "off_track")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  if (overdue.length > 0) {
    const m = overdue[0];
    return {
      headline: `${m.name} is overdue`,
      body: `This milestone was due ${Math.abs(m.daysUntilDue)} day${Math.abs(m.daysUntilDue) === 1 ? "" : "s"} ago. Resolve it to keep the close on track.`,
      action: "Review and resolve",
      dueDate: m.dueDate,
      urgency: m.urgency,
      urgencyLabel: m.urgencyLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
    };
  }
  const thisWeekBuyer = milestones
    .filter((m) => m.dashboardBucket === "needs_attention")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  if (thisWeekBuyer.length > 0) {
    const m = thisWeekBuyer[0];
    return {
      headline: m.name,
      body:
        m.daysUntilDue === 0
          ? "Due today — take care of this before end of day."
          : `Due in ${m.daysUntilDue} day${m.daysUntilDue === 1 ? "" : "s"}.`,
      action: "Start now",
      dueDate: m.dueDate,
      urgency: m.urgency,
      urgencyLabel: m.urgencyLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
    };
  }
  const upcoming = milestones
    .filter((m) => m.status !== "completed")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  if (upcoming.length > 0) {
    const m = upcoming[0];
    return {
      headline: `Next up: ${m.name}`,
      body: `Due in ${m.daysUntilDue} days — waiting on ${sentenceOwnerLabel(m.ownerLabel)}.`,
      dueDate: m.dueDate,
      urgency: m.urgency,
      urgencyLabel: m.urgencyLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
    };
  }
  return {
    headline: "You're all caught up",
    body: "Every milestone is resolved. Congrats!",
    urgency: "completed",
    urgencyLabel: URGENCY_LABELS.completed,
    trackState: "on_track",
    trackLabel: TRACK_STATE_LABELS.on_track,
  };
}

export function buildWeeklyPlan(
  milestones: CloseDashboardMilestone[],
  now: string,
): WeeklyPlan {
  const start = now.slice(0, 10);
  const endDate = new Date(parseDateOnly(start) + 6 * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
  const inWindow = (m: CloseDashboardMilestone) =>
    m.daysUntilDue >= 0 && m.daysUntilDue <= 7 && m.status !== "completed";

  const actionsThisWeek: WeeklyPlanItem[] = milestones
    .filter((m) => inWindow(m) && m.responsibleParty === "buyer")
    .map((m) => ({
      milestone: m,
      kind: "action",
      ownerLabel: m.ownerLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
      reason: `You own this${m.daysUntilDue === 0 ? " — due today" : ""}.`,
    }));

  const deadlinesThisWeek: WeeklyPlanItem[] = milestones
    .filter((m) => inWindow(m))
    .map((m) => ({
      milestone: m,
      kind: "deadline",
      ownerLabel: m.ownerLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
      reason: `Due ${m.dueDate}`,
    }));

  const blockedOnOthers: WeeklyPlanItem[] = milestones
    .filter(
      (m) =>
        m.status !== "completed" &&
        m.responsibleParty !== "buyer" &&
        m.daysUntilDue <= 14,
    )
    .map((m) => ({
      milestone: m,
      kind: "waiting",
      ownerLabel: m.ownerLabel,
      trackState: m.trackState,
      trackLabel: m.trackLabel,
      reason: `Waiting on ${sentenceOwnerLabel(m.ownerLabel)}`,
    }));

  const headline = actionsThisWeek.length > 0
    ? `${actionsThisWeek.length} action${actionsThisWeek.length === 1 ? "" : "s"} this week`
    : deadlinesThisWeek.length > 0
      ? `${deadlinesThisWeek.length} deadline${deadlinesThisWeek.length === 1 ? "" : "s"} this week`
      : "Quiet week — waiting on partners.";

  const summary = [
    actionsThisWeek.length > 0
      ? `${actionsThisWeek.length} for you`
      : "0 actions",
    `${deadlinesThisWeek.length} deadlines`,
    `${blockedOnOthers.length} waiting on others`,
  ].join(" · ");

  return {
    weekStartDate: start,
    weekEndDate: endDate,
    actionsThisWeek,
    deadlinesThisWeek,
    blockedOnOthers,
    headline,
    summary,
  };
}

export function buildCloseDashboard(
  input: BuildDashboardInput,
): CloseDashboardData {
  const now = input.now ?? new Date().toISOString();
  const milestones = input.milestones.map((m) =>
    toCloseDashboardMilestone(m, now),
  );

  const needsAttention = milestones
    .filter((m) => m.dashboardBucket === "needs_attention")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const waitingOnOthers = milestones
    .filter((m) => m.dashboardBucket === "waiting_on_others")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const onTrack = milestones
    .filter((m) => m.dashboardBucket === "on_track")
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const byUrgency = groupByUrgency(milestones);
  const byWorkstream = groupByWorkstream(milestones);
  const nextStep = buildNextStep(milestones);
  const weeklyPlan = buildWeeklyPlan(milestones, now);

  const completed = milestones.filter((m) => m.status === "completed").length;
  const overdue = milestones.filter((m) => m.urgency === "overdue").length;
  const pending = Math.max(0, milestones.length - completed - overdue);
  const onTrackPct =
    milestones.length > 0
      ? (completed + Math.max(0, onTrack.length - completed)) /
        milestones.length
      : 1;

  const daysToClose = input.closeDate
    ? Math.max(0, daysBetween(now, input.closeDate))
    : null;
  const overallState: TrackState = overdue > 0 ? "off_track" : "on_track";

  return {
    dealRoomId: input.dealRoomId,
    propertyAddress: input.propertyAddress,
    closeDate: input.closeDate,
    daysToClose,
    totalMilestones: milestones.length,
    pendingMilestones: pending,
    completedMilestones: completed,
    overdueMilestones: overdue,
    onTrackPct: Math.min(1, Math.max(0, onTrackPct)),
    overallState,
    overallStateLabel: TRACK_STATE_LABELS[overallState],
    needsAttention,
    waitingOnOthers,
    onTrack,
    byUrgency,
    byWorkstream,
    nextStep,
    weeklyPlan,
    generatedAt: now,
  };
}

// ICS calendar generation — pure string builder for .ics attachment.
// The delivery pipeline (Resend + APNs) lives in a separate lane and
// will consume this output.
//
// IMPORTANT: for VALUE=DATE events, DTEND is EXCLUSIVE per RFC 5545. A
// one-day event on 2026-04-25 must have DTSTART=20260425 and
// DTEND=20260426. Setting DTEND equal to DTSTART creates a zero-length
// event that some clients (Google Calendar, Outlook) drop or render in
// unexpected ways.
export function nextDayDate(iso: string): string {
  const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return iso.replace(/-/g, "");
  const [, y, m, d] = parts;
  const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
  const yy = next.getUTCFullYear().toString().padStart(4, "0");
  const mm = (next.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = next.getUTCDate().toString().padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function icsCompactDate(iso: string): string {
  return iso.replace(/-/g, "");
}

export function buildIcsForMilestone(
  milestone: CloseDashboardMilestone,
  dealRoomId: string,
): string {
  const uid = `${dealRoomId}-${milestone.id}@buyer-codex`;
  const dtStart = icsCompactDate(milestone.dueDate);
  const dtEnd = nextDayDate(milestone.dueDate);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//buyer-codex//close-dashboard//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStart}T000000Z`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${milestone.name}`,
    `DESCRIPTION:Closing milestone (${milestone.workstream}). Responsible: ${milestone.ownerLabel}.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function buildIcsForWeeklyPlan(
  plan: WeeklyPlan,
  dealRoomId: string,
): string {
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//buyer-codex//close-dashboard-weekly//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  const events: string[] = [];
  const unique = new Map<string, WeeklyPlanItem>();
  for (const item of [...plan.actionsThisWeek, ...plan.deadlinesThisWeek]) {
    unique.set(item.milestone.id, item);
  }
  for (const item of unique.values()) {
    const m = item.milestone;
    const uid = `${dealRoomId}-${m.id}-weekly@buyer-codex`;
    const dtStart = icsCompactDate(m.dueDate);
    const dtEnd = nextDayDate(m.dueDate);
    events.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStart}T000000Z`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${m.name}`,
      `DESCRIPTION:${item.reason}`,
      "END:VEVENT",
    );
  }
  return [...header, ...events, "END:VCALENDAR"].join("\r\n");
}
