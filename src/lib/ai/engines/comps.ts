import type {
  CompAdjustmentSummary,
  CompCandidate,
  CompConflict,
  CompSelectionBasis,
  CompSourceAttribution,
  CompSourcePlatform,
  CompsAggregates,
  CompsInput,
  CompsOutput,
  CompResult,
} from "./types";

const PORTAL_PRIORITY: Record<CompSourcePlatform, number> = {
  redfin: 3,
  zillow: 2,
  realtor: 1,
};

const PORTAL_BASE_QUALITY: Record<CompSourcePlatform, number> = {
  redfin: 0.94,
  zillow: 0.9,
  realtor: 0.86,
};

const WEIGHTS = {
  beds: 0.13,
  baths: 0.1,
  sqft: 0.22,
  lotSize: 0.08,
  yearBuilt: 0.08,
  propertyType: 0.08,
  condition: 0.08,
  waterfront: 0.06,
  pool: 0.05,
  garage: 0.06,
  hoa: 0.06,
} as const;

const MIN_BOUNDED_COMPS = 3;

function normalizeText(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function normalizePlatform(value: string): CompSourcePlatform {
  if (value === "redfin" || value === "zillow" || value === "realtor") {
    return value;
  }
  return "realtor";
}

function buildExactDedupeKey(candidate: CompCandidate): string {
  return [
    candidate.canonicalId,
    candidate.soldDate,
    String(candidate.soldPrice),
  ].join("|");
}

function buildConflictKey(candidate: CompCandidate): string {
  return [
    candidate.canonicalId || normalizeText(candidate.address),
    candidate.soldDate,
  ].join("|");
}

function compareDatesDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

function compareTextAsc(a?: string, b?: string): number {
  return (a ?? "").localeCompare(b ?? "");
}

function scoreNumericDifference(
  subjectValue: number | undefined,
  candidateValue: number | undefined,
  slope: number,
): number {
  if (
    typeof subjectValue !== "number" ||
    typeof candidateValue !== "number" ||
    Number.isNaN(subjectValue) ||
    Number.isNaN(candidateValue)
  ) {
    return 0.55;
  }

  if (subjectValue === 0) {
    return candidateValue === 0 ? 1 : 0.35;
  }

  const ratio = Math.abs(subjectValue - candidateValue) / Math.max(subjectValue, 1);
  return Math.max(0, 1 - ratio * slope);
}

function scoreDiscreteDifference(
  subjectValue: number | undefined,
  candidateValue: number | undefined,
  stepPenalty: number,
): number {
  if (
    typeof subjectValue !== "number" ||
    typeof candidateValue !== "number" ||
    Number.isNaN(subjectValue) ||
    Number.isNaN(candidateValue)
  ) {
    return 0.55;
  }
  return Math.max(0, 1 - Math.abs(subjectValue - candidateValue) * stepPenalty);
}

function scoreBooleanMatch(
  subjectValue: boolean | undefined,
  candidateValue: boolean | undefined,
): number {
  if (subjectValue === undefined || candidateValue === undefined) {
    return 0.55;
  }
  return subjectValue === candidateValue ? 1 : 0.2;
}

function scoreConditionMatch(
  subjectValue: CompsInput["subject"]["condition"],
  candidateValue: CompsInput["subject"]["condition"],
): number {
  if (!subjectValue || !candidateValue || subjectValue === "unknown" || candidateValue === "unknown") {
    return 0.55;
  }
  return subjectValue === candidateValue ? 1 : 0.2;
}

function locationContext(
  subject: CompsInput["subject"],
  candidate: CompCandidate,
): { match: CompSelectionBasis | "broader"; score: number } {
  const subjectSubdivision = normalizeText(subject.subdivision);
  const candidateSubdivision = normalizeText(candidate.subdivision);
  if (subjectSubdivision && subjectSubdivision === candidateSubdivision) {
    return { match: "subdivision", score: 1 };
  }

  const subjectSchoolDistrict = normalizeText(subject.schoolDistrict);
  const candidateSchoolDistrict = normalizeText(candidate.schoolDistrict);
  if (subjectSchoolDistrict && subjectSchoolDistrict === candidateSchoolDistrict) {
    return { match: "school_zone", score: 0.85 };
  }

  if (normalizeText(subject.zip) && normalizeText(subject.zip) === normalizeText(candidate.zip)) {
    return { match: "zip", score: 0.7 };
  }

  return { match: "broader", score: 0.4 };
}

/** Score similarity between subject and candidate (0-1, higher = more similar). */
export function scoreSimilarity(
  subject: CompsInput["subject"],
  candidate: CompCandidate,
): number {
  const score =
    WEIGHTS.beds * scoreDiscreteDifference(subject.beds, candidate.beds, 0.3) +
    WEIGHTS.baths * scoreDiscreteDifference(subject.baths, candidate.baths, 0.25) +
    WEIGHTS.sqft * scoreNumericDifference(subject.sqft, candidate.sqft, 2) +
    WEIGHTS.lotSize * scoreNumericDifference(subject.lotSize, candidate.lotSize, 1.4) +
    WEIGHTS.yearBuilt * scoreDiscreteDifference(subject.yearBuilt, candidate.yearBuilt, 1 / 30) +
    WEIGHTS.propertyType *
      (normalizeText(subject.propertyType) === normalizeText(candidate.propertyType) ? 1 : 0.2) +
    WEIGHTS.condition * scoreConditionMatch(subject.condition, candidate.condition) +
    WEIGHTS.waterfront * scoreBooleanMatch(subject.waterfront, candidate.waterfront) +
    WEIGHTS.pool * scoreBooleanMatch(subject.pool, candidate.pool) +
    WEIGHTS.garage *
      scoreDiscreteDifference(subject.garageSpaces, candidate.garageSpaces, 0.25) +
    WEIGHTS.hoa *
      ((subject.hoaFee ?? 0) > 0 === ((candidate.hoaFee ?? 0) > 0) ? 1 : 0.25);

  return Number(score.toFixed(3));
}

function sourceQualityScore(candidate: CompCandidate): number {
  const portal = normalizePlatform(candidate.sourcePlatform);
  const fields = [
    candidate.soldPrice > 0,
    Boolean(candidate.soldDate),
    typeof candidate.listPrice === "number" && candidate.listPrice > 0,
    typeof candidate.beds === "number" && candidate.beds > 0,
    typeof candidate.baths === "number" && candidate.baths > 0,
    typeof candidate.sqft === "number" && candidate.sqft > 0,
    typeof candidate.yearBuilt === "number" && candidate.yearBuilt > 0,
    typeof candidate.lotSize === "number" && candidate.lotSize > 0,
    Boolean(candidate.propertyType),
    candidate.waterfront !== undefined,
    candidate.pool !== undefined,
    typeof candidate.hoaFee === "number",
    typeof candidate.dom === "number" && candidate.dom >= 0,
    Boolean(candidate.subdivision),
    Boolean(candidate.schoolDistrict),
    Boolean(candidate.zip),
    typeof candidate.garageSpaces === "number",
    candidate.condition !== undefined,
  ];
  const completeness = fields.filter(Boolean).length / fields.length;
  const citationBonus = candidate.sourceCitation ? 0.02 : 0;
  return Number(
    Math.min(0.99, PORTAL_BASE_QUALITY[portal] + completeness * 0.07 + citationBonus).toFixed(3),
  );
}

function compareSourceRecords(a: CompCandidate, b: CompCandidate): number {
  const qualityDiff = sourceQualityScore(b) - sourceQualityScore(a);
  if (qualityDiff !== 0) return qualityDiff;

  const portalDiff =
    PORTAL_PRIORITY[normalizePlatform(b.sourcePlatform)] -
    PORTAL_PRIORITY[normalizePlatform(a.sourcePlatform)];
  if (portalDiff !== 0) return portalDiff;

  const domDiff = (a.dom ?? Number.MAX_SAFE_INTEGER) - (b.dom ?? Number.MAX_SAFE_INTEGER);
  if (domDiff !== 0) return domDiff;

  const listPriceDiff = (b.listPrice ?? 0) - (a.listPrice ?? 0);
  if (listPriceDiff !== 0) return listPriceDiff;

  const citationDiff = compareTextAsc(a.sourceCitation, b.sourceCitation);
  if (citationDiff !== 0) return citationDiff;

  return compareTextAsc(a.address, b.address);
}

function buildSourceAttributions(
  records: CompCandidate[],
  selectedPortal: CompSourcePlatform,
): CompSourceAttribution[] {
  const deduped = new Map<string, CompSourceAttribution>();
  const ordered = [...records].sort(compareSourceRecords);

  for (const record of ordered) {
    const portal = normalizePlatform(record.sourcePlatform);
    if (deduped.has(portal)) continue;
    deduped.set(portal, {
      portal,
      citation:
        record.sourceCitation ??
        `${portal}://${record.canonicalId || normalizeText(record.address)}`,
      qualityScore: sourceQualityScore(record),
      soldPrice: record.soldPrice,
      soldDate: record.soldDate,
      selected: portal === selectedPortal,
    });
  }

  return Array.from(deduped.values()).sort(
    (a, b) =>
      PORTAL_PRIORITY[b.portal] - PORTAL_PRIORITY[a.portal] ||
      compareTextAsc(a.citation, b.citation),
  );
}

function mergeExactDuplicateGroup(records: CompCandidate[]): CompCandidate {
  const ordered = [...records].sort(compareSourceRecords);
  const primary = ordered[0];
  const selectedPortal = normalizePlatform(primary.sourcePlatform);
  const sourceCitations = buildSourceAttributions(records, selectedPortal);

  return {
    ...primary,
    sourcePlatform: selectedPortal,
    sourceCitation:
      primary.sourceCitation ??
      sourceCitations.find((citation) => citation.portal === selectedPortal)?.citation ??
      `${selectedPortal}://${primary.canonicalId}`,
    sourceQualityScore: sourceQualityScore(primary),
    sourcePlatforms: sourceCitations.map((citation) => citation.portal),
    sourceCitations,
  };
}

function resolveConflictGroup(records: CompCandidate[]): CompCandidate {
  if (records.length === 1) {
    return records[0];
  }

  const ordered = [...records].sort(compareSourceRecords);
  const winner = ordered[0];
  const winnerPortal = normalizePlatform(winner.sourcePlatform);
  const sourceCitations = buildSourceAttributions(ordered, winnerPortal);

  const conflict: CompConflict = {
    field: "soldPrice",
    note: `Resolved sold-price conflict using ${winnerPortal} as the highest-quality source.`,
    chosenPortal: winnerPortal,
    values: ordered.map((record) => ({
      portal: normalizePlatform(record.sourcePlatform),
      citation:
        record.sourceCitation ??
        `${normalizePlatform(record.sourcePlatform)}://${record.canonicalId}`,
      value: record.soldPrice,
    })),
  };

  return {
    ...winner,
    sourcePlatform: winnerPortal,
    sourceCitation:
      winner.sourceCitation ??
      sourceCitations.find((citation) => citation.portal === winnerPortal)?.citation ??
      `${winnerPortal}://${winner.canonicalId}`,
    sourceQualityScore: sourceQualityScore(winner),
    sourcePlatforms: sourceCitations.map((citation) => citation.portal),
    sourceCitations,
    conflicts: [conflict],
  };
}

/**
 * Dedup candidates by canonicalId + soldPrice + soldDate, then resolve
 * sold-price conflicts for the same canonical sale deterministically.
 */
export function dedupCandidates(candidates: CompCandidate[]): CompCandidate[] {
  const exactGroups = new Map<string, CompCandidate[]>();

  for (const candidate of [...candidates].sort((a, b) =>
    compareTextAsc(a.canonicalId, b.canonicalId) ||
    compareDatesDesc(a.soldDate, b.soldDate) ||
    b.soldPrice - a.soldPrice ||
    compareTextAsc(a.sourcePlatform, b.sourcePlatform) ||
    compareTextAsc(a.address, b.address),
  )) {
    const key = buildExactDedupeKey(candidate);
    exactGroups.set(key, [...(exactGroups.get(key) ?? []), candidate]);
  }

  const mergedExact = Array.from(exactGroups.values()).map(mergeExactDuplicateGroup);
  const conflictGroups = new Map<string, CompCandidate[]>();

  for (const candidate of mergedExact) {
    const key = buildConflictKey(candidate);
    conflictGroups.set(key, [...(conflictGroups.get(key) ?? []), candidate]);
  }

  return Array.from(conflictGroups.values())
    .map(resolveConflictGroup)
    .sort((a, b) =>
      compareDatesDesc(a.soldDate, b.soldDate) ||
      b.soldPrice - a.soldPrice ||
      compareTextAsc(a.canonicalId, b.canonicalId) ||
      compareTextAsc(a.address, b.address),
    );
}

function determineSelectionBasis(
  subject: CompsInput["subject"],
  candidates: CompCandidate[],
  maxComps: number,
): {
  filtered: CompCandidate[];
  basis: CompsOutput["selectionBasis"];
  reason: string;
} {
  const minCompCount = Math.min(maxComps, MIN_BOUNDED_COMPS);
  const subdivisionMatches = candidates.filter(
    (candidate) =>
      normalizeText(subject.subdivision) &&
      normalizeText(subject.subdivision) === normalizeText(candidate.subdivision),
  );
  if (subdivisionMatches.length >= minCompCount) {
    return {
      filtered: subdivisionMatches,
      basis: "subdivision",
      reason: `Bounded to subdivision ${subject.subdivision} (${subdivisionMatches.length} candidates).`,
    };
  }

  const schoolMatches = candidates.filter(
    (candidate) =>
      normalizeText(subject.schoolDistrict) &&
      normalizeText(subject.schoolDistrict) === normalizeText(candidate.schoolDistrict),
  );
  if (schoolMatches.length >= minCompCount) {
    return {
      filtered: schoolMatches,
      basis: "school_zone",
      reason: subject.subdivision
        ? `Subdivision ${subject.subdivision} only had ${subdivisionMatches.length} comp(s); downgraded to school zone ${subject.schoolDistrict}.`
        : `Bounded to school zone ${subject.schoolDistrict} (${schoolMatches.length} candidates).`,
    };
  }

  const zipMatches = candidates.filter(
    (candidate) => normalizeText(subject.zip) && normalizeText(subject.zip) === normalizeText(candidate.zip),
  );
  if (zipMatches.length > 0) {
    return {
      filtered: zipMatches,
      basis: "zip",
      reason: subject.schoolDistrict
        ? `Subdivision / school-zone matches were sparse (${subdivisionMatches.length}/${schoolMatches.length}); downgraded to zip ${subject.zip}.`
        : subject.subdivision
          ? `Subdivision ${subject.subdivision} only had ${subdivisionMatches.length} comp(s); downgraded to zip ${subject.zip}.`
          : `Selected by zip ${subject.zip}.`,
    };
  }

  return {
    filtered: candidates,
    basis: "zip",
    reason: `No zip-bounded comps were available for ${subject.zip}; retained the broader recent-sales pool.`,
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function buildAdjustments(
  subject: CompsInput["subject"],
  candidate: CompCandidate,
): CompAdjustmentSummary {
  const location = locationContext(subject, candidate);
  return {
    bedsDelta: candidate.beds - subject.beds,
    bathsDelta: Number((candidate.baths - subject.baths).toFixed(1)),
    sqftDelta: candidate.sqft - subject.sqft,
    yearBuiltDelta: candidate.yearBuilt - subject.yearBuilt,
    lotSizeDelta:
      subject.lotSize !== undefined && candidate.lotSize !== undefined
        ? candidate.lotSize - subject.lotSize
        : undefined,
    garageSpacesDelta:
      subject.garageSpaces !== undefined && candidate.garageSpaces !== undefined
        ? candidate.garageSpaces - subject.garageSpaces
        : undefined,
    locationMatch: location.match,
    locationScore: location.score,
  };
}

function buildExplanation(
  subject: CompsInput["subject"],
  candidate: CompCandidate,
  similarityScore: number,
  adjustments: CompAdjustmentSummary,
): string {
  const descriptors: string[] = [];
  if (adjustments.locationMatch === "subdivision") descriptors.push("same subdivision");
  else if (adjustments.locationMatch === "school_zone") descriptors.push("same school zone");
  else if (adjustments.locationMatch === "zip") descriptors.push("same zip");

  if (candidate.beds === subject.beds) descriptors.push("same bed count");
  if (Math.abs(candidate.baths - subject.baths) <= 0.5) descriptors.push("similar baths");
  if (Math.abs(candidate.sqft - subject.sqft) <= Math.max(subject.sqft * 0.1, 150)) {
    descriptors.push("similar living area");
  }
  if (candidate.propertyType === subject.propertyType) descriptors.push("same property type");
  if (Math.abs(candidate.yearBuilt - subject.yearBuilt) <= 5) descriptors.push("similar age");
  if ((candidate.hoaFee ?? 0) > 0 === ((subject.hoaFee ?? 0) > 0)) descriptors.push("same HOA profile");

  const conflictNote =
    candidate.conflicts && candidate.conflicts.length > 0
      ? ` ${candidate.conflicts[0].note}`
      : "";

  return `Similarity ${similarityScore.toFixed(3)}; ${descriptors.join(", ") || "comparable profile"}. Sold ${candidate.soldDate} for $${candidate.soldPrice.toLocaleString()}.${conflictNote}`;
}

function compareRankedCandidates(
  a: {
    candidate: CompCandidate;
    similarityScore: number;
    locationScore: number;
  },
  b: {
    candidate: CompCandidate;
    similarityScore: number;
    locationScore: number;
  },
): number {
  const similarityDiff = b.similarityScore - a.similarityScore;
  if (similarityDiff !== 0) return similarityDiff;

  const locationDiff = b.locationScore - a.locationScore;
  if (locationDiff !== 0) return locationDiff;

  const qualityDiff = (b.candidate.sourceQualityScore ?? 0) - (a.candidate.sourceQualityScore ?? 0);
  if (qualityDiff !== 0) return qualityDiff;

  const conflictDiff = (a.candidate.conflicts?.length ?? 0) - (b.candidate.conflicts?.length ?? 0);
  if (conflictDiff !== 0) return conflictDiff;

  return (
    compareDatesDesc(a.candidate.soldDate, b.candidate.soldDate) ||
    b.candidate.soldPrice - a.candidate.soldPrice ||
    compareTextAsc(a.candidate.canonicalId, b.candidate.canonicalId) ||
    compareTextAsc(a.candidate.address, b.candidate.address) ||
    compareTextAsc(a.candidate.sourcePlatform, b.candidate.sourcePlatform)
  );
}

/** Run the comps selection engine. */
export function selectComps(input: CompsInput): CompsOutput {
  const maxComps = input.maxComps ?? 5;
  const deduped = dedupCandidates(input.candidates);
  const { filtered, basis, reason } = determineSelectionBasis(input.subject, deduped, maxComps);

  const ranked = filtered.map((candidate) => {
    const adjustments = buildAdjustments(input.subject, candidate);
    return {
      candidate,
      similarityScore: scoreSimilarity(input.subject, candidate),
      locationScore: adjustments.locationScore,
      adjustments,
    };
  });

  ranked.sort(compareRankedCandidates);

  const comps: CompResult[] = ranked.slice(0, maxComps).map((entry) => ({
    candidate: entry.candidate,
    similarityScore: entry.similarityScore,
    explanation: buildExplanation(
      input.subject,
      entry.candidate,
      entry.similarityScore,
      entry.adjustments,
    ),
    sourceCitation:
      entry.candidate.sourceCitation ??
      entry.candidate.sourceCitations?.find((citation) => citation.selected)?.citation ??
      `${normalizePlatform(entry.candidate.sourcePlatform)}://${entry.candidate.canonicalId}`,
    sourceCitations: entry.candidate.sourceCitations,
    adjustments: entry.adjustments,
  }));

  const soldPrices = comps.map((comp) => comp.candidate.soldPrice);
  const psfs = comps
    .filter((comp) => comp.candidate.sqft > 0)
    .map((comp) => comp.candidate.soldPrice / comp.candidate.sqft);
  const doms = comps
    .filter((comp) => typeof comp.candidate.dom === "number")
    .map((comp) => comp.candidate.dom as number);
  const saleToListRatios = comps
    .filter(
      (comp) =>
        typeof comp.candidate.listPrice === "number" &&
        (comp.candidate.listPrice as number) > 0,
    )
    .map((comp) => comp.candidate.soldPrice / (comp.candidate.listPrice as number));

  const aggregates: CompsAggregates = {
    medianSoldPrice: median(soldPrices),
    medianPricePerSqft: Number(median(psfs).toFixed(2)),
    medianDom: median(doms),
    medianSaleToListRatio: Number(median(saleToListRatios).toFixed(3)),
  };

  return {
    comps,
    aggregates,
    selectionBasis: basis,
    selectionReason: reason,
    totalCandidates: input.candidates.length,
    dedupedCandidates: deduped.length,
  };
}
