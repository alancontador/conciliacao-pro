import { describe, it, expect } from 'vitest';
import { RECONCILIATION_CONFIG } from './types';

describe('RECONCILIATION_CONFIG', () => {
  it('usa os valores padrao definidos no spec', () => {
    expect(RECONCILIATION_CONFIG.valueTolerance).toBe(0.01);
    expect(RECONCILIATION_CONFIG.timeWindowDays).toBe(60);
    expect(RECONCILIATION_CONFIG.maxCombinationSize).toBe(4);
    expect(RECONCILIATION_CONFIG.maxSubsetSumPoolSize).toBe(25);
    expect(RECONCILIATION_CONFIG.weights).toEqual({ valor: 50, texto: 35, data: 15 });
    expect(RECONCILIATION_CONFIG.thresholds).toEqual({ alta: 85, media: 60 });
  });
});
