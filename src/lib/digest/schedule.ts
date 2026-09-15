import { dateKeyInTz, hourInTz, shiftDateKey, weekdayInTz } from '@/lib/timezone';

/**
 * Özet raporu zamanlaması — saf fonksiyonlar (test edilebilir).
 *
 * Cron endpoint'i saatte bir çağrılır; hangi merchant'ın o turda özet alacağı
 * burada, merchant'ın kendi saat diliminde karar verilir. Gönderim saatinden
 * sonraki DIGEST_GRACE_HOURS saat içinde her tur "vadesi geldi" der; aynı
 * dönemin iki kez gitmesini DigestLog'daki periodKey tekilliği engeller.
 * Böylece kaçan bir tur (sunucu kapalı, cron gecikmesi) bir sonrakinde telafi edilir.
 */

export const DIGEST_FREQUENCIES = ['off', 'daily', 'weekly'] as const;
export type DigestFrequency = (typeof DIGEST_FREQUENCIES)[number];
export type ActiveDigestFrequency = Exclude<DigestFrequency, 'off'>;

/** Gönderim saatinden sonra kaç saat boyunca telafi denenir. */
export const DIGEST_GRACE_HOURS = 3;

export interface DigestSchedule {
  frequency: DigestFrequency;
  /** 0=Pazar … 6=Cumartesi (yalnız haftalıkta anlamlı). */
  weekday: number;
  /** 0-23, merchant TZ'sinde. */
  hour: number;
}

export function isDigestFrequency(value: unknown): value is DigestFrequency {
  return typeof value === 'string' && (DIGEST_FREQUENCIES as readonly string[]).includes(value);
}

/**
 * Şu an gönderilmesi gereken özetin dönem anahtarı; vadesi gelmemişse null.
 * Anahtar gönderim gününe bağlıdır ("daily:2026-09-10", "weekly:2026-09-07").
 */
export function dueDigestPeriodKey(now: Date, schedule: DigestSchedule, timeZone: string): string | null {
  if (schedule.frequency === 'off') return null;
  const hour = hourInTz(now, timeZone);
  if (hour < schedule.hour || hour >= schedule.hour + DIGEST_GRACE_HOURS) return null;
  if (schedule.frequency === 'weekly' && weekdayInTz(now, timeZone) !== schedule.weekday) return null;
  return `${schedule.frequency}:${dateKeyInTz(now, timeZone)}`;
}

/** Kapalı gün aralığı ("YYYY-MM-DD", iki uç dahil). */
export interface DateKeyRange {
  start: string;
  end: string;
}

export interface DigestRanges {
  current: DateKeyRange;
  /** Karşılaştırma için bir önceki eşdeğer dönem. */
  previous: DateKeyRange;
}

/**
 * Özetin kapsadığı dönem: tamamlanmış günler. Günlükte dün, haftalıkta dünden
 * geriye 7 gün — bugün yarım gün olduğu için dahil edilmez.
 */
export function digestRanges(now: Date, frequency: ActiveDigestFrequency, timeZone: string): DigestRanges {
  const length = frequency === 'daily' ? 1 : 7;
  const end = shiftDateKey(dateKeyInTz(now, timeZone), -1);
  const start = shiftDateKey(end, -(length - 1));
  return {
    current: { start, end },
    previous: { start: shiftDateKey(start, -length), end: shiftDateKey(start, -1) },
  };
}
