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

/**
 * Retorna true quando a conta e bancaria ou de aplicacao financeira.
 * Exige conta do ATIVO (codigo iniciando em "1") para evitar capturar contas
 * de resultado ou de passivo que tenham nome de banco na descricao.
 */
export function isContaBancariaOuAplicacao(codigo: string, descricao: string): boolean {
  const cod = (codigo ?? '').toString().trim();
  if (!cod.startsWith('1')) return false;

  const desc = normalizar(descricao);
  if (!desc) return false;

  if (PALAVRAS_EXCLUSAO.some((p) => desc.includes(p))) return false;

  return PALAVRAS_CHAVE.some((p) => desc.includes(p));
}
