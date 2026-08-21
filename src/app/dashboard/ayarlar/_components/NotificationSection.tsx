'use client';

import { useCallback, useState } from 'react';
import { ApiRequests } from '@/lib/api-requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from './SettingsSection';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NotificationSectionProps {
  token: string;
  initialSettings: {
    notificationEmail: string | null;
    emailNotifications: boolean;
  } | null;
}

/**
 * E-posta bildirim ayarları bölümü. Kritik stok / ölü stok / satış artışı
 * uyarıları sync sonrası değerlendirilir; buradan adres ve açık/kapalı
 * durumu yönetilir. Veri fetch'i sayfa hook'unda (use-ayarlar-data).
 */
export function NotificationSection({ token, initialSettings }: NotificationSectionProps) {
  const [email, setEmail] = useState(initialSettings?.notificationEmail ?? '');
  const [enabled, setEnabled] = useState(initialSettings?.emailNotifications ?? false);
  const [savedSnapshot, setSavedSnapshot] = useState({
    email: initialSettings?.notificationEmail ?? '',
    enabled: initialSettings?.emailNotifications ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const emailValid = EMAIL_PATTERN.test(email.trim());
  const dirty = email.trim() !== savedSnapshot.email || enabled !== savedSnapshot.enabled;

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const trimmed = email.trim();
    try {
      const res = await ApiRequests.merchantSettings.update(token, {
        notificationEmail: trimmed || null,
        emailNotifications: enabled && Boolean(trimmed),
      });
      if (res.status === 200) {
        setSavedSnapshot({ email: trimmed, enabled });
        setMessage({ text: 'Kaydedildi', isError: false });
      } else {
        setMessage({ text: 'Kaydedilemedi', isError: true });
      }
    } catch {
      setMessage({ text: 'Kaydedilemedi — e-posta adresini kontrol edin.', isError: true });
    } finally {
      setSaving(false);
    }
  }, [token, email, enabled]);

  return (
    <SettingsSection
      id="bildirim-ayarlari"
      eyebrow="BİLDİRİM"
      title="E-posta bildirimleri"
      description="Kritik stok, ölü stok ve satış artışı uyarıları uygulama içinde her zaman görünür; dilerseniz e-posta olarak da alın."
    >
      <label className="flex min-h-10 w-fit cursor-pointer items-center gap-3 text-sm text-foreground">
        <Switch
          checked={enabled}
          onCheckedChange={value => {
            setEnabled(value);
            setMessage(null);
          }}
          aria-label="E-posta bildirimlerini aç"
        />
        E-posta bildirimlerini aç
      </label>

      <div className="max-w-sm">
        <label
          htmlFor="notifEmail"
          className={
            enabled
              ? 'mb-1 block text-xs text-muted-foreground transition-colors duration-150'
              : 'mb-1 block text-xs text-muted-foreground/50 transition-colors duration-150'
          }
        >
          Bildirim adresi
        </label>
        <Input
          id="notifEmail"
          type="email"
          value={email}
          disabled={!enabled}
          onChange={e => {
            setEmail(e.target.value);
            setMessage(null);
          }}
          placeholder="ornek@magaza.com"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={save}
          disabled={saving || !dirty || (enabled && !emailValid)}
          className="self-start"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        <span aria-live="polite">
          {message && (
            <span className={message.isError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {message.text}
            </span>
          )}
        </span>
      </div>
    </SettingsSection>
  );
}
