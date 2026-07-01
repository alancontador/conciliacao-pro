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

  it('encontra combinacao no limite exato de maxCombinationSize (4)', () => {
    const rows = [
      row({ globalIdx: 0, debito: 300, data: new Date('2026-03-01') }),
      row({ globalIdx: 1, debito: 300, data: new Date('2026-03-02') }),
      row({ globalIdx: 2, debito: 300, data: new Date('2026-03-03') }),
      row({ globalIdx: 3, debito: 300, data: new Date('2026-03-04') }),
      row({ globalIdx: 4, credito: 1200, data: new Date('2026-03-05') }),
    ];
    const config = { ...RECONCILIATION_CONFIG, maxCombinationSize: 4 };
    const candidates = generateSubsetSumCandidates(rows, new Set(), config);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA.map((r) => r.globalIdx).sort()).toEqual([0, 1, 2, 3]);
    expect(candidates[0].groupB[0].globalIdx).toBe(4);
  });

  it('nao encontra combinacao quando precisaria exceder maxCombinationSize', () => {
    const rows = [
      row({ globalIdx: 0, debito: 300, data: new Date('2026-03-01') }),
      row({ globalIdx: 1, debito: 300, data: new Date('2026-03-02') }),
      row({ globalIdx: 2, debito: 300, data: new Date('2026-03-03') }),
      row({ globalIdx: 3, debito: 300, data: new Date('2026-03-04') }),
      row({ globalIdx: 4, credito: 1200, data: new Date('2026-03-05') }),
    ];
    const config = { ...RECONCILIATION_CONFIG, maxCombinationSize: 3 };
    expect(generateSubsetSumCandidates(rows, new Set(), config)).toHaveLength(0);
  });

  it('encontra 1 debito casado por soma de 3 creditos (direcao 1:N)', () => {
    const rows = [
      row({ globalIdx: 0, debito: 1200, data: new Date('2026-03-10') }),
      row({ globalIdx: 1, credito: 400, data: new Date('2026-03-01') }),
      row({ globalIdx: 2, credito: 400, data: new Date('2026-03-05') }),
      row({ globalIdx: 3, credito: 400, data: new Date('2026-03-09') }),
    ];
    const candidates = generateSubsetSumCandidates(rows, new Set(), RECONCILIATION_CONFIG);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA.map((r) => r.globalIdx)).toEqual([0]);
    expect(candidates[0].groupB.map((r) => r.globalIdx).sort()).toEqual([1, 2, 3]);
  });

  it('nao trava com muitos lancamentos sem combinacao valida (regressao de performance)', () => {
    // 200 debitos identicos e nenhum credito com soma alcancavel: antes da correcao,
    // a busca combinatoria (C(n, maxCombinationSize)) explodia e travava a aba com
    // contas de muitos lancamentos. O limite de pool (maxSubsetSumPoolSize) deve
    // manter isso rapido independente do total de lancamentos na conta.
    const debitos = Array.from({ length: 200 }, (_, i) =>
      row({ globalIdx: i, debito: 100, data: new Date(2026, 2, 1 + (i % 30)) }),
    );
    const creditos = Array.from({ length: 50 }, (_, i) =>
      row({ globalIdx: 200 + i, credito: 133.33, data: new Date(2026, 2, 15) }),
    );

    const start = Date.now();
    const candidates = generateSubsetSumCandidates([...debitos, ...creditos], new Set(), RECONCILIATION_CONFIG);
    const elapsedMs = Date.now() - start;

    expect(candidates).toHaveLength(0);
    expect(elapsedMs).toBeLessThan(3000);
  });
});
