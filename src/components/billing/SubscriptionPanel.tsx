'use client';

import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useOnboardingDialog } from '@/components/onboarding/onboarding-dialog-context';
import { ONBOARDING_PLAN_STEP } from '@/components/onboarding/OnboardingDialog';
import type { SubscriptionState } from '@/lib/billing/entitlement';
import { useSubscription } from '@/lib/billing/use-subscription';

const STATE_BADGE: Record<SubscriptionState, { label: string; variant: BadgeVariant }> = {
  trial: { label: 'Deneme', variant: 'info' },
  active: { label: 'Aktif', variant: 'success' },
  will_be_removed: { label: 'Dönem sonunda bitecek', variant: 'warning' },
  expired: { label: 'Deneme bitti', variant: 'critical' },
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (iso: string | null) => (iso ? dateFormatter.format(new Date(iso)) : null);

/**
 * Ayarlar `#plan` bölümü — abonelik durumunun kalıcı evi (Başlarken satırı
 * emekli olduktan sonra da görünür). Plan kartı ve ödeme Başlarken
 * popup'ının plan adımında yaşar; burası durum + "Planı gör".
 */
export function SubscriptionPanel() {
  const { summary, loading, error, refresh } = useSubscription();
  const { openOnboarding } = useOnboardingDialog();

  if (loading) {
    return (
      <div aria-busy className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-8 w-28" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">Abonelik durumu alınamadı.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  const badge = STATE_BADGE[summary.state];
  const renewal = formatDate(summary.renewsAt);
  const statusLine =
    summary.state === 'trial'
      ? `${formatDate(summary.trialEndsAt)} tarihinde bitiyor · ${summary.trialDaysLeft} gün kaldı`
      : summary.state === 'active'
        ? renewal
          ? `Yıllık plan · sonraki yenileme ${renewal}`
          : 'Yıllık plan'
        : summary.state === 'will_be_removed'
          ? renewal
            ? `${renewal} sonrası erişim kapanır`
            : 'Dönem sonunda erişim kapanır'
          : 'Verilerin saklanıyor; devam etmek için abone ol.';

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        <span className="text-sm text-foreground">{statusLine}</span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => openOnboarding(ONBOARDING_PLAN_STEP)}>
        Planı gör
      </Button>
    </div>
  );
}
