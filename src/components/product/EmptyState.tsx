import type { ReactNode } from "react";
import { SurfaceState } from "./SurfaceState";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <SurfaceState
      title={title}
      description={description}
      action={action}
      icon={icon}
      className="py-16"
    />
  );
}
