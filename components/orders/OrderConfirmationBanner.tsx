/**
 * Shown on order detail only when arriving straight from checkout
 * (`?placed=1`). Success-toned, not amber — amber is reserved for the CTA that
 * got the buyer here, and this is confirmation, not conversion.
 */
export function OrderConfirmationBanner({
  orderNumber,
}: {
  orderNumber: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-1 rounded-lg border border-success/20 bg-success/10 p-5"
    >
      <p className="text-headline-md text-success">Order placed</p>
      <p className="text-body-md text-text-main">
        Thanks — order {orderNumber} is confirmed and the seller has been
        notified. You can follow its progress below.
      </p>
    </div>
  );
}
