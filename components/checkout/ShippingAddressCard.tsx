import { Card, CardHeader } from "@/components/ui/Card";

/**
 * Display-only. v1 has no address book and no editing — the address ships with
 * the seeded buyer profile, and there is no payment step to attach it to.
 */
export function ShippingAddressCard({
  address,
}: {
  address: readonly string[];
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Shipping address" />
      <address className="p-5 text-body-md not-italic text-text-main">
        {address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </Card>
  );
}
