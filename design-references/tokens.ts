/**
 * Candidate design tokens for buyer-codex.
 *
 * Status: provisional until RealAdvisor is unblocked.
 * Sources:
 * - PayFit: aesthetic tone and CTA polish
 * - Hosman: structural CTA blue, proof-strip rhythm, property-card chrome
 * - shadcn preset b2D0wqNxS: app card radius, ring, density
 */

export const colors = {
  page: "rgb(252, 251, 255)",
  surface: "oklch(1 0 0)",
  surfaceRing: "oklch(0.922 0 0)",
  ink: "rgb(33, 23, 90)",
  inkStrong: "oklch(0.16172 0.03703 253.15)",
  text: "rgb(30, 26, 55)",
  textMuted: "oklch(0.49112 0.03033 253.74)",
  primary: "rgb(80, 118, 246)",
  primaryStrong: "oklch(0.5563 0.18803 256.77)",
  primaryForeground: "oklch(0.97 0.014 254.604)",
  success: "#10BC4C",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

export const typography = {
  fontFamily: {
    sans: 'Geist, "SF Pro Text", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
  },
  fontSize: {
    label: "14px",
    body: "16px",
    cardTitle: "20px",
    sectionTitle: "44px",
    heroTitle: "56px",
  },
  lineHeight: {
    body: 1.5,
    heading: 1.2,
    hero: 1.18,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const spacing = {
  1: "4px",
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
  sm: "12px",
  md: "16px",
  lg: "24px",
  xl: "26px",
  pill: "9999px",
} as const;

export const shadows = {
  marketingCard: "0 0 15px 0 rgba(0, 0, 0, 0.07)",
  appCard:
    "0 0 0 1px oklab(0.145 0 0 / 0.05), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
} as const;

export const motion = {
  fast: "150ms",
  normal: "220ms",
  slow: "320ms",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  easeStandard: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const layout = {
  marketingContainer: "1200px",
  appContainer: "1280px",
  heroFormMax: "720px",
} as const;
