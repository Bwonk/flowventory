import type { ProductRow } from '../types';
import { STATUS_META } from '../constants';

export function downloadCSV(rows: ProductRow[]) {
  const headers = ['Ürün Adı', 'Kategori', 'Durum', 'Toplam Stok', 'Varyant Sayısı'];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const cells = [
      `"${row.productName.replace(/"/g, '""')}"`,
      `"${(row.category ?? '').replace(/"/g, '""')}"`,
      STATUS_META[row.status].label,
      row.totalStock,
      row.variantCount,
    ];
    csvRows.push(cells.join(','));
  }
  const csv = csvRows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stok-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
