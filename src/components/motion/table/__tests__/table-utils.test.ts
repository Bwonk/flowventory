import { describe, expect, it } from 'vitest';
import {
  applyColumnOrder,
  cellPadding,
  compareSortValues,
  minTableWidth,
  moveColumnKey,
  nextSortState,
  resolveColumnWidth,
  sortRows,
} from '../utils';

const tr = new Intl.Collator('tr', { numeric: true });

describe('compareSortValues', () => {
  it('sayıları farkla, metni tr collator ile karşılaştırır', () => {
    expect(compareSortValues(2, 10, tr)).toBeLessThan(0);
    expect(compareSortValues('çilek', 'domates', tr)).toBeLessThan(0);
    expect(compareSortValues('ısı', 'iğne', tr)).toBeLessThan(0);
    expect(compareSortValues('İzmir', 'istanbul', tr)).toBeGreaterThan(0);
  });
});

describe('sortRows', () => {
  const rows = [
    { id: 'a', row: { v: 5 as number | null } },
    { id: 'b', row: { v: null as number | null } },
    { id: 'c', row: { v: 1 as number | null } },
    { id: 'd', row: { v: 5 as number | null } },
  ];
  const column = { key: 'v', header: 'V' };

  it('boş değerler her iki yönde de en sonda, eşitler kararlı', () => {
    expect(sortRows(rows, column, 'asc', tr).map(r => r.id)).toEqual(['c', 'a', 'd', 'b']);
    expect(sortRows(rows, column, 'desc', tr).map(r => r.id)).toEqual(['a', 'd', 'c', 'b']);
  });

  it('sortValue verilirse onu kullanır', () => {
    const col = { key: 'x', header: 'X', sortValue: (r: { v: number | null }) => (r.v == null ? null : -r.v) };
    expect(sortRows(rows, col, 'asc', tr).map(r => r.id)).toEqual(['a', 'd', 'c', 'b']);
  });
});

describe('nextSortState', () => {
  const col = { key: 'stock', defaultDirection: 'desc' as const };
  it('toggle: yeni kolon doğal yön, aynı kolon ters yön', () => {
    expect(nextSortState(null, col, 'toggle')).toEqual({ key: 'stock', direction: 'desc' });
    expect(nextSortState({ key: 'stock', direction: 'desc' }, col, 'toggle')).toEqual({ key: 'stock', direction: 'asc' });
    expect(nextSortState({ key: 'name', direction: 'asc' }, col, 'toggle')).toEqual({ key: 'stock', direction: 'desc' });
  });
  it('cycle: doğal → ters → yok', () => {
    expect(nextSortState({ key: 'stock', direction: 'desc' }, col, 'cycle')).toEqual({ key: 'stock', direction: 'asc' });
    expect(nextSortState({ key: 'stock', direction: 'asc' }, col, 'cycle')).toBeNull();
  });
});

describe('applyColumnOrder / moveColumnKey', () => {
  const cols = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  it('kayıtlı sırayı uygular, eksik kolonu düşürür', () => {
    expect(applyColumnOrder(['c', 'a', 'x'], cols).map(c => c.key)).toEqual(['c', 'a', 'b']);
  });
  it('sonradan gelen kolon sol komşusunun ardına girer', () => {
    const withTrend = [{ key: 'a' }, { key: 't' }, { key: 'b' }, { key: 'c' }];
    expect(applyColumnOrder(['c', 'b', 'a'], withTrend).map(c => c.key)).toEqual(['c', 'b', 'a', 't']);
    expect(applyColumnOrder(['a', 'b', 'c'], withTrend).map(c => c.key)).toEqual(['a', 't', 'b', 'c']);
  });
  it('sürüklenen kolonu bırakma indeksine taşır', () => {
    expect(moveColumnKey(['a', 'b', 'c'], 'a', 3)).toEqual(['b', 'c', 'a']);
    expect(moveColumnKey(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(moveColumnKey(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('genişlik', () => {
  it('px/rem çözülür, paylaşımlı değerler null', () => {
    expect(resolveColumnWidth('112px', 16)).toBe(112);
    expect(resolveColumnWidth('2rem', 16)).toBe(32);
    expect(resolveColumnWidth('20%', 16)).toBeNull();
    expect(resolveColumnWidth(undefined, 16)).toBeNull();
  });
  it('minTableWidth: resize > bildirilen > minWidth/minColumnWidth', () => {
    const cols = [
      { key: 'product', minWidth: 220 },
      { key: 'sku', width: '120px' },
      { key: 'qty' },
    ];
    expect(minTableWidth(cols, { qty: 90 }, { leading: 40, minColumnWidth: 64, rootFontSize: 16 })).toBe(40 + 220 + 120 + 90);
  });
});

describe('cellPadding', () => {
  const cols = [{ printHidden: true }, {}, {}, { printHidden: true }];
  it('kenar px-5, ara px-3; checkbox varsa ilk veri kolonu kenar değil', () => {
    expect(cellPadding(cols, 0, false)).toBe('pl-5 pr-3');
    expect(cellPadding(cols, 0, true)).toBe('pl-3 pr-3');
    expect(cellPadding(cols, 3, false)).toBe('pl-3 pr-5');
  });
  it('yazdırmada gizlenen kenarların ardındaki kolon print kenarı alır', () => {
    expect(cellPadding(cols, 1, false)).toBe('pl-3 pr-3 print:pl-5');
    expect(cellPadding(cols, 2, false)).toBe('pl-3 pr-3 print:pr-5');
  });
});
