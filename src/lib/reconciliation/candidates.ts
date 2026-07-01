import type { RazaoRowWithIndex, ReconciliationConfig } from './types';
import { toTime, roundCents } from './utils';

export interface RawCandidateGroup {
  groupA: RazaoRowWithIndex[];
  groupB: RazaoRowWithIndex[];
}

export function generateExactCandidates(rows: RazaoRowWithIndex[]): RawCandidateGroup[] {
  const debitos = rows.filter((r) => r.debito > 0).sort((a, b) => toTime(a.data) - toTime(b.data));
  const creditos = rows.filter((r) => r.credito > 0).sort((a, b) => toTime(a.data) - toTime(b.data));

  const debitosByValue = new Map<number, RazaoRowWithIndex[]>();
  for (const row of debitos) {
    const key = roundCents(row.debito);
    const list = debitosByValue.get(key) ?? [];
    list.push(row);
    debitosByValue.set(key, list);
  }

  const candidates: RawCandidateGroup[] = [];
  for (const credito of creditos) {
    const key = roundCents(credito.credito);
    const debito = debitosByValue.get(key)?.shift();
    if (!debito) continue;
    candidates.push({ groupA: [debito], groupB: [credito] });
  }

  return candidates;
}

function valueOf(r: RazaoRowWithIndex): number {
  return r.debito > 0 ? r.debito : r.credito;
}

// Limite de nós explorados por busca: contas com muitos lançamentos não podem travar a aba
// mesmo que, por algum motivo, um pool maior que maxSubsetSumPoolSize chegue até aqui.
const SEARCH_VISIT_BUDGET = 50_000;

function findSubsetSum(
  pool: RazaoRowWithIndex[],
  target: number,
  tolerance: number,
  maxSize: number,
): RazaoRowWithIndex[] | null {
  const sorted = [...pool].sort((a, b) => valueOf(b) - valueOf(a));
  let visited = 0;

  function search(startIdx: number, remaining: number, picked: RazaoRowWithIndex[]): RazaoRowWithIndex[] | null {
    if (Math.abs(remaining) <= tolerance && picked.length >= 2) return picked;
    if (picked.length >= maxSize) return null;
    for (let i = startIdx; i < sorted.length; i++) {
      if (++visited > SEARCH_VISIT_BUDGET) return null;
      const value = valueOf(sorted[i]);
      if (value - remaining > tolerance) continue; // maior que o restante: pula (lista ordenada desc)
      const result = search(i + 1, remaining - value, [...picked, sorted[i]]);
      if (result) return result;
    }
    return null;
  }

  return search(0, target, []);
}

// Reduz o pool de candidatos ao subconjunto mais relevante (mais próximo em data do alvo)
// antes de rodar a busca combinatória — sem isso, C(n, maxCombinationSize) explode com
// contas de muitos lançamentos e trava a aba.
function limitPool(
  pool: RazaoRowWithIndex[],
  target: RazaoRowWithIndex,
  maxSize: number,
): RazaoRowWithIndex[] {
  if (pool.length <= maxSize) return pool;
  return [...pool]
    .sort((a, b) => Math.abs(toTime(a.data) - toTime(target.data)) - Math.abs(toTime(b.data) - toTime(target.data)))
    .slice(0, maxSize);
}

export function generateSubsetSumCandidates(
  rows: RazaoRowWithIndex[],
  alreadyMatchedIdx: Set<number>,
  config: ReconciliationConfig,
): RawCandidateGroup[] {
  const debitos = rows.filter((r) => r.debito > 0 && !alreadyMatchedIdx.has(r.globalIdx));
  const creditos = rows.filter((r) => r.credito > 0 && !alreadyMatchedIdx.has(r.globalIdx));

  const candidates: RawCandidateGroup[] = [];
  const usedIdx = new Set<number>();
  const withinWindow = (a: RazaoRowWithIndex, b: RazaoRowWithIndex) =>
    Math.abs(toTime(a.data) - toTime(b.data)) <= config.timeWindowDays * 86400000;

  for (const target of creditos) {
    if (usedIdx.has(target.globalIdx)) continue;
    const pool = limitPool(
      debitos.filter((d) => !usedIdx.has(d.globalIdx) && withinWindow(d, target)),
      target,
      config.maxSubsetSumPoolSize,
    );
    const combo = findSubsetSum(pool, target.credito, config.valueTolerance, config.maxCombinationSize);
    if (combo) {
      combo.forEach((r) => usedIdx.add(r.globalIdx));
      usedIdx.add(target.globalIdx);
      candidates.push({ groupA: combo, groupB: [target] });
    }
  }

  for (const target of debitos) {
    if (usedIdx.has(target.globalIdx)) continue;
    const pool = limitPool(
      creditos.filter((c) => !usedIdx.has(c.globalIdx) && withinWindow(c, target)),
      target,
      config.maxSubsetSumPoolSize,
    );
    const combo = findSubsetSum(pool, target.debito, config.valueTolerance, config.maxCombinationSize);
    if (combo) {
      combo.forEach((r) => usedIdx.add(r.globalIdx));
      usedIdx.add(target.globalIdx);
      candidates.push({ groupA: [target], groupB: combo });
    }
  }

  return candidates;
}
