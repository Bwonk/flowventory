import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/PageContainer';
import { SkeletonRows } from '@/components/shared/data-table/SkeletonRows';

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
        <SkeletonRows rows={8} columns={['w-16', 'w-12', 'w-16', 'w-10']} />
      </div>
    </PageContainer>
  );
}
