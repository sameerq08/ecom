import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";

/** Shown to a signed-in buyer visiting a `/seller/*` route — not a crash, not a redirect loop. */
export function SellerAccessDenied() {
  return (
    <EmptyState
      tone="error"
      icon={<span className="text-display-lg">🚫</span>}
      title="Sellers only"
      description="This area is for sellers managing their own listings and orders."
      actions={
        <Link
          href="/"
          className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
        >
          Back to shop
        </Link>
      }
    />
  );
}
