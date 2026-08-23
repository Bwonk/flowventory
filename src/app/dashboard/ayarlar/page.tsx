'use client';

import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { AyarlarSkeleton } from './_components/AyarlarSkeleton';
import { NotificationSection } from './_components/NotificationSection';
import { SyncSection } from './_components/SyncSection';
import { TrackingScriptSection } from './_components/TrackingScriptSection';
import { useAyarlarData } from './hooks/use-ayarlar-data';

export default function AyarlarPage() {
  const { token, trackingStatus, settings, loading, error, reload } = useAyarlarData();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="YAPILANDIRMA"
        title="Ayarlar"
        description="Veri senkronizasyonu, storefront entegrasyonu ve bildirim tercihleri."
      />

      {loading ? (
        <AyarlarSkeleton />
      ) : error || !token ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-hairline bg-card p-6">
          <p className="text-sm text-muted-foreground">{error ?? 'Ayarlar alınamadı.'}</p>
          <Button type="button" variant="outline" onClick={reload}>
            Tekrar dene
          </Button>
        </div>
      ) : (
        <section className="divide-y divide-hairline rounded-lg border border-hairline bg-card">
          {/* Bölüm id="veri-senkron" taşır: Başlarken kartındaki senkron adımı
              buraya derin bağlanır. */}
          <SyncSection token={token} />
          <TrackingScriptSection token={token} initialStatus={trackingStatus} />
          {/* Bölüm id="bildirim-ayarlari" taşır: bildirim panelinin boş durumu
              buraya derin bağlanır (NotificationDrawer). */}
          <NotificationSection
            token={token}
            initialSettings={
              settings
                ? {
                    notificationEmail: settings.notificationEmail,
                    emailNotifications: settings.emailNotifications,
                  }
                : null
            }
          />
        </section>
      )}
    </PageContainer>
  );
}
