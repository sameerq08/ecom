import Link from "next/link";
import { OrderSummaryCard } from "@/components/orders/OrderSummaryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { getOrders } from "@/lib/data/orders";
import { requireProfile } from "@/lib/supabase/session";

export default async function OrdersPage() {
  // Redirects to /signin when signed out. It throws, so no order history can
  // render first.
  await requireProfile();
  const orders = await getOrders();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg text-text-main">Orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={<span className="text-display-lg">📦</span>}
          title="No orders yet"
          description="Orders you place will appear here, with their delivery progress."
          actions={
            <Link
              href="/"
              className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
            >
              Start shopping
            </Link>
          }
        />
      ) : (
        orders.map((order) => (
          <OrderSummaryCard key={order.id} order={order} />
        ))
      )}
    </div>
  );
}
