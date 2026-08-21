import type { AbcClass } from '@/lib/reports/abc';
import type { SellThroughBand } from '@/lib/reports/sell-through';

export const ABC_LABELS: Record<AbcClass, { title: string; description: string }> = {
  A: { title: 'A Sınıfı', description: 'Cironun ~%80\'i — sürekli izle, asla tükettirme' },
  B: { title: 'B Sınıfı', description: 'Cironun ~%15\'i — düzenli kontrol yeterli' },
  C: { title: 'C Sınıfı', description: 'Cironun ~%5\'i — stok bağlama, azaltmayı düşün' },
};

export const SELL_THROUGH_BAND_ORDER: SellThroughBand[] = ['yüksek', 'normal', 'düşük', 'satışsız'];

export const SELL_THROUGH_BAND_LABEL: Record<SellThroughBand, string> = {
  yüksek: 'Hızlı eriyen (%60+)',
  normal: 'Normal (%25-60)',
  düşük: 'Yavaş (%25 altı)',
  satışsız: 'Hiç satmayan',
};

export const SELL_THROUGH_BAND_DOT: Record<SellThroughBand, string> = {
  yüksek: 'bg-status-healthy',
  normal: 'bg-accent-blue',
  düşük: 'bg-status-warning',
  satışsız: 'bg-status-critical',
};

export const ABC_BADGE_CLASS: Record<AbcClass, string> = {
  A: 'bg-success text-success-foreground',
  B: 'bg-warning text-warning-foreground',
  C: 'bg-muted text-muted-foreground',
};
