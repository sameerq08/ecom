import Link from "next/link";
import { OrderStatusControl } from "@/components/seller/OrderStatusControl";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  ORDER_STATUS_LABELS,
  formatPrice,
  type OrderStatus,
  type SellerOrderItemRow,
} from "@/lib/types/ui";

/** The single status→tone mapping. Import it; do not redeclare it elsewhere. */
export const statusTones: Record<OrderStatus, BadgeTone> = {
  pending: "pending",
  confirmed: "pending",
  shipped: "success",
  delivered: "success",
};

/**
 * Serves both seller views: the dashboard's read-only recent orders, and the
 * `/seller/orders` queue, which adds the product/quantity columns and the
 * status control. One table, two configurations, so the row styling cannot
 * drift between them.
 */
export function OrderTable({
  orders,
  showItemDetail = false,
  showActions = false,
}: {
  orders: readonly SellerOrderItemRow[];
  showItemDetail?: boolean;
  showActions?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            <th className="p-4 text-label-md text-text-muted">Order</th>
            <th className="p-4 text-label-md text-text-muted">Date</th>
            <th className="p-4 text-label-md text-text-muted">Customer</th>
            {showItemDetail ? (
              <>
                <th className="p-4 text-label-md text-text-muted">Product</th>
                <th className="p-4 text-right text-label-md text-text-muted">
                  Qty
                </th>
              </>
            ) : null}
            <th className="p-4 text-right text-label-md text-text-muted">
              Amount
            </th>
            <th className="p-4 text-label-md text-text-muted">Status</th>
            {showActions ? (
              <th className="p-4 text-label-md text-text-muted">Action</th>
            ) : null}
          </tr>
        </thead>
        <tbody className="text-body-sm">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-b border-border transition-colors hover:bg-canvas"
            >
              <td className="p-4">
                <Link
                  href={`/orders/${order.orderId}`}
                  className="font-semibold text-link hover:underline"
                >
                  {order.orderNumber}
                </Link>
              </td>
              <td className="p-4 whitespace-nowrap text-text-muted">
                {order.placedAt}
              </td>
              <td className="p-4 text-text-main">{order.customerName}</td>
              {showItemDetail ? (
                <>
                  <td className="max-w-xs p-4 text-text-main">
                    {order.productName}
                  </td>
                  <td className="p-4 text-right text-text-main">
                    {order.quantity}
                  </td>
                </>
              ) : null}
              <td className="p-4 text-right whitespace-nowrap text-text-main">
                {formatPrice(order.amount)}
              </td>
              <td className="p-4">
                <Badge tone={statusTones[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </td>
              {showActions ? (
                <td className="p-4">
                  <OrderStatusControl
                    orderId={order.orderId}
                    status={order.status}
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
