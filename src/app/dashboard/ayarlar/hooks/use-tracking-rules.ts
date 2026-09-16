'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { TrackingRuleItem } from '@/app/api/rules/route';
import { extractErrorMessage } from '@/lib/api-error';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import type { RuleInput } from '@/lib/rules/schema';

/**
 * Takip kuralları veri katmanı — sayfadan bağımsız (ileride ayrı sayfaya
 * taşınabilir). Liste yükleme + oluştur/güncelle/aç-kapa/sil; sonuçlar
 * toast'a düşer, liste yerinde güncellenir.
 */
export function useTrackingRules(token: string) {
  const [rules, setRules] = useState<TrackingRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await ApiRequests.rules.list(token);
      if (res.status !== 200 || !res.data?.data) throw new Error('rules list failed');
      setRules(res.data.data.rules);
    } catch (err) {
      logger.error('Rules load failed', { error: err });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: RuleInput): Promise<boolean> => {
      try {
        const res = await ApiRequests.rules.create(token, input);
        const item = res.data?.data;
        if (!item) throw new Error('empty create response');
        setRules(prev => [item, ...prev]);
        toast.success(`Kural eklendi: ${item.name}`);
        return true;
      } catch (err) {
        logger.error('Rule create failed', { error: err });
        toast.error(extractErrorMessage(err, 'Kural eklenemedi.'));
        return false;
      }
    },
    [token],
  );

  const update = useCallback(
    async (id: string, input: RuleInput): Promise<boolean> => {
      try {
        const res = await ApiRequests.rules.update(token, id, input);
        const item = res.data?.data;
        if (!item) throw new Error('empty update response');
        setRules(prev => prev.map(r => (r.id === id ? item : r)));
        toast.success(`Kural güncellendi: ${item.name}`);
        return true;
      } catch (err) {
        logger.error('Rule update failed', { id, error: err });
        toast.error(extractErrorMessage(err, 'Kural güncellenemedi.'));
        return false;
      }
    },
    [token],
  );

  /** Optimistic aç/kapa; hata olursa geri alınır. */
  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      const prevRules = rules;
      setRules(prev => prev.map(r => (r.id === id ? { ...r, enabled } : r)));
      try {
        const res = await ApiRequests.rules.update(token, id, { enabled });
        if (!res.data?.data) throw new Error('empty toggle response');
      } catch (err) {
        logger.error('Rule toggle failed', { id, error: err });
        setRules(prevRules);
        toast.error(extractErrorMessage(err, 'Kural değiştirilemedi.'));
      }
    },
    [token, rules],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await ApiRequests.rules.delete(token, id);
        setRules(prev => prev.filter(r => r.id !== id));
        return true;
      } catch (err) {
        logger.error('Rule delete failed', { id, error: err });
        toast.error(extractErrorMessage(err, 'Kural silinemedi.'));
        return false;
      }
    },
    [token],
  );

  return { rules, loading, error, reload: load, create, update, toggle, remove };
}
