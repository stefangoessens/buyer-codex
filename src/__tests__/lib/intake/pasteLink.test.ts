import { describe, expect, it } from "vitest";
import {
  buildListingIntakeHref,
  getPasteLinkErrorMessage,
  prepareListingIntakeSubmission,
} from "@/lib/intake/pasteLink";
import {
    PASTE_LINK_DROP_OFF_ALERTS,
    PASTE_LINK_FUNNEL_NAME,
    PASTE_LINK_FUNNEL_STAGES,
    PASTE_LINK_REGISTERED_DEAL_ROOM_KPI,
    PASTE_TO_DOSSIER_SLO,
    PASTE_TO_TEASER_SLO,
} from "@/lib/intake/pasteLinkFunnel";

describe("buildListingIntakeHref", () => {
  it("includes the source and submission timestamp when provided", () => {
    const href = buildListingIntakeHref("https://www.zillow.com/homedetails/1_zpid/", {
      source: "hero",
      submittedAt: 123456789,
    });

    expect(href).toBe(
      "/intake?url=https%3A%2F%2Fwww.zillow.com%2Fhomedetails%2F1_zpid%2F&source=hero&submittedAt=123456789",
    );
  });

  it("preserves persisted intake identifiers for canonical handoff", () => {
    const href = buildListingIntakeHref(
      "https://zillow.com/homedetails/1_zpid/",
      {
        source: "hero",
        submittedAt: 123456789,
        platform: "zillow",
        sourceListingId: "source_listing_123",
        attemptId: "intake_attempt_456",
      },
    );

    expect(href).toBe(
      "/intake?url=https%3A%2F%2Fzillow.com%2Fhomedetails%2F1_zpid%2F&source=hero&submittedAt=123456789&platform=zillow&sourceListingId=source_listing_123&attemptId=intake_attempt_456",
    );
  });
});

describe("prepareListingIntakeSubmission", () => {
  it("normalizes a supported portal URL and returns a typed href", () => {
    const result = prepareListingIntakeSubmission(
      "www.redfin.com/FL/Miami/123-Main-St-33101/home/123456",
      "hero",
      42,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.data.platform).toBe("redfin");
      expect(result.parsed.data.normalizedUrl).toContain("redfin.com");
      expect(result.href).toContain("source=hero");
      expect(result.href).toContain("submittedAt=42");
    }
  });

  it("returns a typed unsupported_url failure for other domains", () => {
    const result = prepareListingIntakeSubmission(
      "https://example.com/listing/123",
      "hero",
    );

    expect(result).toEqual({
      ok: false,
      code: "unsupported_url",
      message: "Paste a Zillow, Redfin, or Realtor.com listing link.",
    });
  });

  it("returns a specific missing_listing_id message for incomplete portal links", () => {
    const result = prepareListingIntakeSubmission("https://www.zillow.com/", "hero");

    expect(result).toEqual({
      ok: false,
      code: "missing_listing_id",
      message:
        "We recognized the portal, but that URL does not point to a specific listing.",
    });
  });
});

describe("getPasteLinkErrorMessage", () => {
  it("maps malformed_url to the user-facing helper text", () => {
    expect(getPasteLinkErrorMessage("malformed_url")).toBe(
      "Paste the full listing link, including the page path.",
    );
  });
});

describe("paste-link funnel configuration", () => {
  it("defines the required funnel stages in order", () => {
    expect(PASTE_LINK_FUNNEL_NAME).toBe("paste_link_public_homepage");
    expect(PASTE_LINK_FUNNEL_STAGES.map((stage) => stage.event)).toEqual([
      "paste_submitted",
      "parse_succeeded",
      "teaser_rendered",
      "registration_prompted",
      "registration_completed",
      "deal_room_unlocked",
      "agreement_prompted",
      "agreement_signed",
    ]);
  });

  it("documents the teaser and dossier SLOs alongside the <60s conversion KPI", () => {
    expect(PASTE_TO_TEASER_SLO.targetMs).toBe(5000);
    expect(PASTE_TO_DOSSIER_SLO.targetMs).toBe(60000);
    expect(PASTE_TO_DOSSIER_SLO.measurement).toBe("deal_room_unlocked.latencyMs");
    expect(PASTE_LINK_REGISTERED_DEAL_ROOM_KPI.targetWindowSeconds).toBe(60);
  });

  it("defines drop-off alerts for the major funnel transitions", () => {
    expect(PASTE_LINK_DROP_OFF_ALERTS).toHaveLength(4);
    expect(PASTE_LINK_DROP_OFF_ALERTS[0]).toMatchObject({
      stage: "parse_succeeded",
      previousStage: "paste_submitted",
    });
  });
});
