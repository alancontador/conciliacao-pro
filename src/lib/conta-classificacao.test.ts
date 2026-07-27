import { describe, it, expect } from 'vitest';
import { isContaBancariaOuAplicacao } from './conta-classificacao';

describe('isContaBancariaOuAplicacao', () => {
  it('reconhece contas bancárias do ativo', () => {
    expect(isContaBancariaOuAplicacao('1.1.1.02.000001', 'BANCO ITAU S/A')).toBe(true);
    expect(isContaBancariaOuAplicacao('1.1.1.02.000003', 'BCO BRADESCO CONTA MOVIMENTO')).toBe(true);
    expect(isContaBancariaOuAplicacao('1.1.1.02.000004', 'BANCO DO BRASIL - CONTA CORRENTE')).toBe(true);
  });

  it('reconhece aplicações financeiras', () => {
    expect(isContaBancariaOuAplicacao('1.1.1.03.000001', 'CDB - BANCO ITAU')).toBe(true);
    expect(isContaBancariaOuAplicacao('1.1.2.01.000001', 'APLICAÇÕES FINANCEIRAS')).toBe(true);
    expect(isContaBancariaOuAplicacao('1.1.2.01.000002', 'FUNDO DE INVESTIMENTO RENDA FIXA')).toBe(true);
    expect(isContaBancariaOuAplicacao('1.1.2.01.000003', 'POUPANÇA')).toBe(true);
  });

  it('ignora caixa e demais contas do ativo', () => {
    expect(isContaBancariaOuAplicacao('1.1.1.01.000001', 'CAIXA EM MOEDA NACIONAL')).toBe(false);
    expect(isContaBancariaOuAplicacao('1.1.3.08.000001', 'IPI A RECUPERAR')).toBe(false);
    expect(isContaBancariaOuAplicacao('1.1.5.01.000002', 'MATÉRIA-PRIMA')).toBe(false);
  });

  it('ignora contas de resultado e passivo com nome de banco', () => {
    expect(isContaBancariaOuAplicacao('4.1.2.01.000010', 'DESPESAS BANCARIAS')).toBe(false);
    expect(isContaBancariaOuAplicacao('3.1.1.01.000005', 'JUROS BANCARIOS ATIVOS')).toBe(false);
    expect(isContaBancariaOuAplicacao('2.1.2.01.000001', 'BANCO ITAU - EMPRESTIMO')).toBe(false);
    expect(isContaBancariaOuAplicacao('2.1.2.01.000002', 'FINANCIAMENTO BANCO BRADESCO')).toBe(false);
  });

  it('tolera código/descrição vazios', () => {
    expect(isContaBancariaOuAplicacao('', 'BANCO ITAU')).toBe(false);
    expect(isContaBancariaOuAplicacao('1.1.1.02.000001', '')).toBe(false);
  });
});
