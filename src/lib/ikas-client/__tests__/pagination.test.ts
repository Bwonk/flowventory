import { describe, expect, it } from 'vitest';
import { fetchAllPages, IKAS_PAGE_LIMIT_MAX, type IkasPage } from '@/lib/ikas-client/pagination';

function makePage<T>(data: T[], hasNext: boolean, page: number): IkasPage<T> {
  return { data, hasNext, page, limit: IKAS_PAGE_LIMIT_MAX, count: data.length };
}

describe('fetchAllPages', () => {
  it('tek sayfayı döndürür', async () => {
    const result = await fetchAllPages(async () => makePage([1, 2, 3], false, 1));
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.complete).toBe(true);
    expect(result.pageCount).toBe(1);
  });

  it('hasNext bitene kadar tüm sayfaları birleştirir', async () => {
    const pages = [makePage([1, 2], true, 1), makePage([3, 4], true, 2), makePage([5], false, 3)];
    const requested: number[] = [];
    const result = await fetchAllPages(async ({ page }) => {
      requested.push(page);
      return pages[page - 1];
    });
    expect(result.items).toEqual([1, 2, 3, 4, 5]);
    expect(result.complete).toBe(true);
    expect(requested).toEqual([1, 2, 3]);
  });

  it('sayfa hatasında kısmi veri döndürmek yerine fırlatır', async () => {
    await expect(
      fetchAllPages(async ({ page }) => (page === 2 ? null : makePage([1], true, page))),
    ).rejects.toThrow('page 2 fetch failed');
  });

  it('maxPages tavanına takılınca complete=false döner (sessiz kesinti yok)', async () => {
    const result = await fetchAllPages(
      async ({ page }) => makePage([page], true, page),
      { maxPages: 3 },
    );
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.complete).toBe(false);
    expect(result.pageCount).toBe(3);
  });

  it('limit ikas maksimumunu (200) aşamaz', async () => {
    let seenLimit = 0;
    await fetchAllPages(
      async pagination => {
        seenLimit = pagination.limit;
        return makePage([], false, 1);
      },
      { limit: 999 },
    );
    expect(seenLimit).toBe(IKAS_PAGE_LIMIT_MAX);
  });
});
