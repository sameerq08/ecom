import { Skeleton } from "@/components/ui/Skeleton";

export function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-64" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Skeleton className="w-full rounded-lg pt-[100%]" />
          <div className="flex gap-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-touch w-touch" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>

        <div className="lg:col-span-3">
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
