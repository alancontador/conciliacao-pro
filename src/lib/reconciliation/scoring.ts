import type {
  RazaoRowWithIndex, ReconciliationConfig, ConfidenceLevel, MatchReasons, ReconciliationCandidate,
} from './types';
import { computeTextScore } from './text';
import { computeGroupDateScore } from './date';
import type { RawCandidateGroup } from './candidates';

function computeGroupTextScore(groupA: RazaoRowWithIndex[], groupB: RazaoRowWithIndex[]) {
  let best = { score: 0, detalhe: 'Nenhuma similaridade textual relevante' };
  for (const a of groupA) {
    for (const b of groupB) {
      const result = computeTextScore(a.historico, b.historico);
      if (result.score > best.score) best = result;
    }
  }
  return best;
}

function computeValueScore(groupA: RazaoRowWithIndex[], groupB: RazaoRowWithIndex[]) {
  const totalItems = groupA.length + groupB.length;
  if (totalItems === 2) {
    return { score: 1, detalhe: 'Valor exato 1:1' };
  }
  const score = Math.max(0.5, 1 - (totalItems - 2) * 0.1);
  return { score, detalhe: `Soma de ${totalItems} lançamento(s) bate dentro da tolerância configurada` };
}

export function classify(score: number, config: ReconciliationConfig): ConfidenceLevel {
  if (score >= config.thresholds.alta) return 'ALTA';
  if (score >= config.thresholds.media) return 'MEDIA';
  return 'BAIXA';
}

export function scoreCandidate(raw: RawCandidateGroup, config: ReconciliationConfig): ReconciliationCandidate {
  const valor = computeValueScore(raw.groupA, raw.groupB);
  const texto = computeGroupTextScore(raw.groupA, raw.groupB);
  const data = computeGroupDateScore(raw.groupA, raw.groupB, config.timeWindowDays);

  const rawScore =
    valor.score * config.weights.valor +
    texto.score * config.weights.texto +
    data.score * config.weights.data;
  const score = Math.round(rawScore);

  const reasons: MatchReasons = {
    valorScore: valor.score, valorDetalhe: valor.detalhe,
    textoScore: texto.score, textoDetalhe: texto.detalhe,
    dataScore: data.score, dataDetalhe: data.detalhe,
  };

  const allIdx = [...raw.groupA, ...raw.groupB].map((r) => r.globalIdx).sort((a, b) => a - b);

  return {
    id: allIdx.join('-'),
    groupA: raw.groupA,
    groupB: raw.groupB,
    score,
    confidence: classify(score, config),
    reasons,
  };
}
