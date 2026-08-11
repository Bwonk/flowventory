/**
 * ikas list sorguları için sayfalama yardımcısı.
 *
 * ikas PaginationInput: limit min 1, max 200, default 50. Sayfalama
 * istenmezse API yalnızca ilk 50 kaydı döndürür — bu da 50+ ürün/siparişli
 * mağazalarda sessiz veri kaybı demektir. Bu helper `hasNext` false olana
 * kadar tüm sayfaları çeker.
 */

/** ikas *PaginationResponse tiplerinin ortak şekli. */
export interface IkasPage<T> {
  data: T[];
  hasNext: boolean;
  page: number;
  limit: number;
  count: number;
}

export interface FetchAllPagesOptions {
  /** Sayfa başına kayıt (ikas max: 200). */
  limit?: number;
  /** Güvenlik tavanı — sonsuz döngü/aşırı istek koruması. */
  maxPages?: number;
}

export interface FetchAllPagesResult<T> {
  items: T[];
  /**
   * false ise maxPages tavanına takıldık ve veri kesildi.
   * Çağıran taraf bunu kullanıcıya/loga yansıtmalı — sessiz kesinti yok.
   */
  complete: boolean;
  /** Çekilen sayfa sayısı (gözlemlenebilirlik için). */
  pageCount: number;
}

/** ikas'ın PaginationInput sınırları. */
export const IKAS_PAGE_LIMIT_MAX = 200;

/**
 * `hasNext` false olana kadar tüm sayfaları sırayla çeker.
 *
 * @param fetchPage - Verilen pagination ile tek sayfa döndürür.
 *   Sorgu başarısızsa `null`/`undefined` döndürmeli; bu durumda helper
 *   hata fırlatır (kısmi veriyi "tam" gibi göstermemek için).
 */
export async function fetchAllPages<T>(
  fetchPage: (pagination: { page: number; limit: number }) => Promise<IkasPage<T> | null | undefined>,
  options: FetchAllPagesOptions = {},
): Promise<FetchAllPagesResult<T>> {
  const limit = Math.min(options.limit ?? IKAS_PAGE_LIMIT_MAX, IKAS_PAGE_LIMIT_MAX);
  const maxPages = options.maxPages ?? 50;

  const items: T[] = [];
  let page = 1;

  for (; page <= maxPages; page++) {
    const result = await fetchPage({ page, limit });
    if (!result) {
      throw new Error(`ikas pagination: page ${page} fetch failed`);
    }
    items.push(...result.data);
    if (!result.hasNext) {
      return { items, complete: true, pageCount: page };
    }
  }

  return { items, complete: false, pageCount: maxPages };
}
