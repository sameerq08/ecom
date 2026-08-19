import { addProductToCart } from "@/app/products/[id]/actions";
import { Button } from "@/components/ui/Button";
import { formatPrice, type ProductDetail } from "@/lib/types/ui";

const MAX_SELECTABLE_QTY = 10;

/** Sticky purchase card. */
export function BuyBox({ product }: { product: ProductDetail }) {
  const quantities = Array.from(
    { length: Math.min(product.stockQty, MAX_SELECTABLE_QTY) },
    (_, index) => index + 1,
  );

  return (
    <div className="sticky top-28 flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="text-display-lg text-text-main">
        {formatPrice(product.price)}
      </div>

      <p
        className={`text-body-lg ${product.inStock ? "text-success" : "text-error"}`}
      >
        {product.inStock ? "In Stock" : "Out of Stock"}
      </p>

      {product.inStock ? (
        <p className="text-body-sm text-text-muted">
          {product.stockQty} available
        </p>
      ) : null}

      <p className="text-body-sm text-text-muted">
        Sold by <span className="text-text-main">{product.seller.storeName}</span>
      </p>

      <form action={addProductToCart} className="flex flex-col gap-4">
        <input type="hidden" name="productId" value={product.id} />

        {product.inStock ? (
          <div className="flex flex-col gap-1">
            <label
              className="text-label-md text-text-main"
              htmlFor="buy-box-quantity"
            >
              Quantity
            </label>
            <select
              id="buy-box-quantity"
              name="quantity"
              defaultValue="1"
              className="h-touch w-full rounded border border-border bg-surface px-3 text-body-md text-text-main"
            >
              {quantities.map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Button type="submit" fullWidth disabled={!product.inStock}>
          Add to Cart
        </Button>
      </form>
    </div>
  );
}
