'use client';

import { useState, type ReactNode } from 'react';
import { Check, Crown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PLAN } from '@/lib/billing/plan';
import type { SubscriptionState } from '@/lib/billing/entitlement';
import { useSubscription } from '@/lib/billing/use-subscription';
import { formatMoneyRounded } from '@/lib/format';
import { EASE_OUT, springOrInstant } from '@/lib/motion';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const formatDate = (iso: string | null) => (iso ? dateFormatter.format(new Date(iso)) : null);

// Köşe rozeti: durum çiftlerinden (DESIGN.md §1 rozet zemin/metin) — mono eyebrow dili.
const CORNER_BADGE: Record<SubscriptionState, { label: string; className: string }> = {
  trial: { label: `${PLAN.trialDays} gün ücretsiz deneme`, className: 'bg-success text-success-foreground' },
  active: { label: 'Aktif', className: 'bg-success text-success-foreground' },
  will_be_removed: { label: 'Dönem sonunda bitecek', className: 'bg-warning text-warning-foreground' },
  expired: { label: 'Deneme bitti', className: 'bg-critical text-critical-foreground' },
};

const PERIOD_LABEL = { YEARLY: '/yıllık', MONTHLY: '/aylık', ONE_TIME: 'tek sefer' } as const;

const MANAGE_HINT = 'ikas panelinde uygulamanın sağ üstündeki "Planı Yönet" butonunu da kullanabilirsin.';

/**
 * Plan kartı — ink zeminli tek plan kartı (onboarding popup'ının son adımı).
 * Referans: kullanıcının paylaştığı koyu fiyat kartı; DESIGN.md'ye çevrildi:
 * zemin `bg-primary` (ink, ikinci accent yok — teal/yeşil buton yerine beyaz
 * texture secondary buton), köşe `rounded-lg`, gölge yok, fiyat KPI dilinde
 * `font-mono tabular-nums`, köşe rozeti durum çiftinden. Kalan deneme günü
 * statik metin — geri sayım animasyonu yok.
 */
export function PlanCard() {
  const { summary, loading, error, pending, refresh, startCheckout, cancelPending } = useSubscription();
  const [starting, setStarting] = useState(false);
  const reduceMotion = useReducedMotion();

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

  // Bölge planının fiyatı (Partner panel); yoksa TR planının sabit bilgisi.
  const price = summary?.offer ?? { price: PLAN.yearlyPrice, currency: PLAN.currency, period: 'YEARLY' as const };
  const state = summary?.state ?? 'trial';
  const badge = CORNER_BADGE[state];

  const statusLine = (() => {
    if (!summary) return null;
    const trialEnd = formatDate(summary.trialEndsAt);
    const renewal = formatDate(summary.renewsAt);
    switch (summary.state) {
      case 'trial':
        return `Deneme süren ${trialEnd} tarihinde bitiyor · ${summary.trialDaysLeft} gün kaldı`;
      case 'active':
        return renewal ? `Yıllık planın aktif · sonraki yenileme ${renewal}` : 'Yıllık planın aktif';
      case 'will_be_removed':
        return renewal ? `${renewal} sonrası erişim kapanır` : 'Dönem sonunda erişim kapanır';
      case 'expired':
        return 'Stok verilerin ve kuralların saklanıyor; abone olunca kaldığın yerden devam edersin.';
    }
  })();

  const ctaLabel = pending
    ? 'Ödeme bekleniyor…'
    : state === 'will_be_removed'
        ? 'Aboneliği yenile'
        : 'Şimdi abone ol';

  const actions: ReactNode = loading ? (
      <Skeleton className="h-9 w-full bg-primary-foreground/10" />
    ) : error ? (
      <div className="flex items-center justify-between gap-3 text-sm text-primary-foreground/70">
        Abonelik durumu alınamadı.
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          Tekrar dene
        </Button>
      </div>
    ) : state === 'active' ? null : !summary?.billingEnabled ? (
      <p className="rounded-md border border-primary-foreground/15 px-4 py-2 text-center text-sm text-primary-foreground/60">
        Abonelik çok yakında açılıyor
      </p>
    ) : (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="w-full flex-1"
          onClick={() => void handleCheckout()}
          disabled={starting || pending}
        >
          {ctaLabel}
        </Button>
        {pending && (
          <Button
            type="button"
            variant="ghost"
            className="text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={cancelPending}
          >
            Vazgeç
          </Button>
        )}
      </div>
    );

  return (
    <div>
      <div className="relative rounded-lg bg-primary p-6 text-primary-foreground">
        {/* Durum değişince (ör. ödeme → Aktif) rozet yerinde takas olur. */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={state}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.95 }}
            transition={springOrInstant(reduceMotion)}
            className={cn(
              'absolute -top-2.5 right-5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider',
              badge.className,
            )}
          >
            {badge.label}
          </motion.span>
        </AnimatePresence>

        <p className="flex items-center gap-1.5 text-sm font-medium text-primary-foreground/70">
          <Crown className="size-4" aria-hidden />
          {PLAN.name}
        </p>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-mono text-4xl font-medium tracking-tight tabular-nums">
            {formatMoneyRounded(price.price, price.currency)}
          </span>
          <span className="text-sm text-primary-foreground/60">{PERIOD_LABEL[price.period]}</span>
          <span className="text-xs text-primary-foreground/40">+ KDV</span>
        </p>
        <p className="mt-3 text-sm text-primary-foreground/70">{PLAN.description}</p>

        <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {PLAN.features.map(feature => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary-foreground/50" aria-hidden />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {/* Aksiyon alanı; abonelik aktif olunca yükseklik + opaklıkla çöker.
              p-1/-m-1: overflow-hidden buton odak halkasını kırpmasın. */}
          <AnimatePresence initial={false}>
            {actions && (
              <motion.div
                key="actions"
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: { duration: reduceMotion ? 0 : 0.2, ease: EASE_OUT },
                }}
                className="-m-1 overflow-hidden p-1"
              >
                <div className="pb-3">{actions}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {statusLine && (
            <p
              className="flex items-center justify-center gap-1.5 text-center text-xs text-primary-foreground/60"
              aria-live="polite"
            >
              {state === 'active' && !pending && <DrawnCheck reduceMotion={reduceMotion} />}
              {pending ? 'ikas ödeme ekranı açıldı; ödeme tamamlanınca burası kendiliğinden güncellenir.' : statusLine}
            </p>
          )}
        </div>
      </div>

      <p className="mx-auto mt-3 max-w-md text-center text-xs text-muted-foreground">
        Gösterilen fiyat 1 tam yılı kapsar. Ödeme ekranındaki ücret, kalan ikas mağaza lisansı gününe
        göre oranlanır. {summary?.billingEnabled === false ? 'Deneme süren boyunca tüm özellikler açık.' : MANAGE_HINT}
      </p>
    </div>
  );
}

/** Abonelik aktif satırının tiki — bir kez çizilir (300ms, EASE_OUT). */
function DrawnCheck({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-primary-foreground" fill="none" aria-hidden>
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduceMotion ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE_OUT }}
      />
    </svg>
  );
}
