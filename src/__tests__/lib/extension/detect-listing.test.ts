import { describe, expect, it } from "vitest";
import {
  buildExtensionIntakeRedirectUrl,
  buildIntakeForwardUrl,
  detectListingPage,
  getExtensionIntakeViewModel,
} from "@/lib/extension/detect-listing";

describe("detectListingPage — empty / internal pages", () => {
  it("returns empty for undefined", () => {
    const result = detectListingPage(undefined);
    expect(result.status).toBe("empty");
  });

  it("returns empty for empty string", () => {
    const result = detectListingPage("");
    expect(result.status).toBe("empty");
  });

  it("returns empty for whitespace-only string", () => {
    const result = detectListingPage("   ");
    expect(result.status).toBe("empty");
  });

  it("returns empty for chrome:// URLs", () => {
    const result = detectListingPage("chrome://newtab");
    expect(result.status).toBe("empty");
    expect(result.message).toContain("Browser internal page");
  });

  it("returns empty for chrome-extension://", () => {
    const result = detectListingPage("chrome-extension://abc123/popup.html");
    expect(result.status).toBe("empty");
  });

  it("returns empty for about:blank", () => {
    const result = detectListingPage("about:blank");
    expect(result.status).toBe("empty");
  });

  it("returns empty for edge://", () => {
    const result = detectListingPage("edge://settings");
    expect(result.status).toBe("empty");
  });
});

describe("detectListingPage — supported listings", () => {
  it("detects a Zillow listing URL (long form /homedetails/)", () => {
    const result = detectListingPage(
      "https://www.zillow.com/homedetails/123-Main-St-Miami-FL-33131/12345678_zpid/",
    );
    expect(result.status).toBe("supported_listing");
    expect(result.platform).toBe("zillow");
    expect(result.listingId).toBeDefined();
    expect(result.normalizedUrl).toBeDefined();
    expect(result.message).toContain("Zillow");
  });

  it("detects a Zillow listing URL (short form /homes/<id>_zpid)", () => {
    const result = detectListingPage(
      "https://www.zillow.com/homes/12345678_zpid/",
    );
    expect(result.status).toBe("supported_listing");
    expect(result.platform).toBe("zillow");
  });

  it("detects a Redfin listing URL", () => {
    const result = detectListingPage(
      "https://www.redfin.com/FL/Miami/123-Main-St-33131/home/12345678",
    );
    expect(result.status).toBe("supported_listing");
    expect(result.platform).toBe("redfin");
    expect(result.message).toContain("Redfin");
  });

  it("detects a Realtor.com listing URL", () => {
    const result = detectListingPage(
      "https://www.realtor.com/realestateandhomes-detail/123-Main-St_Miami_FL_33131_M12345-67890",
    );
    expect(result.status).toBe("supported_listing");
    expect(result.platform).toBe("realtor");
    expect(result.message).toContain("Realtor.com");
  });

  it("provides a forwardable normalizedUrl for listings", () => {
    const result = detectListingPage(
      "https://www.zillow.com/homedetails/123-Main-St-Miami-FL-33131/12345678_zpid/",
    );
    if (result.status !== "supported_listing") {
      throw new Error("expected supported");
    }
    expect(result.normalizedUrl).toMatch(/zillow\.com/);
  });

  it("prompts the user to click save", () => {
    const result = detectListingPage(
      "https://www.zillow.com/homedetails/123-Main-St/12345_zpid/",
    );
    expect(result.message).toMatch(/save to buyer-codex/i);
  });
});

describe("detectListingPage — unsupported or empty portal pages", () => {
  it("reports supported_portal_no_listing for Zillow index pages", () => {
    const result = detectListingPage("https://www.zillow.com/");
    expect(result.status).toBe("supported_portal_no_listing");
    expect(result.message).toContain("Open a listing");
  });

  it("reports unsupported_portal for non-listing domains", () => {
    const result = detectListingPage("https://www.google.com/");
    expect(result.status).toBe("unsupported_portal");
    expect(result.message).toContain("Zillow");
    expect(result.message).toContain("Redfin");
    expect(result.message).toContain("Realtor");
  });

  it("reports unsupported_portal for other real estate sites", () => {
    const result = detectListingPage("https://www.trulia.com/p/12345");
    expect(result.status).toBe("unsupported_portal");
  });
});

describe("detectListingPage — invalid URLs", () => {
  it("returns invalid_url for garbage input that can't be parsed as a URL", () => {
    const result = detectListingPage("not a url at all !!!");
    expect(result.status).toBe("invalid_url");
  });

  it("handles missing protocol gracefully", () => {
    const result = detectListingPage(
      "zillow.com/homedetails/123-Main/12345_zpid/",
    );
    expect(result.status).toBe("supported_listing");
  });
});

describe("buildIntakeForwardUrl", () => {
  it("builds a well-formed intake URL", () => {
    const url = buildIntakeForwardUrl(
      "https://buyer-codex.app",
      "https://www.zillow.com/homedetails/123-Main-St/12345_zpid/",
    );
    expect(url).toMatch(/^https:\/\/buyer-codex\.app\/intake\?url=/);
    expect(url).toContain("source=extension");
  });

  it("URL-encodes the forwarded listing URL", () => {
    const url = buildIntakeForwardUrl(
      "https://buyer-codex.app",
      "https://www.zillow.com/homedetails/123 Main St/12345_zpid/",
    );
    expect(url).not.toContain("123 Main St");
    expect(url).toContain("123%20Main%20St");
  });

  it("strips trailing slash from base URL", () => {
    const url = buildIntakeForwardUrl(
      "https://buyer-codex.app/",
      "https://www.zillow.com/homedetails/123/12345_zpid/",
    );
    expect(url).toMatch(/^https:\/\/buyer-codex\.app\/intake\?/);
    expect(url).not.toMatch(/app\/\/intake/);
  });
});

describe("buildExtensionIntakeRedirectUrl", () => {
  it("includes the explicit intake outcome and auth state", () => {
    const url = buildExtensionIntakeRedirectUrl("https://buyer-codex.app", {
      kind: "duplicate",
      authState: "signed_in",
      platform: "redfin",
      listingId: "123456",
      normalizedUrl: "https://www.redfin.com/FL/Miami/home/123456",
      sourceListingId: "sl_123456",
      attemptId: "att_123456",
    });

    expect(url).toContain("source=extension");
    expect(url).toContain("result=duplicate");
    expect(url).toContain("auth=signed_in");
    expect(url).toContain("sourceListingId=sl_123456");
    expect(url).toContain("attemptId=att_123456");
  });
});

describe("getExtensionIntakeViewModel", () => {
  it("returns a duplicate signed-in dashboard handoff", () => {
    const model = getExtensionIntakeViewModel({
      kind: "duplicate",
      authState: "signed_in",
      platform: "zillow",
      listingId: "12345",
      normalizedUrl: "https://www.zillow.com/homedetails/12345_zpid/",
      sourceListingId: "sl_existing",
      attemptId: "att_existing",
    });

    expect(model.primaryHref).toBe("/dashboard");
    expect(model.statusLabel).toBe("Duplicate listing");
    expect(model.title).toContain("already");
  });

  it("returns a signed-out created handoff", () => {
    const model = getExtensionIntakeViewModel({
      kind: "created",
      authState: "signed_out",
      platform: "realtor",
      listingId: "M12345-67890",
      normalizedUrl:
        "https://www.realtor.com/realestateandhomes-detail/123-Main-St_Miami_FL_33131_M12345-67890",
      sourceListingId: "sl_new",
      attemptId: "att_new",
    });

    expect(model.primaryHref).toBe("/");
    expect(model.primaryLabel).toBe("Go to buyer-codex");
    expect(model.statusLabel).toBe("Saved to intake");
  });
});
