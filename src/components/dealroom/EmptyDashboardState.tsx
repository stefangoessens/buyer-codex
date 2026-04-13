import { SurfaceState } from "@/components/product/SurfaceState";

export function EmptyDashboardState() {
  return (
    <SurfaceState
      title="Paste a listing to get started"
      description="Your first deal room will appear here as soon as you drop a Zillow, Redfin, or Realtor.com link above."
      className="bg-neutral-50/60"
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="size-5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-1.027a4.5 4.5 0 0 0-1.242-7.244l-4.5-4.5a4.5 4.5 0 0 0-6.364 6.364l1.757 1.757"
          />
        </svg>
      }
    />
  );
}
