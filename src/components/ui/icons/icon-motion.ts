/**
 * Animasyonlu ikonların ortak spring'i (DESIGN.md §6).
 *
 * Kanonik `SPRING` (350/35) taşmasızdır; ikon dönüş/kaymasında çok az
 * taşma (ζ≈0.75, ~%3) hareketi canlı gösterir ama zıplatmaz. ~300ms'de oturur.
 * İkonlarda elle stiffness/damping yazma — bunu kullan.
 */
export const ICON_SPRING = { type: 'spring', stiffness: 350, damping: 28 } as const;
