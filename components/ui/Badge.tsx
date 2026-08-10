import type { ReactNode } from "react";

export type BadgeTone = "success" | "pending" | "error" | "neutral";

const tones: Record<BadgeTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  pending: "bg-accent/20 text-on-accent border-accent/40",
  error: "bg-error/10 text-error border-error/20",
  neutral: "bg-surface-muted text-text-muted border-border",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-label-sm ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
