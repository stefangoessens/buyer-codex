"use client";

import { useState } from "react";
import { PasteLinkInput } from "@/components/marketing/PasteLinkInput";
import { Button } from "@/components/ui/button";
import { KPICard } from "./KPICard";
import { PasteLinkCtaCard } from "./PasteLinkCtaCard";
import { PricingPanel } from "./PricingPanel";
import { PropertyCard } from "./PropertyCard";
import { SegmentedTabs } from "./SegmentedTabs";
import { SurfaceDrawer } from "./SurfaceDrawer";
import { SurfaceState } from "./SurfaceState";
import { TimelineStep } from "./TimelineStep";

export function SharedComponentShowcase() {
  const [heroMode, setHeroMode] = useState("link");
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <PasteLinkCtaCard
          eyebrow="Shared CTA shell"
          title="One intake card now spans marketing and the buyer dashboard."
          description="The homepage hero and the authenticated dashboard consume the same shadcn-based card structure with different surface tone and controls."
          controls={
            <SegmentedTabs
              items={[
                { value: "link", label: "Paste link" },
                { value: "address", label: "Enter address" },
              ]}
              value={heroMode}
              onValueChange={setHeroMode}
            />
          }
          surface="marketing"
        >
          <PasteLinkInput
            variant="hero"
            placeholder={
              heroMode === "link"
                ? "Paste a Zillow, Redfin, or Realtor.com link..."
                : "Address mode swaps to the manual-address shell in production."
            }
          />
        </PasteLinkCtaCard>

        <div className="grid gap-4">
          <KPICard
            label="Active deals"
            value="4"
            tone="primary"
            density="compact"
            description="Dashboard summary band"
          />
          <KPICard
            label="Urgent follow-up"
            value="2"
            tone="warning"
            trend={{ direction: "up", text: "1 new" }}
            description="Admin and buyer surfaces share the same metric tile."
          />
          <Button
            variant="outline"
            className="justify-start rounded-[var(--radius-control)]"
            onClick={() => setDrawerOpen(true)}
          >
            Open shared drawer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_0.95fr]">
        <PropertyCard
          href="/dashboard"
          eyebrow="Buyer-safe case"
          status="pending"
          statusLabel="Offer prep"
          address="123 Gulf Stream Ave"
          detail="Opening range and leverage notes are ready for review."
          price={965000}
          beds={4}
          baths={3.5}
          sqft={2840}
          score={9.4}
          imageUrl="/images/marketing/hero/product-dashboard.png"
          activityLabel="Updated 2h ago"
        />

        <PricingPanel
          eyebrow="Pricing panel"
          title="Projected closing credit"
          value="$16,500"
          description="Shared result shell for calculator and pricing education surfaces."
          tone="emphasis"
          highlights={[
            <div key="commission" className="flex items-center justify-between">
              <span className="text-neutral-500">Seller-paid commission</span>
              <span className="font-medium text-neutral-900">$29,400</span>
            </div>,
            <div key="buyer" className="flex items-center justify-between">
              <span className="text-neutral-500">Buyer-agent share</span>
              <span className="font-medium text-neutral-900">$14,700</span>
            </div>,
            <div key="credit" className="flex items-center justify-between">
              <span className="text-neutral-500">Your credit back</span>
              <span className="text-lg font-semibold text-primary-700">$16,500</span>
            </div>,
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SurfaceState
          title="Shared state treatment"
          description="Empty and error states use the same component family in dashboard, deal room, and admin surfaces."
        />

        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-[var(--spacing-card-padding)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-text-brand)]">
            Timeline
          </p>
          <div className="mt-5 space-y-1">
            <TimelineStep
              label="Offer sent"
              description="Broker reviewed and delivered to the listing agent."
              status="completed"
            />
            <TimelineStep
              label="Counteroffer review"
              description="Waiting on seller response and next buyer decision."
              status="current"
            />
            <TimelineStep
              label="Close dashboard"
              description="Deadlines and document tasks unlock after acceptance."
              status="upcoming"
              isLast
            />
          </div>
        </div>
      </div>

      <SurfaceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Shared drawer primitive"
        description="Used by the buyer app and internal console for compact mobile navigation."
      >
        <div className="space-y-2">
          {[
            "Dashboard",
            "Deal room",
            "Offer cockpit",
            "Close dashboard",
          ].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700"
            >
              {label}
            </div>
          ))}
        </div>
      </SurfaceDrawer>
    </div>
  );
}
