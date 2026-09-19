import { describe, expect, it } from 'vitest';
import {
  buildGeo,
  clipForProgress,
  contentOpacity,
  growRect,
  nextFocusIndex,
  rectAtProgress,
  resolveShiftX,
  resolveSide,
  triggerCutout,
} from '../utils';

const base = {
  triggerW: 120,
  triggerH: 36,
  contentW: 200,
  contentH: 160,
  side: 'bottom' as const,
  align: 'start' as const,
  gap: 8,
  panelRadius: 8,
  triggerRadius: 6,
};

describe('buildGeo', () => {
  it('start + bottom: panel tetikleyicinin sol kenarından, boyun kadar aşağıda', () => {
    const geo = buildGeo(base);
    expect(geo.left).toBe(0);
    expect(geo.top).toBe(0);
    expect(geo.trigger).toEqual({ x: 0, y: 0, w: 120, h: 36, r: 6 });
    expect(geo.panel).toEqual({ x: 0, y: 44, w: 200, h: 160, r: 8 });
    expect(geo.layerW).toBe(200);
    expect(geo.layerH).toBe(204);
  });

  it('end: panel sola taşar, katman kutusu onu içine alır', () => {
    const geo = buildGeo({ ...base, align: 'end' });
    expect(geo.left).toBe(-80);
    expect(geo.trigger.x).toBe(80);
    expect(geo.panel.x).toBe(0);
    expect(geo.layerW).toBe(200);
  });

  it('center: panel tetikleyiciye ortalanır', () => {
    const geo = buildGeo({ ...base, align: 'center' });
    expect(geo.left).toBe(-40);
    expect(geo.panel.x + geo.panel.w / 2).toBe(geo.trigger.x + geo.trigger.w / 2);
  });

  it('top: panel tetikleyicinin üstünde, boyun kadar aralıkla', () => {
    const geo = buildGeo({ ...base, side: 'top' });
    expect(geo.top).toBe(-168);
    expect(geo.panel.y).toBe(0);
    expect(geo.trigger.y).toBe(168);
    expect(geo.trigger.y - (geo.panel.y + geo.panel.h)).toBe(8);
  });

  it('pad katman kutusunu her yandan büyütür, göreli konumları bozmaz', () => {
    const geo = buildGeo({ ...base, pad: 4 });
    expect(geo.left).toBe(-4);
    expect(geo.top).toBe(-4);
    expect(geo.layerW).toBe(208);
    expect(geo.layerH).toBe(212);
    expect(geo.trigger.x).toBe(4);
    expect(geo.panel.y - geo.trigger.y).toBe(44);
  });

  it('shiftX paneli kaydırır, tetikleyici yerinde kalır', () => {
    const geo = buildGeo({ ...base, shiftX: -50 });
    expect(geo.left).toBe(-50);
    expect(geo.trigger.x).toBe(50);
    expect(geo.panel.x).toBe(0);
  });

  it('alçak tetikleyicide yarıçap yüksekliğin yarısını geçmez', () => {
    expect(buildGeo({ ...base, triggerH: 8 }).trigger.r).toBe(4);
  });
});

describe('morph', () => {
  const geo = buildGeo(base);

  it('0 tetikleyici, 1 panel, arası doğrusal', () => {
    expect(rectAtProgress(geo, 0)).toEqual(geo.trigger);
    expect(rectAtProgress(geo, 1)).toEqual(geo.panel);
    expect(rectAtProgress(geo, 0.5)).toEqual({ x: 0, y: 22, w: 160, h: 98, r: 7 });
  });

  it('growRect merkezden büyütür/küçültür', () => {
    expect(growRect({ x: 10, y: 10, w: 20, h: 20, r: 8 }, 1)).toEqual({ x: 9, y: 9, w: 22, h: 22, r: 9 });
    expect(growRect({ x: 10, y: 10, w: 20, h: 20, r: 8 }, -1)).toEqual({ x: 11, y: 11, w: 18, h: 18, r: 7 });
  });

  it('shape() yoksa inset() geri dönüşü', () => {
    expect(clipForProgress(geo, 1, false)).toBe('inset(44px 0px 0px 0px round 8px)');
    expect(clipForProgress(geo, 1, false, -1)).toBe('inset(45px 1px 1px 1px round 7px)');
    expect(clipForProgress(geo, 1, true).startsWith('shape(from 8.000px 44.000px')).toBe(true);
  });

  it('tetikleyici oyuğu evenodd iki yol taşır', () => {
    const cutout = triggerCutout(geo);
    expect(cutout.startsWith('path(evenodd, "')).toBe(true);
    expect(cutout.match(/Z/g)).toHaveLength(2);
  });

  it('içerik gövde akmaya başladıktan sonra belirir, oturmadan tamdır', () => {
    expect(contentOpacity(0)).toBe(0);
    expect(contentOpacity(0.2)).toBe(0);
    expect(contentOpacity(0.5)).toBeCloseTo(0.5);
    expect(contentOpacity(0.8)).toBe(1);
    expect(contentOpacity(1.05)).toBe(1);
  });
});

describe('resolveSide', () => {
  const at = (triggerTop: number, preferred: 'top' | 'bottom' = 'bottom') =>
    resolveSide({ preferred, triggerTop, triggerHeight: 36, contentHeight: 320, gap: 8, viewportHeight: 800 });

  it('altta yer varsa tercih korunur', () => {
    expect(at(100)).toBe('bottom');
  });

  it('alt dar, üst geniş → top', () => {
    expect(at(600)).toBe('top');
  });

  it('ikisi de darsa daha geniş olan; eşitlikte tercih', () => {
    const tight = { preferred: 'bottom' as const, triggerHeight: 36, contentHeight: 600, gap: 8, viewportHeight: 800 };
    expect(resolveSide({ ...tight, triggerTop: 300 })).toBe('bottom');
    expect(resolveSide({ ...tight, triggerTop: 500 })).toBe('top');
    expect(resolveSide({ ...tight, triggerTop: 382 })).toBe('bottom');
  });

  it('top tercihi de aynı kuralla çevrilir', () => {
    expect(at(600, 'top')).toBe('top');
    expect(at(100, 'top')).toBe('bottom');
  });
});

describe('resolveShiftX', () => {
  it('sığıyorsa kaydırma yok', () => {
    expect(resolveShiftX(100, 0, 320, 1200)).toBe(0);
  });

  it('sağdan taşan panel içeri çekilir', () => {
    expect(resolveShiftX(1000, 0, 320, 1200)).toBe(-128);
  });

  it('soldan taşan panel (end hizası) içeri itilir', () => {
    expect(resolveShiftX(100, -200, 320, 1200)).toBe(108);
  });

  it('viewport panelden darsa sol kenar kazanır', () => {
    expect(resolveShiftX(20, 0, 400, 360)).toBe(-12);
  });
});

describe('nextFocusIndex', () => {
  it('uçlarda sarar', () => {
    expect(nextFocusIndex(0, [true, true, true], 1)).toBe(1);
    expect(nextFocusIndex(2, [true, true, true], 1)).toBe(0);
    expect(nextFocusIndex(0, [true, true, true], -1)).toBe(2);
  });

  it('odak panelde değilken ↓ ilk, ↑ son öğe', () => {
    expect(nextFocusIndex(-1, [true, true, true], 1)).toBe(0);
    expect(nextFocusIndex(-1, [true, true, true], -1)).toBe(2);
  });

  it('disabled öğeleri atlar', () => {
    expect(nextFocusIndex(0, [true, false, true], 1)).toBe(2);
    expect(nextFocusIndex(-1, [false, true], 1)).toBe(1);
  });

  it('etkin öğe yoksa -1; tek öğe kendine döner', () => {
    expect(nextFocusIndex(0, [], 1)).toBe(-1);
    expect(nextFocusIndex(0, [false, false], 1)).toBe(-1);
    expect(nextFocusIndex(0, [true], 1)).toBe(0);
  });
});
