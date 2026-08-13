'use client';

import { logger } from '@/lib/logger';
import { useCallback, useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * E-posta bildirim ayarları kartı.
 * Kritik stok / ölü stok / satış artışı uyarıları, sync sonrası
 * değerlendirilir; buradan e-posta adresi ve açık/kapalı durumu yönetilir.
 */
export function NotificationSettingsCard() {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetchedToken = await TokenHelpers.getTokenForIframeApp();
        if (!fetchedToken || cancelled) return;
        setToken(fetchedToken);
        const res = await ApiRequests.merchantSettings.get(fetchedToken);
        const settings = res.data?.data;
        if (settings && !cancelled) {
          setEmail(settings.notificationEmail ?? '');
          setEnabled(settings.emailNotifications);
        }
      } catch (error) {
        logger.error('Error loading notification settings', { error });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await ApiRequests.merchantSettings.update(token, {
        notificationEmail: email.trim() || null,
        emailNotifications: enabled && Boolean(email.trim()),
      });
      if (res.status === 200) {
        setMessage('Kaydedildi.');
      } else {
        setMessage('Kaydedilemedi.');
      }
    } catch {
      setMessage('Kaydedilemedi — e-posta adresini kontrol edin.');
    } finally {
      setSaving(false);
    }
  }, [token, email, enabled]);

  if (loading) return null;

  return (
    <section className="mt-6 rounded-lg border border-hairline bg-card p-6">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-medium text-foreground">E-posta Bildirimleri</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Kritik stok, ölü stok ve satış artışı uyarıları uygulama içinde her zaman görünür;
        dilerseniz e-posta olarak da alın.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          E-posta bildirimlerini aç
        </label>

        <div className="max-w-sm">
          <label htmlFor="notifEmail" className="mb-1 block text-xs text-muted-foreground">
            Bildirim adresi
          </label>
          <Input
            id="notifEmail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ornek@magaza.com"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={saving || (enabled && !email.trim())}
            className="self-start"
          >
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
          {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
      </div>
    </section>
  );
}
