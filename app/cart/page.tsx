import Link from "next/link";
import { CartRow } from "@/components/cart/CartRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCart, summarizeCart } from "@/lib/data/cart";
import { formatPrice } from "@/lib/types/ui";

export default async function CartPage() {
  const lines = await getCart();
  const totals = summarizeCart(lines);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-display-lg text-text-main">Cart</h1>
        <EmptyState
          icon={<span className="text-display-lg">🛒</span>}
          title="Your cart is empty"
          description="Browse the marketplace to find products from our sellers."
          actions={
            <Link
              href="/"
              className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
            >
              Keep browsing
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg text-text-main">Cart</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="flex-grow p-5">
          {lines.map((line) => (
            <CartRow key={line.id} line={line} />
          ))}
          <div className="pt-4 text-right">
            <span className="text-body-lg text-text-main">
              Subtotal ({totals.itemCount}{" "}
              {totals.itemCount === 1 ? "item" : "items"}):{" "}
            </span>
            <span className="text-title-lg font-bold text-text-main">
              {formatPrice(totals.subtotal)}
            </span>
          </div>
        </Card>

        <CartSummary
          totals={totals}
          action={
            totals.hasBlockedLine ? (
              // Amber is a conversion colour; a blocked CTA must not wear it.
              <span
                aria-disabled="true"
                className="inline-flex h-touch w-full cursor-not-allowed items-center justify-center rounded border border-border bg-surface-muted px-4 text-body-md font-bold text-text-muted"
              >
                Proceed to Checkout
              </span>
            ) : (
              <Link
                href="/checkout"
                className="inline-flex h-touch w-full items-center justify-center rounded bg-accent px-4 text-body-md font-bold text-on-accent transition-colors hover:bg-accent-hover"
              >
                Proceed to Checkout
              </Link>
            )
          }
        />
      </div>
    </div>
  );
}
