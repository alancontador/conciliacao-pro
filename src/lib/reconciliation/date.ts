import { toTime } from './utils';
import type { RazaoRowWithIndex } from './types';

export interface DateScoreResult {
  score: number;
  detalhe: string;
}

export function computeDateScore(dateA: Date | string, dateB: Date | string, timeWindowDays: number): DateScoreResult {
  const diffMs = Math.abs(toTime(dateA) - toTime(dateB));
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > timeWindowDays) {
    return {
      score: 0,
      detalhe: `${Math.round(diffDays)} dia(s) de diferença (fora da janela de ${timeWindowDays} dias)`,
    };
  }
  return { score: 1 - diffDays / timeWindowDays, detalhe: `${Math.round(diffDays)} dia(s) de diferença` };
}

export function computeGroupDateScore(
  groupA: RazaoRowWithIndex[],
  groupB: RazaoRowWithIndex[],
  timeWindowDays: number,
): DateScoreResult {
  const latestA = groupA.reduce((max, r) => (toTime(r.data) > toTime(max.data) ? r : max));
  const latestB = groupB.reduce((max, r) => (toTime(r.data) > toTime(max.data) ? r : max));
  return computeDateScore(latestA.data, latestB.data, timeWindowDays);
}
