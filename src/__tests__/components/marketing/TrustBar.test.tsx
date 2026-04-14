import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrustBar } from "@/components/marketing/TrustBar";
import type { TrustProofStatReadModel } from "@/lib/trustProof/readModel";

const stats: TrustProofStatReadModel[] = [
  {
    id: "pb_pilot_cohort",
    value: "50+",
    label: "Pilot cohort buyers",
    description: "Buyers we're onboarding into the pilot cohort across Florida.",
    isIllustrative: true,
    badge: "Illustrative example",
    badgeAriaLabel: "Illustrative example — not a live buyer-codex transaction.",
  },
];

describe("TrustBar", () => {
  it("renders catalog-backed proof without fake review rows", () => {
    const html = renderToStaticMarkup(
      <TrustBar
        stats={stats}
        badge="Illustrative example"
        badgeAriaLabel="Illustrative example — not a live buyer-codex transaction."
      />,
    );

    expect(html).toContain("Pilot cohort buyers");
    expect(html).toContain("Illustrative example");
    expect(html).not.toContain("4.9/5");
    expect(html).not.toContain("reviews");
    expect(html).not.toContain("Capterra");
  });
});
