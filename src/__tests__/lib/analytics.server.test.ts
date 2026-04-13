import { afterEach, describe, expect, it, vi } from "vitest";
import { trackServerEvent } from "@/lib/analytics.server";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trackServerEvent()", () => {
  it("preserves domain payload source values and adds transport metadata", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true } as Response);

    const ok = await trackServerEvent("document_uploaded", {
      documentId: "doc_1",
      fileType: "pdf",
      sizeBytes: 42,
      source: "buyer",
    });

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse(String((init as RequestInit).body)) as {
      properties: Record<string, unknown>;
    };

    expect(body.properties.source).toBe("buyer");
    expect(body.properties.analytics_transport).toBe("server");
  });
});
