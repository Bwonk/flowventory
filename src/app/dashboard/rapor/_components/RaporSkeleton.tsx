import { Skeleton } from '@/components/ui/skeleton';

/** Satın alma raporu sayfası yüklenirken gösterilen iskelet — yeni tab'lı geometriyi aynalar. */
export function RaporSkeleton() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-8 h-10 w-72" />

      {/* Aksiyon rafı + KPI paneli — çentikli panel silüeti */}
      <div className="mb-4">
        <div className="flex justify-end">
          <Skeleton className="-mb-px h-10 w-96 max-w-full rounded-t-lg rounded-b-none" />
        </div>
        <div className="overflow-hidden rounded-lg rounded-tr-none border border-hairline bg-card">
          <div className="-mr-px -mb-px grid grid-cols-1 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-b border-r border-border p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-6 w-20" />
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Tedarikçi paneli — klasör-tab rayı (sol tab + sağ raf) + satırlar */}
      <div>
        <div className="flex items-end justify-between gap-3 px-4">
          <Skeleton className="-mb-px h-9 w-32 rounded-t-lg rounded-b-none" />
          <Skeleton className="-mb-px h-8 w-72 rounded-t-lg rounded-b-none" />
        </div>
        <div className="overflow-hidden rounded-lg rounded-tr-none border border-hairline bg-card">
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
