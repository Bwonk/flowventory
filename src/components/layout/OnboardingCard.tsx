'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import {
  firstIncompleteIndex,
  nextIncompleteIndex,
  useOnboardingSteps,
} from '@/lib/onboarding';

// Tam genişlik, yön farkındalıklı carousel kaydırması. Giren ve çıkan slayt
// AYNI spring'i paylaşır ki tek ray üzerinde kayıyormuş hissi doğsun
// (repo emsali spring: sidebar 350/35). Kenarda hafif fade, sert kesilmeyi
// yumuşatır — "çıkış girişten sessiz" ilkesi burada bu fade ile sağlanır.
const SLIDE_SPRING = { type: 'spring', stiffness: 350, damping: 35 } as const;

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: `${dir * 100}%`, opacity: dir === 0 ? 1 : 0.4 }),
  center: {
    x: '0%',
    opacity: 1,
    transition: { x: SLIDE_SPRING, opacity: { duration: 0.15 } },
  },
  exit: (dir: number) => ({
    x: `${dir * -100}%`,
    opacity: 0.4,
    transition: { x: SLIDE_SPRING, opacity: { duration: 0.15 } },
  }),
};

// prefers-reduced-motion: kayma yok, salt opacity.
const fadeVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

// Adım tamamlandığında yeşil check'in okunması için bekleme — süre hareket
// değil zamanlama olduğundan reduced-motion'da da korunur.
const DONE_BEAT_MS = 900;

/**
 * Sidebar footer'ındaki kompakt "Başlarken" kartı — kurulum adımlarını tek
 * slayt halinde gösterir; ok/nokta ile gezilir, adım tamamlanınca kendiliğinden
 * sonraki eksik adıma kayar. Beyaz sidebar yüzeyinde ikinci seviye `bg-muted`
 * zemin (çerçevesiz/gölgesiz — DESIGN.md kart-içinde-kart kuralı); bu yüzden
 * içteki tüm hover yüzeyleri `hover:bg-card`. Daraltılmış ikon modunda kart
 * tamamen gizlenir. İlerleme ayrı bir sayaçta değil dot'larda yaşar:
 * tamamlanan adımın dot'u koyu mürekkep tonuna döner, aktif dot hap olur.
 */
export function OnboardingCard() {
  const { steps, total, loading, retired, dismiss } = useOnboardingSteps();
  const prefersReducedMotion = useReducedMotion();

  // index + yön tek state'te: AnimatePresence custom'ı her geçişte tutarlı.
  // null = henüz konumlanmadı; dir 0 + initial={false} → ilk boyamada animasyon yok.
  const [slide, setSlide] = useState<[index: number, dir: number] | null>(null);
  // Son adım da bitti → beat oynadı, kart çıkış animasyonuyla emekli oluyor.
  const [finished, setFinished] = useState(false);
  // Slayt viewport'unun animasyonlu yüksekliği; 'auto' = ilk ölçüm öncesi.
  const [viewportHeight, setViewportHeight] = useState<number | 'auto'>('auto');

  const advanceTimerRef = useRef<number | null>(null);
  const prevDoneRef = useRef<boolean[] | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const clearAdvanceTimer = useCallback(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }, []);

  // Aktif slaytın içeriğini ölçer; içerik sarma/font yüklenmesiyle değişirse
  // ResizeObserver yeniden ölçer. Çıkan slaytın unmount'unda gelen null'u
  // yoksayarız: giren slayt observer'ı çoktan devralmıştır (AnimatePresence
  // önce yeniyi mount eder, eskiyi sonra kaldırır).
  const setMeasureEl = useCallback((el: HTMLDivElement | null) => {
    if (el === null) return;
    resizeObserverRef.current?.disconnect();
    setViewportHeight(el.offsetHeight);
    const observer = new ResizeObserver(() => {
      setViewportHeight(el.offsetHeight);
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => () => resizeObserverRef.current?.disconnect(), []);

  // İlk konum: loading bittiğinde bir kez, ilk eksik adıma. Daha erken
  // hesaplamak yanlış adıma düşürür (threshold hook'u varsayılanla başlar).
  // Açılışta her şey zaten bitmişse slide hiç set edilmez → kart hiç açılmaz
  // (mezuniyet bayrağını hook yazar, sonraki oturumlarda retired=true).
  useEffect(() => {
    if (loading || slide !== null) return;
    const first = firstIncompleteIndex(steps);
    if (first === -1) return;
    setSlide([first, 0]);
    prevDoneRef.current = steps.map(s => s.done);
  }, [loading, slide, steps]);

  const goTo = useCallback(
    (next: number) => {
      clearAdvanceTimer(); // kullanıcı niyeti bekleyen otomatik kaymayı iptal eder
      setSlide(prev => {
        if (!prev) return prev;
        const [current] = prev;
        if (next === current || next < 0 || next >= total) return prev;
        return [next, next > current ? 1 : -1];
      });
    },
    [clearAdvanceTimer, total],
  );

  // Done beat: aktif slayttaki adım false→true olursa check'i göster,
  // DONE_BEAT_MS sonra sonraki eksik adıma kay (kalmadıysa kartı bitir).
  // Aktif olmayan slaytların tamamlanması index'i OYNATMAZ.
  useEffect(() => {
    if (slide === null || prevDoneRef.current === null) return;
    const [index] = slide;
    const prevDone = prevDoneRef.current;
    prevDoneRef.current = steps.map(s => s.done);

    if (!prevDone[index] && steps[index].done && advanceTimerRef.current === null) {
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        const next = nextIncompleteIndex(steps, index);
        if (next === -1) {
          if (firstIncompleteIndex(steps) === -1) setFinished(true);
        } else {
          setSlide([next, 1]);
        }
      }, DONE_BEAT_MS);
    }
  }, [steps, slide]);

  useEffect(() => clearAdvanceTimer, [clearAdvanceTimer]);

  const handleDotKeys = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (slide === null) return;
      const [index] = slide;
      let next: number | null = null;
      if (e.key === 'ArrowLeft') next = Math.max(index - 1, 0);
      else if (e.key === 'ArrowRight') next = Math.min(index + 1, total - 1);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = total - 1;
      if (next === null) return;
      e.preventDefault();
      goTo(next);
      dotRefs.current[next]?.focus();
    },
    [slide, total, goTo],
  );

  if (retired || loading || slide === null) return null;

  const [index, dir] = slide;
  const step = steps[index];

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <AnimatePresence initial={false}>
        {!finished && (
          <motion.section
            aria-label="Başlarken kurulum adımları"
            exit={{ opacity: 0, height: 0, transition: { duration: prefersReducedMotion ? 0 : 0.2 } }}
            className="overflow-hidden rounded-lg bg-muted"
          >
            <div className="p-3">
              {/* Başlık satırı: eyebrow + kapat (ilerleme sayacı yok — dot'larda) */}
              <div className="flex items-center">
                <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Başlarken
                </p>
                <button
                  type="button"
                  aria-label="Kurulum kartını kapat"
                  onClick={dismiss}
                  className="-mr-1 ml-auto rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>

              {/* Slayt viewport'u — yükseklik aktif slaytın içeriğine spring
                  ile uyar; slaytlar absolute, tam genişlikte kayar. */}
              <motion.div
                animate={{ height: viewportHeight }}
                transition={prefersReducedMotion ? { duration: 0 } : SLIDE_SPRING}
                className="relative mt-2 overflow-hidden"
              >
                <AnimatePresence initial={false} custom={dir}>
                  <motion.div
                    key={step.key}
                    custom={dir}
                    variants={prefersReducedMotion ? fadeVariants : slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    role="group"
                    aria-roledescription="slayt"
                    aria-label={`${index + 1} / ${total}`}
                    className="absolute inset-x-0 top-0"
                  >
                    <div ref={setMeasureEl}>
                      <Link
                        href={step.href}
                        className="group/step flex items-start gap-2 rounded-md p-2 transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span
                          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums ${
                            step.done
                              ? 'bg-success text-success-foreground'
                              : 'border border-hairline bg-card text-muted-foreground'
                          }`}
                        >
                          <AnimatePresence initial={false} mode="popLayout">
                            {step.done ? (
                              <motion.span
                                key="check"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                                className="flex"
                              >
                                <Check className="size-3" aria-hidden />
                              </motion.span>
                            ) : (
                              <motion.span
                                key="num"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: 'spring', stiffness: 350, damping: 35 }}
                              >
                                {index + 1}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </span>

                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-medium leading-snug ${
                              step.done ? 'text-muted-foreground line-through' : 'text-foreground'
                            }`}
                          >
                            {step.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                            {step.description}
                          </span>
                        </span>

                        <ChevronRight
                          className="mt-1 size-3 shrink-0 text-muted-foreground transition-colors duration-150 group-hover/step:text-foreground"
                          aria-hidden
                        />
                      </Link>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* Ekran okuyucu duyurusu — animasyonlu viewport'un DIŞINDA:
                  geçişte iki slayt birden DOM'da, çift okuma olmasın. */}
              <p className="sr-only" aria-live="polite">
                {`Adım ${index + 1}/${total}: ${step.title}`}
              </p>

              {/* Kontroller: dot grubu (roving tabindex) + oklar. Dot'lar hem
                  konumu hem ilerlemeyi taşır: aktif = hap (layout morph),
                  tamamlandı = koyu mürekkep, bekliyor = hairline. Durum rengi
                  değil veri-mürekkep tonu — DESIGN durum-renk bütçesi korunur. */}
              <div className="mt-1 flex items-center justify-between">
                <div
                  role="group"
                  aria-label="Adım seçici"
                  className="-ml-1 flex items-center"
                  onKeyDown={handleDotKeys}
                >
                  {steps.map((s, i) => (
                    <button
                      key={s.key}
                      type="button"
                      ref={el => {
                        dotRefs.current[i] = el;
                      }}
                      tabIndex={i === index ? 0 : -1}
                      aria-current={i === index ? 'step' : undefined}
                      aria-label={`Adım ${i + 1}: ${s.title}${s.done ? ' (tamamlandı)' : ''}`}
                      onClick={() => goTo(i)}
                      className="flex h-8 w-4 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {i === index ? (
                        <motion.span
                          layoutId={prefersReducedMotion ? undefined : 'onboarding-active-dot'}
                          transition={SLIDE_SPRING}
                          className="h-1.5 w-3.5 rounded-full bg-foreground"
                        />
                      ) : (
                        <span
                          className={`size-1.5 rounded-full transition-colors duration-150 ${
                            s.done ? 'bg-muted-foreground' : 'bg-hairline'
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>

                <div className="-mr-1 flex items-center">
                  <button
                    type="button"
                    aria-label="Önceki adım"
                    disabled={index === 0}
                    onClick={() => goTo(index - 1)}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Sonraki adım"
                    disabled={index === total - 1}
                    onClick={() => goTo(index + 1)}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
