import Link from "next/link";
import type { Article } from "@/lib/articles/types";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/articles/types";
import { groupArticlesByCategory } from "@/lib/articles/selectors";

/**
 * Article index — groups public articles by category and renders a
 * card per article. Used on the `/blog` route.
 */
export function ArticleIndex({ articles }: { articles: readonly Article[] }) {
  const groups = groupArticlesByCategory(articles);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
        <p className="text-sm text-neutral-600">
          No articles published yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(({ category, articles: bucket }) => {
        const [lead, ...rest] = bucket;

        return (
          <section
            key={category}
            className="rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:p-8"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,1.05fr)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-600">
                  {ARTICLE_CATEGORY_LABELS[category]}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-3xl">
                  {lead?.title}
                </h2>
                {lead ? (
                  <>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {lead.summary}
                    </p>
                    <Link
                      href={`/blog/${lead.slug}`}
                      className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                    >
                      Read featured article
                    </Link>
                  </>
                ) : null}
              </div>

              <div className="space-y-3">
                {bucket.map((article, index) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    compact={index > 0 || rest.length === 0}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ArticleCard({
  article,
  compact,
}: {
  article: Article;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className={`group block overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 transition hover:border-primary-300 hover:bg-white ${compact ? "p-5" : ""}`}
    >
      {article.coverImage && !compact ? (
        <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
          <img
            src={article.coverImage.src}
            alt={article.coverImage.alt}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        </div>
      ) : null}
      <div className={compact ? "" : "p-5 lg:p-6"}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
          {ARTICLE_CATEGORY_LABELS[article.category]}
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-950">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
          {article.summary}
        </p>
        <p className="mt-4 text-xs font-medium text-slate-500">
          {article.author.name} · {article.readingMinutes} min read ·{" "}
          {article.publishedAt.slice(0, 10)}
        </p>
      </div>
    </Link>
  );
}
