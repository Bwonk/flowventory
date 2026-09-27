'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Onboarding } from '@/components/ui/onboarding';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { confirmDefaultThreshold, type OnboardingState } from '@/lib/onboarding';
import { DEFAULT_STOCK_THRESHOLD } from '@/lib/stock-threshold';
import { SPRING } from '@/lib/motion';

/**
 * Kurulum rehberi kartı (Shopify "setup guide" kalıbı): akordeon adımlar,
 * adım başına tek birincil aksiyon (derin link), açık adım tamamlanınca
 * sıradaki eksik adım kendiliğinden açılır. Hepsi bitince kart "kurulu ve
 * çalışıyor" satırına çöker; adımlar isteğe bağlı yeniden açılır.
 */
export function SetupGuide({ onboarding }: { onboarding: OnboardingState }) {
  if (onboarding.loading) {
    return (
      <div className="overflow-hidden rounded-lg border border-hairline bg-card" aria-busy>
        <div className="flex h-12 items-center border-b border-hairline px-5">
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: onboarding.total }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-hairline px-5 py-3 last:border-b-0">
            <Skeleton className="size-5 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    );
  }

  return <SetupGuideCard onboarding={onboarding} />;
}

// Son adımın tikinin okunması için bekleme — Onboarding'in adım geçişiyle aynı.
const COMPLETE_BEAT_MS = 900;

/** Yükleme sonrası kart; açılışta zaten tamamsa doğrudan tamamlanma satırı. */
function SetupGuideCard({ onboarding }: { onboarding: OnboardingState }) {
  const { steps, complete } = onboarding;
  const reduceMotion = useReducedMotion();
  const [showSteps, setShowSteps] = useState(false);
  // Bu oturumda tamamlandıysa tamamlanma satırı beat'ten sonra gelir.
  const [celebrated, setCelebrated] = useState(complete);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (!justCompleted) return;
    const timer = window.setTimeout(() => setCelebrated(true), COMPLETE_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [justCompleted]);

  const showComplete = complete && celebrated && !showSteps;

  const stepsList = (
    <Onboarding.Steps>
      {steps.map(step => (
        <Onboarding.Step key={step.key} stepKey={step.key} title={step.title}>
          <Onboarding.StepDescription>{step.description}</Onboarding.StepDescription>
          <Onboarding.StepActions>
            <Button asChild size="sm" variant={step.done ? 'outline' : 'default'}>
              <Link href={step.href}>
                {step.cta}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </Button>
            {step.key === 'threshold' && !step.done && (
              <Button type="button" size="sm" variant="ghost" onClick={confirmDefaultThreshold}>
                Varsayılanı kullan ({DEFAULT_STOCK_THRESHOLD.min}/{DEFAULT_STOCK_THRESHOLD.max})
              </Button>
            )}
          </Onboarding.StepActions>
        </Onboarding.Step>
      ))}
    </Onboarding.Steps>
  );

  return (
    <Onboarding steps={steps} onComplete={() => setJustCompleted(true)} aria-labelledby="kurulum-rehberi-baslik">
      <Onboarding.Header>
        <Onboarding.Title id="kurulum-rehberi-baslik">Kurulum rehberi</Onboarding.Title>
        <Onboarding.Progress />
      </Onboarding.Header>
      <Onboarding.StepIndicator className="border-b border-hairline px-5 py-3" />

      <AnimatePresence initial={false} mode="wait">
        {showComplete ? (
          <motion.div
            key="complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: reduceMotion ? 0 : 0.15 } }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.1 } }}
            className="flex items-start gap-3 px-5 py-4"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
            >
              <Check className="size-3" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Kurulum tamam — Flowventory stoklarını izliyor.</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Uyarılar ve sipariş önerileri Genel Bakış’ta.</p>
              <div className="mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                <Button asChild size="sm">
                  <Link href="/dashboard">
                    Genel Bakış’a git
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setShowSteps(true)}>
                  Adımları göster
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="steps"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto', transition: { height: reduceMotion ? { duration: 0 } : SPRING, opacity: { duration: reduceMotion ? 0 : 0.15 } } }}
            exit={{ opacity: 0, height: 0, transition: { height: reduceMotion ? { duration: 0 } : SPRING, opacity: { duration: reduceMotion ? 0 : 0.1 } } }}
            className="overflow-hidden"
          >
            {stepsList}
          </motion.div>
        )}
      </AnimatePresence>
    </Onboarding>
  );
}
