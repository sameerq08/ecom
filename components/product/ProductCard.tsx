import Image from "next/image";
import { formatPrice, type Product } from "@/lib/types/ui";
import { StarRating } from "./StarRating";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm transition-shadow hover:shadow-md">
      <div className="relative w-full pt-[100%] bg-surface">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain p-4"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-body-md text-text-main group-hover:underline">
          {product.name}
        </h3>
        <StarRating rating={product.rating} />
        <div className="mt-2 text-title-lg font-bold text-text-main">
          {formatPrice(product.price)}
        </div>
        <div className="mt-auto pt-2 text-body-sm">
          <span className="text-text-muted">by {product.sellerName}</span>
          <span
            className={`ml-2 ${product.inStock ? "text-success" : "text-error"}`}
          >
            {product.inStock ? "In Stock" : "Out of Stock"}
          </span>
        </div>
      </div>
    </article>
  );
}
