import { NextRequest } from 'next/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildTrackToken } from '@/lib/track-token';
import { OPTIONS, POST } from '../route';

/**
 * `/api/track/view` route testleri.
 *
 * Bu endpoint storefront'a (yani internete) açık olduğu için güvenlik
 * davranışı manuel QA yerine burada doğrulanıyor:
 * imzasız/yanlış token reddi, cross-tenant yazma engeli ve rate limit.
 *
 * DB'ye gerçekten yazmamak için prisma ve merchant ayarları mock'lanıyor.
 */

// vi.hoisted: mock fabrikaları import'lardan önce çalıştığı için
// spy'lar da oraya taşınmalı, yoksa "cannot access before initialization".
const { upsertProductView, upsertProductViewHourly } = vi.hoisted(() => ({
  upsertProductView: vi.fn(),
  upsertProductViewHourly: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    productView: { upsert: upsertProductView },
    productViewHourly: { upsert: upsertProductViewHourly },
  },
}));

vi.mock('@/lib/merchant-settings', () => ({
  getMerchantTimezone: vi.fn(async () => 'Europe/Istanbul'),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const TEST_SECRET = 'test-client-secret';
const MERCHANT_ID = 'merchant-1';

// CLIENT_SECRET token üretilmeden önce ayarlanmalı; buildTrackToken env'i
// çağrı anında okuyor, o yüzden import sırası değil bu satırın sırası önemli.
vi.stubEnv('CLIENT_SECRET', TEST_SECRET);

const VALID_TOKEN = buildTrackToken(MERCHANT_ID);

/** Her test kendi IP'sini kullanır; rate limit sayacı modül düzeyinde paylaşılıyor. */
function post(body: unknown, ip: string) {
  return POST(
    new NextRequest('http://localhost/api/track/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  upsertProductView.mockReset();
  upsertProductViewHourly.mockReset();
});

describe('POST /api/track/view — token doğrulaması', () => {
  it('geçerli token ile görüntülenmeyi kaydeder', async () => {
    const res = await post(
      { productId: 'p1', merchantId: MERCHANT_ID, token: VALID_TOKEN },
      '10.0.0.1',
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(upsertProductView).toHaveBeenCalledTimes(1);
    expect(upsertProductViewHourly).toHaveBeenCalledTimes(1);
  });

  it('yanlış token ile 401 döner ve hiçbir şey yazmaz', async () => {
    const res = await post(
      { productId: 'p1', merchantId: MERCHANT_ID, token: 'sahte-token' },
      '10.0.0.2',
    );

    expect(res.status).toBe(401);
    expect(upsertProductView).not.toHaveBeenCalled();
  });

  it('token alanı yoksa 400 döner (eski, token gömülmemiş script)', async () => {
    const res = await post({ productId: 'p1', merchantId: MERCHANT_ID }, '10.0.0.3');

    expect(res.status).toBe(400);
    expect(upsertProductView).not.toHaveBeenCalled();
  });

  it('başka mağazanın token ile o mağaza adına yazılamaz (cross-tenant)', async () => {
    const otherToken = buildTrackToken('merchant-2');

    const res = await post(
      { productId: 'p1', merchantId: MERCHANT_ID, token: otherToken },
      '10.0.0.4',
    );

    expect(res.status).toBe(401);
    expect(upsertProductView).not.toHaveBeenCalled();
  });

  it('bozuk JSON gövdesinde 400 döner', async () => {
    const res = await post('{ bozuk', '10.0.0.5');

    expect(res.status).toBe(400);
    expect(upsertProductView).not.toHaveBeenCalled();
  });
});

describe('POST /api/track/view — rate limit', () => {
  it('dakikada 60 isteği geçen çağrılar 429 alır', async () => {
    const ip = '10.0.1.1';
    const body = { productId: 'p1', merchantId: MERCHANT_ID, token: VALID_TOKEN };

    for (let i = 0; i < 60; i++) {
      const res = await post(body, ip);
      expect(res.status).toBe(200);
    }

    const blocked = await post(body, ip);
    expect(blocked.status).toBe(429);
    await expect(blocked.json()).resolves.toEqual({ error: 'Too many requests' });

    // Limit aşımı yalnızca o IP'yi etkiler.
    const other = await post(body, '10.0.1.2');
    expect(other.status).toBe(200);
  });

  it('rate limit token doğrulamasından önce çalışır', async () => {
    const ip = '10.0.2.1';
    const body = { productId: 'p1', merchantId: MERCHANT_ID, token: 'sahte-token' };

    for (let i = 0; i < 60; i++) {
      expect((await post(body, ip)).status).toBe(401);
    }

    expect((await post(body, ip)).status).toBe(429);
  });
});

describe('OPTIONS /api/track/view', () => {
  it('CORS preflight için 204 ve CORS başlıkları döner', async () => {
    const res = await OPTIONS();

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});
