"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SurfaceDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function SurfaceDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "left",
  className,
}: SurfaceDrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 md:hidden" aria-modal="true" role="dialog">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-neutral-950/35 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-y-0 flex w-[min(88vw,24rem)] flex-col border-neutral-200 bg-white shadow-[0_24px_80px_-32px_rgba(15,23,42,0.45)]",
          side === "left" ? "left-0 border-r" : "right-0 border-l",
          className,
        )}
      >
        <div className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-neutral-900">{title}</p>
              {description ? (
                <p className="mt-1 text-sm text-neutral-500">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Dismiss drawer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? <div className="border-t border-neutral-200 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
