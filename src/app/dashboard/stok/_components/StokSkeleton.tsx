import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/PageContainer';

export function StokSkeleton() {
  return (
    <PageContainer>
      {/* Başlık + CSV butonu */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Skeleton className="mb-2 h-3 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Tek kart: filtre satırı + tablo satırları (başlık şeridi yok — ac1e03e) */}
      <div className="overflow-hidden rounded-lg border border-hairline bg-card">
        <div className="border-b border-border p-2">
          <Skeleton className="h-10 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-5 py-2.5 last:border-b-0">
            <Skeleton className="h-7 w-7 shrink-0 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            <Skeleton className="h-4 w-12 shrink-0" />
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
