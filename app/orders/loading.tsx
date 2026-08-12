import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the order list: meta header row, then the timeline track. */
export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-10 w-40" />

      {[0, 1, 2].map((card) => (
        <Card key={card} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-wrap gap-6">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ))}
            </div>
            <Skeleton className="h-touch w-40" />
          </div>

          <Skeleton className="mt-10 h-1 w-full rounded-full" />
          <div className="mt-4 flex justify-between">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-4 w-16" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
