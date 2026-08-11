/**
 * Basit in-memory sabit pencereli rate limiter.
 *
 * Tek instance (dev / tek node) için yeterli; serverless / multi-instance
 * deploy'da her instance kendi sayacını tutar — o aşamada Redis benzeri
 * paylaşımlı bir store'a taşınmalı (Faz 2 notu).
 */

type WindowEntry = { count: number; windowStart: number };

const buckets = new Map<string, WindowEntry>();

/** Bellek şişmesin diye süresi geçen pencereleri ara ara temizle. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (now - entry.windowStart >= windowMs) buckets.delete(key);
  }
}

/**
 * @returns true ise istek izinli, false ise limit aşıldı.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  sweep(windowMs);
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}
