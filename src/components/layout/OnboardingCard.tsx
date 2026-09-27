'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useOnboardingDialog } from '@/components/onboarding/onboarding-dialog-context';
import { ONBOARDING_SETUP_STEP } from '@/components/onboarding/OnboardingDialog';
import { firstIncompleteIndex, useOnboardingSteps } from '@/lib/onboarding';
import { PRESS_FEEDBACK_CLASS, springOrInstant } from '@/lib/motion';
import { cn } from '@/lib/utils';

// Son adım da bitince "Kurulum tamam" satırının okunması için bekleme —
// zamanlama olduğundan reduced-motion'da da korunur.
const DONE_BEAT_MS = 1200;

/**
 * Sidebar footer'ındaki "Başlarken" launcher'ı (Appcues "beacon" /
 * Userpilot kapalı checklist kalıbı): adımları göstermez — ilerleme
 * (sayaç + segment çubuğu) ve sıradaki adımın adı; tıklanınca Başlarken
 * popup'ı kurulum adımında açılır. Beyaz sidebar yüzeyinde ikinci seviye
 * `bg-muted` zemin (çerçevesiz/gölgesiz — kart-içinde-kart kuralı).
 * Daraltılmış ikon modunda gizlenir. ✕ kalıcı gizler; hepsi bitince kısa bir
 * "Kurulum tamam" beat'inden sonra kendiliğinden emekli olur.
 */
export function OnboardingCard() {
  const { steps, doneCount, total, loading, retired, complete, dismiss } = useOnboardingSteps();
  const { openOnboarding } = useOnboardingDialog();
  const reduceMotion = useReducedMotion();
  // X'e basıldı ya da tamamlanma beat'i bitti → önce çıkış animasyonu, sonra emeklilik.
  const [closing, setClosing] = useState(false);
  const [finished, setFinished] = useState(false);
  // Yükleme bittiği andaki tamamlanma durumu: açılışta zaten tamamsa kart
  // hiç gösterilmez (mezuniyet bayrağını hook yazar).
  const [initialComplete, setInitialComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && initialComplete === null) setInitialComplete(complete);
  }, [loading, complete, initialComplete]);

  useEffect(() => {
    if (!complete || initialComplete !== false) return;
    const timer = window.setTimeout(() => setFinished(true), DONE_BEAT_MS);
    return () => window.clearTimeout(timer);
  }, [complete, initialComplete]);

  if (retired || loading || initialComplete !== false) return null;

  const next = steps[firstIncompleteIndex(steps)];

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <AnimatePresence
        initial={false}
        onExitComplete={() => {
          if (closing) dismiss();
        }}
      >
        {!closing && !finished && (
          <motion.section
            aria-label="Başlarken"
            exit={{ opacity: 0, height: 0, transition: { duration: reduceMotion ? 0 : 0.2 } }}
            className="relative overflow-hidden rounded-lg bg-muted"
          >
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => openOnboarding(ONBOARDING_SETUP_STEP)}
              className={cn(
                'group/launcher block w-full p-3 pr-8 text-left hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                PRESS_FEEDBACK_CLASS,
              )}
            >
              <span className="block font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Başlarken
              </span>

              <span className="mt-1.5 flex items-center gap-1 text-sm font-medium text-foreground">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    key={complete ? 'done' : 'todo'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.15 }}
                    className="flex min-w-0 items-center gap-1.5"
                  >
                    {complete && (
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
                        <Check className="size-2.5" aria-hidden />
                      </span>
                    )}
                    <span className="truncate">{complete ? 'Kurulum tamam' : 'Kurulumu tamamla'}</span>
                  </motion.span>
                </AnimatePresence>
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground transition-[color,transform] duration-150 group-hover/launcher:translate-x-0.5 group-hover/launcher:text-foreground motion-reduce:transition-none"
                  aria-hidden
                />
              </span>
              {next && !complete && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">Sıradaki: {next.title}</span>
              )}

              {/* İlerleme: tamamlanan adım SAYISI kadar segment soldan dolar —
                  adıma bağlı değil (adımlar sırasız yapılabiliyor; ortada boşluk
                  bozuk çubuk gibi okunuyordu, QA 27 Eyl 2026). Sayaç metni yok:
                  çubuk yeterli. Mürekkep dili: dolu = foreground, boş = hairline. */}
              <span className="mt-2.5 flex gap-1" aria-hidden>
                {steps.map((step, index) => (
                  <span key={step.key} className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-foreground"
                      initial={false}
                      animate={{ scaleX: index < doneCount ? 1 : 0 }}
                      transition={springOrInstant(reduceMotion)}
                    />
                  </span>
                ))}
              </span>
              <span className="sr-only">
                {`${doneCount}/${total} kurulum adımı tamamlandı. Adımları açmak için tıkla.`}
              </span>
            </button>

            <button
              type="button"
              aria-label="Başlarken kartını gizle"
              onClick={() => setClosing(true)}
              className={cn(
                'absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                PRESS_FEEDBACK_CLASS,
              )}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
