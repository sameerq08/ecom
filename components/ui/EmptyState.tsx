import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  actions?: ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-8 text-center shadow-sm md:p-16">
      <div
        className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ${
          tone === "error" ? "bg-error/10 text-error" : "bg-surface-muted text-text-muted"
        }`}
      >
        {icon}
      </div>
      <h2
        className={`mb-4 text-display-lg ${
          tone === "error" ? "text-error" : "text-text-main"
        }`}
      >
        {title}
      </h2>
      <p className="mx-auto mb-8 max-w-lg text-body-lg text-text-muted">
        {description}
      </p>
      {actions ? (
        <div className="mx-auto flex w-full max-w-md flex-col gap-4 sm:flex-row">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
