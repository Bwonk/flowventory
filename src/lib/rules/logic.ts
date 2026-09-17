import type { RuleLogic } from './types';

/**
 * Koşul başına bağlaç — saf. Öncelik standarttır (K1): VE, VEYA'dan önce
 * bağlanır; "A ve B ya da C" = (A ∧ B) ∨ C. Zincir VEYA'lardan bölünür,
 * her küme bir VE zinciridir. Motor, cümle ve oluşturucudaki küme çerçevesi
 * aynı gruplamayı (`groupNodes`) okur.
 */

type Linked = { op: RuleLogic };

/** Düğüm indekslerini VE kümelerine böler: [[0, 1], [2]]. İlk düğümün op'u yok sayılır. */
export function groupNodes(nodes: readonly Linked[]): number[][] {
  const groups: number[][] = [];
  nodes.forEach((node, index) => {
    if (index === 0 || node.op === 'or') groups.push([index]);
    else groups[groups.length - 1].push(index);
  });
  return groups;
}

/**
 * Koşul sonuçlarını (sağlanıyorsa gövde, değilse null) bağlaçlarla birleştirir.
 * Tamamı sağlanan kümelerin gövdelerini döner; hiçbiri yoksa (ya da koşul yoksa) null.
 */
export function evaluateNodes(nodes: readonly Linked[], results: ReadonlyArray<string | null>): string[] | null {
  const bodies: string[] = [];
  for (const group of groupNodes(nodes)) {
    const groupBodies = group.map(i => results[i] ?? null);
    if (groupBodies.every((b): b is string => b !== null)) bodies.push(...groupBodies);
  }
  return bodies.length > 0 ? bodies : null;
}

/** "A", "A ve B", "A, B ve C" / "A ya da B", "A, B ya da C". */
export function joinClauses(clauses: readonly string[], logic: RuleLogic): string {
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return clauses[0];
  const conj = logic === 'and' ? 've' : 'ya da';
  return `${clauses.slice(0, -1).join(', ')} ${conj} ${clauses[clauses.length - 1]}`;
}

/**
 * Cümle, motorla aynı gruplamayla: "A ve B ya da C". Hepsi VEYA ise
 * virgüllü liste ("A, B ya da C"); karışıkta kümeler " ya da " ile ayrılır.
 */
export function describeNodes(nodes: readonly Linked[], clauses: readonly string[]): string {
  const groups = groupNodes(nodes).map(group => group.map(i => clauses[i]));
  if (groups.every(g => g.length === 1)) return joinClauses(groups.map(g => g[0]), 'or');
  return groups.map(g => joinClauses(g, 'and')).join(' ya da ');
}
