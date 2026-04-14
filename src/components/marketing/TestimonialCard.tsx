import Image from "next/image";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role?: string;
  avatarSrc?: string;
  rating?: number;
  eyebrow?: string;
  eyebrowAriaLabel?: string;
}

export function TestimonialCard({
  quote,
  author,
  role,
  avatarSrc,
  rating = 5,
  eyebrow,
  eyebrowAriaLabel,
}: TestimonialCardProps) {
  return (
    <div className="flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-700"
              aria-label={eyebrowAriaLabel ?? eyebrow}
            >
              {eyebrow}
            </p>
          ) : null}
          <div
            className="mt-3 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
            role="img"
            aria-label={`${rating} out of 5 stars`}
          >
            <span className="text-primary-500">●</span>
            <span>{rating}/5 buyer rating</span>
          </div>
        </div>
        <span className="text-4xl leading-none text-primary-200" aria-hidden="true">
          “
        </span>
      </div>

      <blockquote className="mt-5 flex-1 text-base leading-7 text-slate-700">
        {quote}
      </blockquote>

      <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
        {avatarSrc ? (
          <Image
            src={avatarSrc}
            alt={author}
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <div className="text-sm font-semibold text-slate-900">{author}</div>
          {role ? <div className="text-xs text-slate-500">{role}</div> : null}
        </div>
      </div>
    </div>
  );
}
