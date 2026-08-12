import { updateQuantity } from "@/app/cart/actions";

/**
 * Each control is its own form posting the target quantity, so the stepper
 * works with JavaScript disabled. The server clamps to [1, stock] regardless
 * of what is submitted; the disabled states here are the visible half of that.
 */
export function QuantityStepper({
  lineId,
  quantity,
  maxQuantity,
}: {
  lineId: string;
  quantity: number;
  maxQuantity: number;
}) {
  const atMinimum = quantity <= 1;
  const atStock = quantity >= maxQuantity;

  return (
    <div className="flex items-center overflow-hidden rounded-full border border-border bg-surface-muted shadow-sm">
      <form action={updateQuantity}>
        <input type="hidden" name="lineId" value={lineId} />
        <input type="hidden" name="quantity" value={quantity - 1} />
        <button
          type="submit"
          aria-label="Decrease quantity"
          disabled={atMinimum}
          className="flex h-touch w-touch items-center justify-center text-text-main transition-colors hover:bg-border/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          −
        </button>
      </form>

      <span className="w-10 text-center text-body-md font-bold text-text-main">
        {quantity}
      </span>

      <form action={updateQuantity}>
        <input type="hidden" name="lineId" value={lineId} />
        <input type="hidden" name="quantity" value={quantity + 1} />
        <button
          type="submit"
          aria-label="Increase quantity"
          disabled={atStock}
          className="flex h-touch w-touch items-center justify-center text-text-main transition-colors hover:bg-border/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        >
          +
        </button>
      </form>
    </div>
  );
}
