'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { RuleDetailApiResponse } from '@/app/api/rules/[id]/route';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import { ErrorState } from '@/components/shared/ErrorState';
import { KurallarSkeleton } from '../_components/KurallarSkeleton';
import { RuleBuilderPage } from '../_components/builder/RuleBuilderPage';

/** /dashboard/kurallar/[id] — mevcut kuralı düzenle + tetik geçmişi. */
export default function KuralDuzenlePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [token, setToken] = useState<string | null>(null);
  const [detail, setDetail] = useState<RuleDetailApiResponse | null>(null);
  const [notificationEmail, setNotificationEmail] = useState<string | null>(null);
  const [leadTimeDays, setLeadTimeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const fetchedToken = await TokenHelpers.getTokenForIframeApp();
      setToken(fetchedToken || null);
      if (!fetchedToken) {
        setError('Oturum doğrulanamadı. Uygulamayı ikas panelinden yeniden açmayı deneyin.');
        return;
      }
      const [ruleRes, settingsRes] = await Promise.all([
        ApiRequests.rules.get(fetchedToken, id),
        ApiRequests.merchantSettings.get(fetchedToken).catch(() => null),
      ]);
      if (ruleRes.status !== 200 || !ruleRes.data?.data) {
        setError('Kural bulunamadı.');
        return;
      }
      setDetail(ruleRes.data.data);
      setNotificationEmail(settingsRes?.data?.data?.notificationEmail ?? null);
      setLeadTimeDays(settingsRes?.data?.data?.leadTimeDays ?? 7);
    } catch (err) {
      logger.error('Error loading rule', { id, error: err });
      setError('Kural alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (loading) return <KurallarSkeleton />;
  if (error || !token || !detail) return <ErrorState description={error ?? 'Kural yüklenemedi.'} onRetry={initialize} />;

  return (
    <RuleBuilderPage
      token={token}
      mode="edit"
      rule={detail.rule}
      template={null}
      notificationEmail={notificationEmail}
      leadTimeDays={leadTimeDays}
    />
  );
}
