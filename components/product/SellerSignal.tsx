import type { SellerSignal as SellerSignalType } from "@/lib/types/ui";

/**
 * Public seller signal shown on the detail page. Display-only in v1 — the
 * `/sellers/[id]` storefront is a later step, so this is deliberately not a link.
 */
export function SellerSignal({ seller }: { seller: SellerSignalType }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-title-lg text-text-main">Sold by {seller.storeName}</h2>
      <dl className="mt-3 flex flex-col gap-1 text-body-sm text-text-muted">
        <div className="flex gap-2">
          <dt>Selling since</dt>
          <dd className="text-text-main">{seller.memberSince}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Active listings</dt>
          <dd className="text-text-main">{seller.listingCount}</dd>
        </div>
      </dl>
    </div>
  );
}
