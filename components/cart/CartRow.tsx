import Image from "next/image";
import { formatPrice, type CartLine } from "@/lib/types/ui";
import { QuantityStepper } from "./QuantityStepper";

export function CartRow({ line }: { line: CartLine }) {
  const { product, quantity } = line;

  return (
    <div className="flex flex-col gap-4 border-b border-border py-4 sm:flex-row">
      <div className="relative h-48 w-full flex-shrink-0 overflow-hidden rounded bg-surface-muted sm:h-32 sm:w-48">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, 192px"
          className="object-contain p-2"
        />
      </div>

      <div className="flex flex-grow flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <h3 className="line-clamp-2 text-body-lg font-semibold text-text-main">
              {product.name}
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
          <QuantityStepper quantity={quantity} />
          <button
            type="button"
            className="flex h-touch items-center text-body-sm text-link hover:underline"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
