import { CASE_STUDIES, PROOF_BLOCKS } from "@/content/trustProof";
import {
  DEFAULT_LABELING_POLICY,
  detectSliceLabelingMode,
  publicCaseStudies,
  publicProofBlocks,
  summarizeTrustProof,
  type SliceLabelingMode,
  type TrustProofSummary,
} from "./policy";
import type { CaseStudy, LabeledCaseStudy, LabeledProofBlock, ProofBlock } from "./types";

export interface TrustProofHighlightReadModel {
  value: string;
  label: string;
}

export interface TrustProofStatReadModel {
  id: string;
  value: string;
  label: string;
  description?: string;
  isIllustrative: boolean;
  badge: string | null;
  badgeAriaLabel: string | null;
}

export interface TrustProofCaseStudyReadModel {
  id: string;
  headline: string;
  summary: string;
  buyerDisplayName: string;
  buyerContext: string;
  highlights: TrustProofHighlightReadModel[];
  isIllustrative: boolean;
  badge: string | null;
  badgeAriaLabel: string | null;
}

export interface TrustProofSurfaceReadModel {
  stats: TrustProofStatReadModel[];
  caseStudies: TrustProofCaseStudyReadModel[];
  summary: TrustProofSummary;
  sliceLabelingMode: SliceLabelingMode;
  sectionBadge: string | null;
  sectionBadgeAriaLabel: string | null;
}

function toStatReadModel(block: LabeledProofBlock): TrustProofStatReadModel {
  return {
    id: block.block.id,
    value: block.block.value,
    label: block.block.label,
    description: block.block.description,
    isIllustrative: block.isIllustrative,
    badge: block.label,
    badgeAriaLabel: block.ariaLabel,
  };
}

function formatUsdCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 100_000 ? 0 : 1,
  })
    .format(value)
    .replace(/\.0(?=[KMBT])/u, "");
}

function formatPercent(value: number): string {
  const normalized = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${normalized}%`;
}

function toCaseStudyHighlights(study: CaseStudy): TrustProofHighlightReadModel[] {
  const highlights: TrustProofHighlightReadModel[] = [
    {
      value: formatUsdCompact(study.outcomes.buyerSavings),
      label: "Buyer savings",
    },
  ];

  if (study.outcomes.daysToClose !== undefined) {
    highlights.push({
      value: `${study.outcomes.daysToClose} days`,
      label: "Time to close",
    });
  }

  if (study.outcomes.effectiveCommissionPct !== undefined) {
    highlights.push({
      value: formatPercent(study.outcomes.effectiveCommissionPct),
      label: "Effective commission",
    });
  } else {
    highlights.push({
      value: formatUsdCompact(study.outcomes.purchasePrice),
      label: "Purchase price",
    });
  }

  return highlights;
}

function toCaseStudyReadModel(study: LabeledCaseStudy): TrustProofCaseStudyReadModel {
  return {
    id: study.case.id,
    headline: study.case.headline,
    summary: study.case.summary,
    buyerDisplayName: study.case.buyer.displayName,
    buyerContext: study.case.buyer.location,
    highlights: toCaseStudyHighlights(study.case),
    isIllustrative: study.isIllustrative,
    badge: study.label,
    badgeAriaLabel: study.ariaLabel,
  };
}

export function buildTrustProofSurfaceReadModel(args?: {
  caseStudies?: readonly CaseStudy[];
  proofBlocks?: readonly ProofBlock[];
  maxCaseStudies?: number;
  maxProofBlocks?: number;
  now?: Date;
}): TrustProofSurfaceReadModel {
  const cases = args?.caseStudies ?? CASE_STUDIES;
  const blocks = args?.proofBlocks ?? PROOF_BLOCKS;
  const labeledCases = publicCaseStudies(
    cases,
    DEFAULT_LABELING_POLICY,
    args?.now,
  );
  const labeledBlocks = publicProofBlocks(blocks, DEFAULT_LABELING_POLICY);
  const featuredCases = labeledCases.slice(0, args?.maxCaseStudies);
  const featuredBlocks = labeledBlocks.slice(0, args?.maxProofBlocks);
  const sliceLabelingMode = detectSliceLabelingMode(
    featuredCases,
    DEFAULT_LABELING_POLICY,
  );

  return {
    stats: featuredBlocks.map(toStatReadModel),
    caseStudies: featuredCases.map(toCaseStudyReadModel),
    summary: summarizeTrustProof(cases, blocks, args?.now),
    sliceLabelingMode,
    sectionBadge:
      sliceLabelingMode.kind === "allIllustrative"
        ? sliceLabelingMode.label
        : null,
    sectionBadgeAriaLabel:
      sliceLabelingMode.kind === "allIllustrative"
        ? sliceLabelingMode.aria
        : null,
  };
}

export function buildHomepageTrustProofReadModel(
  now?: Date,
): TrustProofSurfaceReadModel {
  return buildTrustProofSurfaceReadModel({
    maxCaseStudies: 3,
    maxProofBlocks: 4,
    now,
  });
}

export function buildPricingTrustProofReadModel(
  now?: Date,
): TrustProofSurfaceReadModel {
  return buildTrustProofSurfaceReadModel({
    maxCaseStudies: 2,
    maxProofBlocks: 3,
    now,
  });
}
