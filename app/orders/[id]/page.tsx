import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderConfirmationBanner } from "@/components/orders/OrderConfirmationBanner";
import { OrderItemRow } from "@/components/orders/OrderItemRow";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { ShippingAddressCard } from "@/components/checkout/ShippingAddressCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { getOrderById } from "@/lib/data/orders";
import { requireProfile } from "@/lib/supabase/session";
import { ORDER_STATUS_LABELS, formatPrice } from "@/lib/types/ui";

export default async function OrderDetailPage(
  props: PageProps<"/orders/[id]">,
) {
  // Redirects to /signin when signed out. It throws, so no order detail can
  // render first.
  await requireProfile();
  const { id } = await props.params;
  const order = await getOrderById(id);

  if (!order) {
    notFound();
  }

  const searchParams = await props.searchParams;
  const justPlaced = searchParams.placed === "1";

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-text-muted">
        <Link href="/orders" className="text-link hover:underline">
          Orders
        </Link>
        <span className="px-2">/</span>
        <span>{order.orderNumber}</span>
      </nav>

      {justPlaced ? (
        <OrderConfirmationBanner orderNumber={order.orderNumber} />
      ) : null}

      <h1 className="text-display-lg text-text-main">
        Order {order.orderNumber}
      </h1>

      <Card className="p-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-body-sm text-text-muted">Order Placed</p>
            <p className="text-body-md font-semibold text-text-main">
              {order.placedAt}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-text-muted">Total</p>
            <p className="text-body-md font-semibold text-text-main">
              {formatPrice(order.total)}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-text-muted">Items</p>
            <p className="text-body-md font-semibold text-text-main">
              {order.itemCount}
            </p>
          </div>
          <div>
            <p className="text-body-sm text-text-muted">Status</p>
            <p className="text-body-md font-semibold text-text-main">
              {ORDER_STATUS_LABELS[order.status]}
            </p>
          </div>
        </div>

        <OrderStatusTimeline status={order.status} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader title="Items in this order" />
          <div className="p-5">
            {order.lines.map((line) => (
              <OrderItemRow key={line.id} line={line} />
            ))}
            <div className="flex justify-between border-t border-border pt-4 text-body-lg text-text-main">
              <span>Order total</span>
              <span className="text-title-lg font-bold">
                {formatPrice(order.total)}
              </span>
            </div>
          </div>
        </Card>

        <ShippingAddressCard address={order.shippingAddress} />
      </div>
    </div>
  );
}
