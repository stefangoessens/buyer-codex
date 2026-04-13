/**
 * Canonical design token re-export for design references and downstream docs.
 * Source of truth lives in packages/shared/src/theme.ts so web and docs stay in
 * lockstep and the iOS mirror can be generated from the same contract.
 */

export {
  brand,
  breakpoints,
  colors,
  layout,
  motion,
  radii,
  semanticColors,
  semanticMotion,
  semanticRadii,
  semanticShadows,
  semanticSpacing,
  semanticTypography,
  shadows,
  spacing,
  themeTokens,
  tokenUsage,
  typography,
  type ThemeTokens,
} from "@buyer-codex/shared/theme";
