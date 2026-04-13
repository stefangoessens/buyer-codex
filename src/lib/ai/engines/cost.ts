import type {
  CostAssumptions,
  CostInput,
  CostLineItem,
  CostOutput,
  CostRange,
} from "./types";

const DEFAULT_ASSUMPTIONS: CostAssumptions = {
  interestRate: 0.065,
  downPaymentPct: 0.20,
  propertyTaxRate: 0.0185,
  maintenancePct: 0.01,
  pmiRate: 0.005,
  closingCostPct: 0.03,
  closingCostRangeSpreadPct: 0.15,
  floridaHomesteadExemptionValue: 50000,
  floridaHomesteadNonSchoolPortion: 0.7,
};

const CURRENT_YEAR = 2026;
const COASTAL_WATERFRONT_KEYWORDS = [
  "ocean",
  "gulf",
  "intracoastal",
  "bay",
  "canal",
  "harbor",
  "coastal",
] as const;

function roundRange(mid: number, spread: number): CostRange {
  return {
    low: Math.round(mid * (1 - spread)),
    mid: Math.round(mid),
    high: Math.round(mid * (1 + spread)),
  };
}

function normalizeState(state?: string): string | undefined {
  return state?.trim().toUpperCase();
}

function normalizeFloodZone(floodZone?: string): string | undefined {
  if (!floodZone) return undefined;
  return floodZone.toUpperCase().replace(/[0-9]+$/, "").trim();
}

function deriveCoastDistanceMiles(input: CostInput): number | undefined {
  if (typeof input.coastDistanceMiles === "number") {
    return input.coastDistanceMiles;
  }

  const waterfrontType = input.waterfrontType?.toLowerCase().trim();
  if (!waterfrontType) return undefined;

  if (
    COASTAL_WATERFRONT_KEYWORDS.some((keyword) =>
      waterfrontType.includes(keyword),
    )
  ) {
    return 0.5;
  }

  return undefined;
}

function isFloridaHomesteadApplied(input: CostInput): boolean {
  const applyFlag = input.applyHomesteadExemption ?? input.ownerOccupied;
  return normalizeState(input.state) === "FL" && applyFlag === true;
}

function calculateFloridaHomesteadSavings(
  assessedValue: number,
  rate: number,
  assumptions: CostAssumptions,
): number {
  const maxExemption = Math.min(
    assumptions.floridaHomesteadExemptionValue,
    assessedValue,
  );
  const firstTier = Math.min(25000, maxExemption);
  const secondTier = Math.max(0, maxExemption - firstTier);
  const effectiveExemptValue =
    firstTier +
    secondTier * assumptions.floridaHomesteadNonSchoolPortion;

  return effectiveExemptValue * rate;
}

function buildAnnualizedLineItem(args: {
  category: string;
  label: string;
  annualRange: CostRange;
  source: CostLineItem["source"];
  notes: string;
  basis?: Record<string, string | number | boolean>;
}): CostLineItem {
  const { annualRange } = args;
  return {
    category: args.category,
    label: args.label,
    monthlyLow: Math.round(annualRange.low / 12),
    monthlyMid: Math.round(annualRange.mid / 12),
    monthlyHigh: Math.round(annualRange.high / 12),
    annualLow: annualRange.low,
    annualMid: annualRange.mid,
    annualHigh: annualRange.high,
    source: args.source,
    notes: args.notes,
    basis: args.basis,
  };
}

/** Monthly mortgage P&I via standard amortization formula */
export function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  years: number = 30,
): number {
  if (principal <= 0 || annualRate <= 0) return 0;
  const monthlyRate = annualRate / 12;
  const n = years * 12;
  return (
    principal *
    ((monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1))
  );
}

/** FL hazard insurance estimation */
export function estimateFlInsurance(
  propertyValue: number,
  roofYear?: number,
  yearBuilt?: number,
  impactWindows?: boolean,
  stormShutters?: boolean,
  constructionType?: string,
  coastDistanceMiles?: number,
): { low: number; mid: number; high: number } {
  const baseAnnual = propertyValue * 0.00833;

  const roofAge = roofYear
    ? CURRENT_YEAR - roofYear
    : yearBuilt
      ? CURRENT_YEAR - yearBuilt
      : 20;
  let roofFactor = 1.0;
  if (roofAge < 5) roofFactor = 1.0;
  else if (roofAge < 10) roofFactor = 1.2;
  else if (roofAge < 15) roofFactor = 1.5;
  else if (roofAge < 20) roofFactor = 2.0;
  else roofFactor = 2.5;

  let windDiscount = 1.0;
  if (impactWindows || stormShutters) windDiscount -= 0.15;
  if (constructionType?.toUpperCase() === "CBS") windDiscount -= 0.05;

  let coastFactor = 1.0;
  if (typeof coastDistanceMiles === "number") {
    if (coastDistanceMiles <= 1) coastFactor = 1.35;
    else if (coastDistanceMiles <= 5) coastFactor = 1.2;
    else if (coastDistanceMiles <= 15) coastFactor = 1.1;
  }

  const adjusted =
    baseAnnual *
    roofFactor *
    coastFactor *
    Math.max(windDiscount, 0.7);

  return {
    low: Math.round(adjusted * 0.8),
    mid: Math.round(adjusted),
    high: Math.round(adjusted * 1.3),
  };
}

/** FL flood insurance estimation by FEMA zone */
export function estimateFloodInsurance(
  floodZone?: string,
  elevationFeet?: number,
): { low: number; mid: number; high: number } {
  const zone = normalizeFloodZone(floodZone);
  if (!zone) return { low: 0, mid: 0, high: 0 };

  let baseMid = 0;
  if (zone === "VE" || zone === "V") baseMid = 5000;
  else if (
    zone === "AE" ||
    zone === "A" ||
    zone === "AO" ||
    zone === "AH" ||
    zone === "AR"
  ) {
    baseMid = 2500;
  } else if (zone === "X" || zone === "B" || zone === "C" || zone === "D") {
    baseMid = 600;
  }
  if (baseMid === 0) return { low: 0, mid: 0, high: 0 };

  let elevationFactor = 1.0;
  if (typeof elevationFeet === "number") {
    if (elevationFeet < 8) elevationFactor = zone.startsWith("V") ? 1.3 : 1.2;
    else if (elevationFeet < 15) {
      elevationFactor = zone.startsWith("V") ? 1.15 : 1.05;
    } else {
      elevationFactor = zone.startsWith("V") ? 0.9 : 0.85;
    }
  }

  const adjusted = Math.round(baseMid * elevationFactor);
  const spread =
    zone.startsWith("V") ? 0.6 : zone.startsWith("A") ? 0.5 : 0.4;

  return {
    low: Math.round(adjusted * (1 - spread / 2)),
    mid: adjusted,
    high: Math.round(adjusted * (1 + spread)),
  };
}

function buildPropertyTaxLineItem(
  input: CostInput,
  assumptions: CostAssumptions,
  price: number,
): CostLineItem {
  if (typeof input.taxAnnual === "number" && input.taxAnnual > 0) {
    return buildAnnualizedLineItem({
      category: "tax",
      label: "Property Tax",
      annualRange: roundRange(input.taxAnnual, 0.1),
      source: "fact",
      notes:
        "Current annual tax from listing/public record. Actual post-close taxes can change after reassessment.",
      basis: {
        source: "listing_tax_annual",
        annualTax: input.taxAnnual,
      },
    });
  }

  const assessedValue = input.taxAssessedValue ?? price;
  const taxRate = assumptions.propertyTaxRate;
  const baseAnnualTax = assessedValue * taxRate;
  const homesteadApplied = isFloridaHomesteadApplied(input);
  const homesteadSavings = homesteadApplied
    ? calculateFloridaHomesteadSavings(assessedValue, taxRate, assumptions)
    : 0;
  const estimatedTax = Math.max(0, baseAnnualTax - homesteadSavings);

  const noteParts = [
    `Estimated at ${(taxRate * 100).toFixed(2)}% effective tax rate.`,
  ];
  if (homesteadApplied) {
    noteParts.push(
      `Florida owner-occupied homestead reduction applied (${Math.round(homesteadSavings).toLocaleString()} annual savings estimate).`,
    );
  }

  return buildAnnualizedLineItem({
    category: "tax",
    label: homesteadApplied
      ? "Property Tax (homestead-adjusted estimate)"
      : "Property Tax",
    annualRange: roundRange(estimatedTax, 0.1),
    source: "estimate",
    notes: noteParts.join(" "),
    basis: {
      state: normalizeState(input.state) ?? "unknown",
      county: input.county ?? "unknown",
      assessedValue: Math.round(assessedValue),
      taxRate,
      homesteadApplied,
      homesteadSavings: Math.round(homesteadSavings),
    },
  });
}

/** Compute full ownership cost breakdown */
export function computeOwnershipCosts(input: CostInput): CostOutput {
  const assumptions = { ...DEFAULT_ASSUMPTIONS, ...input.assumptions };
  const price = input.purchasePrice;
  const coastDistanceMiles = deriveCoastDistanceMiles(input);

  const downPayment = price * assumptions.downPaymentPct;
  const loanAmount = price - downPayment;
  const closingCostsMid = price * assumptions.closingCostPct;
  const closingCostsRange = roundRange(
    closingCostsMid,
    assumptions.closingCostRangeSpreadPct,
  );
  const totalUpfrontRange: CostRange = {
    low: Math.round(downPayment + closingCostsRange.low),
    mid: Math.round(downPayment + closingCostsRange.mid),
    high: Math.round(downPayment + closingCostsRange.high),
  };

  const lineItems: CostLineItem[] = [];

  const monthlyPI = calculateMortgagePayment(loanAmount, assumptions.interestRate);
  lineItems.push(
    buildAnnualizedLineItem({
      category: "mortgage",
      label: "Principal & Interest",
      annualRange: {
        low: Math.round(monthlyPI * 12),
        mid: Math.round(monthlyPI * 12),
        high: Math.round(monthlyPI * 12),
      },
      source: "assumption",
      notes: `${(assumptions.interestRate * 100).toFixed(1)}% rate, ${(assumptions.downPaymentPct * 100).toFixed(0)}% down, 30yr fixed`,
      basis: {
        interestRate: assumptions.interestRate,
        downPaymentPct: assumptions.downPaymentPct,
        loanAmount: Math.round(loanAmount),
      },
    }),
  );

  lineItems.push(buildPropertyTaxLineItem(input, assumptions, price));

  if (input.hoaFee && input.hoaFee > 0) {
    const monthly =
      input.hoaFrequency === "annual"
        ? input.hoaFee / 12
        : input.hoaFrequency === "quarterly"
          ? input.hoaFee / 3
          : input.hoaFee;
    lineItems.push(
      buildAnnualizedLineItem({
        category: "hoa",
        label: "HOA",
        annualRange: {
          low: Math.round(monthly * 12),
          mid: Math.round(monthly * 12),
          high: Math.round(monthly * 12),
        },
        source: "fact",
        notes: "From listing data",
        basis: {
          hoaFee: input.hoaFee,
          hoaFrequency: input.hoaFrequency ?? "monthly",
        },
      }),
    );
  }

  const insurance = estimateFlInsurance(
    price,
    input.roofYear,
    input.yearBuilt,
    input.impactWindows,
    input.stormShutters,
    input.constructionType,
    coastDistanceMiles,
  );
  const roofReferenceYear = input.roofYear ?? input.yearBuilt;
  const roofAge = roofReferenceYear
    ? CURRENT_YEAR - roofReferenceYear
    : undefined;
  lineItems.push(
    buildAnnualizedLineItem({
      category: "insurance",
      label: "Homeowners Insurance (FL estimate)",
      annualRange: insurance,
      source: "estimate",
      notes: `FL hazard insurance estimate, not a quote. Inputs: roof age ${roofAge ?? "unknown"} years, coast distance ${typeof coastDistanceMiles === "number" ? coastDistanceMiles.toFixed(1) : "unknown"} mi, wind mitigation ${input.impactWindows || input.stormShutters ? "present" : "not observed"}.`,
      basis: {
        roofYear: input.roofYear ?? "unknown",
        roofAge: roofAge ?? "unknown",
        coastDistanceMiles:
          typeof coastDistanceMiles === "number"
            ? Number(coastDistanceMiles.toFixed(1))
            : "unknown",
        impactWindows: input.impactWindows ?? false,
        stormShutters: input.stormShutters ?? false,
        constructionType: input.constructionType ?? "unknown",
      },
    }),
  );

  const flood = estimateFloodInsurance(input.floodZone, input.elevationFeet);
  if (flood.mid > 0) {
    lineItems.push(
      buildAnnualizedLineItem({
        category: "flood",
        label: "Flood Insurance",
        annualRange: flood,
        source: "estimate",
        notes: `FEMA zone ${normalizeFloodZone(input.floodZone)}${typeof input.elevationFeet === "number" ? ` with ${input.elevationFeet} ft elevation` : ""} - estimate, not a quote.`,
        basis: {
          floodZone: normalizeFloodZone(input.floodZone) ?? "unknown",
          elevationFeet:
            typeof input.elevationFeet === "number"
              ? input.elevationFeet
              : "unknown",
        },
      }),
    );
  }

  if (assumptions.downPaymentPct < 0.20) {
    const monthlyPMI = loanAmount * assumptions.pmiRate / 12;
    lineItems.push(
      buildAnnualizedLineItem({
        category: "pmi",
        label: "PMI",
        annualRange: roundRange(monthlyPMI * 12, 0.2),
        source: "estimate",
        notes: `Estimated at ${(assumptions.pmiRate * 100).toFixed(2)}% of loan per year until 20% equity.`,
        basis: {
          pmiRate: assumptions.pmiRate,
          loanAmount: Math.round(loanAmount),
        },
      }),
    );
  }

  const monthlyMaint = (price * assumptions.maintenancePct) / 12;
  lineItems.push(
    buildAnnualizedLineItem({
      category: "maintenance",
      label: "Maintenance Reserve",
      annualRange: roundRange(monthlyMaint * 12, 0.5),
      source: "assumption",
      notes: `${(assumptions.maintenancePct * 100).toFixed(1)}% of value annually.`,
      basis: {
        maintenancePct: assumptions.maintenancePct,
        propertyValue: Math.round(price),
      },
    }),
  );

  const totalLow = lineItems.reduce((sum, item) => sum + item.monthlyLow, 0);
  const totalMid = lineItems.reduce((sum, item) => sum + item.monthlyMid, 0);
  const totalHigh = lineItems.reduce((sum, item) => sum + item.monthlyHigh, 0);
  const totalAnnualLow = lineItems.reduce((sum, item) => sum + item.annualLow, 0);
  const totalAnnualMid = lineItems.reduce((sum, item) => sum + item.annualMid, 0);
  const totalAnnualHigh = lineItems.reduce(
    (sum, item) => sum + item.annualHigh,
    0,
  );

  return {
    lineItems,
    totalMonthlyLow: totalLow,
    totalMonthlyMid: totalMid,
    totalMonthlyHigh: totalHigh,
    totalAnnual: totalAnnualMid,
    totalAnnualLow,
    totalAnnualHigh,
    annualRange: {
      low: totalAnnualLow,
      mid: totalAnnualMid,
      high: totalAnnualHigh,
    },
    upfrontCosts: {
      downPayment: Math.round(downPayment),
      closingCosts: closingCostsRange.mid,
      total: totalUpfrontRange.mid,
      closingCostsRange,
      totalRange: totalUpfrontRange,
    },
    assumptions,
    disclaimers: [
      "All insurance figures are estimates, not quotes. Actual premiums may vary significantly.",
      "FL hazard insurance rates are volatile and subject to carrier availability.",
      "Property tax can change after reassessment and buyer-specific exemptions.",
      "Consult a mortgage lender for precise payment calculations.",
    ],
  };
}
