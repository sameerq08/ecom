import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this page. Please try again.",
  actions,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <EmptyState
      tone="error"
      icon={<span className="text-4xl">!</span>}
      title={title}
      description={description}
      actions={actions}
    />
  );
}
