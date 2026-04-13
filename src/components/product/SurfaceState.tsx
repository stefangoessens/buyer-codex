import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SurfaceStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: "empty" | "error" | "info";
  className?: string;
}

const toneClasses = {
  empty: "border-dashed border-neutral-300 bg-neutral-50/70",
  error: "border-solid border-error-200 bg-error-50/70",
  info: "border-solid border-primary-200 bg-primary-50/60",
} as const;

const defaultIcons = {
  empty: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M7 10.5 12 15l5-4.5" />
      <path d="M4 19h16" />
    </svg>
  ),
  error: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  ),
  info: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  ),
} as const;

export function SurfaceState({
  title,
  description,
  action,
  icon,
  tone = "empty",
  className,
}: SurfaceStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[20px] border px-8 py-12 text-center",
        toneClasses[tone],
        className,
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          tone === "error"
            ? "bg-error-100 text-error-700"
            : tone === "info"
              ? "bg-primary-100 text-primary-700"
              : "bg-white text-primary-700",
        )}
      >
        {icon ?? defaultIcons[tone]}
      </div>
      <div className="mt-4">
        <p className="text-base font-semibold text-neutral-900">{title}</p>
        {description ? (
          <p className="mt-1 max-w-md text-sm leading-6 text-neutral-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
