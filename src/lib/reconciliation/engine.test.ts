import { describe, it, expect } from 'vitest';
import { generateCandidates } from './engine';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('generateCandidates', () => {
  const rows: RazaoRowWithIndex[] = [
    // Caso 1: par exato 1:1, mesmo documento referenciado -> ALTA
    row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Pagamento Fornecedor A NF 1234' }),
    row({ globalIdx: 1, credito: 500, data: new Date('2026-03-02'), historico: 'Recebimento Fornecedor A NF 1234' }),

    // Caso 2: soma N:1 -- 3 parcelas de 400 fecham com 1 recebimento de 1200
    row({ globalIdx: 2, debito: 400, data: new Date('2026-03-01'), historico: 'Parcela 1/3 NF 5001' }),
    row({ globalIdx: 3, debito: 400, data: new Date('2026-03-05'), historico: 'Parcela 2/3 NF 5001' }),
    row({ globalIdx: 4, debito: 400, data: new Date('2026-03-09'), historico: 'Parcela 3/3 NF 5001' }),
    row({ globalIdx: 5, credito: 1200, data: new Date('2026-03-10'), historico: 'Recebimento NF 5001' }),

    // Caso 3: falso positivo de valor -- mesmo valor, fornecedores diferentes
    row({ globalIdx: 6, debito: 700, data: new Date('2026-04-01'), historico: 'Fornecedor ABC Comercio Ltda' }),
    row({ globalIdx: 7, credito: 700, data: new Date('2026-04-01'), historico: 'Fornecedor XYZ Distribuidora SA' }),

    // Caso 4: baixa confianca -- sem relacao de texto e data muito distante
    row({ globalIdx: 8, debito: 900, data: new Date('2026-01-01'), historico: 'Pagamento Aluguel Sala 302' }),
    row({ globalIdx: 9, credito: 900, data: new Date('2026-12-01'), historico: 'Recebimento Juros Aplicacao CDB' }),
  ];

  const candidates = generateCandidates(rows);

  it('encontra o par exato 1:1 com confianca ALTA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 0 && c.groupB[0]?.globalIdx === 1);
    expect(found?.confidence).toBe('ALTA');
  });

  it('encontra a soma N:1 das 3 parcelas', () => {
    const found = candidates.find((c) => c.groupB[0]?.globalIdx === 5);
    expect(found?.groupA.map((r) => r.globalIdx).sort()).toEqual([2, 3, 4]);
  });

  it('nao classifica o falso positivo de valor como ALTA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 6 && c.groupB[0]?.globalIdx === 7);
    expect(found?.confidence).not.toBe('ALTA');
  });

  it('classifica o caso sem relacao como BAIXA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 8 && c.groupB[0]?.globalIdx === 9);
    expect(found?.confidence).toBe('BAIXA');
  });
});
