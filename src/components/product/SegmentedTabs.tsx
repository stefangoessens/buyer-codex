"use client";

import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  value: string;
  label: string;
  description?: string;
}

interface SegmentedTabsProps {
  items: readonly SegmentedTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = {
  sm: {
    root: "gap-1 p-1",
    button: "px-3 py-2 text-xs",
  },
  md: {
    root: "gap-1.5 p-1.5",
    button: "px-4 py-2.5 text-sm",
  },
} as const;

export function SegmentedTabs({
  items,
  value,
  onValueChange,
  size = "md",
  className,
}: SegmentedTabsProps) {
  const classes = sizeClasses[size];

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center rounded-full border border-neutral-200/80 bg-white/90 shadow-sm backdrop-blur",
        classes.root,
        className,
      )}
      role="tablist"
      aria-orientation="horizontal"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "rounded-full font-medium transition-colors",
              classes.button,
              active
                ? "bg-primary-700 text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
