import Link from "next/link";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { Card } from "@/components/ui/Card";
import { formatPrice, type OrderSummary } from "@/lib/types/ui";

/** The order-list card: meta header, order number link, then the status timeline. */
export function OrderSummaryCard({ order }: { order: OrderSummary }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-6">
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
            <p className="text-body-sm text-text-muted">Ship To</p>
            <p className="text-body-md font-semibold text-text-main">
              {order.shipTo}
            </p>
          </div>
        </div>

        <Link
          href={`/orders/${order.id}`}
          className="flex h-touch items-center text-body-sm font-semibold text-link hover:underline"
        >
          Order {order.orderNumber}
        </Link>
      </div>

      <OrderStatusTimeline status={order.status} />
    </Card>
  );
}
