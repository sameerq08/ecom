import Link from "next/link";
import { OrderTable } from "@/components/seller/OrderTable";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSellerOrderItems } from "@/lib/data/seller";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STEPS,
  type OrderStatus,
} from "@/lib/types/ui";

/** Narrows an untrusted query value to a real status, or undefined for "all". */
function parseStatus(raw: string | string[] | undefined): OrderStatus | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ORDER_STATUS_STEPS.find((step) => step === value);
}

export default async function SellerOrdersPage(
  props: PageProps<"/seller/orders">,
) {
  const searchParams = await props.searchParams;
  const status = parseStatus(searchParams.status);
  const rows = await getSellerOrderItems(status);

  // Links rather than a JS-driven control, so filtering survives no-JS.
  const filters: { label: string; href: string; active: boolean }[] = [
    {
      label: "All",
      href: "/seller/orders",
      active: status === undefined,
    },
    ...ORDER_STATUS_STEPS.map((step) => ({
      label: ORDER_STATUS_LABELS[step],
      href: `/seller/orders?status=${step}`,
      active: status === step,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-body-sm text-text-muted">
        <Link href="/seller" className="text-link hover:underline">
          Seller
        </Link>
        <span className="px-2">/</span>
        <span>Incoming orders</span>
      </nav>

      <h1 className="text-display-lg text-text-main">Incoming orders</h1>

      <ul className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <li key={filter.href}>
            <Link
              href={filter.href}
              aria-current={filter.active ? "page" : undefined}
              className={`flex h-touch items-center rounded-full border px-4 text-body-md transition-colors ${
                filter.active
                  ? "border-primary bg-primary text-on-primary"
                  : "border-border bg-surface text-text-main hover:bg-surface-muted"
              }`}
            >
              {filter.label}
            </Link>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <EmptyState
          icon={<span className="text-display-lg">📭</span>}
          title="No orders to show"
          description={
            status
              ? `None of your line items are currently ${ORDER_STATUS_LABELS[status].toLowerCase()}.`
              : "No orders have come in for your listings yet."
          }
          actions={
            status ? (
              <Link
                href="/seller/orders"
                className="inline-flex h-touch w-full items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main transition-colors hover:bg-surface-muted"
              >
                Clear filter
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader
            title={`${rows.length} ${rows.length === 1 ? "line item" : "line items"}`}
          />
          <OrderTable orders={rows} showItemDetail showActions />
        </Card>
      )}
    </div>
  );
}
