import { describe, expect, it } from 'vitest';
import { describeNodes, evaluateNodes, groupNodes, joinClauses } from '@/lib/rules/logic';
import type { RuleLogic } from '@/lib/rules/types';

const nodes = (...ops: RuleLogic[]) => ops.map(op => ({ op }));

describe('groupNodes — VE önceliği', () => {
  it('A ve B ya da C → [[A, B], [C]]', () => {
    expect(groupNodes(nodes('and', 'and', 'or'))).toEqual([[0, 1], [2]]);
  });
  it('A ya da B ve C → [[A], [B, C]]', () => {
    expect(groupNodes(nodes('and', 'or', 'and'))).toEqual([[0], [1, 2]]);
  });
  it("ilk düğümün op'u yok sayılır", () => {
    expect(groupNodes(nodes('or'))).toEqual([[0]]);
    expect(groupNodes(nodes('or', 'and'))).toEqual([[0, 1]]);
  });
  it('boş liste', () => {
    expect(groupNodes([])).toEqual([]);
  });
});

describe('evaluateNodes', () => {
  it('A ve B ya da C: yalnız C sağlanırsa geçer, gövde C', () => {
    expect(evaluateNodes(nodes('and', 'and', 'or'), [null, 'b', 'c'])).toEqual(['c']);
  });
  it('A ve B ya da C: A+B sağlanırsa geçer', () => {
    expect(evaluateNodes(nodes('and', 'and', 'or'), ['a', 'b', null])).toEqual(['a', 'b']);
  });
  it('A ya da B ve C: B tek başına yetmez', () => {
    expect(evaluateNodes(nodes('and', 'or', 'and'), [null, 'b', null])).toBeNull();
    expect(evaluateNodes(nodes('and', 'or', 'and'), ['a', 'b', null])).toEqual(['a']);
  });
  it('tek koşul', () => {
    expect(evaluateNodes(nodes('and'), ['a'])).toEqual(['a']);
    expect(evaluateNodes(nodes('and'), [null])).toBeNull();
  });
  it('hepsi VEYA: sağlananların hepsi gövdeye girer', () => {
    expect(evaluateNodes(nodes('and', 'or', 'or'), ['a', null, 'c'])).toEqual(['a', 'c']);
  });
  it('koşulsuz → null', () => {
    expect(evaluateNodes([], [])).toBeNull();
  });
});

describe('describeNodes / joinClauses', () => {
  it('karışık zincir kümelerle okunur', () => {
    expect(describeNodes(nodes('and', 'and', 'or'), ['A', 'B', 'C'])).toBe('A ve B ya da C');
    expect(describeNodes(nodes('and', 'or', 'and'), ['A', 'B', 'C'])).toBe('A ya da B ve C');
    expect(describeNodes(nodes('and', 'and', 'and', 'or'), ['A', 'B', 'C', 'D'])).toBe('A, B ve C ya da D');
  });
  it('hepsi VEYA ya da hepsi VE virgüllü liste', () => {
    expect(describeNodes(nodes('and', 'or', 'or'), ['A', 'B', 'C'])).toBe('A, B ya da C');
    expect(describeNodes(nodes('and', 'and', 'and'), ['A', 'B', 'C'])).toBe('A, B ve C');
    expect(describeNodes(nodes('and'), ['A'])).toBe('A');
  });
  it('joinClauses 1/2/3', () => {
    expect(joinClauses(['A'], 'and')).toBe('A');
    expect(joinClauses(['A', 'B'], 'and')).toBe('A ve B');
    expect(joinClauses(['A', 'B', 'C'], 'or')).toBe('A, B ya da C');
  });
});
