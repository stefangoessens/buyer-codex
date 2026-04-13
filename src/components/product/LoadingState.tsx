import { cn } from "@/lib/utils";

interface LoadingStateProps {
  variant: "card" | "list" | "text" | "panel" | "metrics";
  count?: number;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-neutral-200", className)} />
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function TextSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 aspect-[16/7] w-full rounded-[20px]" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-36 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="rounded-[18px] border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-8 w-24" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ variant, count = 1 }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="space-y-4">
      {items.map((i) => {
        switch (variant) {
          case "card":
            return <CardSkeleton key={i} />;
          case "list":
            return <ListRowSkeleton key={i} />;
          case "text":
            return <TextSkeleton key={i} />;
          case "panel":
            return <PanelSkeleton key={i} />;
          case "metrics":
            return <MetricsSkeleton key={i} />;
        }
      })}
    </div>
  );
}
