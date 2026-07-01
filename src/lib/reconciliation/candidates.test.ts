import { describe, it, expect } from 'vitest';
import { generateExactCandidates, generateSubsetSumCandidates } from './candidates';
import { RECONCILIATION_CONFIG } from './types';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('generateExactCandidates', () => {
  it('pareia debito e credito de mesmo valor absoluto', () => {
    const rows = [
      row({ globalIdx: 0, debito: 500, historico: 'Pagamento Fornecedor A' }),
      row({ globalIdx: 1, credito: 500, historico: 'Recebimento Fornecedor A' }),
    ];
    const candidates = generateExactCandidates(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA[0].globalIdx).toBe(0);
    expect(candidates[0].groupB[0].globalIdx).toBe(1);
  });

  it('nao pareia quando os valores sao diferentes', () => {
    const rows = [row({ globalIdx: 0, debito: 500 }), row({ globalIdx: 1, credito: 300 })];
    expect(generateExactCandidates(rows)).toHaveLength(0);
  });
});

describe('generateSubsetSumCandidates', () => {
  it('encontra soma de 3 debitos que bate com 1 credito', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400, data: new Date('2026-03-01') }),
      row({ globalIdx: 1, debito: 400, data: new Date('2026-03-05') }),
      row({ globalIdx: 2, debito: 400, data: new Date('2026-03-09') }),
      row({ globalIdx: 3, credito: 1200, data: new Date('2026-03-10') }),
    ];
    const candidates = generateSubsetSumCandidates(rows, new Set(), RECONCILIATION_CONFIG);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA.map((r) => r.globalIdx).sort()).toEqual([0, 1, 2]);
    expect(candidates[0].groupB[0].globalIdx).toBe(3);
  });

  it('ignora combinacoes fora da janela de tempo', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400, data: new Date('2026-01-01') }),
      row({ globalIdx: 1, debito: 400, data: new Date('2026-01-05') }),
      row({ globalIdx: 2, debito: 400, data: new Date('2026-01-09') }),
      row({ globalIdx: 3, credito: 1200, data: new Date('2026-12-01') }),
    ];
    expect(generateSubsetSumCandidates(rows, new Set(), RECONCILIATION_CONFIG)).toHaveLength(0);
  });

  it('respeita indices ja pareados', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400 }),
      row({ globalIdx: 1, debito: 400 }),
      row({ globalIdx: 2, credito: 400 }),
    ];
    expect(generateSubsetSumCandidates(rows, new Set([0]), RECONCILIATION_CONFIG)).toHaveLength(0);
  });
});
