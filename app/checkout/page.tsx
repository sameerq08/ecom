import Link from "next/link";
import { placeOrder } from "@/app/checkout/actions";
import { CartRow } from "@/components/cart/CartRow";
import { CartSummary } from "@/components/cart/CartSummary";
import { ShippingAddressCard } from "@/components/checkout/ShippingAddressCard";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCart, summarizeCart } from "@/lib/data/cart";
import { getCheckoutAddress } from "@/lib/data/orders";
import { requireProfile } from "@/lib/supabase/session";

export default async function CheckoutPage() {
  // Redirects to /signin when signed out. It throws, so no checkout content
  // can render first.
  await requireProfile();
  const lines = await getCart();
  const totals = summarizeCart(lines);
  const address = getCheckoutAddress();

  if (lines.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-display-lg text-text-main">Checkout</h1>
        <EmptyState
          icon={<span className="text-display-lg">🧾</span>}
          title="Nothing to check out"
          description="Your cart is empty, so there is no order to review yet."
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
      <h1 className="text-display-lg text-text-main">Checkout</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-grow flex-col gap-6">
          <ShippingAddressCard address={address} />

          <Card className="overflow-hidden">
            <CardHeader title="Review your order" />
            <div className="p-5">
              {lines.map((line) => (
                <CartRow key={line.id} line={line} editable={false} />
              ))}
              <div className="pt-4 text-right">
                <Link
                  href="/cart"
                  className="inline-flex h-touch items-center text-body-md text-link hover:underline"
                >
                  Edit cart
                </Link>
              </div>
            </div>
          </Card>
        </div>

        <CartSummary
          totals={totals}
          label="Order total"
          note="No payment is taken in this version. Placing the order records it and notifies the seller."
          action={
            <form action={placeOrder}>
              <Button type="submit" fullWidth disabled={totals.hasBlockedLine}>
                Place Order
              </Button>
            </form>
          }
        />
      </div>
    </div>
  );
}
