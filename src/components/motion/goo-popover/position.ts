'use client';
// beui.dev/components/motion/popover (popover-position) — birebir; farklar:
// tetikleyicinin basma ölçeğinin ölçümden çıkarılması (`unscaledRect`) ve
// portal kabı (`container`) dönüşümlü bir ata ise (Radix Dialog içeriği) onun
// köşesine göre `offset`.

import { type MutableRefObject, useCallback, useLayoutEffect, useState } from 'react';

export type PortalLayout = {
  trigger: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  content: {
    width: number;
    height: number;
  };
  /**
   * Portal kabının viewport'taki iç köşesi. Kap dönüşümlü olduğunda (`translate`)
   * `position: fixed` onun kutusuna göre konumlanır; body'de 0.
   */
  offset: {
    x: number;
    y: number;
  };
};

function sameLayout(a: PortalLayout | null, b: PortalLayout) {
  return (
    a?.trigger.left === b.trigger.left &&
    a.trigger.top === b.trigger.top &&
    a.trigger.width === b.trigger.width &&
    a.trigger.height === b.trigger.height &&
    a.content.width === b.content.width &&
    a.content.height === b.content.height &&
    a.offset.x === b.offset.x &&
    a.offset.y === b.offset.y
  );
}

/**
 * Tetikleyicinin basma ölçeği (`active:scale-[0.99]`, CSS `scale`) çıkarılmış
 * kutusu. Açılış click'te ölçülür — tetikleyici o an ölçekten geri dönerken;
 * ham rect'le goo kopyası ve panel yarım piksel kayık kalıyordu. Ölçek
 * merkezden olduğu için merkez sabit, boyut ölçeğe bölünür.
 */
function unscaledRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const scale = getComputedStyle(element).scale;
  if (!scale || scale === 'none') return rect;
  const [sx = 1, sy = sx] = scale.split(' ').map(Number);
  if (!sx || !sy || (sx === 1 && sy === 1)) return rect;
  const width = rect.width / sx;
  const height = rect.height / sy;
  return {
    left: rect.left + (rect.width - width) / 2,
    top: rect.top + (rect.height - height) / 2,
    width,
    height,
  };
}

function containerOffset(container: HTMLElement | null | undefined) {
  if (!container) return { x: 0, y: 0 };
  const rect = container.getBoundingClientRect();
  return { x: rect.left + container.clientLeft, y: rect.top + container.clientTop };
}

/** Tetikleyiciyi ve portallanmış paneli viewport koordinatlarında ölçer. */
export function usePopoverPortalPosition<TriggerElement extends HTMLElement, ContentElement extends HTMLElement>(
  triggerRef: MutableRefObject<TriggerElement | null>,
  contentRef: MutableRefObject<ContentElement | null>,
  active: boolean,
  container?: HTMLElement | null,
) {
  const [layout, setLayout] = useState<PortalLayout | null>(null);

  const update = useCallback(() => {
    const trigger = triggerRef.current;
    const content = contentRef.current;
    if (!trigger || !content) return;

    const rect = unscaledRect(trigger);
    const next: PortalLayout = {
      trigger: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      content: {
        width: content.offsetWidth,
        height: content.offsetHeight,
      },
      offset: containerOffset(container),
    };
    setLayout(current => (sameLayout(current, next) ? current : next));
  }, [contentRef, triggerRef, container]);

  useLayoutEffect(() => {
    update();
    if (!active) return;

    const trigger = triggerRef.current;
    const content = contentRef.current;
    const observer = new ResizeObserver(update);
    if (trigger) observer.observe(trigger);
    if (content) observer.observe(content);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [active, contentRef, triggerRef, update]);

  return layout;
}
