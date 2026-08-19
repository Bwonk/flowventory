// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { firstIncompleteIndex, nextIncompleteIndex } from '@/lib/onboarding';

const s = (...done: boolean[]) => done.map(d => ({ done: d }));

describe('firstIncompleteIndex', () => {
  it('hiçbiri bitmemişse 0 döner', () => {
    expect(firstIncompleteIndex(s(false, false, false))).toBe(0);
  });

  it('ilk adım bittiyse sonrakini döner', () => {
    expect(firstIncompleteIndex(s(true, false, false))).toBe(1);
  });

  it('aradaki eksik adımı bulur', () => {
    expect(firstIncompleteIndex(s(true, false, true))).toBe(1);
  });

  it('hepsi bittiyse -1 döner', () => {
    expect(firstIncompleteIndex(s(true, true, true))).toBe(-1);
  });
});

describe('nextIncompleteIndex', () => {
  it('bir sonraki eksik adımı döner', () => {
    expect(nextIncompleteIndex(s(true, false, false), 0)).toBe(1);
  });

  it('tamamlanmış adımların üzerinden atlar', () => {
    expect(nextIncompleteIndex(s(false, true, false), 0)).toBe(2);
  });

  it('geriye sarmaz: sonrasında eksik yoksa -1 döner', () => {
    expect(nextIncompleteIndex(s(false, true, true), 0)).toBe(-1);
  });

  it('son adımdan sonrası yoktur', () => {
    expect(nextIncompleteIndex(s(true, true, false), 2)).toBe(-1);
  });
});
