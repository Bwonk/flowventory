'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ClipboardList, LineChart, Package, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FeatureCarousel, Onboarding, TipsList, useOnboarding } from '@/components/ui/onboarding';
import { PlanCard } from '@/components/billing/PlanCard';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PLAN } from '@/lib/billing/plan';
import { confirmDefaultThreshold, useOnboardingSteps } from '@/lib/onboarding';
import { DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';
import { springOrInstant } from '@/lib/motion';
import { cn } from '@/lib/utils';

export const ONBOARDING_TOTAL_STEPS = 3;
/** Abonelik adımı (kilit ekranı ve Ayarlar doğrudan buraya açar). */
export const ONBOARDING_PLAN_STEP = 3;

const STEP_CONFIG = [
  {
    title: 'Flowventory’ye hoş geldin',
    description: 'Stoklarını izler, neyi ne zaman sipariş edeceğini söyler.',
  },
  {
    title: 'Mağazanı hazırla',
    description: 'Dört adımda kurulum — istediğin zaman buraya dönebilirsin.',
  },
  {
    title: 'Planını seç',
    description: `${PLAN.trialDays} gün ücretsiz dene; sonra yıllık tek ödeme.`,
  },
] as const;

type PreviewRow = { label: string; value: string; tone?: 'critical' | 'warning' | 'healthy' };

const FEATURES: ReadonlyArray<{
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  preview: { eyebrow: string; rows: PreviewRow[] };
}> = [
  {
    id: 'stok',
    icon: Package,
    title: 'Stok takibi',
    description: 'Kritik ve az kalan ürünler tek listede; ikas’ta stok değişince anında güncellenir.',
    preview: {
      eyebrow: 'Stok sağlığı',
      rows: [
        { label: 'Kritik', value: '12', tone: 'critical' },
        { label: 'Az kalan', value: '34', tone: 'warning' },
        { label: 'Sağlıklı', value: '418', tone: 'healthy' },
      ],
    },
  },
  {
    id: 'rapor',
    icon: ClipboardList,
    title: 'Satın alma raporu',
    description: 'Satış hızına göre tedarikçi bazlı sipariş önerisi; PDF olarak tedarikçine gönder.',
    preview: {
      eyebrow: 'Önerilen sipariş',
      rows: [
        { label: 'Anadolu Tekstil', value: '240 adet' },
        { label: 'Ege Ambalaj', value: '1.200 adet' },
        { label: 'Marmara Deri', value: '85 adet' },
      ],
    },
  },
  {
    id: 'kurallar',
    icon: SlidersHorizontal,
    title: 'Otomatik kurallar',
    description: 'Stok eşiğe inince bildirim, e-posta ya da stok aksiyonu — sen bakmadan.',
    preview: {
      eyebrow: 'Kural',
      rows: [
        { label: 'Stok 10’un altına düşerse', value: 'Bildirim' },
        { label: '3 gün içinde 5 daha düşerse', value: 'E-posta' },
      ],
    },
  },
  {
    id: 'analiz',
    icon: LineChart,
    title: 'Görüntülenme analizi',
    description: 'Çok bakılıp az satan ürünleri yakala; fiyat ya da görsel sorununu erken gör.',
    preview: {
      eyebrow: 'Son 30 gün',
      rows: [
        { label: 'Keten gömlek', value: '2.140 → 6 satış', tone: 'warning' },
        { label: 'Deri cüzdan', value: '980 → 41 satış', tone: 'healthy' },
      ],
    },
  },
];

const TONE_DOT: Record<NonNullable<PreviewRow['tone']>, string> = {
  critical: 'bg-status-critical',
  warning: 'bg-status-warning',
  healthy: 'bg-status-healthy',
};

// ─── Başlık ───────────────────────────────────────────────────────────────

function OnboardingDialogHeader() {
  const { currentStep } = useOnboarding();
  const config = STEP_CONFIG[currentStep - 1];
  return (
    <DialogHeader className="items-center !text-center">
      <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Başlarken · {currentStep}/{ONBOARDING_TOTAL_STEPS}
      </p>
      <DialogTitle className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
        {config.title}
      </DialogTitle>
      <DialogDescription>{config.description}</DialogDescription>
      <div className="flex w-full justify-center pt-3">
        <Onboarding.StepIndicator variant="pills" className="w-full max-w-40" />
      </div>
    </DialogHeader>
  );
}

// ─── 1. Özellikler ────────────────────────────────────────────────────────

function FeatureStep() {
  const { stepValue, setStepValue } = useOnboarding();
  const reduceMotion = useReducedMotion();
  const active = FEATURES[stepValue] ?? FEATURES[0];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <FeatureCarousel
        className="order-2 flex w-full flex-col gap-1.5 md:order-1 md:w-1/2"
        onValueChange={setStepValue}
        totalItems={FEATURES.length}
        value={stepValue}
      >
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          const isActive = stepValue === index;
          return (
            <FeatureCarousel.Item
              index={index}
              key={feature.id}
              className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3.5 transition-colors duration-150',
                  // Kart içinde kart: ikinci seviye muted zemin (DESIGN.md §1).
                  isActive ? 'border-hairline bg-muted' : 'border-transparent hover:bg-muted/60',
                )}
              >
                <Icon
                  className={cn('mt-0.5 size-4 shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground')}
                  aria-hidden
                />
                <div>
                  <p className="text-sm font-medium text-foreground">{feature.title}</p>
                  {isActive && <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>}
                </div>
              </div>
            </FeatureCarousel.Item>
          );
        })}
      </FeatureCarousel>

      {/* Görsel yerine veri-mürekkep önizlemesi (dekoratif). */}
      <div className="order-1 w-full md:order-2 md:w-1/2" aria-hidden>
        <div className="relative flex aspect-[4/3] flex-col justify-center overflow-hidden rounded-lg border border-hairline bg-background p-5">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
              transition={springOrInstant(reduceMotion)}
            >
              <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {active.preview.eyebrow}
              </p>
              <ul className="mt-3 divide-y divide-hairline">
                {active.preview.rows.map(row => (
                  <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 text-foreground">
                      {row.tone && <span className={cn('size-2 shrink-0 rounded-full', TONE_DOT[row.tone])} />}
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{row.value}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── 2. Kurulum ───────────────────────────────────────────────────────────

function SetupStep({ onNavigate }: { onNavigate: (href: string) => void }) {
  const { steps, doneCount, total, loading } = useOnboardingSteps();
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-right font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        <AnimatedNumber value={doneCount} /> / {total} tamamlandı
      </p>
      <TipsList title="Kurulum adımları" className={cn(loading && 'opacity-60')}>
        {steps.map((step, index) => (
          <TipsList.Item
            key={step.key}
            className="flex items-start gap-3 border-b border-hairline py-3.5 last:border-b-0"
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors duration-150',
                step.done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={step.done ? 'check' : 'num'}
                  className="flex"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={springOrInstant(reduceMotion)}
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </motion.span>
              </AnimatePresence>
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  step.done ? 'text-muted-foreground line-through' : 'text-foreground',
                )}
              >
                {step.title}
                {step.done && <span className="sr-only"> (tamamlandı)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
              {step.key === 'threshold' && !step.done && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="-ml-2 mt-1 text-muted-foreground"
                  onClick={confirmDefaultThreshold}
                >
                  Varsayılanı kullan ({DEFAULT_STOCK_THRESHOLD.min}/{DEFAULT_STOCK_THRESHOLD.max})
                </Button>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant={step.done ? 'ghost' : 'outline'}
              className="shrink-0"
              onClick={() => onNavigate(step.href)}
            >
              {step.done ? 'Aç' : step.cta}
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </TipsList.Item>
        ))}
      </TipsList>
    </div>
  );
}

// ─── Dialog ───────────────────────────────────────────────────────────────

/**
 * Başlarken popup'ı — cult-ui `onboarding` demosunun kalıbı (Dialog içinde
 * başlık + pill göstergesi + adımlar + Geri/İleri). Adımlar: 1) özellik
 * turu (FeatureCarousel, alt adımlar İleri ile gezilir), 2) kurulum
 * adımları (TipsList; canlı tamamlanma durumu, derin link popup'ı kapatır),
 * 3) plan kartı. Demo çerçevesi korunur: şeffaf DialogContent içinde
 * `bg-muted` dış hale (konsantrik: 16 = 8 + 8) + hairline kart.
 */
export function OnboardingDialog({
  open,
  onOpenChange,
  step,
  onStepChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: number;
  onStepChange: (step: number) => void;
}) {
  const router = useRouter();

  const navigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full max-w-[calc(100dvw-2rem)] border-none bg-transparent p-0 shadow-none sm:max-w-3xl"
        showCloseButton={false}
      >
        <div className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto overscroll-contain rounded-2xl bg-muted p-0.5 md:p-2">
          <Onboarding
            className="relative"
            value={step}
            onValueChange={onStepChange}
            maxStepValue={FEATURES.length - 1}
            onComplete={() => onOpenChange(false)}
            totalSteps={ONBOARDING_TOTAL_STEPS}
          >
            <OnboardingDialogHeader />
            <div className="my-6 min-h-70">
              <Onboarding.Step step={1}>
                <FeatureStep />
              </Onboarding.Step>
              <Onboarding.Step step={2}>
                <SetupStep onNavigate={navigate} />
              </Onboarding.Step>
              <Onboarding.Step step={3}>
                <PlanCard />
              </Onboarding.Step>
            </div>
            <Onboarding.Navigation completeLabel="Uygulamaya geç" />
          </Onboarding>
        </div>
      </DialogContent>
    </Dialog>
  );
}
