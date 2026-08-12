import { advanceStatus } from "@/app/seller/orders/actions";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  type OrderStatus,
} from "@/lib/types/ui";

/**
 * Advances an order one step. Only the order id is submitted — the next status
 * is decided on the server, so the control cannot be used to skip a step or
 * roll one back. A delivered order renders as terminal rather than vanishing,
 * so the column keeps its shape.
 *
 * Not amber: this is a workflow action, not a conversion CTA.
 */
export function OrderStatusControl({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const next = ORDER_STATUS_STEPS[ORDER_STATUS_STEPS.indexOf(status) + 1];

  if (!next) {
    return (
      <span className="flex h-touch items-center whitespace-nowrap text-body-sm text-text-muted">
        Complete
      </span>
    );
  }

  return (
    <form action={advanceStatus}>
      <input type="hidden" name="orderId" value={orderId} />
      <button
        type="submit"
        className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 whitespace-nowrap text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
      >
        Mark {ORDER_STATUS_LABELS[next]}
      </button>
    </form>
  );
}
