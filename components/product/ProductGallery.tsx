import Link from "next/link";
import { ProductImage } from "./ProductImage";

/**
 * Thumbnails are links that set `?image=N` rather than client state, so the
 * gallery stays a Server Component, works without JavaScript, and the selected
 * image survives a reload or a shared URL.
 */
export function ProductGallery({
  productId,
  name,
  images,
  activeIndex,
}: {
  productId: string;
  name: string;
  images: readonly string[];
  activeIndex: number;
}) {
  const active = images[activeIndex] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface pt-[100%]">
        <ProductImage
          src={active}
          alt={name}
          sizes="(max-width: 1024px) 100vw, 40vw"
          padding="p-8"
        />
      </div>

      {images.length > 1 ? (
        <ul className="flex flex-wrap gap-3" aria-label="Product images">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={image}>
                <Link
                  href={`/products/${productId}?image=${index}`}
                  scroll={false}
                  aria-label={`Show image ${index + 1} of ${images.length}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`relative block h-touch w-touch overflow-hidden rounded border-2 bg-surface transition-colors ${
                    isActive
                      ? "border-primary"
                      : "border-border hover:border-text-muted"
                  }`}
                >
                  <ProductImage
                    src={image}
                    alt=""
                    sizes="44px"
                    padding="p-1"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
