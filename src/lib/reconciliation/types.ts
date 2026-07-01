import type { RazaoRow } from '@/types/accounting';

export interface RazaoRowWithIndex extends RazaoRow {
  globalIdx: number;
}

export interface ReconciliationConfig {
  valueTolerance: number;
  timeWindowDays: number;
  maxCombinationSize: number;
  weights: { valor: number; texto: number; data: number };
  thresholds: { alta: number; media: number };
}

export const RECONCILIATION_CONFIG: ReconciliationConfig = {
  valueTolerance: 0.01,
  timeWindowDays: 60,
  maxCombinationSize: 4,
  weights: { valor: 50, texto: 35, data: 15 },
  thresholds: { alta: 85, media: 60 },
};

export type ConfidenceLevel = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface MatchReasons {
  valorScore: number;
  valorDetalhe: string;
  textoScore: number;
  textoDetalhe: string;
  dataScore: number;
  dataDetalhe: string;
}

export interface ReconciliationCandidate {
  id: string;
  groupA: RazaoRowWithIndex[];
  groupB: RazaoRowWithIndex[];
  score: number;
  confidence: ConfidenceLevel;
  reasons: MatchReasons;
}
