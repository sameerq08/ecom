import { ProductCardSkeleton } from "@/components/product/ProductCardSkeleton";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-touch w-32 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-[520px] w-full rounded-lg" />

        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
