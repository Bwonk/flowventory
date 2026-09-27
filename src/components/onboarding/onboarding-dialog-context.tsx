'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { consumeFirstLanding } from '@/lib/onboarding';
import { OnboardingDialog } from './OnboardingDialog';

interface OnboardingDialogContextValue {
  /** Başlarken popup'ını aç; `step` verilirse o adımdan (1 tabanlı). */
  openOnboarding: (step?: number) => void;
}

const OnboardingDialogContext = createContext<OnboardingDialogContextValue | null>(null);

export function useOnboardingDialog(): OnboardingDialogContextValue {
  const ctx = useContext(OnboardingDialogContext);
  if (!ctx) throw new Error('useOnboardingDialog, OnboardingDialogProvider içinde kullanılmalı');
  return ctx;
}

/**
 * Başlarken popup'ının tek örneği (dashboard layout'unda). Tetikleyiciler:
 * sidebar "Başlarken" satırı, kilit ekranı ve Ayarlar "Planı gör" (plan
 * adımına), bir de ilk açılış (rehber bitmemişse kendiliğinden açılır).
 */
export function OnboardingDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);

  const openOnboarding = useCallback((initialStep = 1) => {
    setStep(initialStep);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (consumeFirstLanding()) openOnboarding();
  }, [openOnboarding]);

  const value = useMemo(() => ({ openOnboarding }), [openOnboarding]);

  return (
    <OnboardingDialogContext.Provider value={value}>
      {children}
      <OnboardingDialog open={open} onOpenChange={setOpen} step={step} onStepChange={setStep} />
    </OnboardingDialogContext.Provider>
  );
}
