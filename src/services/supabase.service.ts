import { supabase } from '@/lib/supabase';
import type { DbProfile, DbEmpresa, DbConta, DbDadosEmpresa, DbConvite, DbCompetencia } from '@/lib/supabase';
import type { KPIData } from '@/types/accounting';
import type { Empresa } from '@/types/empresa';
import type { Usuario, PermissoesUsuario } from '@/types/usuario';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory } from '@/types/accounting';
import type { MatchReasons } from '@/lib/reconciliation/types';

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function resetPasswordForEmail(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export async function updatePassword(newPassword: string) {
  return supabase.auth.updateUser({ password: newPassword });
}

// ── Tenant ───────────────────────────────────────────────────────────────────

export async function createTenantAndAdmin(params: {
  tenantNome: string;
  tenantCnpj?: string;
  adminNome: string;
  email: string;
  password: string;
}) {
  // 1. Tenta criar conta; se já existe, faz login direto
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
  });

  let session = signUpData?.session;
  let userId = signUpData?.user?.id;

  // Supabase pode retornar erro "already registered" — tenta login nesse caso
  if (signUpError || !userId) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });
    if (signInError || !signInData.user) {
      throw new Error(signUpError?.message ?? 'Erro ao criar conta');
    }
    session = signInData.session;
    userId = signInData.user.id;
  }

  // Se signUp funcionou mas sem sessão, faz login para obter sessão
  if (!session) {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });
    if (signInError || !signInData.session) {
      throw new Error('Confirme seu e-mail antes de continuar.');
    }
    session = signInData.session;
    userId = signInData.user!.id;
  }

  // 2. Verifica se já existe profile para este usuário (e-mail já cadastrado)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (existingProfile) {
    await supabase.auth.signOut();
    throw new Error('Este e-mail já possui uma conta cadastrada. Faça login.');
  }

  // 3. Cria tenant + profile via RPC com SECURITY DEFINER (bypass RLS)
  const adminPermissoes: PermissoesUsuario = {
    verDashboard: true, verStatus: true, editarStatus: true,
    importar: true, exportar: true, gerenciarUsuarios: true, gerenciarEmpresas: true,
  };
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'signup_create_tenant_and_profile',
    {
      p_tenant_nome: params.tenantNome,
      p_tenant_cnpj: params.tenantCnpj ?? '',
      p_admin_nome: params.adminNome,
      p_permissoes: adminPermissoes,
    },
  );
  if (rpcError) throw new Error('Erro ao configurar escritório: ' + rpcError.message);

  // Salva email no profile do admin (a RPC não recebe o email)
  await supabase.from('profiles').update({ email: params.email }).eq('id', userId);

  return { userId, tenantId: (rpcData as { tenant_id: string }).tenant_id };
}

// ── Profile (usuário logado) ──────────────────────────────────────────────────

export async function loadMyProfile(): Promise<DbProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .single();
  return data;
}

// ── Usuários (CRUD de profiles do tenant) ────────────────────────────────────

export async function loadUsuarios(tenantId: string): Promise<DbProfile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('criado_em');
  return data ?? [];
}

export async function createConvite(params: {
  tenantId: string;
  email: string;
  nome: string;
  role: string;
  permissoes: PermissoesUsuario;
}): Promise<DbConvite> {
  const { data, error } = await supabase
    .from('convites')
    .insert({
      tenant_id: params.tenantId,
      email: params.email,
      nome: params.nome,
      role: params.role,
      permissoes: params.permissoes,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Erro ao criar convite');
  return data;
}

export async function updateProfile(
  id: string,
  updates: Partial<Pick<DbProfile, 'nome' | 'role' | 'status' | 'permissoes'>>,
) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', id);
  if (error) throw error;
}

export async function deleteProfile(id: string) {
  // Deleta o profile (o auth.users é deletado em cascata pelo Supabase ou manualmente)
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
}

// ── Convites ─────────────────────────────────────────────────────────────────

export async function loadConviteByToken(token: string): Promise<DbConvite | null> {
  const { data } = await supabase
    .from('convites')
    .select('*')
    .eq('token', token)
    .eq('aceito', false)
    .single();
  return data;
}

export async function aceitarConvite(token: string, nome: string, password: string): Promise<void> {
  // 1. Busca o convite
  const convite = await loadConviteByToken(token);
  if (!convite) throw new Error('Convite inválido ou expirado');
  if (new Date(convite.expires_at) < new Date()) throw new Error('Convite expirado');

  // 2. Cria conta no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: convite.email,
    password,
  });
  if (authError || !authData.user) throw authError ?? new Error('Erro ao criar conta');

  // 3. Cria o profile
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    tenant_id: convite.tenant_id,
    nome,
    email: convite.email,
    role: convite.role,
    status: 'ativo',
    permissoes: convite.permissoes,
  });
  if (profileError) throw profileError;

  // 4. Marca convite como aceito
  await supabase.from('convites').update({ aceito: true }).eq('token', token);
}

// ── Empresas ──────────────────────────────────────────────────────────────────

export async function loadEmpresas(tenantId: string): Promise<DbEmpresa[]> {
  const { data } = await supabase
    .from('empresas')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('razao_social');
  return data ?? [];
}

export async function insertEmpresa(
  tenantId: string,
  e: Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<DbEmpresa> {
  const { data, error } = await supabase
    .from('empresas')
    .insert({
      tenant_id: tenantId,
      razao_social: e.razaoSocial,
      nome_fantasia: e.nomeFantasia ?? null,
      cnpj: e.cnpj,
      responsavel: e.responsavel,
      email: e.email ?? null,
      telefone: e.telefone ?? null,
      ativa: e.ativa,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Erro ao inserir empresa');
  return data;
}

export async function updateEmpresaDb(id: string, updates: Partial<Omit<Empresa, 'id' | 'createdAt'>>) {
  const { error } = await supabase
    .from('empresas')
    .update({
      razao_social: updates.razaoSocial,
      nome_fantasia: updates.nomeFantasia ?? null,
      cnpj: updates.cnpj,
      responsavel: updates.responsavel,
      email: updates.email ?? null,
      telefone: updates.telefone ?? null,
      ativa: updates.ativa,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEmpresaDb(id: string) {
  const { error } = await supabase.from('empresas').delete().eq('id', id);
  if (error) throw error;
}

// ── Competências ──────────────────────────────────────────────────────────────

export async function loadCompetencias(empresaId: string): Promise<DbCompetencia[]> {
  const { data } = await supabase
    .from('competencias')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('competencia', { ascending: false });
  return data ?? [];
}

// Cria a competência se ainda não existir; retorna a linha existente ou criada.
export async function ensureCompetencia(
  tenantId: string,
  empresaId: string,
  competencia: string,
): Promise<DbCompetencia> {
  const { data, error } = await supabase
    .from('competencias')
    .upsert(
      { tenant_id: tenantId, empresa_id: empresaId, competencia },
      { onConflict: 'empresa_id,competencia', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  // ignoreDuplicates não retorna a linha existente — busca-a.
  const { data: existing, error: selErr } = await supabase
    .from('competencias')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)
    .single();
  if (selErr || !existing) throw selErr ?? new Error('Erro ao carregar competência');
  return existing;
}

export async function updateCompetenciaStatus(
  empresaId: string,
  competencia: string,
  status: 'EM_ANDAMENTO' | 'CONCLUIDA',
  opts: { concluidaPor?: string | null; kpisSnapshot?: KPIData | null } = {},
) {
  const payload: Record<string, unknown> = { status };
  if (status === 'CONCLUIDA') {
    payload.concluida_em = new Date().toISOString();
    payload.concluida_por = opts.concluidaPor ?? null;
    if (opts.kpisSnapshot !== undefined) payload.kpis_snapshot = opts.kpisSnapshot;
  } else {
    payload.concluida_em = null;
    payload.concluida_por = null;
  }
  const { error } = await supabase
    .from('competencias')
    .update(payload)
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia);
  if (error) throw error;
}

// ── Contas ────────────────────────────────────────────────────────────────────

export async function loadContas(empresaId: string, competencia: string): Promise<DbConta[]> {
  const { data } = await supabase
    .from('contas')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia);
  return data ?? [];
}

export async function upsertContas(
  tenantId: string,
  empresaId: string,
  competencia: string,
  contas: Conta[],
) {
  if (!contas.length) return;
  const rows = contas.map((c) => ({
    empresa_id: empresaId,
    tenant_id: tenantId,
    competencia,
    numero: c.numero,
    descricao: c.descricao,
    natureza: c.natureza,
    status: c.status,
    documentos: c.documentos ?? [],
    prazo_regularizacao: c.prazoRegularizacao ?? null,
  }));
  const { error } = await supabase
    .from('contas')
    .upsert(rows, { onConflict: 'empresa_id,competencia,numero' });
  if (error) throw error;
}

export async function updateContaStatus(
  empresaId: string,
  competencia: string,
  numero: string,
  status: string,
) {
  const { error } = await supabase
    .from('contas')
    .update({ status })
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)
    .eq('numero', numero);
  if (error) throw error;
}

// ── Dados Empresa (balancete + razão como JSONB) ──────────────────────────────

export async function loadDadosEmpresa(
  empresaId: string,
  competencia: string,
): Promise<DbDadosEmpresa | null> {
  const { data } = await supabase
    .from('dados_empresa')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)
    .maybeSingle();
  return data;
}

export async function upsertDadosEmpresa(
  tenantId: string,
  empresaId: string,
  competencia: string,
  dados: {
    balanceteData?: BalanceteRow[];
    razaoData?: RazaoRow[];
    reconciledIndices?: number[];
    importHistory?: ImportHistory[];
  },
) {
  const { data: existing } = await supabase
    .from('dados_empresa')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('competencia', competencia)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    empresa_id: empresaId,
    tenant_id: tenantId,
    competencia,
  };
  if (dados.balanceteData !== undefined) payload.balancete_data = dados.balanceteData;
  if (dados.razaoData !== undefined) payload.razao_data = dados.razaoData;
  if (dados.reconciledIndices !== undefined) payload.reconciled_indices = dados.reconciledIndices;
  if (dados.importHistory !== undefined) payload.import_history = dados.importHistory;

  if (existing) {
    const { error } = await supabase
      .from('dados_empresa')
      .update(payload)
      .eq('empresa_id', empresaId)
      .eq('competencia', competencia);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('dados_empresa').insert(payload);
    if (error) throw error;
  }
}

// ── Auditoria de Conciliação Inteligente ──────────────────────────────────────

export async function insertConciliacaoAuditoria(params: {
  tenantId: string;
  empresaId: string;
  competencia: string;
  contaNumero: string;
  lancamentos: { data: string; lote: string; historico: string; valor: number }[];
  score: number;
  criterios: MatchReasons;
  usuarioId: string;
}) {
  const { error } = await supabase.from('conciliacoes_auditoria').insert({
    tenant_id: params.tenantId,
    empresa_id: params.empresaId,
    competencia: params.competencia,
    conta_numero: params.contaNumero,
    lancamentos: params.lancamentos,
    score: params.score,
    criterios: params.criterios,
    usuario_id: params.usuarioId,
  });
  if (error) throw error;
}
