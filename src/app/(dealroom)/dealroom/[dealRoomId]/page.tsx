import type { Metadata } from "next";
import { PropertyCaseOverview } from "@/components/dealroom/PropertyCaseOverview";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const metadata: Metadata = {
  title: "Deal room overview | buyer-codex",
  description:
    "Review the buyer-safe property case, confidence, and recommended next move for this deal room.",
};

export default async function DealRoomOverviewPage({
  params,
}: {
  params: Promise<{ dealRoomId: string }>;
}) {
  const { dealRoomId } = await params;

  return (
    <div className="w-full">
      <PropertyCaseOverview dealRoomId={dealRoomId as Id<"dealRooms">} />
    </div>
  );
}
