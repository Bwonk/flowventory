"use client";

import { type AnimationEvent, useCallback, useRef } from "react";

/**
 * Origin-aware animation: bir açılır yüzey (Dialog, Popover) kendi ortasından
 * değil, onu açan tetikleyicinin merkezinden büyür ve kapanışta oraya küçülür.
 *
 * Yüzeyin `onAnimationStart`'ına bağlanır; giriş (`data-state="open"`) ve çıkış
 * (`data-state="closed"`) animasyonu başlarken tetikleyicinin merkezini
 * yüzeyin dönüşümsüz kutusuna göre `transform-origin` olarak yazar. Ölçek ve
 * süre yüzeyin kendi sınıflarında kalır; bu hook yalnız kökü taşır.
 */

export interface Point {
  x: number;
  y: number;
}

/** Basıştan sonra açılışın o basışa ait sayıldığı pencere (ms). */
export const PRESS_WINDOW_MS = 1000;

/** Basışın tetikleyici sayılacak en yakın ata öğesi. */
const PRESSABLE =
  'button, a[href], [role="button"], [role="menuitem"], [role="option"], [role="tab"], tr, [tabindex]';

/** Tetikleyici merkezini, yüzeyin (dönüşümsüz) sol-üst köşesine göre CSS kökü yapar. */
export function transformOriginFor(point: Point, box: { left: number; top: number }): string {
  return `${Math.round(point.x - box.left)}px ${Math.round(point.y - box.top)}px`;
}

/** Son basış bu açılışı tetiklemiş sayılır mı? (eski bir tıklamadan büyümesin) */
export function isFreshPress(pressedAt: number, now: number): boolean {
  return now - pressedAt >= 0 && now - pressedAt <= PRESS_WINDOW_MS;
}

interface TriggerSnapshot {
  el: Element;
  center: Point;
}

function centerOf(el: Element): Point | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Kontrollü açılan yüzeylerin (DialogTrigger'sız modal, satır tıklaması,
// menü öğesi) tetikleyicisi DOM'da işaretli değil; son basışı yakalayarak
// buluruz. Yakalama fazında, uygulama yüklenirken bir kez kurulur — yüzey
// mount olduğunda basış çoktan olmuş olur.
let lastPress: (TriggerSnapshot & { at: number }) | null = null;

function recordPress(el: Element | null) {
  if (!el || el === document.body) return;
  const center = centerOf(el);
  if (center) lastPress = { el, center, at: performance.now() };
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      recordPress(target?.closest(PRESSABLE) ?? target);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key === "Enter" || event.key === " ") recordPress(document.activeElement);
    },
    true,
  );
}

/** Radix tetikleyicisi `aria-controls` ile işaretli; yoksa taze son basış. */
function resolveTrigger(surface: HTMLElement): TriggerSnapshot | null {
  if (surface.id) {
    const el = document.querySelector(`[aria-controls="${CSS.escape(surface.id)}"]`);
    const center = el && centerOf(el);
    if (el && center) return { el, center };
  }
  if (lastPress && isFreshPress(lastPress.at, performance.now()) && !surface.contains(lastPress.el)) {
    return { el: lastPress.el, center: lastPress.center };
  }
  return null;
}

/**
 * Yüzeyin animasyonsuz kutusu: giriş/çıkış keyframe'i `transform`'u sürer;
 * bir okumalık `!important` ezme onu devre dışı bırakır (animasyon yeniden
 * başlamaz). Konumlandırma `translate` özelliği ya da atadaki dönüşümle
 * geldiği için ölçüme dahil kalır.
 */
function untransformedRect(el: HTMLElement): DOMRect {
  const value = el.style.getPropertyValue("transform");
  const priority = el.style.getPropertyPriority("transform");
  el.style.setProperty("transform", "none", "important");
  const rect = el.getBoundingClientRect();
  if (value) el.style.setProperty("transform", value, priority);
  else el.style.removeProperty("transform");
  return rect;
}

export function useTriggerOrigin<T extends HTMLElement>(onAnimationStart?: (event: AnimationEvent<T>) => void) {
  const trigger = useRef<TriggerSnapshot | null>(null);

  return useCallback(
    (event: AnimationEvent<T>) => {
      onAnimationStart?.(event);
      // İçerideki öğelerin animasyonları da buraya kabarır.
      if (event.target !== event.currentTarget) return;
      const surface = event.currentTarget;
      const state = surface.dataset.state;

      if (state === "open") trigger.current = resolveTrigger(surface);
      else if (state !== "closed") return;

      const snapshot = trigger.current;
      if (!snapshot) {
        surface.style.removeProperty("transform-origin");
        return;
      }
      // Kapanışta tetikleyici yerindeyse güncel merkezine (sayfa kaymış
      // olabilir) döner; söküldüyse (menü öğesi) açılıştaki noktaya.
      const center = (snapshot.el.isConnected && centerOf(snapshot.el)) || snapshot.center;
      snapshot.center = center;
      surface.style.transformOrigin = transformOriginFor(center, untransformedRect(surface));
    },
    [onAnimationStart],
  );
}
