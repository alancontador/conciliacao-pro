import { describe, it, expect } from 'vitest';
import { isContaBancariaOuAplicacao } from './conta-classificacao';

// Atalho com os campos que o balancete importado realmente traz.
const conta = (classificacao: string, descricao: string) => ({
  classificacao,
  descricao,
  natureza: (/^1/.test(classificacao) ? 'ATIVO' : 'PASSIVO') as 'ATIVO' | 'PASSIVO',
});

describe('isContaBancariaOuAplicacao', () => {
  it('reconhece contas bancárias do ativo', () => {
    expect(isContaBancariaOuAplicacao(conta('1.1.1.02.000001', 'BANCO ITAU S/A'))).toBe(true);
    expect(isContaBancariaOuAplicacao(conta('1.1.1.02.000003', 'BCO BRADESCO CONTA MOVIMENTO'))).toBe(true);
    expect(isContaBancariaOuAplicacao(conta('1.1.1.02.000004', 'BANCO DO BRASIL - CONTA CORRENTE'))).toBe(true);
  });

  it('reconhece aplicações financeiras', () => {
    expect(isContaBancariaOuAplicacao(conta('1.1.1.03.000001', 'CDB - BANCO ITAU'))).toBe(true);
    expect(isContaBancariaOuAplicacao(conta('1.1.2.01.000001', 'APLICAÇÕES FINANCEIRAS'))).toBe(true);
    expect(isContaBancariaOuAplicacao(conta('1.1.2.01.000002', 'FUNDO DE INVESTIMENTO RENDA FIXA'))).toBe(true);
    expect(isContaBancariaOuAplicacao(conta('1.1.2.01.000003', 'POUPANÇA'))).toBe(true);
  });

  // Regressão: o balancete do Domínio traz `codigo` = código interno (5, 11, 302...)
  // e `classificacao` = código contábil pontuado. A regra deve olhar a
  // classificação/natureza, nunca o código interno.
  it('não depende do código interno do Domínio', () => {
    expect(isContaBancariaOuAplicacao({
      classificacao: '1.1.1.02.000005',
      descricao: 'BANCO SANTANDER C/C',
      natureza: 'ATIVO',
    })).toBe(true);
    // mesma conta, sem natureza informada: cai na classificação
    expect(isContaBancariaOuAplicacao({
      classificacao: '1.1.1.02.000005',
      descricao: 'BANCO SANTANDER C/C',
    })).toBe(true);
  });

  it('ignora caixa e demais contas do ativo', () => {
    expect(isContaBancariaOuAplicacao(conta('1.1.1.01.000001', 'CAIXA EM MOEDA NACIONAL'))).toBe(false);
    expect(isContaBancariaOuAplicacao(conta('1.1.3.08.000001', 'IPI A RECUPERAR'))).toBe(false);
    expect(isContaBancariaOuAplicacao(conta('1.1.5.01.000002', 'MATÉRIA-PRIMA'))).toBe(false);
  });

  it('ignora contas de resultado e passivo com nome de banco', () => {
    expect(isContaBancariaOuAplicacao(conta('4.1.2.01.000010', 'DESPESAS BANCARIAS'))).toBe(false);
    expect(isContaBancariaOuAplicacao(conta('3.1.1.01.000005', 'JUROS BANCARIOS ATIVOS'))).toBe(false);
    expect(isContaBancariaOuAplicacao(conta('2.1.2.01.000001', 'BANCO ITAU - EMPRESTIMO'))).toBe(false);
    expect(isContaBancariaOuAplicacao(conta('2.1.2.01.000002', 'FINANCIAMENTO BANCO BRADESCO'))).toBe(false);
  });

  it('tolera classificação/descrição vazias', () => {
    expect(isContaBancariaOuAplicacao({ classificacao: '', descricao: 'BANCO ITAU' })).toBe(false);
    expect(isContaBancariaOuAplicacao({ classificacao: '1.1.1.02.000001', descricao: '' })).toBe(false);
  });
});
