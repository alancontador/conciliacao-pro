import { describe, it, expect } from 'vitest';
import { scoreCandidate, classify } from './scoring';
import { RECONCILIATION_CONFIG } from './types';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('classify', () => {
  it('classifica os limiares configurados', () => {
    expect(classify(90, RECONCILIATION_CONFIG)).toBe('ALTA');
    expect(classify(70, RECONCILIATION_CONFIG)).toBe('MEDIA');
    expect(classify(40, RECONCILIATION_CONFIG)).toBe('BAIXA');
  });
});

describe('scoreCandidate', () => {
  it('par exato 1:1 com mesmo documento referenciado recebe confianca ALTA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Pagamento Fornecedor A NF 1234' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-03-02'), historico: 'Recebimento Fornecedor A NF 1234' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).toBe('ALTA');
  });

  it('falso positivo de valor com fornecedores diferentes nunca fica ALTA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Fornecedor ABC Comercio Ltda' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-03-01'), historico: 'Fornecedor XYZ Distribuidora SA' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).not.toBe('ALTA');
  });

  it('lancamentos sem relacao de texto e com data distante ficam BAIXA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-01-01'), historico: 'Pagamento Aluguel Sala 302' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-12-01'), historico: 'Recebimento Juros Aplicacao CDB' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).toBe('BAIXA');
  });

  it('produz um id estavel a partir dos indices globais ordenados', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 5, debito: 100 })],
      groupB: [row({ globalIdx: 2, credito: 100 })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.id).toBe('2-5');
  });
});
