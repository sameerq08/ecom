import Link from "next/link";
import { ProductImage } from "@/components/product/ProductImage";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, type SellerListingRow } from "@/lib/types/ui";

/**
 * The seller's own listings, including inactive ones — this is the owner view,
 * not the public catalog. Inactive rows are dimmed and badged; out-of-stock
 * rows carry an error-toned stock figure. Edit is rendered but inert: listing
 * management is a later step.
 */
export function ProductTable({
  listings,
}: {
  listings: readonly SellerListingRow[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            <th className="p-4 text-label-md text-text-muted">Listing</th>
            <th className="p-4 text-label-md text-text-muted">Category</th>
            <th className="p-4 text-right text-label-md text-text-muted">
              Price
            </th>
            <th className="p-4 text-right text-label-md text-text-muted">
              Stock
            </th>
            <th className="p-4 text-label-md text-text-muted">State</th>
            <th className="p-4 text-label-md text-text-muted">Action</th>
          </tr>
        </thead>
        <tbody className="text-body-sm">
          {listings.map(({ product, categoryName, stockQty, active }) => (
            <tr
              key={product.id}
              className={`border-b border-border transition-colors hover:bg-canvas ${
                active ? "" : "opacity-60"
              }`}
            >
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface-muted">
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      sizes="48px"
                      padding="p-1"
                    />
                  </div>
                  <Link
                    href={`/products/${product.id}`}
                    className="line-clamp-2 max-w-xs font-semibold text-link hover:underline"
                  >
                    {product.name}
                  </Link>
                </div>
              </td>
              <td className="p-4 whitespace-nowrap text-text-muted">
                {categoryName}
              </td>
              <td className="p-4 text-right whitespace-nowrap text-text-main">
                {formatPrice(product.price)}
              </td>
              <td
                className={`p-4 text-right ${
                  stockQty > 0 ? "text-text-main" : "text-error"
                }`}
              >
                {stockQty > 0 ? stockQty : "Out of stock"}
              </td>
              <td className="p-4">
                <Badge tone={active ? "success" : "neutral"}>
                  {active ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="p-4">
                <button
                  type="button"
                  disabled
                  className="inline-flex h-touch items-center justify-center rounded border border-border bg-surface px-4 text-body-md font-bold text-text-main disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
