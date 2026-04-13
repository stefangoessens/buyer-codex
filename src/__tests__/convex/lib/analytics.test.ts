import { afterEach, describe, expect, it, vi } from "vitest";
import { trackPosthogEvent } from "../../../../convex/lib/analytics";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("convex trackPosthogEvent()", () => {
  it("preserves domain payload fields and adds server transport metadata", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const env = {
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    };

    process.env.NEXT_PUBLIC_POSTHOG_KEY = "test-posthog-key";
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://us.i.posthog.com";

    try {
      const ok = await trackPosthogEvent(
        "advisory_broker_override_submitted",
        {
          outputId: "engineOut_offer_1",
          propertyId: "prop_1",
          dealRoomId: "dr_1",
          actorRole: "broker",
          surface: "deal_room_overview",
          engineType: "offer",
          priorReviewState: "pending",
          reasonCategory: "unsupported_evidence",
          hasReasonDetail: true,
          outputConfidence: 0.42,
          linkedClaimCount: 1,
          reviewLatencyMs: 45_000,
          generatedAt: "2026-04-13T19:00:00.000Z",
        },
        "broker_1",
      );

      expect(ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, init] = fetchSpy.mock.calls[0] ?? [];
      const body = JSON.parse(String((init as RequestInit).body)) as {
        properties: Record<string, unknown>;
      };

      expect(body.properties.reasonCategory).toBe("unsupported_evidence");
      expect(body.properties.analytics_transport).toBe("server");
      expect(body.properties.app_service).toBe("buyer-codex-convex");
    } finally {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = env.NEXT_PUBLIC_POSTHOG_KEY;
      process.env.NEXT_PUBLIC_POSTHOG_HOST = env.NEXT_PUBLIC_POSTHOG_HOST;
    }
  });
});
