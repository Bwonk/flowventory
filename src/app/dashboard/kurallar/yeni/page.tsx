'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { findTemplate } from '@/lib/rules/templates';
import { ErrorState } from '@/components/shared/ErrorState';
import { KurallarSkeleton } from '../_components/KurallarSkeleton';
import { RuleBuilderPage } from '../_components/builder/RuleBuilderPage';

/** /dashboard/kurallar/yeni[?template=<key>] — boş kural ya da şablondan taslak. */
function YeniKuralContent() {
  const searchParams = useSearchParams();
  const template = findTemplate(searchParams.get('template'));

  const [token, setToken] = useState<string | null>(null);
  const [notificationEmail, setNotificationEmail] = useState<string | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (!fetchedToken) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const res = await ApiRequests.merchantSettings.get(fetchedToken).catch(() => null);
      setNotificationEmail(res?.data?.data?.notificationEmail ?? null);
      setLeadTimeDays(res?.data?.data?.leadTimeDays ?? 7);
    } catch (err) {
      logger.error('Error initializing new rule page', { error: err });
      setError('Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <KurallarSkeleton />;
  if (error || !token) return <ErrorState description={error ?? 'Sayfa yüklenemedi.'} onRetry={initialize} />;

  return (
    <RuleBuilderPage
      token={token}
      mode="create"
      rule={null}
      template={template}
      notificationEmail={notificationEmail}
      leadTimeDays={leadTimeDays}
    />
  );
}

export default function YeniKuralPage() {
  return (
    <Suspense fallback={<KurallarSkeleton />}>
      <YeniKuralContent />
    </Suspense>
  );
}
