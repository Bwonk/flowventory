import { SkeletonRows } from '@/components/shared/data-table/SkeletonRows';
import { Skeleton } from '@/components/ui/skeleton';

/** Satın alma raporu yüklenirken iskelet — araç yolları + düz kartlar geometrisi. */
export function RaporSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <Skeleton className="h-9 w-[184px] max-w-full rounded-lg" />
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="-mr-px -mb-px grid grid-cols-1 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-r border-border p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-6 w-20" />
            </div>
          ))}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-96 max-w-full rounded-lg" />
        <Skeleton className="h-9 w-[156px] rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="flex h-[33px] items-center gap-6 border-b border-border px-5">
          <Skeleton className="size-4 rounded" />
          {['w-12', 'w-8', 'w-10', 'w-16', 'w-14', 'w-10'].map((w, i) => (
            <Skeleton key={i} className={`h-2.5 ${w}`} />
          ))}
        </div>
        <SkeletonRows rows={6} columns={['w-14', 'w-10', 'w-12', 'w-10', 'w-16']} />
        <div className="flex h-12 items-center justify-center border-t border-border">
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
    </div>
  );
}
