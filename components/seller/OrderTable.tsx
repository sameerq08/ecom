import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  ORDER_STATUS_LABELS,
  formatPrice,
  type OrderStatus,
  type SellerOrderRow,
} from "@/lib/types/ui";

const statusTones: Record<OrderStatus, BadgeTone> = {
  pending: "pending",
  confirmed: "pending",
  shipped: "success",
  delivered: "success",
};

export function OrderTable({ orders }: { orders: SellerOrderRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            <th className="p-4 text-label-md text-text-muted">Order</th>
            <th className="p-4 text-label-md text-text-muted">Date</th>
            <th className="p-4 text-label-md text-text-muted">Customer</th>
            <th className="p-4 text-right text-label-md text-text-muted">
              Amount
            </th>
            <th className="p-4 text-label-md text-text-muted">Status</th>
          </tr>
        </thead>
        <tbody className="text-body-sm">
          {orders.map((order) => (
            <tr
              key={order.id}
              className="border-b border-border transition-colors hover:bg-canvas"
            >
              <td className="p-4 font-semibold text-link">
                {order.orderNumber}
              </td>
              <td className="p-4 text-text-muted">{order.placedAt}</td>
              <td className="p-4 text-text-main">{order.customerName}</td>
              <td className="p-4 text-right text-text-main">
                {formatPrice(order.amount)}
              </td>
              <td className="p-4">
                <Badge tone={statusTones[order.status]}>
                  {ORDER_STATUS_LABELS[order.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
