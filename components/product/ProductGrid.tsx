import type { ReactNode } from "react";
import type { Product } from "@/lib/types/ui";
import { ProductCard } from "./ProductCard";

/**
 * Shared responsive catalog grid. When there is nothing to show, the caller's
 * `emptyState` takes over the whole region rather than leaving a blank grid.
 */
export function ProductGrid({
  products,
  emptyState,
}: {
  products: readonly Product[];
  emptyState?: ReactNode;
}) {
  if (products.length === 0) {
    return emptyState ?? null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
