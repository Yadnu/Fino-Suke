import { Skeleton, SkeletonBudgetCard } from "@/components/ui/SkeletonCard";

export default function BudgetLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-28 mt-2" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBudgetCard key={i} />
        ))}
      </div>
    </div>
  );
}
