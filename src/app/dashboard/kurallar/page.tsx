'use client';

import { useCallback, useEffect, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/shared/ErrorState';
import { KurallarSkeleton } from './_components/KurallarSkeleton';
import { NewRuleMenu } from './_components/NewRuleMenu';
import { RulesList } from './_components/RulesList';
import { useTrackingRules } from './hooks/use-tracking-rules';

/**
 * Kurallar sayfası — liste + "Yeni kural ekle" menüsü. Oluşturma/düzenleme
 * ayrı rotalarda (yeni, [id]); bu sayfa yalnız listeyi yönetir.
 */
export default function KurallarPage() {
  const [token, setToken] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const initialize = useCallback(async () => {
    setInitializing(true);
    setInitError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (!fetchedToken) {
        setInitError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const res = await ApiRequests.merchantSettings.get(fetchedToken).catch(() => null);
      setNotificationEmail(res?.data?.data?.notificationEmail ?? null);
    } catch (error) {
      logger.error('Error initializing rules page', { error });
      setInitError('Beklenmeyen bir hata oluştu.');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (initializing) return <KurallarSkeleton />;
  if (initError || !token) return <ErrorState description={initError ?? 'Sayfa yüklenemedi.'} onRetry={initialize} />;

  return <KurallarContent token={token} notificationEmail={notificationEmail} />;
}

function KurallarContent({ token, notificationEmail }: { token: string; notificationEmail: string | null }) {
  const { rules, loading, error, reload, toggle, remove } = useTrackingRules(token);
  const [menuOpen, setMenuOpen] = useState(false);

  if (error) return <ErrorState description="Kurallar alınamadı." onRetry={reload} />;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="TAKİP"
        title="Kurallar"
        description="Koşul tanımlayın; sağlanınca zilde bildirim ya da e-posta alın. Kurallar veri yenilendikçe ve saatte bir değerlendirilir."
        actions={<NewRuleMenu notificationEmail={notificationEmail} open={menuOpen} onOpenChange={setMenuOpen} />}
      />
      <RulesList rules={rules} loading={loading} onToggle={toggle} onDelete={remove} onCreateFirst={() => setMenuOpen(true)} />
    </PageContainer>
  );
}
