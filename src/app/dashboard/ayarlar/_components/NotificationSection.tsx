'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { isAxiosError } from 'axios';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ApiRequests } from '@/lib/api-requests';
import type { DigestFrequency } from '@/lib/digest/schedule';
import { EASE_OUT, INSTANT, springOrInstant } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dropdown, OptionButton } from '@/components/shared/filters/Dropdown';
import { SegmentedTrack } from '@/components/shared/tool-track';
import { SettingsSection } from './SettingsSection';
import { StatusText } from './StatusText';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FREQUENCY_OPTIONS: ReadonlyArray<{ value: DigestFrequency; label: string }> = [
  { value: 'off', label: 'Kapalı' },
  { value: 'daily', label: 'Günlük' },
  { value: 'weekly', label: 'Haftalık' },
];

/** 0=Pazar … 6=Cumartesi (sunucuyla aynı); menüde Pazartesi'den başlar. */
const WEEKDAY_LABELS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

interface NotificationSettings {
  notificationEmail: string | null;
  emailNotifications: boolean;
  digestFrequency: DigestFrequency;
  digestWeekday: number;
  digestHour: number;
  timezone: string;
}

interface NotificationSectionProps {
  token: string;
  initialSettings: NotificationSettings | null;
}

function FieldLabel({ children, htmlFor, disabled }: { children: ReactNode; htmlFor?: string; disabled?: boolean }) {
  const className = disabled
    ? 'mb-1 block text-xs text-muted-foreground/50 transition-colors duration-150'
    : 'mb-1 block text-xs text-muted-foreground transition-colors duration-150';
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <p className={className}>{children}</p>
  );
}

/**
 * Aç/kapa bölge: yükseklik 0↔auto kanonik spring, içerik 150ms'de belirir,
 * kapanışta ~100ms'de söner; yalnız hareket sırasında kırpar (odak halkası
 * dinlenmede taşabilsin). `-mt-4 pt-4`: kapalıyken kolonun gap'i de kapansın.
 * Reduced-motion: anlık.
 */
function Collapse({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ height: 0, overflow: 'hidden' }}
      animate={{ height: 'auto', transitionEnd: { overflow: 'visible' } }}
      exit={{ height: 0, overflow: 'hidden' }}
      transition={springOrInstant(reduceMotion)}
      className="-mt-4"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: reduceMotion ? INSTANT : { duration: 0.15, ease: EASE_OUT } }}
        exit={{ opacity: 0, transition: reduceMotion ? INSTANT : { duration: 0.1, ease: EASE_OUT } }}
        className="pt-4"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * E-posta bildirim ayarları bölümü: anlık uyarılar (kritik stok / ölü stok /
 * satış artışı — sync sonrası değerlendirilir) ve zamanlanmış özet raporu
 * (günlük/haftalık, /api/cron/digest). İkisi aynı adrese gider. Veri fetch'i
 * sayfa hook'unda (use-ayarlar-data).
 */
export function NotificationSection({ token, initialSettings }: NotificationSectionProps) {
  const initial = {
    email: initialSettings?.notificationEmail ?? '',
    alerts: initialSettings?.emailNotifications ?? false,
    frequency: initialSettings?.digestFrequency ?? ('off' as DigestFrequency),
    weekday: initialSettings?.digestWeekday ?? 1,
    hour: initialSettings?.digestHour ?? 9,
  };
  const timezone = initialSettings?.timezone ?? null;

  const [email, setEmail] = useState(initial.email);
  const [alerts, setAlerts] = useState(initial.alerts);
  const [frequency, setFrequency] = useState(initial.frequency);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [hour, setHour] = useState(initial.hour);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  // Hata, adres değiştirilip alan terk edilince görünür (yazarken erken bağırmasın); sonra canlı güncellenir.
  const [emailTouched, setEmailTouched] = useState(false);

  const digestOn = frequency !== 'off';
  const emailNeeded = alerts || digestOn;
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const emailIssue =
    emailNeeded && emailTouched && !emailValid
      ? email.trim()
        ? 'Geçerli bir e-posta adresi girin (ör. ornek@magaza.com).'
        : 'Bildirim adresi gerekli.'
      : null;
  const dirty =
    email.trim() !== saved.email ||
    alerts !== saved.alerts ||
    frequency !== saved.frequency ||
    weekday !== saved.weekday ||
    hour !== saved.hour;

  const edit = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setMessage(null);
  };

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    const trimmed = email.trim();
    const next = {
      email: trimmed,
      alerts: alerts && Boolean(trimmed),
      frequency: trimmed ? frequency : ('off' as DigestFrequency),
      weekday,
      hour,
    };
    try {
      const res = await ApiRequests.merchantSettings.update(token, {
        notificationEmail: trimmed || null,
        emailNotifications: next.alerts,
        digestFrequency: next.frequency,
        digestWeekday: next.weekday,
        digestHour: next.hour,
      });
      if (res.status === 200) {
        setSaved(next);
        setMessage({ text: 'Kaydedildi', isError: false });
      } else {
        setMessage({ text: 'Kaydedilemedi', isError: true });
      }
    } catch {
      setMessage({ text: 'Kaydedilemedi — e-posta adresini kontrol edin.', isError: true });
    } finally {
      setSaving(false);
    }
  }, [token, email, alerts, frequency, weekday, hour]);

  const sendTest = useCallback(async () => {
    if (saved.frequency === 'off') return;
    setTesting(true);
    setMessage(null);
    try {
      const res = await ApiRequests.digest.sendTest(token, { frequency: saved.frequency });
      const sentTo = res.data?.data?.sentTo;
      setMessage({ text: sentTo ? `Örnek gönderildi: ${sentTo}` : 'Örnek gönderildi', isError: false });
    } catch (error) {
      const serverError = isAxiosError(error)
        ? (error.response?.data as { error?: string } | undefined)?.error
        : undefined;
      setMessage({ text: serverError ?? 'Örnek gönderilemedi.', isError: true });
    } finally {
      setTesting(false);
    }
  }, [token, saved.frequency]);

  const scheduleText =
    frequency === 'daily'
      ? `Her gün, saat ${formatHour(hour)} itibarıyla bir önceki günün özeti gönderilir.`
      : `Her ${WEEKDAY_LABELS[weekday]}, saat ${formatHour(hour)} itibarıyla son 7 günün özeti gönderilir.`;

  return (
    <SettingsSection
      id="bildirim-ayarlari"
      eyebrow="BİLDİRİM"
      title="E-posta bildirimleri"
      description="Kritik stok, ölü stok ve satış artışı uyarıları uygulama içinde her zaman görünür; dilerseniz anlık uyarıları ve düzenli bir özet raporunu e-postayla alın."
    >
      <label className="flex min-h-10 w-fit cursor-pointer items-center gap-3 text-sm text-foreground">
        <Switch checked={alerts} onCheckedChange={edit(setAlerts)} aria-label="Anlık uyarıları e-postayla gönder" />
        Anlık uyarıları e-postayla gönder
      </label>

      <div>
        <FieldLabel>Özet raporu</FieldLabel>
        <SegmentedTrack
          options={FREQUENCY_OPTIONS}
          value={frequency}
          onChange={edit(setFrequency)}
          aria-label="Özet raporu sıklığı"
        />
      </div>

      <AnimatePresence initial={false}>
        {digestOn && (
          <Collapse key="digest-schedule">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                {frequency === 'weekly' && (
                  <div role="group" aria-label="Özet günü">
                    <FieldLabel>Gün</FieldLabel>
                    <Dropdown label={WEEKDAY_LABELS[weekday]} active>
                      {close =>
                        WEEKDAY_ORDER.map(day => (
                          <OptionButton
                            key={day}
                            label={WEEKDAY_LABELS[day]}
                            selected={weekday === day}
                            onClick={() => {
                              edit(setWeekday)(day);
                              close();
                            }}
                          />
                        ))
                      }
                    </Dropdown>
                  </div>
                )}
                <div role="group" aria-label="Özet saati">
                  <FieldLabel>Saat</FieldLabel>
                  <Dropdown label={formatHour(hour)} active panelClassName="max-h-72 min-w-[140px] overflow-y-auto">
                    {close =>
                      HOURS.map(h => (
                        <OptionButton
                          key={h}
                          label={formatHour(h)}
                          selected={hour === h}
                          onClick={() => {
                            edit(setHour)(h);
                            close();
                          }}
                        />
                      ))
                    }
                  </Dropdown>
                </div>
              </div>
              <p className="text-pretty text-xs text-muted-foreground">
                {scheduleText}
                {timezone ? ` Saatler mağaza saat dilimindedir (${timezone}).` : null}
              </p>
            </div>
          </Collapse>
        )}
      </AnimatePresence>

      <div className="max-w-sm">
        <FieldLabel htmlFor="notifEmail" disabled={!emailNeeded}>
          Bildirim adresi
        </FieldLabel>
        <Input
          id="notifEmail"
          type="email"
          value={email}
          disabled={!emailNeeded}
          onChange={e => edit(setEmail)(e.target.value)}
          onBlur={() => {
            // Yalnız gezinip geçmek (değer değişmeden) hata sayılmaz.
            if (email.trim() !== saved.email) setEmailTouched(true);
          }}
          placeholder="ornek@magaza.com"
          aria-invalid={emailIssue ? true : undefined}
          aria-describedby={emailIssue ? 'notifEmail-issue' : undefined}
        />
        {emailIssue && (
          <p id="notifEmail-issue" className="mt-1 text-xs text-destructive">
            {emailIssue}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !dirty || (emailNeeded && !emailValid)}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </Button>
        {saved.frequency !== 'off' && (
          <Button
            type="button"
            variant="outline"
            onClick={sendTest}
            disabled={testing || dirty || !saved.email}
            title={dirty ? 'Önce değişiklikleri kaydedin' : undefined}
          >
            {testing ? 'Gönderiliyor…' : 'Örnek özet gönder'}
          </Button>
        )}
        <span aria-live="polite">
          {message && (
            <StatusText key={message.text} tone={message.isError ? 'error' : 'muted'}>
              {message.text}
            </StatusText>
          )}
        </span>
      </div>
    </SettingsSection>
  );
}
