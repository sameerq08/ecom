import Link from "next/link";
import { removeFromCart } from "@/app/cart/actions";
import { ProductImage } from "@/components/product/ProductImage";
import { formatPrice, type CartLine } from "@/lib/types/ui";
import { QuantityStepper } from "./QuantityStepper";

/**
 * `editable` is false on checkout, where the same row renders as a read-only
 * review line rather than duplicating the layout in a second component.
 */
export function CartRow({
  line,
  editable = true,
}: {
  line: CartLine;
  editable?: boolean;
}) {
  const { product, quantity, maxQuantity } = line;

  return (
    <div className="flex flex-col gap-4 border-b border-border py-4 sm:flex-row">
      <div className="relative h-48 w-full flex-shrink-0 overflow-hidden rounded bg-surface-muted sm:h-32 sm:w-48">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          sizes="(max-width: 640px) 100vw, 192px"
          padding="p-2"
        />
      </div>

      <div className="flex flex-grow flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h3 className="line-clamp-2 text-body-lg font-semibold text-text-main">
              <Link
                href={`/products/${product.id}`}
                className="hover:text-link hover:underline"
              >
                {product.name}
              </Link>
            </h3>
            <span className="whitespace-nowrap text-title-lg font-bold text-text-main">
              {formatPrice(product.price)}
            </span>
          </div>
          <p
            className={`mt-1 text-body-sm ${
              product.inStock ? "text-success" : "text-error"
            }`}
          >
            {product.inStock ? "In Stock" : "Out of Stock"}
          </p>
          <p className="mt-1 text-body-sm text-text-muted">
            Sold by {product.sellerName}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {editable ? (
            <>
              <QuantityStepper
                lineId={line.id}
                quantity={quantity}
                maxQuantity={maxQuantity}
              />
              <form action={removeFromCart}>
                <input type="hidden" name="lineId" value={line.id} />
                <button
                  type="submit"
                  className="flex h-touch items-center text-body-sm text-link hover:underline"
                >
                  Delete
                </button>
              </form>
            </>
          ) : (
            <p className="text-body-sm text-text-muted">
              Quantity: <span className="font-bold">{quantity}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
