import { createClient } from '@supabase/supabase-js';

const url  = import.meta.env.VITE_SUPABASE_URL  as string;
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error(
    'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas. ' +
    'Copie .env.example para .env e preencha com os dados do seu projeto Supabase.'
  );
}

export const supabase = createClient(url, key);

// ── Tipos das tabelas ──────────────────────────────────────────────────────────

export interface DbTenant {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string | null;
  plano: string;
  ativo: boolean;
  criado_em: string;
}

export interface DbProfile {
  id: string;
  tenant_id: string;
  nome: string;
  role: string;
  status: string;
  permissoes: Record<string, boolean>;
  criado_em: string;
  atualizado_em: string;
}

export interface DbEmpresa {
  id: string;
  tenant_id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  periodo: string | null;
  responsavel: string | null;
  email: string | null;
  telefone: string | null;
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface DbConta {
  id: string;
  empresa_id: string;
  tenant_id: string;
  numero: string;
  descricao: string | null;
  natureza: string | null;
  status: string;
  documentos: unknown[];
  prazo_regularizacao: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface DbDadosEmpresa {
  id: string;
  empresa_id: string;
  tenant_id: string;
  balancete_data: unknown[];
  razao_data: unknown[];
  reconciled_indices: number[];
  import_history: unknown[];
  atualizado_em: string;
}

export interface DbConvite {
  id: string;
  token: string;
  tenant_id: string;
  email: string;
  nome: string;
  role: string;
  permissoes: Record<string, boolean>;
  expires_at: string;
  aceito: boolean;
  criado_em: string;
}
