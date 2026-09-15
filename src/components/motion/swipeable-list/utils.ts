// Kaydırma karar mantığı — React'siz saf fonksiyonlar (vitest ile sınanır).
// Eşikler beui swipeable-list kaynağından birebir (DESIGN.md §6 "Kaydırma motifi").

import type { SwipeSide } from './types';

/** Kapalı satır: ray genişliğinin bu oranı aşılınca açılır (revealThreshold ile büyüğü). */
export const OPEN_DISTANCE_RATIO = 0.46;
/** Açık satır: ray genişliğinin bu oranının altına inince kapanır. */
export const CLOSE_DISTANCE_RATIO = 0.72;
/** Fırlatma ile açılma hızı (px/s). */
export const OPEN_VELOCITY = 720;
/** Ters fırlatma ile kapanma hızı (px/s). */
export const CLOSE_VELOCITY = 320;
/** Fırlatmanın sayılması için en az mesafe (px) — titreme fırlatma değildir. */
export const FLING_DISTANCE = 14;
/** Yaya devredilen bırakma hızının kıskacı (px/s). */
export const RELEASE_VELOCITY_LIMIT = 1500;

/** Rayın toplam genişliği: aksiyon sayısı × sütun genişliği. */
export function railWidth(actionCount: number, actionWidth: number): number {
  return Math.max(0, actionCount) * actionWidth;
}

/** Yüzeyin bir tarafta dinlenirken durduğu x: sol ray +, sağ ray −, kapalı 0. */
export function sideOffset(side: SwipeSide | null, leftWidth: number, rightWidth: number): number {
  if (side === 'left') return leftWidth;
  if (side === 'right') return -rightWidth;
  return 0;
}

export function clampReleaseVelocity(velocity: number): number {
  return Math.max(-RELEASE_VELOCITY_LIMIT, Math.min(RELEASE_VELOCITY_LIMIT, velocity));
}

export type SwipeReleaseInput = {
  /** Bırakma anındaki x (px). */
  latest: number;
  /** Bırakma anındaki yatay hız (px/s). */
  velocity: number;
  openSide: SwipeSide | null;
  leftWidth: number;
  rightWidth: number;
  revealThreshold: number;
};

/**
 * Sürükleme bırakılınca satırın oturacağı taraf. Açıkken: rayın %72'sinin
 * altına inmek ya da ters yöne fırlatmak kapatır; karşı rayın açılma eşiği
 * aşıldıysa tek jestte karşı taraf açılır (beui'de yoktu: önce kapatıyordu).
 * Kapalıyken: eşik (`max(revealThreshold, ray×0.46)`) ya da fırlatma
 * (>720px/s ve >14px) açar. Genişliği 0 olan tarafa hiçbir koşulda açılmaz.
 */
export function resolveSwipeRelease({
  latest,
  velocity,
  openSide,
  leftWidth,
  rightWidth,
  revealThreshold,
}: SwipeReleaseInput): SwipeSide | null {
  const leftOpenThreshold = Math.max(revealThreshold, leftWidth * OPEN_DISTANCE_RATIO);
  const rightOpenThreshold = Math.max(revealThreshold, rightWidth * OPEN_DISTANCE_RATIO);

  if (openSide === 'left') {
    if (rightWidth > 0 && latest < -rightOpenThreshold) return 'right';
    if (latest < leftWidth * CLOSE_DISTANCE_RATIO || velocity < -CLOSE_VELOCITY) return null;
    return 'left';
  }

  if (openSide === 'right') {
    if (leftWidth > 0 && latest > leftOpenThreshold) return 'left';
    if (Math.abs(latest) < rightWidth * CLOSE_DISTANCE_RATIO || velocity > CLOSE_VELOCITY) {
      return null;
    }
    return 'right';
  }

  if (
    leftWidth > 0 &&
    latest > 0 &&
    (latest > leftOpenThreshold || (velocity > OPEN_VELOCITY && latest > FLING_DISTANCE))
  ) {
    return 'left';
  }

  if (
    rightWidth > 0 &&
    latest < 0 &&
    (latest < -rightOpenThreshold || (velocity < -OPEN_VELOCITY && latest < -FLING_DISTANCE))
  ) {
    return 'right';
  }

  return null;
}

export type SwipeKeyContext = {
  openSide: SwipeSide | null;
  hasLeft: boolean;
  hasRight: boolean;
};

/**
 * Klavye eşleniği: → sol rayı (sağa kaydırma), ← sağ rayı (sola kaydırma) açar;
 * Escape yalnız açıkken kapatır. `undefined` = tuş bize ait değil, dokunma.
 */
export function resolveSwipeKey(key: string, ctx: SwipeKeyContext): SwipeSide | null | undefined {
  if (key === 'ArrowRight') return ctx.hasLeft && ctx.openSide !== 'left' ? 'left' : undefined;
  if (key === 'ArrowLeft') return ctx.hasRight && ctx.openSide !== 'right' ? 'right' : undefined;
  if (key === 'Escape') return ctx.openSide ? null : undefined;
  return undefined;
}
