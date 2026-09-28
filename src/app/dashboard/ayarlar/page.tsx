'use client';

import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { SubscriptionPanel } from '@/components/billing/SubscriptionPanel';
import { AyarlarSkeleton } from './_components/AyarlarSkeleton';
import { ContentFadeIn } from '@/components/motion/content-fade-in';
import { NotificationSection } from './_components/NotificationSection';
import { RulesLinkSection } from './_components/RulesLinkSection';
import { SettingsSection } from './_components/SettingsSection';
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
        <ContentFadeIn>
          <section className="divide-y divide-hairline rounded-lg border border-hairline bg-card">
            {/* Bölüm id="veri-senkron" / "takip-scripti" taşır: Başlarken
                rehberindeki senkron ve script adımları buraya derin bağlanır. */}
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
                      digestFrequency: settings.digestFrequency,
                      digestWeekday: settings.digestWeekday,
                      digestHour: settings.digestHour,
                      timezone: settings.timezone,
                    }
                  : null
              }
            />
            {/* Kurallar kendi sayfasında (/dashboard/kurallar); burada yalnız yönlendirme. */}
            <RulesLinkSection />
            {/* Aboneliğin kalıcı evi — Başlarken satırı emekli olduktan sonra da görünür. */}
            <SettingsSection
              id="plan"
              eyebrow="ABONELİK"
              title="Plan ve abonelik"
              description="Mevcut planın, deneme süren ve yenileme tarihi."
            >
              <SubscriptionPanel />
            </SettingsSection>
          </section>
        </ContentFadeIn>
      )}
    </PageContainer>
  );
}
