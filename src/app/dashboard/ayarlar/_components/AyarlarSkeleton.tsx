import { Skeleton } from '@/components/ui/skeleton';

/**
 * Tek-kart ayarlar panelinin yükleme iskeleti. Gerçek içerikle aynı kabuğu
 * ve bölüm grid'ini kullanır; ikinci bölüm #bildirim-ayarlari çapasını
 * taşır ki derin bağlantı skeleton sırasında da doğru yere kaysın
 * (skeleton ↔ içerik birbirini dışlar, id çakışmaz).
 */
export function AyarlarSkeleton() {
  return (
    <div className="divide-y divide-hairline rounded-lg border border-hairline bg-card">
      <section className="grid gap-4 p-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-x-12">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </section>
      <section
        id="bildirim-ayarlari"
        className="grid gap-4 scroll-mt-6 p-6 md:grid-cols-[260px_minmax(0,1fr)] md:gap-x-12"
      >
        <div className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </section>
    </div>
  );
}
