'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTip } from '@/components/shared/InfoTip';
import { PLAN } from '@/lib/billing/plan';
import type { SubscriptionState } from '@/lib/billing/entitlement';
import { useSubscription } from '@/lib/billing/use-subscription';
import { formatMoneyRounded } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATE_BADGE: Record<SubscriptionState, { label: string; variant: BadgeVariant }> = {
  trial: { label: 'Deneme', variant: 'info' },
  active: { label: 'Aktif', variant: 'success' },
  will_be_removed: { label: 'Dönem sonunda bitecek', variant: 'warning' },
  expired: { label: 'Deneme bitti', variant: 'critical' },
};

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

function formatDate(iso: string | null): string | null {
  return iso ? dateFormatter.format(new Date(iso)) : null;
}

const MANAGE_HINT = 'ikas panelinde uygulamanın sağ üstündeki "Planı Yönet" butonunu da kullanabilirsin.';

/**
 * Abonelik kartı (Başlarken sayfası; `compact` ile Ayarlar #plan bölümü).
 * Tek plan, TR'de yalnız yıllık → dönem seçici yok. Kalan deneme günü statik
 * metindir — geri sayım animasyonu yok (Built for Shopify 4.3.2 emsali).
 */
export function SubscriptionPanel({ compact = false }: { compact?: boolean }) {
  const { summary, loading, error, pending, refresh, startCheckout, cancelPending } = useSubscription();
  const [starting, setStarting] = useState(false);

  const handleCheckout = async () => {
    setStarting(true);
    const result = await startCheckout();
    setStarting(false);
    if (result === 'disabled') {
      toast.error('Abonelik henüz açılmadı', { description: 'Deneme süren boyunca tüm özellikler açık.' });
    } else if (result === 'error') {
      toast.error('Ödeme ekranı açılamadı', { description: MANAGE_HINT });
    }
  };

  if (loading) {
    return (
      <div className={cn(!compact && 'rounded-lg border border-hairline bg-card p-5')} aria-busy>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-4 w-56" />
        {!compact && <Skeleton className="mt-5 h-9 w-36" />}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={cn('flex flex-col items-start gap-3', !compact && 'rounded-lg border border-hairline bg-card p-5')}>
        <p className="text-sm text-muted-foreground">Abonelik durumu alınamadı.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          Tekrar dene
        </Button>
      </div>
    );
  }

  const { state, billingEnabled, trialDaysLeft } = summary;
  const badge = STATE_BADGE[state];
  const trialEnd = formatDate(summary.trialEndsAt);
  const renewal = formatDate(summary.renewsAt);
  const canStart = state !== 'active';

  const statusLine =
    state === 'trial'
      ? `Deneme süren ${trialEnd} tarihinde bitiyor · ${trialDaysLeft} gün kaldı`
      : state === 'active'
        ? renewal
          ? `Yıllık plan · sonraki yenileme ${renewal}`
          : 'Yıllık plan'
        : state === 'will_be_removed'
          ? renewal
            ? `${renewal} sonrası erişim kapanır.`
            : 'Dönem sonunda erişim kapanır.'
          : 'Stok verilerin ve kuralların saklanıyor; devam etmek için aboneliği başlat.';

  const cta = canStart && billingEnabled && (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
      <Button type="button" onClick={() => void handleCheckout()} disabled={starting || pending}>
        {pending ? 'Ödeme bekleniyor…' : state === 'will_be_removed' ? 'Aboneliği yenile' : 'Aboneliği başlat'}
      </Button>
      {pending && (
        <Button type="button" variant="ghost" onClick={cancelPending}>
          Vazgeç
        </Button>
      )}
    </div>
  );

  const note = !billingEnabled ? (
    <p className="text-xs text-muted-foreground">
      Abonelik çok yakında açılıyor; deneme süren boyunca tüm özellikler açık.
    </p>
  ) : pending ? (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      ikas ödeme ekranı açıldı. Ödeme tamamlanınca burası kendiliğinden güncellenir.
    </p>
  ) : canStart ? (
    <p className="text-xs text-muted-foreground">Ödeme ikas üzerinden alınır; {MANAGE_HINT}</p>
  ) : (
    <p className="text-xs text-muted-foreground">
      Planı ikas panelinde uygulamanın sağ üstündeki &quot;Planı Yönet&quot; butonundan yönetebilirsin.
    </p>
  );

  if (compact) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badge.variant}>{badge.label}</Badge>
          <span className="text-sm text-foreground">{statusLine}</span>
        </div>
        {cta}
        {note}
      </div>
    );
  }

  return (
    <section
      id="abonelik"
      aria-labelledby="abonelik-baslik"
      className="scroll-mt-6 overflow-hidden rounded-lg border border-hairline bg-card"
    >
      <div className="flex h-12 items-center justify-between gap-3 border-b border-hairline px-5">
        <h2 id="abonelik-baslik" className="text-sm font-medium text-foreground">
          Abonelik
        </h2>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <p className="text-sm text-muted-foreground">{statusLine}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{PLAN.name}</p>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {PLAN.features.map(feature => (
                <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="size-3.5 shrink-0 text-foreground" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5 sm:flex-col sm:items-end sm:gap-0">
            <p className="font-mono text-2xl font-medium tabular-nums text-foreground">
              {formatMoneyRounded(PLAN.yearlyPrice, PLAN.currency)}
            </p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              / yıl + KDV
              <InfoTip
                size="sm"
                side="left"
                text="ikas, fiyatı mağazanın kalan ikas lisans gününe göre oranlar; KDV ödeme ekranında eklenir."
              />
            </div>
          </div>
        </div>

        {(cta || note) && (
          <div className="flex flex-col gap-2 border-t border-hairline pt-4">
            {cta}
            {note}
          </div>
        )}
      </div>
    </section>
  );
}
