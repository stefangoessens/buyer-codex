import type { Metadata } from "next";
import { ARTICLES } from "@/content/articles";
import { publicArticles, sortArticlesNewestFirst } from "@/lib/articles/selectors";
import { ArticleIndex } from "@/components/marketing/articles/ArticleIndex";
import { MarketingCtaBand, MarketingSection } from "@/components/marketing/MarketingScaffold";
import { metadataForStaticPage } from "@/lib/seo/pageDefinitions";
import type { ContentPageMeta } from "@/lib/content/types";

const META: ContentPageMeta = {
  slug: "blog",
  eyebrow: "The buyer-codex blog",
  title: "Articles for Florida homebuyers",
  description:
    "Plain-language guides on pricing, offers, closing, commissions, and Florida market specifics — written by licensed brokers and the buyer-codex team.",
};

export const metadata: Metadata = metadataForStaticPage("blog");

export default function BlogIndexPage() {
  const articles = sortArticlesNewestFirst(publicArticles(ARTICLES));
  const featured = articles[0];

  return (
    <>
      <section className="px-6 pb-8 pt-10 lg:px-8 lg:pb-12 lg:pt-14">
        <div className="mx-auto grid max-w-[1280px] gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,1.05fr)]">
          <div className="rounded-[40px] border border-white/70 bg-white/90 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.1)] backdrop-blur lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
              {META.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-slate-950 lg:text-6xl">
              {META.title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
              {META.description}
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                {articles.length} published buyer guides
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                SEO-safe static article routes
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                Product CTAs embedded inside editorial content
              </div>
            </div>
          </div>

          {featured ? (
            <a
              href={`/blog/${featured.slug}`}
              className="group block overflow-hidden rounded-[40px] bg-slate-950 p-7 text-white shadow-[0_35px_100px_rgba(15,23,42,0.18)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-300">
                Featured article
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] transition group-hover:text-primary-200">
                {featured.title}
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {featured.summary}
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-medium text-slate-300">
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  {featured.author.name}
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  {featured.readingMinutes} min read
                </span>
                <span className="rounded-full border border-white/10 px-3 py-1.5">
                  {featured.publishedAt.slice(0, 10)}
                </span>
              </div>
            </a>
          ) : null}
        </div>
      </section>

      <MarketingSection className="pt-4">
        <ArticleIndex articles={articles} />
      </MarketingSection>

      <MarketingCtaBand
        eyebrow="From reading to action"
        title="Run a live listing after you finish the guide."
        description="Editorial routes now share the same buyer-codex shell as pricing and the homepage, so educational traffic can move cleanly into analysis."
        primaryHref="/"
        primaryLabel="Start with a listing"
        secondaryHref="/pricing"
        secondaryLabel="Review pricing"
      />
    </>
  );
}
