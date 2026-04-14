import Link from "next/link";
import type { Article } from "@/lib/articles/types";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/articles/types";
import { slugifyHeading } from "@/lib/articles/selectors";
import { ArticleRenderer } from "./ArticleRenderer";
import {
  MarketingCtaBand,
  MarketingSection,
} from "@/components/marketing/MarketingScaffold";

/**
 * Shared article page template. Hero + byline + body + footer.
 * Every article route renders through this template — the only
 * thing a route owns is looking up the `Article` record by slug.
 */
export function ArticleTemplate({ article }: { article: Article }) {
  const guideHeadings = article.body
    .flatMap((block) =>
      block.kind === "heading"
        ? [{ text: block.text, anchor: block.anchor ?? slugifyHeading(block.text) }]
        : [],
    )
    .slice(0, 4);

  return (
    <article className="pb-6">
      <section className="px-6 pb-8 pt-10 lg:px-8 lg:pb-10 lg:pt-14">
        <div className="mx-auto rounded-[40px] bg-slate-950 px-8 py-10 text-white shadow-[0_35px_100px_rgba(15,23,42,0.18)] lg:max-w-[1280px] lg:px-10 lg:py-12">
          <Link
            href="/blog"
            className="inline-flex items-center text-xs font-semibold uppercase tracking-[0.24em] text-primary-300 transition hover:text-white"
          >
            ← Back to articles
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_280px]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300">
                {ARTICLE_CATEGORY_LABELS[article.category]}
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] lg:text-6xl">
                {article.title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 lg:text-lg">
                {article.summary}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">
                Article context
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <p>Published {formatDate(article.publishedAt)}</p>
                <p>{article.readingMinutes} minute read</p>
                {article.publishedAt !== article.updatedAt ? (
                  <p>Updated {formatDate(article.updatedAt)}</p>
                ) : null}
              </div>
              <div className="mt-6 border-t border-white/10 pt-5">
                <ArticleByline article={article} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {article.coverImage && (
        <section className="px-6 lg:px-8">
          <div className="mx-auto max-w-[1280px]">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[36px] border border-slate-200 bg-slate-200 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
              <img
                src={article.coverImage.src}
                alt={article.coverImage.alt}
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </section>
      )}

      <MarketingSection className="py-10 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0 rounded-[36px] border border-slate-200 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:px-8">
            <ArticleRenderer body={article.body} />
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">
                In this guide
              </p>
              <div className="mt-4 space-y-2">
                {guideHeadings.length > 0 ? (
                  guideHeadings.map((heading) => (
                    <a
                      key={heading.anchor}
                      href={`#${heading.anchor}`}
                      className="block rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700 transition hover:bg-primary-50 hover:text-primary-700"
                    >
                      {heading.text}
                    </a>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-slate-600">
                    This article is short enough to read in one pass.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-300">
                Next step
              </p>
              <h2 className="mt-3 text-xl font-semibold">
                Want to pressure-test a real listing?
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Move from editorial context into a live buyer-codex analysis
                without leaving the public shell.
              </p>
              <div className="mt-5 flex flex-col gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-primary-100"
                >
                  Start with a listing
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  Review pricing
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        eyebrow="Continue from here"
        title="Use the article, then move into a live buyer workflow."
        description="The blog shell now sits inside the same buyer-codex marketing boundary as pricing and the homepage, so educational traffic can convert cleanly."
        primaryHref="/"
        primaryLabel="Start analysis"
        secondaryHref="/blog"
        secondaryLabel="Back to articles"
      />
    </article>
  );
}

function ArticleByline({ article }: { article: Article }) {
  return (
    <div className="flex items-center gap-4">
      {article.author.avatarUrl ? (
        <img
          src={article.author.avatarUrl}
          alt={article.author.name}
          className="size-12 rounded-full bg-white/10 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
          {article.author.name.charAt(0)}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-white">{article.author.name}</p>
        <p className="text-xs text-primary-200">{article.author.bio ?? "buyer-codex editorial team"}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  // Keep display deterministic regardless of server locale
  const [year, month, day] = iso.slice(0, 10).split("-");
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const m = months[parseInt(month ?? "1", 10) - 1] ?? "";
  return `${m} ${parseInt(day ?? "1", 10)}, ${year}`;
}
