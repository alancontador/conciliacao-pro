// Classificacao de contas do plano de contas.
//
// Regra de negocio: contas bancarias (conta corrente/movimento) e aplicacoes
// financeiras sao conciliadas fora do sistema (pelo extrato bancario), portanto
// entram como CONCILIADAS automaticamente, sem depender do casamento
// balancete x razao.

// Marcas de acentuacao geradas por normalize('NFD') (U+0300..U+036F).
// Construido via RegExp para manter o arquivo em ASCII puro.
const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

const normalizar = (s: string): string =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toUpperCase()
    .replace(/\s{2,}/g, ' ')
    .trim();

// Palavras que caracterizam conta bancaria ou aplicacao financeira.
const PALAVRAS_CHAVE = [
  'BANCO',
  'BANCOS',
  'BCO',
  'CONTA CORRENTE',
  'CONTA MOVIMENTO',
  'C/C',
  'APLICACAO',
  'APLICACOES',
  'INVESTIMENTO',
  'INVESTIMENTOS',
  'CDB',
  'RDB',
  'LCI',
  'LCA',
  'POUPANCA',
  'FUNDO DE INVEST',
  'TITULOS E VALORES MOBILIARIOS',
  'TESOURO DIRETO',
];

// Palavras que descaracterizam: despesas/receitas ou obrigacoes ligadas a banco,
// e nao o saldo da conta bancaria em si (ex.: "DESPESAS BANCARIAS",
// "BANCO ITAU - EMPRESTIMO", "JUROS S/ APLICACAO").
const PALAVRAS_EXCLUSAO = [
  'DESPESA',
  'TARIFA',
  'JUROS',
  'TAXA',
  'IOF',
  'ENCARGO',
  'EMPRESTIMO',
  'FINANCIAMENTO',
  'CHEQUE ESPECIAL',
  'CONTA GARANTIDA',
  'A RECOLHER',
  'A RECUPERAR',
  'A PAGAR',
  'A RECEBER',
  'RENDIMENTO',
  'VARIACAO',
  'PROVISAO',
];

export interface ContaClassificavel {
  /** Codigo contabil pontuado (ex.: "1.1.1.02.000001"). */
  classificacao?: string;
  descricao: string;
  natureza?: 'ATIVO' | 'PASSIVO';
}

/**
 * Retorna true quando a conta e bancaria ou de aplicacao financeira.
 *
 * Exige conta do ATIVO para nao capturar contas de resultado ou de passivo que
 * tenham nome de banco na descricao. A natureza vem do campo `natureza` (ja
 * derivado da classificacao na importacao do balancete) ou, na falta dele, da
 * `classificacao` iniciada em "1".
 *
 * ATENCAO: nao usar o campo `codigo` do balancete — no layout Dominio ele e o
 * codigo interno da conta (5, 11, 302...), e nao o codigo contabil pontuado.
 */
type ContaComStatus = ContaClassificavel & {
  status: 'CONCILIADO' | 'NAO_CONCILIADO' | 'EM_ANALISE';
  conciliadoPorRegra?: boolean;
};

/**
 * Forca status CONCILIADO em contas bancarias/aplicacoes, marcando a origem.
 * Usado no caminho em que as contas vem persistidas (sem balancete carregado),
 * onde o status salvo pode ser anterior a criacao da regra.
 */
export function aplicarRegraBancaria<T extends ContaComStatus>(conta: T): T {
  if (!isContaBancariaOuAplicacao(conta)) return conta;
  if (conta.status === 'CONCILIADO' && conta.conciliadoPorRegra) return conta;
  return { ...conta, status: 'CONCILIADO', conciliadoPorRegra: true };
}

export function isContaBancariaOuAplicacao(conta: ContaClassificavel): boolean {
  const classif = (conta.classificacao ?? '').toString().trim();
  const isAtivo = conta.natureza ? conta.natureza === 'ATIVO' : classif.startsWith('1');
  if (!isAtivo) return false;

  const desc = normalizar(conta.descricao);
  if (!desc) return false;

  if (PALAVRAS_EXCLUSAO.some((p) => desc.includes(p))) return false;

  return PALAVRAS_CHAVE.some((p) => desc.includes(p));
}
