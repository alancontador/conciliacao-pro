import { describe, it, expect } from 'vitest';
import { computeDateScore, computeGroupDateScore } from './date';
import type { RazaoRowWithIndex } from './types';

describe('computeDateScore', () => {
  it('score 1 quando as datas sao iguais', () => {
    const d = new Date('2026-03-01');
    expect(computeDateScore(d, d, 60).score).toBe(1);
  });

  it('score 0 quando a diferenca excede a janela', () => {
    const a = new Date('2026-01-01');
    const b = new Date('2026-06-01');
    expect(computeDateScore(a, b, 60).score).toBe(0);
  });

  it('decai linearmente dentro da janela', () => {
    const a = new Date('2026-03-01');
    const b = new Date('2026-03-31'); // 30 dias
    expect(computeDateScore(a, b, 60).score).toBeCloseTo(0.5, 1);
  });
});

describe('computeGroupDateScore', () => {
  it('usa a data mais recente de cada grupo', () => {
    const row = (data: string, globalIdx: number): RazaoRowWithIndex => ({
      conta: '1', data: new Date(data), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0, globalIdx,
    });
    const groupA = [row('2026-03-01', 0), row('2026-03-05', 1)];
    const groupB = [row('2026-03-06', 2)];
    expect(computeGroupDateScore(groupA, groupB, 60).detalhe).toContain('1 dia');
  });
});
