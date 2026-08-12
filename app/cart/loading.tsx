import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the cart silhouette: rows of image + text, then the summary panel. */
export default function CartLoading() {
  return (
    <div className="flex flex-col gap-8">
      <Skeleton className="h-10 w-32" />

      <div className="flex flex-col gap-6 lg:flex-row">
        <Card className="flex-grow p-5">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex flex-col gap-4 border-b border-border py-4 sm:flex-row"
            >
              <Skeleton className="h-48 w-full flex-shrink-0 sm:h-32 sm:w-48" />
              <div className="flex flex-grow flex-col gap-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-auto h-touch w-40 rounded-full" />
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </Card>

        <Card className="h-fit w-full flex-shrink-0 p-5 lg:w-[320px]">
          <Skeleton className="mb-4 h-6 w-40" />
          <Skeleton className="h-touch w-full" />
        </Card>
      </div>
    </div>
  );
}
