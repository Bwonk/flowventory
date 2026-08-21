import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer } from '@/components/layout/PageContainer';

/** Dashboard iskeleti — gerçek sayfa düzeniyle (PageHeader + 6 bölüm) birebir hizalı. */
export function DashboardSkeleton() {
  return (
    <PageContainer>
      {/* PageHeader: eyebrow + başlık + açıklama */}
      <div className="mb-6">
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="mb-2 h-8 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-4">
        {/* KPI şeridi */}
        <Skeleton className="h-[180px] w-full rounded-lg" />

        {/* Stok Sağlığı */}
        <Skeleton className="h-[180px] w-full rounded-lg" />

        {/* Performans Trendi */}
        <Skeleton className="h-[380px] w-full rounded-lg" />

        {/* En Çok Satanlar + Az Kalan Ürünler */}
        <div className="@container">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
            <Skeleton className="h-[420px] w-full rounded-lg" />
            <Skeleton className="h-[420px] w-full rounded-lg" />
          </div>
        </div>

        {/* Görüntülenme → Satış Dönüşümü */}
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </PageContainer>
  );
}
