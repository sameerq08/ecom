import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors order detail: meta card with timeline, then items beside the address. */
export function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-64" />

      <Card className="p-5">
        <div className="flex flex-wrap gap-6">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-10 h-1 w-full rounded-full" />
        <div className="mt-4 flex justify-between">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-4 w-16" />
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="flex flex-col gap-4 border-b border-border py-4 last:border-b-0 sm:flex-row"
            >
              <Skeleton className="h-32 w-full flex-shrink-0 sm:h-24 sm:w-32" />
              <div className="flex flex-grow flex-col gap-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </Card>

        <Card className="p-5">
          <Skeleton className="mb-4 h-5 w-40" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
