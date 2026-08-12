import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { formatPrice, type CartTotals } from "@/lib/types/ui";

/**
 * The subtotal panel shared by the cart sidebar and the checkout review.
 * Totals arrive already computed by `summarizeCart` — this renders them and
 * never recalculates, so the two screens cannot disagree.
 */
export function CartSummary({
  totals,
  label = "Subtotal",
  action,
  note,
}: {
  totals: CartTotals;
  label?: string;
  action: ReactNode;
  note?: string;
}) {
  return (
    <Card className="h-fit w-full flex-shrink-0 p-5 lg:w-[320px]">
      <div className="mb-4 text-body-lg text-text-main">
        {label} ({totals.itemCount}{" "}
        {totals.itemCount === 1 ? "item" : "items"}):{" "}
        <span className="text-title-lg font-bold">
          {formatPrice(totals.subtotal)}
        </span>
      </div>

      {totals.hasBlockedLine ? (
        <p className="mb-4 text-body-sm text-error">
          Remove the out-of-stock item before continuing.
        </p>
      ) : null}

      {note ? <p className="mb-4 text-body-sm text-text-muted">{note}</p> : null}

      {action}
    </Card>
  );
}
