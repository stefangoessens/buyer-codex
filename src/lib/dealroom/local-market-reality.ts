import type { DossierPropertyRecord } from "@/lib/dossier/types";
import { pickResolvedMarketContext } from "@/lib/enrichment/marketContext";
import type {
  GeoKind,
  MarketContextDowngradeReason,
  NeighborhoodContext,
  PropertyMarketContext,
  ResolvedMarketContext,
} from "@/lib/enrichment/types";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("en-US");

const MARKET_CONTEXT_WINDOW_DAYS = 90;
const PRICE_POSITION_THRESHOLD_PCT = 5;
const DOM_POSITION_THRESHOLD_PCT = 20;

export type LocalMarketPositionCode =
  | "overpriced"
  | "discounted"
  | "slow"
  | "fast"
  | "normal"
  | "unavailable";

export interface LocalMarketPositionView {
  code: LocalMarketPositionCode;
  label: string;
  summary: string;
  tone: "warning" | "positive" | "neutral";
}

export interface LocalMarketSignalView {
  key: "days_on_market" | "price_per_sqft" | "sale_to_list" | "price_cuts";
  label: string;
  status: "available" | "missing";
  tone: "warning" | "positive" | "neutral";
  summary: string;
  subjectLabel: string | null;
  baselineLabel: string | null;
  deltaLabel: string | null;
}

export interface LocalMarketRealityView {
  geographyLabel: string;
  marketWindowLabel: string;
  fallbackNotice: string | null;
  sampleSizeLabel: string;
  freshnessLabel: string;
  reliabilityLabel: string;
  position: LocalMarketPositionView;
  signals: LocalMarketSignalView[];
}

export interface InternalLocalMarketRealityView {
  selectedGeoKind: GeoKind | null;
  selectedGeoKey: string | null;
  marketWindowDays: number;
  sourceLabel: string | null;
  generatedAt: string;
  lastRefreshedAt: string | null;
  confidence: number;
  downgradeReasons: string[];
  baselineMetrics: Array<{
    label: string;
    value: string;
  }>;
}

export interface BuildLocalMarketRealityInput {
  listPrice: number | null;
  propertyFacts?: Pick<
    DossierPropertyRecord,
    "daysOnMarket" | "sqftLiving" | "priceReductions" | "updatedAt"
  > | null;
  marketContext?: PropertyMarketContext | null;
  preferredWindowDays?: number;
}

export function buildLocalMarketReality(args: BuildLocalMarketRealityInput): {
  buyer: LocalMarketRealityView | null;
  internal: InternalLocalMarketRealityView | null;
} {
  if (!args.marketContext) {
    return { buyer: null, internal: null };
  }

  const resolved =
    pickResolvedMarketContext(
      args.marketContext,
      args.preferredWindowDays ?? MARKET_CONTEXT_WINDOW_DAYS,
    ) ??
    ({
      windowDays: args.preferredWindowDays ?? MARKET_CONTEXT_WINDOW_DAYS,
      selectedContext: null,
      downgradeReasons: [],
      confidence: 0,
    } satisfies ResolvedMarketContext);

  const baseline = resolved.selectedContext;
  const geographyLabel = baseline
    ? `${geoKindLabel(resolved.selectedGeoKind ?? baseline.geoKind)} · ${baseline.geoKey}`
    : "Local market baseline unavailable";
  const marketWindowLabel = `${resolved.windowDays}-day market window`;
  const fallbackNotice = buildFallbackNotice(resolved);

  const signals = [
    buildDomSignal(args.propertyFacts?.daysOnMarket, baseline),
    buildPricePerSqftSignal(
      args.listPrice,
      args.propertyFacts?.sqftLiving,
      baseline,
    ),
    buildSaleToListSignal(baseline),
    buildPriceCutSignal(
      args.listPrice,
      args.propertyFacts?.priceReductions ?? [],
      baseline,
      args.marketContext.generatedAt,
    ),
  ];

  const position = buildPosition({
    baseline,
    dom: signals[0],
    pricePerSqft: signals[1],
  });

  const buyer: LocalMarketRealityView = {
    geographyLabel,
    marketWindowLabel,
    fallbackNotice,
    sampleSizeLabel: baseline
      ? `${integerFormatter.format(baseline.sampleSize.sold)} sold / ${integerFormatter.format(
          baseline.sampleSize.total,
        )} total records`
      : "No trustworthy local baseline yet",
    freshnessLabel: baseline
      ? buildFreshnessLabel(
          baseline.lastRefreshedAt,
          args.marketContext.generatedAt,
        )
      : "Freshness unavailable",
    reliabilityLabel: baseline
      ? reliabilityLabel(resolved.confidence)
      : "Low reliability",
    position,
    signals,
  };

  const internal: InternalLocalMarketRealityView = {
    selectedGeoKind: resolved.selectedGeoKind ?? null,
    selectedGeoKey: resolved.selectedGeoKey ?? null,
    marketWindowDays: resolved.windowDays,
    sourceLabel: baseline?.provenance.source ?? null,
    generatedAt: args.marketContext.generatedAt,
    lastRefreshedAt: baseline?.lastRefreshedAt ?? null,
    confidence: resolved.confidence,
    downgradeReasons: resolved.downgradeReasons.map((reason) => reason.message),
    baselineMetrics: baseline ? buildBaselineMetrics(baseline) : [],
  };

  return { buyer, internal };
}

function buildPosition(args: {
  baseline: NeighborhoodContext | null;
  dom: LocalMarketSignalView;
  pricePerSqft: LocalMarketSignalView;
}): LocalMarketPositionView {
  if (!args.baseline) {
    return {
      code: "unavailable",
      label: "No reliable local baseline",
      summary:
        "The market-context engine has not produced a trustworthy local baseline yet, so the comparison stays explicit about what is missing.",
      tone: "neutral",
    };
  }

  const priceDeltaPct = parseDeltaPercent(args.pricePerSqft.deltaLabel);
  const domDeltaPct = parseDeltaPercent(args.dom.deltaLabel);

  if (priceDeltaPct !== null && priceDeltaPct >= PRICE_POSITION_THRESHOLD_PCT) {
    return {
      code: "overpriced",
      label: "Overpriced for this market",
      summary:
        "This listing is asking more per sqft than the local norm for the selected market slice.",
      tone: "warning",
    };
  }

  if (priceDeltaPct !== null && priceDeltaPct <= -PRICE_POSITION_THRESHOLD_PCT) {
    return {
      code: "discounted",
      label: "Discounted for this market",
      summary:
        "This listing is priced below the local $/sqft norm for the selected market slice.",
      tone: "positive",
    };
  }

  if (domDeltaPct !== null && domDeltaPct >= DOM_POSITION_THRESHOLD_PCT) {
    return {
      code: "slow",
      label: "Slow for this market",
      summary:
        "This listing has been sitting longer than the typical local pace for comparable homes.",
      tone: "warning",
    };
  }

  if (domDeltaPct !== null && domDeltaPct <= -DOM_POSITION_THRESHOLD_PCT) {
    return {
      code: "fast",
      label: "Fast for this market",
      summary:
        "This listing is moving faster than the typical local pace for comparable homes.",
      tone: "positive",
    };
  }

  return {
    code: "normal",
    label: "Normal for this market",
    summary:
      "This listing is broadly tracking the local market on price and pace, without a strong premium or discount signal.",
    tone: "neutral",
  };
}

function buildDomSignal(
  daysOnMarket: number | undefined,
  baseline: NeighborhoodContext | null,
): LocalMarketSignalView {
  if (
    typeof daysOnMarket !== "number" ||
    typeof baseline?.medianDom !== "number" ||
    baseline.medianDom <= 0
  ) {
    return {
      key: "days_on_market",
      label: "Days on market",
      status: "missing",
      tone: "neutral",
      summary:
        "Days-on-market context is withheld until both the listing age and the local baseline are available.",
      subjectLabel: typeof daysOnMarket === "number" ? `${daysOnMarket} days` : null,
      baselineLabel:
        typeof baseline?.medianDom === "number"
          ? `${round1(baseline.medianDom)} day local median`
          : null,
      deltaLabel: null,
    };
  }

  const deltaDays = daysOnMarket - baseline.medianDom;
  const deltaPct = percentageDelta(daysOnMarket, baseline.medianDom);
  const tone =
    deltaPct >= DOM_POSITION_THRESHOLD_PCT
      ? "warning"
      : deltaPct <= -DOM_POSITION_THRESHOLD_PCT
        ? "positive"
        : "neutral";
  const summary =
    tone === "warning"
      ? `This home has been on market longer than typical for this ${geoKindLabel(
          baseline.geoKind,
        ).toLowerCase()}.`
      : tone === "positive"
        ? `This home is moving faster than typical for this ${geoKindLabel(
            baseline.geoKind,
          ).toLowerCase()}.`
        : "This home's time on market is broadly in line with the local norm.";

  return {
    key: "days_on_market",
    label: "Days on market",
    status: "available",
    tone,
    summary,
    subjectLabel: `${integerFormatter.format(daysOnMarket)} days`,
    baselineLabel: `${round1(baseline.medianDom)} day local median`,
    deltaLabel: `${signedPercent(deltaPct)} vs local median (${signedDays(deltaDays)})`,
  };
}

function buildPricePerSqftSignal(
  listPrice: number | null,
  sqftLiving: number | undefined,
  baseline: NeighborhoodContext | null,
): LocalMarketSignalView {
  if (
    typeof listPrice !== "number" ||
    typeof sqftLiving !== "number" ||
    sqftLiving <= 0 ||
    typeof baseline?.medianPricePerSqft !== "number" ||
    baseline.medianPricePerSqft <= 0
  ) {
    return {
      key: "price_per_sqft",
      label: "Price per sqft",
      status: "missing",
      tone: "neutral",
      summary:
        "Price-per-sqft context stays hidden until we have both living area and a local market baseline.",
      subjectLabel:
        typeof listPrice === "number" && typeof sqftLiving === "number" && sqftLiving > 0
          ? `${currencyFormatter.format(listPrice / sqftLiving)}/sqft`
          : null,
      baselineLabel:
        typeof baseline?.medianPricePerSqft === "number"
          ? `${currencyFormatter.format(baseline.medianPricePerSqft)}/sqft median`
          : null,
      deltaLabel: null,
    };
  }

  const listPsf = listPrice / sqftLiving;
  const deltaPct = percentageDelta(listPsf, baseline.medianPricePerSqft);
  const tone =
    deltaPct >= PRICE_POSITION_THRESHOLD_PCT
      ? "warning"
      : deltaPct <= -PRICE_POSITION_THRESHOLD_PCT
        ? "positive"
        : "neutral";
  const avgSuffix =
    typeof baseline.avgPricePerSqft === "number"
      ? ` · ${currencyFormatter.format(baseline.avgPricePerSqft)}/sqft avg`
      : "";
  const summary =
    tone === "warning"
      ? "The asking price per sqft is above the local norm."
      : tone === "positive"
        ? "The asking price per sqft is below the local norm."
        : "The asking price per sqft is tracking close to the local norm.";

  return {
    key: "price_per_sqft",
    label: "Price per sqft",
    status: "available",
    tone,
    summary,
    subjectLabel: `${currencyFormatter.format(listPsf)}/sqft`,
    baselineLabel: `${currencyFormatter.format(
      baseline.medianPricePerSqft,
    )}/sqft median${avgSuffix}`,
    deltaLabel: `${signedPercent(deltaPct)} vs local median`,
  };
}

function buildSaleToListSignal(
  baseline: NeighborhoodContext | null,
): LocalMarketSignalView {
  if (
    typeof baseline?.medianSaleToListRatio !== "number" ||
    baseline.medianSaleToListRatio <= 0
  ) {
    return {
      key: "sale_to_list",
      label: "Sale-to-list behavior",
      status: "missing",
      tone: "neutral",
      summary:
        "Close-to-ask behavior stays hidden until the local sold sample is large enough to trust.",
      subjectLabel: null,
      baselineLabel: null,
      deltaLabel: null,
    };
  }

  const ratioPct = baseline.medianSaleToListRatio * 100;
  const tone =
    ratioPct >= 99.5 ? "warning" : ratioPct <= 97 ? "positive" : "neutral";
  let summary = `Homes here usually close around ${round1(ratioPct)}% of asking.`;

  if (ratioPct >= 100) {
    summary = "Homes here usually close at or above asking.";
  } else if (ratioPct >= 99) {
    summary = "Homes here usually close very close to asking.";
  } else if (ratioPct <= 97) {
    summary = "Homes here usually close meaningfully below asking.";
  }

  return {
    key: "sale_to_list",
    label: "Sale-to-list behavior",
    status: "available",
    tone,
    summary,
    subjectLabel: null,
    baselineLabel: `${round1(ratioPct)}% median close-to-ask`,
    deltaLabel:
      typeof baseline.avgSaleToListRatio === "number"
        ? `${round1(baseline.avgSaleToListRatio * 100)}% avg`
        : null,
  };
}

function buildPriceCutSignal(
  listPrice: number | null,
  priceReductions: Array<{ amount: number; date: string }>,
  baseline: NeighborhoodContext | null,
  referenceAt: string,
): LocalMarketSignalView {
  if (typeof baseline?.priceReductionFrequency !== "number") {
    return {
      key: "price_cuts",
      label: "Price-cut behavior",
      status: "missing",
      tone: "neutral",
      summary:
        "Price-cut behavior stays hidden until we have enough local listing-history coverage.",
      subjectLabel:
        priceReductions.length > 0
          ? `${priceReductions.length} cut${priceReductions.length === 1 ? "" : "s"}`
          : "No cuts recorded",
      baselineLabel: null,
      deltaLabel: null,
    };
  }

  const totalCutAmount = priceReductions.reduce(
    (sum, reduction) => sum + reduction.amount,
    0,
  );
  const approximateOriginalPrice =
    typeof listPrice === "number" ? listPrice + totalCutAmount : null;
  const totalCutPct =
    approximateOriginalPrice && approximateOriginalPrice > 0
      ? (totalCutAmount / approximateOriginalPrice) * 100
      : null;
  const frequencyPct = baseline.priceReductionFrequency * 100;
  const tone =
    frequencyPct >= 35 ? "positive" : frequencyPct <= 15 ? "warning" : "neutral";
  const latestReduction = latestReductionDate(priceReductions);
  const timingLabel =
    latestReduction && isFiniteDate(referenceAt)
      ? ` · last cut ${ageText(latestReduction, referenceAt)} ago`
      : "";

  let summary = `About ${round1(frequencyPct)}% of local listings cut price before selling.`;
  if (priceReductions.length > 0) {
    summary = `This listing has already cut price ${priceReductions.length} time${
      priceReductions.length === 1 ? "" : "s"
    }, while about ${round1(frequencyPct)}% of local listings cut at all.`;
  } else if (frequencyPct >= 35) {
    summary =
      "Price cuts are fairly common locally, but this listing has not reduced yet.";
  } else if (frequencyPct <= 15) {
    summary =
      "Price cuts are relatively rare locally, and this listing has not reduced yet.";
  }

  const medianCutLabel =
    typeof baseline.medianReductionPct === "number"
      ? `${round1(baseline.medianReductionPct * 100)}% median cut`
      : typeof baseline.avgReductionPct === "number"
        ? `${round1(baseline.avgReductionPct * 100)}% avg cut`
        : null;

  return {
    key: "price_cuts",
    label: "Price-cut behavior",
    status: "available",
    tone,
    summary,
    subjectLabel:
      priceReductions.length > 0
        ? `${priceReductions.length} cut${
            priceReductions.length === 1 ? "" : "s"
          } · ${currencyFormatter.format(totalCutAmount)} total${
            totalCutPct !== null ? ` (${round1(totalCutPct)}%)` : ""
          }${timingLabel}`
        : `No cuts recorded${timingLabel}`,
    baselineLabel: `${round1(frequencyPct)}% of local listings cut${
      medianCutLabel ? ` · ${medianCutLabel}` : ""
    }`,
    deltaLabel: null,
  };
}

function buildFallbackNotice(resolved: ResolvedMarketContext): string | null {
  if (resolved.downgradeReasons.length === 0 || !resolved.selectedGeoKind) {
    return null;
  }

  const reasonText = summarizedDowngradeReason(resolved.downgradeReasons);
  return `Using ${geoKindLabel(resolved.selectedGeoKind).toLowerCase()} data${
    resolved.selectedGeoKey ? ` for ${resolved.selectedGeoKey}` : ""
  } because ${reasonText}.`;
}

function summarizedDowngradeReason(
  reasons: MarketContextDowngradeReason[],
): string {
  if (reasons.some((reason) => reason.code === "insufficient_sold_sample")) {
    return "the tighter market slice did not have enough sold homes";
  }
  if (reasons.some((reason) => reason.code === "missing_baseline")) {
    return "the tighter market slice was unavailable";
  }
  return "the property did not have a tighter market key";
}

function buildBaselineMetrics(
  baseline: NeighborhoodContext,
): Array<{ label: string; value: string }> {
  return [
    baseline.medianDom != null
      ? { label: "Median DOM", value: `${round1(baseline.medianDom)} days` }
      : null,
    baseline.medianPricePerSqft != null
      ? {
          label: "Median $/sqft",
          value: `${currencyFormatter.format(baseline.medianPricePerSqft)}/sqft`,
        }
      : null,
    baseline.avgPricePerSqft != null
      ? {
          label: "Average $/sqft",
          value: `${currencyFormatter.format(baseline.avgPricePerSqft)}/sqft`,
        }
      : null,
    baseline.medianSaleToListRatio != null
      ? {
          label: "Median sale-to-list",
          value: `${round1(baseline.medianSaleToListRatio * 100)}%`,
        }
      : null,
    baseline.priceReductionFrequency != null
      ? {
          label: "Price-cut frequency",
          value: `${round1(baseline.priceReductionFrequency * 100)}%`,
        }
      : null,
    baseline.medianReductionPct != null
      ? {
          label: "Median price cut",
          value: `${round1(baseline.medianReductionPct * 100)}%`,
        }
      : null,
    {
      label: "Sample size",
      value: `${integerFormatter.format(
        baseline.sampleSize.sold,
      )} sold / ${integerFormatter.format(baseline.sampleSize.total)} total`,
    },
  ].filter((metric): metric is { label: string; value: string } => Boolean(metric));
}

function buildFreshnessLabel(lastRefreshedAt: string, referenceAt: string): string {
  if (!isFiniteDate(lastRefreshedAt) || !isFiniteDate(referenceAt)) {
    return `Updated ${formatShortDate(lastRefreshedAt)}`;
  }

  const age = ageText(lastRefreshedAt, referenceAt);
  const ageMs = Date.parse(referenceAt) - Date.parse(lastRefreshedAt);
  const prefix =
    ageMs <= 24 * 60 * 60 * 1000
      ? "Fresh"
      : ageMs <= 7 * 24 * 60 * 60 * 1000
        ? "Recent"
        : "Stale";
  return `${prefix} · ${age} old`;
}

function reliabilityLabel(confidence: number): string {
  if (confidence >= 0.75) return "High reliability";
  if (confidence >= 0.55) return "Moderate reliability";
  return "Low reliability";
}

function geoKindLabel(geoKind: GeoKind): string {
  switch (geoKind) {
    case "building":
      return "Building";
    case "subdivision":
      return "Subdivision";
    case "neighborhood":
      return "Neighborhood";
    case "school_zone":
      return "School zone";
    case "zip":
      return "ZIP";
    case "broader_area":
    case "city":
      return "Broader area";
  }
}

function latestReductionDate(
  reductions: Array<{ amount: number; date: string }>,
): string | null {
  return reductions
    .map((reduction) => reduction.date)
    .filter(isFiniteDate)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function ageText(from: string, to: string): string {
  const ms = Math.max(Date.parse(to) - Date.parse(from), 0);
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) return `${Math.max(minutes, 1)}m`;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 48) return `${hours}h`;
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return `${days}d`;
}

function formatShortDate(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function signedPercent(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function signedDays(value: number): string {
  if (value === 0) return "in line";
  return `${value > 0 ? "+" : ""}${integerFormatter.format(Math.round(value))} day${
    Math.abs(Math.round(value)) === 1 ? "" : "s"
  }`;
}

function percentageDelta(value: number, reference: number): number {
  if (!Number.isFinite(reference) || reference === 0) return 0;
  return round1(((value - reference) / reference) * 100);
}

function parseDeltaPercent(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/([+-]?\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isFiniteDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
