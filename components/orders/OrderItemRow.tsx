import Link from "next/link";
import { ProductImage } from "@/components/product/ProductImage";
import { formatPrice, type OrderLine } from "@/lib/types/ui";

/**
 * A placed line. Price comes from `priceAtPurchase`, never from the live
 * catalog — a later price change must not rewrite order history.
 */
export function OrderItemRow({ line }: { line: OrderLine }) {
  const { product, quantity, priceAtPurchase } = line;

  return (
    <div className="flex flex-col gap-4 border-b border-border py-4 last:border-b-0 sm:flex-row">
      <div className="relative h-32 w-full flex-shrink-0 overflow-hidden rounded bg-surface-muted sm:h-24 sm:w-32">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(max-width: 640px) 100vw, 128px"
          padding="p-2"
        />
      </div>

      <div className="flex flex-grow flex-col justify-between gap-2">
        <h3 className="line-clamp-2 text-body-lg font-semibold text-text-main">
          <Link
            href={`/products/${product.id}`}
            className="hover:text-link hover:underline"
          >
            {product.name}
          </Link>
        </h3>
        <p className="text-body-sm text-text-muted">
          Sold by {product.sellerName}
        </p>
        <p className="text-body-sm text-text-muted">
          Quantity: <span className="font-bold">{quantity}</span>
        </p>
      </div>

      <div className="text-left sm:text-right">
        <p className="text-title-lg font-bold text-text-main">
          {formatPrice(priceAtPurchase * quantity)}
        </p>
        {quantity > 1 ? (
          <p className="text-body-sm text-text-muted">
            {formatPrice(priceAtPurchase)} each
          </p>
        ) : null}
      </div>
    </div>
  );
}
