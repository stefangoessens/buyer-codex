export type AccessLevel = "anonymous" | "registered" | "full";

/** Fields visible to anonymous visitors (teaser) */
export const TEASER_FIELDS = [
  "canonicalId", "address", "status", "listPrice", "beds", "bathsFull",
  "bathsHalf", "sqftLiving", "propertyType", "yearBuilt", "photoUrls",
  "photoCount", "pool", "waterfrontType", "hoaFee", "hoaFrequency",
] as const;

/** Fields requiring registration (full property data) */
export const REGISTERED_FIELDS = [
  ...TEASER_FIELDS,
  "mlsNumber", "folioNumber", "coordinates", "zillowId", "redfinId", "realtorId",
  "listDate", "daysOnMarket", "cumulativeDom", "lotSize", "stories", "garageSpaces",
  "constructionType", "roofYear", "roofMaterial", "impactWindows", "stormShutters",
  "floodZone", "hurricaneZone", "seniorCommunity", "shortTermRentalAllowed", "gatedCommunity",
  "taxAnnual", "taxAssessedValue", "listingAgentName", "listingBrokerage", "listingAgentPhone",
  "description", "virtualTourUrl", "elementarySchool", "middleSchool", "highSchool",
  "schoolDistrict", "subdivision", "zestimate", "redfinEstimate", "realtorEstimate",
  "sourcePlatform", "extractedAt", "updatedAt",
] as const;

export function hasFullDealRoomAccess(accessLevel: AccessLevel): boolean {
  return accessLevel === "registered" || accessLevel === "full";
}

export function hasInternalDealRoomAccess(accessLevel: AccessLevel): boolean {
  return accessLevel === "full";
}

/**
 * Filter property data by access level.
 * Returns only the fields permitted for the given access level.
 */
export function filterByAccessLevel<T extends Record<string, unknown>>(
  data: T,
  accessLevel: AccessLevel
): Partial<T> {
  if (hasFullDealRoomAccess(accessLevel)) {
    return data;
  }

  // Anonymous — teaser fields only
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_")) {
      filtered[key] = value;
    }
  }
  for (const field of TEASER_FIELDS) {
    if (field in data) {
      filtered[field] = data[field];
    }
  }
  return filtered as Partial<T>;
}

/**
 * Determine the effective access level for a user viewing a deal room.
 */
export function resolveAccessLevel(
  dealRoomAccessLevel: AccessLevel,
  isAuthenticated: boolean,
  isOwner: boolean,
  isBrokerOrAdmin: boolean
): AccessLevel {
  if (isBrokerOrAdmin) return "full";
  if (!isAuthenticated) return "anonymous";
  if (isOwner && hasInternalDealRoomAccess(dealRoomAccessLevel)) {
    return "full";
  }
  return "registered";
}

/**
 * Check if a user can perform an action based on access level.
 */
export function canPerformAction(
  accessLevel: AccessLevel,
  action: "view_teaser" | "view_full" | "request_tour" | "start_offer" | "sign_agreement"
): boolean {
  switch (action) {
    case "view_teaser": return true;
    case "view_full": return hasFullDealRoomAccess(accessLevel);
    case "request_tour": return hasFullDealRoomAccess(accessLevel);
    case "start_offer": return hasFullDealRoomAccess(accessLevel);
    case "sign_agreement": return hasFullDealRoomAccess(accessLevel);
  }
}
