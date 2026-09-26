/**
 * Hareket token'ları — tek kaynak (DESIGN.md §6).
 *
 * Kanonik spring 350/35 (ζ≈0.94: taşmasız, ~230ms'de oturur) uygulamadaki
 * bütün hap/morph/giriş-çıkış hareketlerinin ortak dilidir; elle kopyalama.
 * Eğriler globals.css `@theme` içindeki `--ease-*` token'larıyla birebir
 * aynıdır — CSS tarafında `ease-out` / `ease-in-out` / `ease-drawer`
 * utility'lerini, Motion tarafında buradaki dizileri kullan.
 */

/** Kanonik spring: hap kayması, morph, giriş/çıkış, sayı geçişi. */
export const SPRING = { type: 'spring', stiffness: 350, damping: 35 } as const;

/** reduced-motion dalı: hareket yok, durum anında değişir. */
export const INSTANT = { duration: 0 } as const;

/** Güçlü ease-out — giren/çıkan her arayüz öğesi. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Güçlü ease-in-out — ekranda yer değiştiren/biçim değiştiren öğe. */
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

/** iOS benzeri çekmece eğrisi — sheet/drawer/kenar paneli. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/**
 * Basma geri bildirimi — basılabilir her öğe (DESIGN.md §6: ölçek 0.99'u
 * geçmez). Geçiş listesinde `transform` olduğu için ölçek sıçramaz, 150ms
 * ease-out ile iner; reduced-motion'da ölçek yok. Uzun basışta etiket
 * seçilmez / iOS çağrı balonu açılmaz. `cn()` ile bileşenin sınıflarının
 * SONUNA ekle (transition-* çakışmasında bu kazanmalı).
 */
export const PRESS_FEEDBACK_CLASS =
  'transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:active:scale-100 select-none [-webkit-touch-callout:none]';

/** reduced-motion'a göre kanonik spring ya da anlık geçiş. */
export function springOrInstant(reduceMotion: boolean | null) {
  return reduceMotion ? INSTANT : SPRING;
}
