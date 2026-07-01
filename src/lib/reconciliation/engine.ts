import { RECONCILIATION_CONFIG } from './types';
import type { ReconciliationCandidate, ReconciliationConfig, RazaoRowWithIndex } from './types';
import { generateExactCandidates, generateSubsetSumCandidates } from './candidates';
import { scoreCandidate } from './scoring';

export function generateCandidates(
  rows: RazaoRowWithIndex[],
  config: ReconciliationConfig = RECONCILIATION_CONFIG,
): ReconciliationCandidate[] {
  const exactRaw = generateExactCandidates(rows);
  const matchedIdx = new Set(exactRaw.flatMap((c) => [...c.groupA, ...c.groupB].map((r) => r.globalIdx)));
  const subsetRaw = generateSubsetSumCandidates(rows, matchedIdx, config);

  return [...exactRaw, ...subsetRaw]
    .map((raw) => scoreCandidate(raw, config))
    .sort((a, b) => b.score - a.score);
}
