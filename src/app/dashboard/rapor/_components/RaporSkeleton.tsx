import { Skeleton } from '@/components/ui/skeleton';

/** Satın alma raporu sayfası yüklenirken gösterilen iskelet. */
export function RaporSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-72" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Skeleton key={i} className="mb-4 h-64 rounded-xl" />
      ))}
    </div>
  );
}
