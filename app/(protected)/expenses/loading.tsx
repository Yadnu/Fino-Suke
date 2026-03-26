import { Skeleton, SkeletonTransactionRow } from "@/components/ui/SkeletonCard";

export default function ExpensesLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-48 rounded-md" />
      </div>
      <div className="bg-surface border border-border rounded-lg p-5 space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTransactionRow key={i} />
        ))}
      </div>
    </div>
  );
}
