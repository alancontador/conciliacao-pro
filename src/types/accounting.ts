export interface Conta {
  numero: string;
  descricao: string;
  natureza: 'ATIVO' | 'PASSIVO';
  contabilidade: number;
  composicao: number;
  diferenca: number;
  status: 'CONCILIADO' | 'NAO_CONCILIADO' | 'EM_ANALISE';
  documentos: Documento[];
  prazoRegularizacao?: Date;
  observacoes?: string;
  movimentacoes: Movimentacao[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Documento {
  id: string;
  nome: string;
  tipo: string;
  tamanho: number;
  url: string;
  uploadedAt: Date;
  uploadedBy: string;
}

export interface Movimentacao {
  id: string;
  data: Date;
  lote: string;
  historico: string;
  debito: number;
  credito: number;
  saldoExercicio: number;
}

export interface BalanceteRow {
  codigo: string;
  classificacao: string;
  descricao: string;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoAtual: number;
  natureza: 'ATIVO' | 'PASSIVO';
}

export interface RazaoRow {
  conta: string;
  data: Date;
  lote: string;
  historico: string;
  debito: number;
  credito: number;
  saldoExercicio: number;
  isManual?: boolean;
}

export interface ImportHistory {
  id: string;
  tipo: 'BALANCETE' | 'RAZAO';
  arquivo: string;
  data: Date;
  usuario: string;
  linhasLidas: number;
  linhasIgnoradas: number;
  erros: string[];
  status: 'SUCESSO' | 'ERRO' | 'PARCIAL';
}

export interface CompanyInfo {
  nome: string;
  cnpj: string;
  periodo: string;
  responsavel: string;
}

export interface KPIData {
  totalContas: number;
  contasConciliadas: number;
  contasPendentes: number;
  percentualConciliacao: number;
  contasAlerta: number;
  prazoMedioRegularizacao: number;
}