import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { formatPrice, type OrderSummary } from "@/lib/types/ui";

// PLACEHOLDER DATA — replaced by Supabase queries in a later step.
const sampleOrders: OrderSummary[] = [
  {
    id: "o1",
    orderNumber: "#112-9876543",
    placedAt: "May 15, 2026",
    total: 129.99,
    shipTo: "Jane Doe",
    status: "shipped",
  },
  {
    id: "o2",
    orderNumber: "#112-4471190",
    placedAt: "May 2, 2026",
    total: 398.98,
    shipTo: "Jane Doe",
    status: "delivered",
  },
];

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg">Orders</h1>

      {sampleOrders.map((order) => (
        <Card key={order.id} className="p-5">
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
                <p className="text-body-md font-semibold text-link">
                  {order.shipTo}
                </p>
              </div>
            </div>
            <p className="text-body-sm text-text-muted">
              Order {order.orderNumber}
            </p>
          </div>

          <OrderStatusTimeline status={order.status} />
        </Card>
      ))}

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md">Error state</h2>
        <ErrorState
          actions={
            <Button fullWidth>Try again</Button>
          }
        />
      </section>
    </div>
  );
}
