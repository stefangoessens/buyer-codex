import React from "react";
import type { TrustProofStatReadModel } from "@/lib/trustProof/readModel";

interface TrustBarProps {
  stats: readonly TrustProofStatReadModel[];
  badge?: string | null;
  badgeAriaLabel?: string | null;
}

export function TrustBar({ stats, badge, badgeAriaLabel }: TrustBarProps) {
  if (stats.length === 0) return null;

  return (
    <section className="w-full bg-white py-8 lg:py-10">
      <div className="mx-auto max-w-[1248px] px-6">
        {badge && (
          <p
            className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-accent-700"
            aria-label={badgeAriaLabel ?? badge}
          >
            {badge}
          </p>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <article
              key={stat.id}
              className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-6"
            >
              <p className="text-3xl font-semibold tracking-tight text-primary-700">
                {stat.value}
              </p>
              <p className="mt-2 text-sm font-semibold text-neutral-800">
                {stat.label}
              </p>
              {stat.description && (
                <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                  {stat.description}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
