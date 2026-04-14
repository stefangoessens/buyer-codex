import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TrustProofCaseStudyCard } from "@/components/marketing/TrustProofCaseStudyCard";
import type { TrustProofCaseStudyReadModel } from "@/lib/trustProof/readModel";

const illustrativeStudy: TrustProofCaseStudyReadModel = {
  id: "cs_tampa_first_home",
  headline: "Saved $18,000 on a first home in Tampa",
  summary:
    "A first-time buyer pasted a Zillow link on lunch break and had a full analysis before they got back to their desk.",
  buyerDisplayName: "Maria G.",
  buyerContext: "First-time buyer, Tampa",
  highlights: [
    { value: "$18K", label: "Buyer savings" },
    { value: "23 days", label: "Time to close" },
    { value: "1.5%", label: "Effective commission" },
  ],
  isIllustrative: true,
  badge: "Illustrative example",
  badgeAriaLabel: "Illustrative example — not a live buyer-codex transaction.",
};

describe("TrustProofCaseStudyCard", () => {
  it("renders proof highlights without quote or star-review framing", () => {
    const html = renderToStaticMarkup(
      <TrustProofCaseStudyCard study={illustrativeStudy} showBadge />,
    );

    expect(html).toContain("Saved $18,000 on a first home in Tampa");
    expect(html).toContain("Illustrative example");
    expect(html).toContain("Buyer savings");
    expect(html).toContain("Time to close");
    expect(html).toContain("Effective commission");
    expect(html).not.toContain("out of 5 stars");
    expect(html).not.toContain("&ldquo;");
  });
});
