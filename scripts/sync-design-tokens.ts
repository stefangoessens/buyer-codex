import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
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
  typography,
} from "../packages/shared/src/theme";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

type TokenValue = string | number;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[._\s]+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .toLowerCase();
}

function tokenKey(key: string): string {
  return kebabCase(key.replace(/\./g, "-"));
}

function swiftIdentifier(input: string): string {
  const parts = tokenKey(input).split("-").filter(Boolean);
  return parts
    .map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join("");
}

function flattenRecord(
  value: Record<string, unknown>,
  prefix: string[],
  accumulator: Array<[string, TokenValue]>
): void {
  for (const [key, nestedValue] of Object.entries(value)) {
    const nextKey = tokenKey(key);

    if (isRecord(nestedValue)) {
      flattenRecord(nestedValue, [...prefix, nextKey], accumulator);
      continue;
    }

    accumulator.push([`--${[...prefix, nextKey].join("-")}`, nestedValue as TokenValue]);
  }
}

function pxToNumber(value: string): number {
  if (value.endsWith("rem")) {
    return Number.parseFloat(value) * 16;
  }

  return Number.parseFloat(value.replace("px", ""));
}

function opacityToColorLiteral(color: string): { hex: string; opacity: string } {
  const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i);
  if (match) {
    const [, red, green, blue, alpha] = match;
    const hex = [red, green, blue]
      .map((part) => Number.parseInt(part, 10).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    return { hex, opacity: alpha };
  }

  return {
    hex: color.replace("#", "").toUpperCase(),
    opacity: "1.0",
  };
}

function shadowLayers(value: string) {
  const segments = value.match(/(?:rgba?\([^)]+\)|[^,])+/g) ?? [];

  return segments
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const match = segment.match(
        /(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)(?:\s+-?\d+(?:\.\d+)?(?:px)?)?\s+rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/i
      );

      if (!match) {
        throw new Error(`Unsupported shadow token format: ${segment}`);
      }

      const [, x, y, blur, red, green, blue, opacity] = match;
      const hex = [red, green, blue]
        .map((part) => Number.parseInt(part, 10).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();

      return {
        hex,
        opacity,
        x,
        y,
        blur,
      };
    });
}

function formatCssBlock(header: string, entries: Array<[string, TokenValue]>): string {
  const body = entries.map(([name, value]) => `  ${name}: ${value};`).join("\n");
  return `${header} {\n${body}\n}`;
}

function buildThemeEntries(): Array<[string, TokenValue]> {
  const entries = new Map<string, TokenValue>();
  const push = (name: string, value: TokenValue) => {
    entries.set(name, value);
  };
  const collect = (record: Record<string, unknown>, prefix: string[]) => {
    const flattened: Array<[string, TokenValue]> = [];
    flattenRecord(record, prefix, flattened);
    for (const [name, value] of flattened) {
      push(name, value);
    }
  };

  for (const [groupName, groupTokens] of Object.entries(colors)) {
    collect(groupTokens, ["color", tokenKey(groupName)]);
  }

  collect(semanticColors, ["color"]);

  push("--color-background", semanticColors.surfaceCanvas);
  push("--color-foreground", semanticColors.textPrimary);
  push("--color-card", semanticColors.surfaceCard);
  push("--color-card-foreground", semanticColors.textPrimary);
  push("--color-muted", semanticColors.surfaceMuted);
  push("--color-muted-foreground", semanticColors.textSecondary);
  push("--color-border", semanticColors.borderDefault);
  push("--color-input", semanticColors.borderDefault);
  push("--color-ring", semanticColors.borderFocus);
  push("--color-primary", semanticColors.actionPrimary);
  push("--color-primary-foreground", semanticColors.textInverse);
  push("--color-secondary", semanticColors.surfaceBrand);
  push("--color-secondary-foreground", semanticColors.textBrand);
  push("--color-accent", semanticColors.surfaceAccent);
  push("--color-accent-foreground", colors.accent[700]);
  push("--color-destructive", semanticColors.statusError);
  push("--color-destructive-foreground", semanticColors.textInverse);

  push("--font-sans", typography.fontFamily.sans);
  push("--font-mono", typography.fontFamily.mono);

  collect(radii, ["radius"]);
  collect(semanticRadii, ["radius"]);
  collect(shadows, ["shadow"]);
  collect(semanticShadows, ["shadow", "elevation"]);
  collect(semanticSpacing, ["spacing"]);

  return [...entries.entries()];
}

function buildRootEntries(): Array<[string, TokenValue]> {
  const entries = new Map<string, TokenValue>();
  const flattened: Array<[string, TokenValue]> = [];
  flattenRecord(themeTokens, ["token"], flattened);
  for (const [name, value] of flattened) {
    entries.set(name, value);
  }

  entries.set("--duration-fast", motion.duration.fast);
  entries.set("--duration-normal", motion.duration.normal);
  entries.set("--duration-slow", motion.duration.slow);
  entries.set("--duration-page", motion.duration.page);
  entries.set("--duration-interactive", semanticMotion.interactiveDuration);
  entries.set("--duration-surface", semanticMotion.surfaceDuration);
  entries.set("--ease-default", motion.easing.default);
  entries.set("--ease-in", motion.easing.in);
  entries.set("--ease-out", motion.easing.out);
  entries.set("--ease-spring", motion.easing.spring);
  entries.set("--ease-entrance", semanticMotion.entranceEasing);
  entries.set("--ease-emphasis", semanticMotion.emphasisEasing);
  entries.set("--layout-container-max", layout.containerMax);
  entries.set("--layout-content-max", layout.contentMax);
  entries.set("--layout-nav-height", layout.navHeight);
  entries.set("--layout-sidebar-width", layout.sidebarWidth);
  entries.set("--layout-sidebar-width-collapsed", layout.sidebarWidthCollapsed);

  return [...entries.entries()];
}

function buildCssFile(): string {
  const themeBlock = formatCssBlock("@theme", buildThemeEntries());
  const rootBlock = formatCssBlock(":root", buildRootEntries());

  return `/*\n * Generated by scripts/sync-design-tokens.ts\n * Source of truth: packages/shared/src/theme.ts\n */\n\n${themeBlock}\n\n${rootBlock}\n`;
}

function swiftColorLiteral(color: string): string {
  const { hex, opacity } = opacityToColorLiteral(color);
  return `Color(hex: 0x${hex}, opacity: ${opacity})`;
}

function swiftFontWeight(weight: number): string {
  if (weight >= 800) return ".heavy";
  if (weight >= 700) return ".bold";
  if (weight >= 600) return ".semibold";
  if (weight >= 500) return ".medium";
  return ".regular";
}

function buildSwiftTheme(): string {
  const primitiveColors = Object.entries(colors)
    .map(([groupName, groupTokens]) => {
      const lines = Object.entries(groupTokens).map(
        ([tokenName, value]) =>
          `        static let ${swiftIdentifier(`${groupName}-${tokenName}`)} = ${swiftColorLiteral(
            value as string
          )}`
      );
      return lines.join("\n");
    })
    .join("\n");

  const semanticColorLines = Object.entries(semanticColors)
    .map(
      ([tokenName, value]) =>
        `        static let ${tokenName} = ${swiftColorLiteral(value)}`
    )
    .join("\n");

  const spacingLines = Object.entries(semanticSpacing)
    .map(
      ([tokenName, value]) =>
        `        static let ${tokenName}: CGFloat = ${pxToNumber(value)}`
    )
    .join("\n");

  const radiusLines = Object.entries(semanticRadii)
    .map(
      ([tokenName, value]) =>
        `        static let ${tokenName}: CGFloat = ${pxToNumber(value)}`
    )
    .join("\n");

  const layoutLines = Object.entries(layout)
    .map(([tokenName, value]) => {
      if (typeof value !== "string") {
        return `        static let ${tokenName}: CGFloat = ${value}`;
      }

      return `        static let ${tokenName}: CGFloat = ${pxToNumber(value)}`;
    })
    .join("\n");

  const motionLines = [
    ...Object.entries(motion.duration).map(
      ([tokenName, value]) =>
        `        static let base${tokenName.charAt(0).toUpperCase()}${tokenName.slice(1)}Duration: Double = ${Number.parseFloat(value) / 1000}`
    ),
    ...Object.entries(semanticMotion).map(([tokenName, value]) => {
      if (value.endsWith("ms")) {
        return `        static let ${tokenName}: Double = ${Number.parseFloat(value) / 1000}`;
      }
      return `        static let ${tokenName} = "${value}"`;
    }),
  ].join("\n");

  const textStyleLines = Object.entries(semanticTypography)
    .map(([tokenName, value]) => {
      const descriptor = value as (typeof semanticTypography)[keyof typeof semanticTypography];
      return `        static let ${tokenName} = BrandTextStyle(size: ${pxToNumber(
        descriptor.fontSize
      )}, weight: ${swiftFontWeight(descriptor.fontWeight)}, lineHeightMultiple: ${
        descriptor.lineHeight
      }, trackingEm: ${Number.parseFloat(descriptor.letterSpacing)})`;
    })
    .join("\n");

  const shadowLines = Object.entries(semanticShadows)
    .map(([tokenName, value]) => {
      const layers = shadowLayers(value)
        .map(
          (layer) =>
            `BrandShadowLayer(color: Color(hex: 0x${layer.hex}), opacity: ${layer.opacity}, radius: ${layer.blur}, x: ${layer.x}, y: ${layer.y})`
        )
        .join(", ");
      return `        static let ${tokenName} = BrandShadowToken(layers: [${layers}])`;
    })
    .join("\n");

  return `import SwiftUI

/// Generated by scripts/sync-design-tokens.ts
/// Source of truth: packages/shared/src/theme.ts
struct BrandTextStyle: Sendable {
    let size: CGFloat
    let weight: Font.Weight
    let lineHeightMultiple: CGFloat
    let trackingEm: CGFloat
}

struct BrandShadowLayer: Sendable {
    let color: Color
    let opacity: Double
    let radius: CGFloat
    let x: CGFloat
    let y: CGFloat
}

struct BrandShadowToken: Sendable {
    let layers: [BrandShadowLayer]
}

enum BrandTheme {
    enum Palette {
${primitiveColors}
    }

    enum SemanticColor {
${semanticColorLines}
    }

    enum Spacing {
${spacingLines}
    }

    enum Radius {
${radiusLines}
    }

    enum Layout {
${layoutLines}
    }

    enum Motion {
${motionLines}
    }

    enum Typography {
        static let sans = "${typography.fontFamily.sans.replace(/"/g, '\\"')}"
        static let mono = "${typography.fontFamily.mono.replace(/"/g, '\\"')}"
${textStyleLines}
    }

    enum Shadow {
${shadowLines}
    }
}
`;
}

async function writeOutputs() {
  const cssPath = path.join(repoRoot, "design-references", "tokens.css");
  const swiftDir = path.join(repoRoot, "ios", "BuyerCodex", "Sources", "Design");
  const swiftPath = path.join(swiftDir, "BrandTheme.swift");

  await mkdir(path.dirname(cssPath), { recursive: true });
  await mkdir(swiftDir, { recursive: true });

  await writeFile(cssPath, buildCssFile(), "utf8");
  await writeFile(swiftPath, buildSwiftTheme(), "utf8");
}

void writeOutputs();
