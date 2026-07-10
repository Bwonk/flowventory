export function formatPrice(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;
}

/** 'YYYY-MM-DD' → 'DD.MM'. */
export function formatDayMonth(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}`;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}
