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
      <NotificationSettingsCard />
    </PageContainer>
  );
}
