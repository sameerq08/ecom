import { OrderTable } from "@/components/seller/OrderTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import type { SellerOrderRow } from "@/lib/types/ui";

// PLACEHOLDER DATA — replaced by Supabase queries in a later step.
const sampleOrders: SellerOrderRow[] = [
  {
    id: "s1",
    orderNumber: "#MH-9021",
    placedAt: "Oct 24, 10:42 AM",
    customerName: "Jane Doe",
    amount: 299,
    status: "shipped",
  },
  {
    id: "s2",
    orderNumber: "#MH-9018",
    placedAt: "Oct 24, 09:15 AM",
    customerName: "Sam Patel",
    amount: 49.99,
    status: "pending",
  },
  {
    id: "s3",
    orderNumber: "#MH-9004",
    placedAt: "Oct 23, 04:02 PM",
    customerName: "Alex Kim",
    amount: 129.5,
    status: "delivered",
  },
];

export default function SellerPage() {
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-display-lg">Seller</h1>

      <Card className="overflow-hidden">
        <CardHeader
          title="Recent Orders"
          action={
            <button
              type="button"
              className="text-label-md text-link hover:underline"
            >
              View All
            </button>
          }
        />
        <OrderTable orders={sampleOrders} />
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-headline-md">Empty state</h2>
        <EmptyState
          icon={<span className="text-4xl">📦</span>}
          title="No products yet"
          description="Add your first listing to start selling on the marketplace."
          actions={<Button fullWidth>Add product</Button>}
        />
      </section>
    </div>
  );
}
