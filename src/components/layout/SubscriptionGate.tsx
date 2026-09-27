'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { hasAccess } from '@/lib/billing/entitlement';
import { useSubscription } from '@/lib/billing/use-subscription';
import { consumeFirstLanding } from '@/lib/onboarding';

const BASLARKEN = '/dashboard/baslarken';
/** Deneme bitse de açık kalan sayfalar: plan yolu ve ayarlar. */
const ALWAYS_OPEN = [BASLARKEN, '/dashboard/ayarlar'];

/**
 * Dashboard içeriğinin kapısı:
 * - İlk açılışta (rehber bitmemişse) Genel Bakış yerine Başlarken açılır.
 * - Deneme bitti ve abonelik yoksa Başlarken/Ayarlar dışındaki sayfalar
 *   yerine kilit ekranı — sessiz 403 değil, ilerleme yolu. Durum
 *   alınamazsa ya da faturalandırma kapalıysa kilit yok (fail-open).
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { summary } = useSubscription();

  useEffect(() => {
    if (pathname === '/dashboard' && consumeFirstLanding()) router.replace(BASLARKEN);
    // Yalnız ilk mount: sonraki gezinmeler yönlendirilmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <Button asChild className="mt-2">
          <Link href={`${BASLARKEN}#abonelik`}>Aboneliği başlat</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
