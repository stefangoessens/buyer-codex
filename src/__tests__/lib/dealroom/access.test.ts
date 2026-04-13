import { describe, it, expect } from "vitest";
import {
  canPerformAction,
  filterByAccessLevel,
  hasFullDealRoomAccess,
  hasInternalDealRoomAccess,
  resolveAccessLevel,
} from "@/lib/dealroom/access";

const fullProperty = {
  canonicalId: "test-1",
  address: { street: "123 Main", city: "Miami", state: "FL", zip: "33101" },
  status: "active",
  listPrice: 500000,
  beds: 3,
  bathsFull: 2,
  sqftLiving: 1800,
  propertyType: "Condo",
  yearBuilt: 2020,
  photoUrls: ["https://example.com/1.jpg"],
  photoCount: 5,
  mlsNumber: "F10400001",
  description: "Beautiful waterfront condo",
  daysOnMarket: 30,
  taxAnnual: 8000,
  floodZone: "AE",
  listingAgentName: "Jane Broker",
};

describe("filterByAccessLevel", () => {
  it("returns all fields for registered", () => {
    const result = filterByAccessLevel(fullProperty, "registered");
    expect(result).toEqual(fullProperty);
  });

  it("returns all fields for full", () => {
    const result = filterByAccessLevel(fullProperty, "full");
    expect(result).toEqual(fullProperty);
  });

  it("returns only teaser fields for anonymous", () => {
    const result = filterByAccessLevel(
      { _id: "prop_1", _creationTime: 123, ...fullProperty },
      "anonymous",
    );
    expect(result.listPrice).toBe(500000);
    expect(result.beds).toBe(3);
    expect(result._id).toBe("prop_1");
    expect(result._creationTime).toBe(123);
    expect((result as Record<string, unknown>).mlsNumber).toBeUndefined();
    expect((result as Record<string, unknown>).description).toBeUndefined();
    expect((result as Record<string, unknown>).taxAnnual).toBeUndefined();
    expect((result as Record<string, unknown>).listingAgentName).toBeUndefined();
  });
});

describe("resolveAccessLevel", () => {
  it("gives full to broker/admin", () => {
    expect(resolveAccessLevel("anonymous", true, false, true)).toBe("full");
  });

  it("gives at least registered access to an authenticated owner", () => {
    expect(resolveAccessLevel("anonymous", true, true, false)).toBe("registered");
    expect(resolveAccessLevel("registered", true, true, false)).toBe("registered");
    expect(resolveAccessLevel("full", true, true, false)).toBe("full");
  });

  it("caps authenticated non-owners at registered access", () => {
    expect(resolveAccessLevel("full", true, false, false)).toBe("registered");
    expect(resolveAccessLevel("anonymous", true, false, false)).toBe("registered");
  });

  it("gives anonymous to unauthenticated", () => {
    expect(resolveAccessLevel("full", false, false, false)).toBe("anonymous");
  });
});

describe("canPerformAction", () => {
  it("anyone can view teaser", () => {
    expect(canPerformAction("anonymous", "view_teaser")).toBe(true);
  });

  it("only registered+ can view full", () => {
    expect(canPerformAction("anonymous", "view_full")).toBe(false);
    expect(canPerformAction("registered", "view_full")).toBe(true);
  });

  it("lets registered users unlock buyer-facing deal-room actions", () => {
    expect(canPerformAction("anonymous", "request_tour")).toBe(false);
    expect(canPerformAction("anonymous", "start_offer")).toBe(false);
    expect(canPerformAction("anonymous", "sign_agreement")).toBe(false);
    expect(canPerformAction("registered", "request_tour")).toBe(true);
    expect(canPerformAction("registered", "start_offer")).toBe(true);
    expect(canPerformAction("registered", "sign_agreement")).toBe(true);
    expect(canPerformAction("full", "start_offer")).toBe(true);
  });
});

describe("access helpers", () => {
  it("treats registered and full as full deal-room access", () => {
    expect(hasFullDealRoomAccess("anonymous")).toBe(false);
    expect(hasFullDealRoomAccess("registered")).toBe(true);
    expect(hasFullDealRoomAccess("full")).toBe(true);
  });

  it("keeps internal-only data reserved for the elevated full tier", () => {
    expect(hasInternalDealRoomAccess("anonymous")).toBe(false);
    expect(hasInternalDealRoomAccess("registered")).toBe(false);
    expect(hasInternalDealRoomAccess("full")).toBe(true);
  });
});
