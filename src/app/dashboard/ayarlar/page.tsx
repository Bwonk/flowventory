'use client';

import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { NotificationSettingsCard } from './_components/NotificationSettingsCard';
import { TrackingScriptCard } from './_components/TrackingScriptCard';

export default function AyarlarPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="YAPILANDIRMA" title="Ayarlar" />
      <TrackingScriptCard />
      {/* Çapa sarmalayıcıda: kart ayarlar yüklenene dek null döndürür, id'nin
          navigasyon anında DOM'da olması hash kaydırmasının ön koşulu.
          Bildirim panelindeki dişli ve boş durum linki buraya derin bağlanır. */}
      <div id="bildirim-ayarlari" className="scroll-mt-6">
        <NotificationSettingsCard />
      </div>
    </PageContainer>
  );
}
