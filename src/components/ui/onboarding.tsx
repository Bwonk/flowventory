'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import { AnimatedNumber } from '@/components/shared/AnimatedNumber';
import { PRESS_FEEDBACK_CLASS, SPRING, springOrInstant } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * Kurulum rehberi (checklist) — cult-ui `onboarding` uyarlaması
 * (github.com/nolly-studio/cult-ui, registry/default/ui/onboarding.tsx).
 *
 * Upstream doğrusal bir ilk açılış sihirbazıdır (İleri/Geri, aktif olmayan
 * adım unmount). Burada korunanlar: compound API, `data-slot` kancaları,
 * controlled/uncontrolled açık adım (upstream'in `useControllableState`'i
 * yerine küçük yerel eşdeğeri — `radix-ui/internal` bu projenin
 * moduleResolution'ında çözülmüyor) ve
 * `role="progressbar"` pill göstergesi. Değişen: adımların her biri kendi
 * `done` durumunu taşır (sıradan bağımsız), adımlar akordeon öğesidir (tek
 * adım açık, yükseklik geçişli), açık adım tamamlanınca kısa bir bekleyişten
 * sonra sıradaki eksik adım açılır. Görsel dil DESIGN.md'ye çevrildi: hairline
 * kart, gölgesiz, serif başlık / rounded-xl buton / transition-all yok;
 * hareket `src/lib/motion.ts` token'larından. Upstream'in FeatureCarousel,
 * TipsList, ChoiceGroup ve doğrusal Navigation parçaları alınmadı.
 */

export interface OnboardingStepState {
  key: string;
  done: boolean;
}

interface OnboardingContextValue {
  steps: ReadonlyArray<OnboardingStepState>;
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
  doneCount: number;
  total: number;
  baseId: string;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('Onboarding parçaları <Onboarding> içinde kullanılmalı');
  return ctx;
}

/**
 * Açık adım tamamlandığında açılacak sıradaki adım: önce ondan SONRAKİ ilk
 * eksik adım, yoksa baştan ilk eksik adım; hiç eksik yoksa null.
 */
export function nextOpenKey(
  steps: ReadonlyArray<OnboardingStepState>,
  fromKey: string,
): string | null {
  const from = steps.findIndex(s => s.key === fromKey);
  const after = steps.slice(from + 1).find(s => !s.done);
  if (after) return after.key;
  return steps.find(s => !s.done)?.key ?? null;
}

// Tamamlanan adımın tikinin okunması için bekleme — hareket değil zamanlama
// olduğundan reduced-motion'da da korunur (eski sidebar kartıyla aynı süre).
const DEFAULT_ADVANCE_DELAY_MS = 900;

/** Controlled (`value` verildiyse) ya da iç state; her değişimde `onChange`. */
function useControllableValue<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const setValue = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      if (next !== current) onChange?.(next);
    },
    [controlled, current, onChange],
  );
  return [current, setValue] as const;
}

// ─── Root ─────────────────────────────────────────────────────────────────

export interface OnboardingProps extends Omit<ComponentPropsWithoutRef<'section'>, 'defaultValue'> {
  steps: ReadonlyArray<OnboardingStepState>;
  /** Açık adımın key'i (controlled); null = hepsi kapalı. */
  value?: string | null;
  /** Uncontrolled başlangıç; verilmezse ilk eksik adım. */
  defaultValue?: string | null;
  onValueChange?: (key: string | null) => void;
  /** Tüm adımlar bu oturumda tamamlandığında bir kez (açılışta zaten bitmişse çağrılmaz). */
  onComplete?: () => void;
  /** Açık adım tamamlanınca sıradakine geçmeden önceki bekleme; 0 = otomatik geçiş yok. */
  advanceDelayMs?: number;
}

function OnboardingRoot({
  steps,
  value,
  defaultValue,
  onValueChange,
  onComplete,
  advanceDelayMs = DEFAULT_ADVANCE_DELAY_MS,
  className,
  children,
  ...props
}: OnboardingProps) {
  const baseId = useId();
  const [openKey, setOpenKey] = useControllableValue<string | null>(
    value,
    defaultValue !== undefined ? defaultValue : (steps.find(s => !s.done)?.key ?? null),
    onValueChange,
  );

  const doneCount = steps.filter(s => s.done).length;
  const total = steps.length;

  // Zamanlayıcı geri çağrısı en güncel adımları ve callback'leri okusun diye.
  const latestRef = useRef({ steps, setOpenKey, onComplete });
  useEffect(() => {
    latestRef.current = { steps, setOpenKey, onComplete };
  });

  // Açık adım false→true olduysa bekle, sonra sıradaki eksik adımı aç. Açık
  // olmayan adımların tamamlanması açık adımı oynatmaz. Zamanlayıcı ref'te:
  // `steps` her render'da yeni dizi geldiğinden effect temizliğine bağlansa
  // her yeniden render'da iptal olurdu (ve geçiş bir daha tetiklenmezdi).
  const prevDoneRef = useRef<Map<string, boolean> | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevDoneRef.current;
    prevDoneRef.current = new Map(steps.map(s => [s.key, s.done]));
    if (prev === null) return;

    const wasAllDone = prev.size > 0 && [...prev.values()].every(Boolean);
    if (!wasAllDone && total > 0 && doneCount === total) latestRef.current.onComplete?.();

    if (advanceDelayMs <= 0 || openKey === null || advanceTimerRef.current !== null) return;
    const openStep = steps.find(s => s.key === openKey);
    if (!openStep?.done || prev.get(openKey) !== false) return;

    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      const latest = latestRef.current;
      latest.setOpenKey(nextOpenKey(latest.steps, openKey));
    }, advanceDelayMs);
  }, [steps, openKey, advanceDelayMs, doneCount, total]);

  // Açık adım değişince (kullanıcı başka adımı açtı) ya da unmount'ta bekleyen
  // otomatik geçiş iptal — kullanıcı niyeti önceliklidir.
  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    },
    [openKey],
  );

  const context = useMemo<OnboardingContextValue>(
    () => ({ steps, openKey, setOpenKey, doneCount, total, baseId }),
    [steps, openKey, setOpenKey, doneCount, total, baseId],
  );

  return (
    <OnboardingContext.Provider value={context}>
      <section
        data-slot="onboarding"
        className={cn('overflow-hidden rounded-lg border border-hairline bg-card', className)}
        {...props}
      >
        {children}
      </section>
    </OnboardingContext.Provider>
  );
}

// ─── Header / Progress / StepIndicator ────────────────────────────────────

function OnboardingHeader({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="onboarding-header"
      className={cn('flex h-12 items-center justify-between gap-3 border-b border-hairline px-5', className)}
      {...props}
    />
  );
}

function OnboardingTitle({ className, ...props }: ComponentPropsWithoutRef<'h2'>) {
  return (
    <h2
      data-slot="onboarding-title"
      className={cn('text-sm font-medium text-foreground', className)}
      {...props}
    />
  );
}

/** "2 / 4 tamamlandı" — mono eyebrow dilinde, sayı yön farkındalıklı kayar. */
function OnboardingProgress({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  const { doneCount, total } = useOnboarding();
  return (
    <p
      data-slot="onboarding-progress"
      className={cn(
        'shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground tabular-nums',
        className,
      )}
      {...props}
    >
      <AnimatedNumber value={doneCount} /> / {total} tamamlandı
    </p>
  );
}

/**
 * İlerleme pill'leri — durum rengi değil mürekkep tonu (eski sidebar kartının
 * nokta dili): tamam `bg-muted-foreground`, açık adım `bg-foreground`,
 * bekliyor `bg-hairline`.
 */
function OnboardingStepIndicator({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  const { steps, openKey, doneCount, total } = useOnboarding();
  return (
    <div
      data-slot="onboarding-step-indicator"
      role="progressbar"
      aria-label={`Kurulum ilerlemesi: ${doneCount}/${total}`}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={doneCount}
      className={cn('flex items-center gap-1', className)}
      {...props}
    >
      {steps.map(step => {
        const state = step.done ? 'completed' : step.key === openKey ? 'active' : 'inactive';
        return (
          <span
            key={step.key}
            data-slot="onboarding-step-dot"
            data-state={state}
            className="h-1 max-w-8 flex-1 rounded-full bg-hairline transition-colors duration-150 data-[state=active]:bg-foreground data-[state=completed]:bg-muted-foreground"
          />
        );
      })}
    </div>
  );
}

// ─── Steps / Step ─────────────────────────────────────────────────────────

const TRIGGER_SELECTOR = '[data-slot="onboarding-step-trigger"]';

/** Adım listesi — ↑/↓/Home/End adım başlıkları arasında gezdirir. */
function OnboardingSteps({ className, onKeyDown, ...props }: ComponentPropsWithoutRef<'ol'>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLOListElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const triggers = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>(TRIGGER_SELECTOR));
    const current = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = Math.min(current + 1, triggers.length - 1);
    else if (e.key === 'ArrowUp') next = Math.max(current - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = triggers.length - 1;
    if (next === null) return;
    e.preventDefault();
    triggers[next]?.focus();
  };

  return (
    <ol
      data-slot="onboarding-steps"
      className={cn('divide-y divide-hairline', className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

/** Numara ↔ tik rozeti; tik yeşili yalnız burada (DESIGN.md §5). */
function StepBadge({ number, done }: { number: number; done: boolean }) {
  const reduceMotion = useReducedMotion();
  const swap = {
    initial: { opacity: 0, scale: 0.8 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
    transition: springOrInstant(reduceMotion),
  };
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums transition-colors duration-150',
        done ? 'bg-success text-success-foreground' : 'border border-hairline bg-card text-muted-foreground',
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {done ? (
          <motion.span key="check" className="flex" {...swap}>
            <Check className="size-3" />
          </motion.span>
        ) : (
          <motion.span key="num" {...swap}>
            {number}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export interface OnboardingStepProps extends Omit<ComponentPropsWithoutRef<'li'>, 'title'> {
  stepKey: string;
  title: ReactNode;
}

function OnboardingStep({ stepKey, title, className, children, ...props }: OnboardingStepProps) {
  const { steps, openKey, setOpenKey, baseId } = useOnboarding();
  const reduceMotion = useReducedMotion();
  const index = steps.findIndex(s => s.key === stepKey);
  const done = steps[index]?.done ?? false;
  const open = openKey === stepKey;
  const triggerId = `${baseId}-${stepKey}-trigger`;
  const panelId = `${baseId}-${stepKey}-panel`;

  return (
    <li
      data-slot="onboarding-step"
      data-state={open ? 'open' : 'closed'}
      data-done={done || undefined}
      className={className}
      {...props}
    >
      <h3>
        <button
          type="button"
          id={triggerId}
          data-slot="onboarding-step-trigger"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpenKey(open ? null : stepKey)}
          className={cn(
            'flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            PRESS_FEEDBACK_CLASS,
          )}
        >
          <StepBadge number={index + 1} done={done} />
          <span
            className={cn(
              'min-w-0 flex-1 text-sm font-medium transition-colors duration-150',
              done ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {title}
            {done && <span className="sr-only"> (tamamlandı)</span>}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none',
              open && 'rotate-180',
            )}
          />
        </button>
      </h3>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="panel"
            id={panelId}
            role="region"
            aria-labelledby={triggerId}
            data-slot="onboarding-step-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: reduceMotion ? { duration: 0 } : SPRING,
              opacity: { duration: reduceMotion ? 0 : 0.15 },
            }}
            className="overflow-hidden"
          >
            {/* Girinti rozet + boşlukla hizalı: px-5 (20) + rozet (20) + gap (12). */}
            <div className="pb-4 pl-13 pr-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function OnboardingStepDescription({ className, ...props }: ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      data-slot="onboarding-step-description"
      className={cn('max-w-prose text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function OnboardingStepActions({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="onboarding-step-actions"
      className={cn('mt-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center', className)}
      {...props}
    />
  );
}

export const Onboarding = Object.assign(OnboardingRoot, {
  Header: OnboardingHeader,
  Title: OnboardingTitle,
  Progress: OnboardingProgress,
  StepIndicator: OnboardingStepIndicator,
  Steps: OnboardingSteps,
  Step: OnboardingStep,
  StepDescription: OnboardingStepDescription,
  StepActions: OnboardingStepActions,
});
