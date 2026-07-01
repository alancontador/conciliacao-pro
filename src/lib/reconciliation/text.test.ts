import { describe, it, expect } from 'vitest';
import {
  normalizeText, extractDocumentSignals, levenshteinDistance, fuzzyTokenSimilarity, computeTextScore,
} from './text';

describe('normalizeText', () => {
  it('remove acentos, baixa a caixa e colapsa espacos', () => {
    expect(normalizeText('  Pagamento   FORNECEDOR Ação  ')).toBe('pagamento fornecedor acao');
  });
});

describe('extractDocumentSignals', () => {
  it('extrai CNPJ formatado', () => {
    expect(extractDocumentSignals('pagamento cnpj 12.345.678/0001-99')).toContain('12345678000199');
  });

  it('extrai numero de NF/documento apos palavra-chave', () => {
    expect(extractDocumentSignals('recebimento nf 5001 cliente x')).toContain('5001');
  });

  it('retorna vazio quando nao ha sinais', () => {
    expect(extractDocumentSignals('pagamento diverso sem referencia')).toEqual([]);
  });
});

describe('levenshteinDistance', () => {
  it('retorna 0 para strings iguais', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('conta uma substituicao simples', () => {
    expect(levenshteinDistance('gato', 'pato')).toBe(1);
  });
});

describe('fuzzyTokenSimilarity', () => {
  it('mantem similaridade razoavel quando so a direcao da transacao muda', () => {
    const score = fuzzyTokenSimilarity('pagamento fornecedor a', 'recebimento fornecedor a');
    expect(score).toBeGreaterThan(0.4);
  });

  it('penaliza fortemente fornecedores diferentes mesmo com texto parecido', () => {
    const score = fuzzyTokenSimilarity('fornecedor abc comercio ltda', 'fornecedor xyz distribuidora sa');
    expect(score).toBeLessThan(0.3);
  });
});

describe('computeTextScore', () => {
  it('da score maximo quando ha documento em comum', () => {
    const result = computeTextScore('recebimento nf 5001 cliente x', 'parcela 1/3 nf 5001 cliente x');
    expect(result.score).toBe(1);
  });

  it('cai para a similaridade de texto quando nao ha documento em comum', () => {
    const result = computeTextScore('fornecedor abc comercio ltda', 'fornecedor xyz distribuidora sa');
    expect(result.score).toBeLessThan(0.3);
  });
});
