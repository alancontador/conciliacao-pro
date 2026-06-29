export interface Empresa {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  periodo: string;
  responsavel: string;
  email?: string;
  telefone?: string;
  ativa: boolean;
  createdAt: Date;
  updatedAt: Date;
}
