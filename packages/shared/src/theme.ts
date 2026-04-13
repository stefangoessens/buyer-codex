/**
 * Canonical buyer-codex theme contract shared across web, backend-adjacent
 * utilities, design reference docs, and mirrored SwiftUI theme artifacts.
 *
 * Reference hierarchy:
 * - PayFit for aesthetic tokens: color, type, spacing rhythm, motion tone
 * - Hosman for structure: layout widths, section cadence, conversion spacing
 * - RealAdvisor for data-density semantics: score, status, comparison affordances
 */

export const brand = {
  primary: "#052D5B",
  primaryLight: "#0F6FDE",
  primaryDark: "#030E1D",
  accent: "#00C4AC",
  accentLight: "#CCF5EF",
  accentDark: "#009B87",
  secondary: "#3A2899",
  secondaryLight: "#FBFAFF",
  secondaryDark: "#21175A",
} as const;

export const colors = {
  primary: {
    50: "#E5F1FF",
    100: "#C7E1FF",
    200: "#78B6FC",
    300: "#4A94E8",
    400: "#0F6FDE",
    500: "#0D62C4",
    600: "#0B5BB8",
    700: "#052D5B",
    800: "#030E1D",
    900: "#020A16",
  },
  accent: {
    50: "#E6FBF8",
    100: "#CCF5EF",
    200: "#99EBE0",
    300: "#66E1D0",
    400: "#33D4C1",
    500: "#00C4AC",
    600: "#009B87",
    700: "#007A6B",
    800: "#005A4F",
    900: "#003A33",
  },
  secondary: {
    50: "#F5F3FF",
    100: "#EDE9FE",
    200: "#DDD6FE",
    300: "#C4B5FD",
    400: "#A78BFA",
    500: "#8B5CF6",
    600: "#7C3AED",
    700: "#3A2899",
    800: "#2A1D70",
    900: "#21175A",
  },
  success: {
    50: "#ECFDF5",
    100: "#D1FAE5",
    500: "#10BC4C",
    700: "#0A8F3A",
  },
  warning: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    500: "#FFB60A",
    700: "#CC9208",
  },
  error: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    500: "#EF4444",
    700: "#B91C1C",
  },
  info: {
    50: "#E5F1FF",
    100: "#C7E1FF",
    500: "#0F6FDE",
    700: "#0B5BB8",
  },
  neutral: {
    50: "#F8F9FC",
    100: "#F5F6F9",
    200: "#ECEFF4",
    300: "#E0E5EB",
    400: "#A0AABD",
    500: "#556272",
    600: "#364153",
    700: "#1E1A37",
    800: "#030E1D",
    900: "#020A16",
    950: "#01040B",
  },
  surface: {
    canvas: "#FFFFFF",
    subtle: "#F8F9FC",
    muted: "#F5F6F9",
    raised: "#FFFFFF",
    brand: "#E5F1FF",
    accent: "#E6FBF8",
    inverse: "#030E1D",
    overlay: "rgba(2, 10, 22, 0.70)",
  },
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter", system-ui, -apple-system, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", monospace',
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3.25rem",
    "6xl": "3.75rem",
    "7xl": "4.5rem",
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.15,
    normal: 1.5,
    relaxed: 1.6,
  },
  letterSpacing: {
    tight: "-0.006em",
    tighter: "-0.02em",
    normal: "0em",
    wide: "0.05em",
  },
} as const;

export const spacing = {
  0: "0px",
  0.5: "2px",
  1: "4px",
  1.5: "6px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const radii = {
  none: "0px",
  sm: "6px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  full: "9999px",
} as const;

export const shadows = {
  sm: "0 1px 2px 0 rgba(2, 10, 22, 0.05)",
  md: "0 4px 6px -1px rgba(2, 10, 22, 0.10), 0 2px 4px -2px rgba(2, 10, 22, 0.10)",
  lg: "0 10px 15px -3px rgba(2, 10, 22, 0.12), 0 4px 6px -4px rgba(2, 10, 22, 0.12)",
  xl: "0 20px 25px -5px rgba(2, 10, 22, 0.16), 0 10px 10px -5px rgba(2, 10, 22, 0.08)",
} as const;

export const motion = {
  duration: {
    fast: "150ms",
    normal: "250ms",
    slow: "400ms",
    page: "600ms",
  },
  easing: {
    default: "cubic-bezier(0.4, 0, 0.2, 1)",
    in: "cubic-bezier(0.4, 0, 1, 1)",
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export const layout = {
  containerMax: "1248px",
  contentMax: "1120px",
  navHeight: "80px",
  heroInputHeight: "68px",
  heroCtaHeight: "64px",
  sidebarWidth: "260px",
  sidebarWidthCollapsed: "64px",
  pagePaddingMobile: spacing[6],
  pagePaddingDesktop: spacing[8],
  sectionPaddingCompact: spacing[12],
  sectionPaddingStandard: spacing[16],
  sectionPaddingGenerous: spacing[20],
  gridGapCompact: spacing[6],
  gridGapStandard: spacing[8],
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

export const semanticColors = {
  textPrimary: colors.neutral[800],
  textSecondary: colors.neutral[600],
  textMuted: colors.neutral[500],
  textInverse: colors.neutral[50],
  textBrand: colors.primary[700],
  surfaceCanvas: colors.surface.canvas,
  surfaceSubtle: colors.surface.subtle,
  surfaceCard: colors.surface.raised,
  surfaceMuted: colors.surface.muted,
  surfaceBrand: colors.surface.brand,
  surfaceAccent: colors.surface.accent,
  surfaceInverse: colors.surface.inverse,
  surfaceOverlay: colors.surface.overlay,
  borderDefault: colors.neutral[200],
  borderStrong: colors.neutral[300],
  borderFocus: colors.primary[400],
  borderAccent: colors.accent[500],
  actionPrimary: colors.primary[700],
  actionPrimaryHover: colors.primary[600],
  actionAccent: colors.accent[500],
  actionAccentHover: colors.accent[600],
  statusSuccess: colors.success[500],
  statusWarning: colors.warning[500],
  statusError: colors.error[500],
  statusInfo: colors.info[500],
} as const;

export const semanticSpacing = {
  stackTight: spacing[3],
  stackDefault: spacing[6],
  stackLoose: spacing[8],
  inlineTight: spacing[2],
  inlineDefault: spacing[3],
  controlX: spacing[5],
  controlY: spacing[3],
  cardPadding: spacing[6],
  cardPaddingDense: spacing[5],
  sectionPadding: layout.sectionPaddingStandard,
  sectionPaddingDense: layout.sectionPaddingCompact,
  sectionPaddingHero: layout.sectionPaddingGenerous,
  pagePaddingMobile: layout.pagePaddingMobile,
  pagePaddingDesktop: layout.pagePaddingDesktop,
  gridGap: layout.gridGapStandard,
} as const;

export const semanticRadii = {
  control: radii.md,
  card: radii.lg,
  panel: radii.xl,
  overlay: radii["2xl"],
  pill: radii.full,
} as const;

export const semanticShadows = {
  card: shadows.sm,
  interactive: shadows.md,
  floating: shadows.lg,
  overlay: shadows.xl,
} as const;

export const semanticMotion = {
  interactiveDuration: motion.duration.fast,
  surfaceDuration: motion.duration.normal,
  pageDuration: motion.duration.page,
  interactiveEasing: motion.easing.default,
  entranceEasing: motion.easing.out,
  emphasisEasing: motion.easing.spring,
} as const;

export const semanticTypography = {
  eyebrow: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: typography.letterSpacing.wide,
    lineHeight: typography.lineHeight.normal,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.regular,
    letterSpacing: typography.letterSpacing.normal,
    lineHeight: typography.lineHeight.normal,
  },
  bodyLead: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.regular,
    letterSpacing: typography.letterSpacing.normal,
    lineHeight: typography.lineHeight.relaxed,
  },
  heading: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: typography.letterSpacing.tight,
    lineHeight: typography.lineHeight.snug,
  },
  display: {
    fontSize: typography.fontSize["5xl"],
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: typography.letterSpacing.tighter,
    lineHeight: typography.lineHeight.snug,
  },
  caption: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.normal,
    lineHeight: typography.lineHeight.normal,
  },
} as const;

export const tokenUsage = {
  colors: {
    primary: "Default trust-forward actions, navigation, chart anchors.",
    accent: "Supportive action and highlight surfaces, especially data-positive contexts.",
    secondary: "Supplementary emphasis and premium framing without competing with primary CTA.",
  },
  spacing: {
    section: "Default marketing and dashboard section rhythm.",
    grid: "Standard card grid and split-layout gap.",
    control: "Inputs, buttons, and compact interactive rows.",
  },
  motion: {
    interactive: "Hover, focus, and small component state changes.",
    page: "Hero reveals, route transitions, and full-surface choreography.",
  },
} as const;

export const themeTokens = {
  brand,
  colors,
  typography,
  spacing,
  radii,
  shadows,
  motion,
  layout,
  breakpoints,
  semanticColors,
  semanticSpacing,
  semanticRadii,
  semanticShadows,
  semanticMotion,
  semanticTypography,
  tokenUsage,
} as const;

export type ThemeTokens = typeof themeTokens;
