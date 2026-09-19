// Goo popover geometrisi ve karar mantığı — React'siz saf fonksiyonlar (vitest ile sınanır).
// Geometri beui popover kaynağından; `resolveSide`, `resolveShiftX`, `growRect` ve
// `nextFocusIndex`, `arrowNavigatesFrom` Flowventory ekleri (DESIGN.md §5 "Goo açılır panel").

export type Side = 'top' | 'bottom';
export type Align = 'start' | 'center' | 'end';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface Geo {
  layerW: number;
  layerH: number;
  left: number;
  top: number;
  trigger: Rect;
  panel: Rect;
}

const CIRCLE_KAPPA = 0.5523;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface GeoInput {
  triggerW: number;
  triggerH: number;
  contentW: number;
  contentH: number;
  side: Side;
  align: Align;
  gap: number;
  panelRadius: number;
  triggerRadius: number;
  /** Paneli viewport içinde tutan yatay kaydırma (px) — bkz. `resolveShiftX`. */
  shiftX?: number;
  /** Katman kutusunun her yandaki payı: hairline kontur kutunun dışına taşmasın. */
  pad?: number;
}

/** Tetikleyici ve panel dikdörtgenleri, ortak bir yerel koordinat kutusunda. */
export function buildGeo({
  triggerW,
  triggerH,
  contentW,
  contentH,
  side,
  align,
  gap,
  panelRadius,
  triggerRadius,
  shiftX = 0,
  pad = 0,
}: GeoInput): Geo {
  const py = side === 'bottom' ? triggerH + gap : -(gap + contentH);
  const px = alignX(align, triggerW, contentW) + shiftX;

  const left = Math.min(0, px) - pad;
  const top = Math.min(0, py) - pad;
  const layerW = Math.max(triggerW, px + contentW) + pad - left;
  const layerH = Math.max(triggerH, py + contentH) + pad - top;

  return {
    layerW,
    layerH,
    left,
    top,
    trigger: { x: 0 - left, y: 0 - top, w: triggerW, h: triggerH, r: Math.min(triggerH / 2, triggerRadius) },
    panel: { x: px - left, y: py - top, w: contentW, h: contentH, r: panelRadius },
  };
}

/** Panelin tetikleyiciye göre hizaya bağlı yatay konumu (kaydırmasız). */
export function alignX(align: Align, triggerW: number, contentW: number): number {
  if (align === 'start') return 0;
  if (align === 'end') return triggerW - contentW;
  return (triggerW - contentW) / 2;
}

export function rectAtProgress(geo: Geo, progress: number): Rect {
  const { trigger, panel } = geo;
  return {
    x: lerp(trigger.x, panel.x, progress),
    y: lerp(trigger.y, panel.y, progress),
    w: lerp(trigger.w, panel.w, progress),
    h: lerp(trigger.h, panel.h, progress),
    r: lerp(trigger.r, panel.r, progress),
  };
}

/**
 * Morph sırasında içerik opaklığı: gövde akmaya başladıktan sonra belirir,
 * oturmadan önce tamdır; kapanışta aynı eğri tersten — "çıkış girişten sessiz".
 */
export function contentOpacity(progress: number): number {
  return Math.min(1, Math.max(0, (progress - 0.2) / 0.6));
}

/** Dikdörtgeni her yandan `by` px büyütür — hairline kontur katmanı için. */
export function growRect(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, w: rect.w + by * 2, h: rect.h + by * 2, r: rect.r + by };
}

function insetFor(rect: Rect, layerW: number, layerH: number) {
  const right = layerW - (rect.x + rect.w);
  const bottom = layerH - (rect.y + rect.h);
  return `inset(${rect.y}px ${right}px ${bottom}px ${rect.x}px round ${rect.r}px)`;
}

function roundedRectShape(rect: Rect) {
  const radius = Math.max(0, Math.min(rect.r, rect.w / 2, rect.h / 2));
  const control = radius * CIRCLE_KAPPA;
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const px = (value: number) => `${value.toFixed(3)}px`;

  return (
    `shape(from ${px(x1 + radius)} ${px(y1)}, ` +
    `line to ${px(x2 - radius)} ${px(y1)}, ` +
    `curve to ${px(x2)} ${px(y1 + radius)} with ${px(x2 - radius + control)} ${px(y1)} / ${px(x2)} ${px(y1 + radius - control)}, ` +
    `line to ${px(x2)} ${px(y2 - radius)}, ` +
    `curve to ${px(x2 - radius)} ${px(y2)} with ${px(x2)} ${px(y2 - radius + control)} / ${px(x2 - radius + control)} ${px(y2)}, ` +
    `line to ${px(x1 + radius)} ${px(y2)}, ` +
    `curve to ${px(x1)} ${px(y2 - radius)} with ${px(x1 + radius - control)} ${px(y2)} / ${px(x1)} ${px(y2 - radius + control)}, ` +
    `line to ${px(x1)} ${px(y1 + radius)}, ` +
    `curve to ${px(x1 + radius)} ${px(y1)} with ${px(x1)} ${px(y1 + radius - control)} / ${px(x1 + radius - control)} ${px(y1)}, ` +
    'close)'
  );
}

/** `progress` anındaki morph dikdörtgeninin clip-path'i; `grow` hairline katmanı için. */
export function clipForProgress(geo: Geo, progress: number, supportsShape: boolean, grow = 0) {
  const base = rectAtProgress(geo, progress);
  const rect = grow ? growRect(base, grow) : base;
  return supportsShape ? roundedRectShape(rect) : insetFor(rect, geo.layerW, geo.layerH);
}

function roundedRectPath(rect: Rect) {
  const radius = Math.max(0, Math.min(rect.r, rect.w / 2, rect.h / 2));
  const n = (value: number) => value.toFixed(3);
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  const arc = `A${n(radius)} ${n(radius)} 0 0 1`;

  // Sıfır yarıçapta her yay çizgiye iner; düz dikdörtgeni de bu çizer.
  return (
    `M${n(x1 + radius)} ${n(y1)}` +
    `H${n(x2 - radius)}${arc} ${n(x2)} ${n(y1 + radius)}` +
    `V${n(y2 - radius)}${arc} ${n(x2 - radius)} ${n(y2)}` +
    `H${n(x1 + radius)}${arc} ${n(x1)} ${n(y2 - radius)}` +
    `V${n(y1 + radius)}${arc} ${n(x1 + radius)} ${n(y1)}Z`
  );
}

// Goo katmanı sayfanın üstüne portallanır; tetikleyici kopyası gerçek
// tetikleyicinin etiketini ve focus ring'ini örterdi. Tetikleyiciyi katmandan
// oymak gerçeğini görünür tutar. CSS mask değil clip-path: WebKit, SVG <mask>'e
// işaret eden `mask: url(#id)`'yi sessizce yok sayıyor.
export function triggerCutout(geo: Geo) {
  const layer = { x: 0, y: 0, w: geo.layerW, h: geo.layerH, r: 0 };
  return `path(evenodd, "${roundedRectPath(layer)} ${roundedRectPath(geo.trigger)}")`;
}

export interface SideInput {
  preferred: Side;
  triggerTop: number;
  triggerHeight: number;
  contentHeight: number;
  gap: number;
  viewportHeight: number;
  /** Viewport kenarından bırakılan pay (px). */
  margin?: number;
}

/**
 * Tercih edilen tarafta yer yoksa ve karşı tarafta daha çok yer varsa çevirir;
 * ikisi de darsa geniş olan kazanır, eşitlikte tercih korunur.
 */
export function resolveSide({
  preferred,
  triggerTop,
  triggerHeight,
  contentHeight,
  gap,
  viewportHeight,
  margin = 8,
}: SideInput): Side {
  const need = contentHeight + gap + margin;
  const above = triggerTop;
  const below = viewportHeight - (triggerTop + triggerHeight);
  const room = preferred === 'bottom' ? below : above;
  const opposite = preferred === 'bottom' ? above : below;
  if (room >= need || opposite <= room) return preferred;
  return preferred === 'bottom' ? 'top' : 'bottom';
}

/** Paneli viewport'un içine çeken yatay kaydırma; sığmıyorsa sol kenar kazanır. */
export function resolveShiftX(triggerLeft: number, panelX: number, contentWidth: number, viewportWidth: number, margin = 8): number {
  const left = triggerLeft + panelX;
  const overflowRight = left + contentWidth - (viewportWidth - margin);
  let shift = overflowRight > 0 ? -overflowRight : 0;
  if (left + shift < margin) shift = margin - left;
  return shift;
}

/**
 * ↑/↓ odaktaki öğeden seçeneklere geçirsin mi? Metin/arama kutusundan evet
 * (combobox kalıbı); ↑/↓'yu kendi kullanan alanlarda (sayı, tarih, select,
 * textarea…) hayır — tuş alana kalır.
 */
export function arrowNavigatesFrom(tagName: string, inputType = ''): boolean {
  const tag = tagName.toLowerCase();
  if (tag === 'select' || tag === 'textarea') return false;
  if (tag !== 'input') return true;
  return ['', 'text', 'search', 'email', 'tel', 'url', 'password'].includes(inputType.toLowerCase());
}

/**
 * ↑/↓ ile panel içi gezinme: `current`'tan `direction` yönünde ilk etkin öğe,
 * uçlarda sararak. Odak panelde değilse (`current = -1`) ↓ ilk, ↑ son öğeye gider.
 * Etkin öğe yoksa -1.
 */
export function nextFocusIndex(current: number, enabled: readonly boolean[], direction: 1 | -1): number {
  const count = enabled.length;
  if (count === 0) return -1;
  const start = current < 0 ? (direction === 1 ? -1 : count) : current;
  for (let step = 1; step <= count; step++) {
    const index = (((start + direction * step) % count) + count) % count;
    if (enabled[index]) return index;
  }
  return -1;
}
