import Link from "next/link";
import { OrderTable } from "@/components/seller/OrderTable";
import { SellerStatCard } from "@/components/seller/SellerStatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSellerOrderItems, getSellerStats } from "@/lib/data/seller";

export default async function SellerPage() {
  const [stats, orderItems] = await Promise.all([
    getSellerStats(),
    getSellerOrderItems(),
  ]);

  const recent = orderItems.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg text-text-main">Seller</h1>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <SellerStatCard
          label="Active listings"
          value={stats.activeListings}
          hint="Live in the public catalog"
        />
        <SellerStatCard
          label="Orders needing action"
          value={stats.ordersNeedingAction}
          hint="Not yet marked delivered"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/seller/products"
          className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
        >
          Manage listings
        </Link>
        <Link
          href="/seller/orders"
          className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
        >
          Incoming orders
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recent Orders"
          action={
            <Link
              href="/seller/orders"
              className="flex h-touch items-center text-label-md text-link hover:underline"
            >
              View All
            </Link>
          }
        />
        {recent.length === 0 ? (
          <div className="p-5">
            <p className="text-body-md text-text-muted">
              No orders have come in for your listings yet.
            </p>
          </div>
        ) : (
          <OrderTable orders={recent} />
        )}
      </Card>

      {stats.activeListings === 0 ? (
        <EmptyState
          icon={<span className="text-display-lg">📦</span>}
          title="No products yet"
          description="Add your first listing to start selling on the marketplace."
          actions={
            <Link
              href="/seller/products"
              className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
            >
              Manage listings
            </Link>
          }
        />
      ) : null}
    </div>
  );
}
