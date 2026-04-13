import { describe, expect, it } from "vitest";

import {
  colors,
  layout,
  semanticColors,
  semanticMotion,
  semanticSpacing,
  themeTokens,
} from "@buyer-codex/shared/theme";
import * as webTheme from "@/lib/theme";

describe("shared theme contract", () => {
  it("re-exports the shared token contract through the web theme module", () => {
    expect(webTheme.colors.primary[700]).toBe(colors.primary[700]);
    expect(webTheme.semanticColors.actionPrimary).toBe(semanticColors.actionPrimary);
    expect(webTheme.themeTokens.layout.containerMax).toBe(themeTokens.layout.containerMax);
  });

  it("keeps semantic aliases anchored to the intended primitives", () => {
    expect(semanticColors.actionPrimary).toBe(colors.primary[700]);
    expect(semanticColors.actionAccent).toBe(colors.accent[500]);
    expect(semanticSpacing.sectionPadding).toBe(layout.sectionPaddingStandard);
    expect(semanticMotion.pageDuration).toBe(themeTokens.motion.duration.page);
  });
});
