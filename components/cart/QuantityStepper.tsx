export function QuantityStepper({ quantity }: { quantity: number }) {
  return (
    <div className="flex items-center overflow-hidden rounded-full border border-border bg-surface-muted shadow-sm">
      <button
        type="button"
        aria-label="Decrease quantity"
        className="flex h-touch w-touch items-center justify-center text-text-main transition-colors hover:bg-border/40"
      >
        −
      </button>
      <span className="w-10 text-center text-body-md font-bold text-text-main">
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        className="flex h-touch w-touch items-center justify-center text-text-main transition-colors hover:bg-border/40"
      >
        +
      </button>
    </div>
  );
}
