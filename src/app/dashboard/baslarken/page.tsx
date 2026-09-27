'use client';

import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { useOnboardingSteps } from '@/lib/onboarding';
import { SetupGuide } from './_components/SetupGuide';
import { SubscriptionPanel } from '@/components/billing/SubscriptionPanel';

/**
 * Başlarken — kurulum rehberi + abonelik (eski sidebar "Başlarken" kartının
 * yerine; plan: docs/plans/onboarding-sekmesi-abonelik.md). Tek kolon,
 * kural oluşturucu emsali `max-w-3xl`.
 */
export default function BaslarkenPage() {
  const onboarding = useOnboardingSteps();
  const { dismissed, complete, dismiss, restore } = onboarding;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="KURULUM"
        title="Başlarken"
        description="Mağazanı bağla, eşikleri belirle, ilk satın alma raporunu al."
        actions={
          complete ? null : dismissed ? (
            <Button type="button" variant="outline" onClick={restore}>
              Rehberi göster
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={dismiss}>
              Rehberi gizle
            </Button>
          )
        }
      />

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {dismissed && !complete ? (
          <p className="rounded-lg bg-muted px-5 py-4 text-sm text-muted-foreground">
            Kurulum rehberi gizlendi. Adımlara istediğin zaman &quot;Rehberi göster&quot; ile dönebilirsin.
          </p>
        ) : (
          <SetupGuide onboarding={onboarding} />
        )}
        <SubscriptionPanel />
      </div>
    </PageContainer>
  );
}
