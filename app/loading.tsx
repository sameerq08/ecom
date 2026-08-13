import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * Homepage skeleton. There was none while the catalog was seed data, because
 * synchronous reads never suspend; the featured rail is a real query now, so
 * this is what paints while it runs.
 *
 * Shaped like the content it replaces — hero band, chip row, then a grid of
 * card skeletons — so nothing shifts when the products arrive.
 */
export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-border bg-surface p-6 md:p-8">
        <Skeleton className="h-8 w-3/4 max-w-lg" />
        <Skeleton className="mt-3 h-6 w-full max-w-2xl" />
        <Skeleton className="mt-4 h-touch w-44" />
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-touch w-32 rounded-full" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
