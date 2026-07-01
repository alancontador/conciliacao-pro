import { createClient } from '@supabase/supabase-js';

// Lê variáveis injetadas em runtime (Docker) ou em build time (Vite dev)
declare global {
  interface Window {
    __env?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
  }
}

const url = window.__env?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
const key = window.__env?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');

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

export interface DbConciliacaoAuditoria {
  id: string;
  tenant_id: string;
  empresa_id: string;
  conta_numero: string;
  razao_indices: number[];
  score: number;
  criterios: Record<string, unknown>;
  usuario_id: string | null;
  criado_em: string;
}
