'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { hasAccess } from '@/lib/billing/entitlement';
import { useSubscription } from '@/lib/billing/use-subscription';
import { useOnboardingDialog } from '@/components/onboarding/onboarding-dialog-context';
import { ONBOARDING_PLAN_STEP } from '@/components/onboarding/OnboardingDialog';

/** Deneme bitse de açık kalan sayfa: ayarlar (plan bölümü orada). */
const ALWAYS_OPEN = ['/dashboard/ayarlar'];

/**
 * Dashboard içeriğinin kapısı: deneme bitti ve abonelik yoksa Ayarlar
 * dışındaki sayfalar yerine kilit ekranı — sessiz 403 değil, ilerleme yolu
 * (CTA Başlarken popup'ını plan adımında açar). Durum alınamazsa ya da
 * faturalandırma kapalıysa kilit yok (fail-open).
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { summary } = useSubscription();
  const { openOnboarding } = useOnboardingDialog();

  const locked =
    summary !== null && !hasAccess(summary.state) && !ALWAYS_OPEN.some(p => pathname.startsWith(p));
  if (!locked) return <>{children}</>;

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <Lock className="size-8 text-hairline" aria-hidden />
        <div>
          <h1 className="text-base font-medium text-foreground">Deneme süren bitti</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stok verilerin ve kuralların saklanıyor. Aboneliği başlatınca kaldığın yerden devam edersin.
          </p>
        </div>
        <Button type="button" className="mt-2" onClick={() => openOnboarding(ONBOARDING_PLAN_STEP)}>
          Planı gör
        </Button>
      </div>
    </PageContainer>
  );
}
