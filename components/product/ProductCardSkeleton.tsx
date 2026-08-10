import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-surface shadow-sm">
      <Skeleton className="w-full pt-[100%] rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-1 h-4 w-24" />
        <Skeleton className="mt-2 h-6 w-20" />
        <Skeleton className="mt-auto h-3 w-32" />
      </div>
    </div>
  );
}
