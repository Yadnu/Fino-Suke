import { Skeleton, SkeletonCard, SkeletonTransactionRow } from "@/components/ui/SkeletonCard";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-28 mt-2" />
      </div>

      {/* Monthly snapshot skeleton */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex justify-between mb-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-20 rounded-pill" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>

      {/* Budget + savings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
        <SkeletonCard />
      </div>

      {/* Recent transactions */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="divide-y divide-border">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonTransactionRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
