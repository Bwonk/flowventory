'use client';
// beui.dev/components/motion/popover (popover-position) — birebir; tek fark
// tetikleyicinin basma ölçeğinin ölçümden çıkarılması (`unscaledRect`).

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
};

function sameLayout(a: PortalLayout | null, b: PortalLayout) {
  return (
    a?.trigger.left === b.trigger.left &&
    a.trigger.top === b.trigger.top &&
    a.trigger.width === b.trigger.width &&
    a.trigger.height === b.trigger.height &&
    a.content.width === b.content.width &&
    a.content.height === b.content.height
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

/** Tetikleyiciyi ve portallanmış paneli viewport koordinatlarında ölçer. */
export function usePopoverPortalPosition<TriggerElement extends HTMLElement, ContentElement extends HTMLElement>(
  triggerRef: MutableRefObject<TriggerElement | null>,
  contentRef: MutableRefObject<ContentElement | null>,
  active: boolean,
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
    };
    setLayout(current => (sameLayout(current, next) ? current : next));
  }, [contentRef, triggerRef]);

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
