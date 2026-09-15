import { describe, expect, it } from 'vitest';
import {
  clampReleaseVelocity,
  railWidth,
  resolveSwipeKey,
  resolveSwipeRelease,
  sideOffset,
} from '../utils';

const W = 56;
const base = { leftWidth: W, rightWidth: W, revealThreshold: 34, velocity: 0 };

describe('railWidth / sideOffset / clampReleaseVelocity', () => {
  it('ray genişliği aksiyon sayısıyla ölçeklenir', () => {
    expect(railWidth(0, W)).toBe(0);
    expect(railWidth(2, W)).toBe(112);
  });

  it('taraf ofseti işaretlidir, kapalıda sıfır', () => {
    expect(sideOffset('left', 56, 112)).toBe(56);
    expect(sideOffset('right', 56, 112)).toBe(-112);
    expect(sideOffset(null, 56, 112)).toBe(0);
  });

  it('bırakma hızı ±1500 ile kıskaçlanır', () => {
    expect(clampReleaseVelocity(4000)).toBe(1500);
    expect(clampReleaseVelocity(-4000)).toBe(-1500);
    expect(clampReleaseVelocity(300)).toBe(300);
  });
});

describe('resolveSwipeRelease — kapalı satır', () => {
  it('eşiğin altında kalırsa kapalı kalır', () => {
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: 30 })).toBeNull();
  });

  it('eşiği geçince açılır (sol ray = sağa kaydırma)', () => {
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: 35 })).toBe('left');
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: -35 })).toBe('right');
  });

  it('fırlatma eşiğin altındaki mesafeden de açar, ama 14px altı titremeyi saymaz', () => {
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: 20, velocity: 800 })).toBe('left');
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: 10, velocity: 800 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: null, latest: -20, velocity: -800 })).toBe('right');
  });

  it('genişliği 0 olan tarafa açılmaz', () => {
    expect(resolveSwipeRelease({ ...base, openSide: null, leftWidth: 0, latest: 200 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: null, rightWidth: 0, latest: -200 })).toBeNull();
  });

  it('dar rayda revealThreshold baskındır', () => {
    expect(resolveSwipeRelease({ ...base, openSide: null, leftWidth: 20, latest: 15 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: null, leftWidth: 20, latest: 35 })).toBe('left');
  });
});

describe('resolveSwipeRelease — açık satır', () => {
  it('sol açıkken rayın %72 üstünde kalırsa açık kalır, altına inerse kapanır', () => {
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: 41 })).toBe('left');
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: 39 })).toBeNull();
  });

  it('sol açıkken ters fırlatma kapatır, yavaş geri çekme kapatmaz', () => {
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: 56, velocity: -400 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: 56, velocity: -200 })).toBe('left');
  });

  it('karşı rayın eşiği aşılırsa tek jestte taraf değiştirir; karşı ray yoksa kapanır', () => {
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: -35 })).toBe('right');
    expect(resolveSwipeRelease({ ...base, openSide: 'right', latest: 35 })).toBe('left');
    expect(resolveSwipeRelease({ ...base, openSide: 'left', latest: -20 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: 'left', rightWidth: 0, latest: -120 })).toBeNull();
  });

  it('sağ açıkken simetrik davranır', () => {
    expect(resolveSwipeRelease({ ...base, openSide: 'right', latest: -41 })).toBe('right');
    expect(resolveSwipeRelease({ ...base, openSide: 'right', latest: -39 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: 'right', latest: -56, velocity: 400 })).toBeNull();
    expect(resolveSwipeRelease({ ...base, openSide: 'right', latest: -56, velocity: 200 })).toBe('right');
  });
});

describe('resolveSwipeKey', () => {
  const both = { openSide: null, hasLeft: true, hasRight: true };

  it('oklar ilgili rayı açar, ray yoksa dokunmaz', () => {
    expect(resolveSwipeKey('ArrowRight', both)).toBe('left');
    expect(resolveSwipeKey('ArrowLeft', both)).toBe('right');
    expect(resolveSwipeKey('ArrowRight', { ...both, hasLeft: false })).toBeUndefined();
  });

  it('zaten açık rayı yeniden açmaz', () => {
    expect(resolveSwipeKey('ArrowRight', { ...both, openSide: 'left' })).toBeUndefined();
  });

  it('Escape yalnız açıkken kapatır, diğer tuşlar bize ait değil', () => {
    expect(resolveSwipeKey('Escape', { ...both, openSide: 'left' })).toBeNull();
    expect(resolveSwipeKey('Escape', both)).toBeUndefined();
    expect(resolveSwipeKey('Enter', { ...both, openSide: 'left' })).toBeUndefined();
  });
});
