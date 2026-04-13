import type {
  GeoKind,
  MarketContextDowngradeReason,
  MarketContextSubject,
  NeighborhoodContext,
  NeighborhoodSale,
  PropertyMarketContext,
  ResolvedMarketContext,
  MarketTrajectory,
} from "./types";

const DEFAULT_WINDOWS = [30, 60, 90] as const;
const TRUSTWORTHY_SOLD_SAMPLE = 3;

export interface NeighborhoodComputeInput {
  geoKey: string;
  geoKind: GeoKind;
  windowDays: number;
  sales: NeighborhoodSale[];
  fetchedAt: string;
  sourceLabel: string;
}

export interface ResolveMarketContextArgs {
  baselines: NeighborhoodContext[];
  subject: MarketContextSubject;
  preferredWindowDays: number;
}

export function buildPropertyMarketContext(args: {
  baselines: NeighborhoodContext[];
  subject: MarketContextSubject;
  generatedAt: string;
  windowDays?: number[];
}): PropertyMarketContext {
  const windows = (args.windowDays ?? [...DEFAULT_WINDOWS]).map((windowDays) =>
    resolveMarketContext({
      baselines: args.baselines,
      subject: args.subject,
      preferredWindowDays: windowDays,
    }),
  );

  return {
    propertyId: args.subject.propertyId,
    baselines: args.baselines,
    windows,
    generatedAt: args.generatedAt,
  };
}

export function resolveMarketContext(
  args: ResolveMarketContextArgs,
): ResolvedMarketContext {
  const candidates = subjectGeoCandidates(args.subject);
  const downgradeReasons: MarketContextDowngradeReason[] = [];
  let fallback: NeighborhoodContext | null = null;

  for (const candidate of candidates) {
    const geoKey = candidate.geoKey?.trim();
    if (!geoKey) {
      downgradeReasons.push({
        code: "missing_geo_key",
        geoKind: candidate.geoKind,
        message: `Subject is missing ${labelForGeoKind(candidate.geoKind)} context for the ${args.preferredWindowDays}-day market window.`,
      });
      continue;
    }

    const baseline = findBaseline(
      args.baselines,
      candidate.geoKind,
      geoKey,
      args.preferredWindowDays,
    );
    if (!baseline) {
      downgradeReasons.push({
        code: "missing_baseline",
        geoKind: candidate.geoKind,
        geoKey,
        message: `No cached ${labelForGeoKind(candidate.geoKind)} market baseline was available for ${geoKey} (${args.preferredWindowDays}-day window).`,
      });
      continue;
    }

    if (baseline.sampleSize.sold >= TRUSTWORTHY_SOLD_SAMPLE) {
      return {
        windowDays: args.preferredWindowDays,
        selectedContext: baseline,
        selectedGeoKind: normalizeGeoKind(baseline.geoKind),
        selectedGeoKey: baseline.geoKey,
        downgradeReasons,
        confidence: baselineConfidence(baseline),
      };
    }

    if (!fallback && baseline.sampleSize.sold > 0) {
      fallback = baseline;
    }

    downgradeReasons.push({
      code: "insufficient_sold_sample",
      geoKind: candidate.geoKind,
      geoKey,
      message: `${labelForGeoKind(candidate.geoKind)} baseline for ${geoKey} only had ${baseline.sampleSize.sold} sold sample${baseline.sampleSize.sold === 1 ? "" : "s"}; minimum trustworthy sample is ${TRUSTWORTHY_SOLD_SAMPLE}.`,
    });
  }

  return {
    windowDays: args.preferredWindowDays,
    selectedContext: fallback,
    selectedGeoKind: fallback ? normalizeGeoKind(fallback.geoKind) : undefined,
    selectedGeoKey: fallback?.geoKey,
    downgradeReasons,
    confidence: fallback ? baselineConfidence(fallback) : 0,
  };
}

export function pickResolvedMarketContext(
  marketContext: PropertyMarketContext | null | undefined,
  preferredWindowDays: number,
): ResolvedMarketContext | null {
  if (!marketContext || marketContext.windows.length === 0) return null;

  const exact = marketContext.windows.find(
    (window) => window.windowDays === preferredWindowDays,
  );
  if (exact) return exact;

  const sorted = [...marketContext.windows].sort(
    (a, b) =>
      Math.abs(a.windowDays - preferredWindowDays) -
      Math.abs(b.windowDays - preferredWindowDays),
  );
  return sorted[0] ?? null;
}

export function computeNeighborhoodContext(
  input: NeighborhoodComputeInput,
): NeighborhoodContext {
  const soldSales = input.sales.filter((sale) => sale.status === "sold");
  const activeSales = input.sales.filter((sale) => sale.status === "active");
  const pendingSales = input.sales.filter((sale) => sale.status === "pending");

  const doms = soldSales
    .map((sale) => sale.dom)
    .filter((value): value is number => isFiniteNumber(value));
  const psfs = soldSales
    .filter((sale) => isFiniteNumber(sale.sqft) && (sale.sqft as number) > 0)
    .map((sale) => sale.soldPrice / (sale.sqft as number));
  const listPrices = activeSales
    .map((sale) => sale.listPrice)
    .filter((value): value is number => isFiniteNumber(value));
  const saleToListRatios = soldSales
    .filter(
      (sale) =>
        isFiniteNumber(sale.listPrice) &&
        (sale.listPrice as number) > 0 &&
        isFiniteNumber(sale.soldPrice) &&
        sale.soldPrice > 0,
    )
    .map((sale) => sale.soldPrice / (sale.listPrice as number));

  const reductions = input.sales.flatMap((sale) => {
    const reductionPct = reductionPctForSale(sale);
    if (reductionPct == null || reductionPct <= 0) return [];
    return [reductionPct];
  });
  const reducedListingCount = input.sales.filter(hasReduction).length;
  const reductionSampleCount = input.sales.filter(hasReductionData).length;

  return {
    geoKey: input.geoKey,
    geoKind: normalizeGeoKind(input.geoKind),
    windowDays: input.windowDays,
    avgPricePerSqft: average(psfs) ?? undefined,
    medianDom: median(doms) ?? undefined,
    medianPricePerSqft: median(psfs) ?? undefined,
    medianListPrice: median(listPrices) ?? undefined,
    avgSaleToListRatio: average(saleToListRatios) ?? undefined,
    medianSaleToListRatio: median(saleToListRatios) ?? undefined,
    priceReductionFrequency:
      reductionSampleCount > 0
        ? round4(reducedListingCount / reductionSampleCount)
        : undefined,
    avgReductionPct: average(reductions) ?? undefined,
    medianReductionPct: median(reductions) ?? undefined,
    inventoryCount: activeSales.length,
    pendingCount: pendingSales.length,
    salesVelocity: computeSalesVelocity(input.sales, input.windowDays),
    trajectory: computeTrajectory(input.sales) ?? undefined,
    sampleSize: {
      total: input.sales.length,
      sold: soldSales.length,
      active: activeSales.length,
      pending: pendingSales.length,
      pricePerSqft: psfs.length,
      dom: doms.length,
      saleToList: saleToListRatios.length,
      reduction: reductionSampleCount,
    },
    provenance: { source: input.sourceLabel, fetchedAt: input.fetchedAt },
    lastRefreshedAt: input.fetchedAt,
  };
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return round4(total / values.length);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  return round4(value);
}

export function computeTrajectory(
  sales: NeighborhoodSale[],
): MarketTrajectory | null {
  const sold = sales
    .filter(
      (sale) =>
        sale.status === "sold" &&
        isFiniteNumber(sale.sqft) &&
        (sale.sqft as number) > 0,
    )
    .map((sale) => ({
      psf: sale.soldPrice / (sale.sqft as number),
      ts: Date.parse(sale.soldDate),
    }))
    .filter((sale) => !Number.isNaN(sale.ts))
    .sort((a, b) => a.ts - b.ts);

  if (sold.length < 4) return null;

  const mid = Math.floor(sold.length / 2);
  const firstMedian = median(sold.slice(0, mid).map((sale) => sale.psf));
  const secondMedian = median(sold.slice(mid).map((sale) => sale.psf));
  if (firstMedian == null || secondMedian == null || firstMedian === 0) {
    return null;
  }

  const delta = (secondMedian - firstMedian) / firstMedian;
  if (delta > 0.03) return "rising";
  if (delta < -0.03) return "falling";
  return "flat";
}

export function computeSalesVelocity(
  sales: NeighborhoodSale[],
  windowDays: number,
): number {
  if (windowDays <= 0) return 0;
  const soldCount = sales.filter((sale) => sale.status === "sold").length;
  return round4(soldCount / windowDays);
}

export function normalizeGeoKind(geoKind: GeoKind): GeoKind {
  if (geoKind === "city") return "broader_area";
  return geoKind;
}

function baselineConfidence(baseline: NeighborhoodContext): number {
  const soldScore = Math.min(baseline.sampleSize.sold / 6, 1);
  const psfScore = Math.min(baseline.sampleSize.pricePerSqft / 6, 1);
  const saleToListScore = Math.min(baseline.sampleSize.saleToList / 6, 1);
  return round4((soldScore * 0.5) + (psfScore * 0.3) + (saleToListScore * 0.2));
}

function findBaseline(
  baselines: NeighborhoodContext[],
  geoKind: GeoKind,
  geoKey: string,
  windowDays: number,
): NeighborhoodContext | null {
  const normalizedKind = normalizeGeoKind(geoKind);
  const normalizedKey = geoKey.trim().toLowerCase();

  return (
    baselines.find(
      (baseline) =>
        normalizeGeoKind(baseline.geoKind) === normalizedKind &&
        baseline.windowDays === windowDays &&
        baseline.geoKey.trim().toLowerCase() === normalizedKey,
    ) ?? null
  );
}

function subjectGeoCandidates(subject: MarketContextSubject) {
  return [
    { geoKind: "building" as const, geoKey: subject.buildingName },
    { geoKind: "subdivision" as const, geoKey: subject.subdivision },
    { geoKind: "neighborhood" as const, geoKey: subject.neighborhood },
    { geoKind: "school_zone" as const, geoKey: subject.schoolDistrict },
    { geoKind: "zip" as const, geoKey: subject.zip },
    { geoKind: "broader_area" as const, geoKey: subject.broaderArea },
  ];
}

function labelForGeoKind(geoKind: GeoKind): string {
  switch (normalizeGeoKind(geoKind)) {
    case "building":
      return "building";
    case "subdivision":
      return "subdivision";
    case "neighborhood":
      return "neighborhood";
    case "school_zone":
      return "school-zone";
    case "zip":
      return "ZIP";
    case "broader_area":
      return "broader-area";
  }

  return "market";
}

function hasReductionData(sale: NeighborhoodSale): boolean {
  return (
    typeof sale.reductionCount === "number" ||
    typeof sale.totalReductionAmount === "number" ||
    typeof sale.totalReductionPct === "number" ||
    Array.isArray(sale.priceReductions)
  );
}

function hasReduction(sale: NeighborhoodSale): boolean {
  if (!hasReductionData(sale)) return false;
  if (typeof sale.reductionCount === "number") {
    return sale.reductionCount > 0;
  }
  const pct = reductionPctForSale(sale);
  return pct != null && pct > 0;
}

function reductionPctForSale(sale: NeighborhoodSale): number | null {
  if (isFiniteNumber(sale.totalReductionPct) && (sale.totalReductionPct as number) >= 0) {
    return round4(sale.totalReductionPct as number);
  }

  if (
    isFiniteNumber(sale.totalReductionAmount) &&
    (sale.totalReductionAmount as number) >= 0 &&
    isFiniteNumber(sale.listPrice) &&
    (sale.listPrice as number) > 0
  ) {
    return round4(((sale.totalReductionAmount as number) / (sale.listPrice as number)) * 100);
  }

  if (
    Array.isArray(sale.priceReductions) &&
    isFiniteNumber(sale.listPrice) &&
    (sale.listPrice as number) > 0
  ) {
    const totalReductionAmount = sale.priceReductions.reduce(
      (sum, reduction) => sum + (isFiniteNumber(reduction.amount) ? reduction.amount : 0),
      0,
    );
    return round4((totalReductionAmount / (sale.listPrice as number)) * 100);
  }

  return null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}
