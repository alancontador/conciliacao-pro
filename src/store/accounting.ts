import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory, CompanyInfo, KPIData } from '@/types/accounting';
import type { Usuario, PermissoesUsuario } from '@/types/usuario';
import type { Empresa } from '@/types/empresa';
import type { Competencia, CompetenciaStatus } from '@/types/competencia';
import * as svc from '@/services/supabase.service';
import type { DbCompetencia } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import type { MatchReasons } from '@/lib/reconciliation/types';
import { computeTextScore } from '@/lib/reconciliation/text';
import { currentCompetencia } from '@/lib/competencia';
import { isContaBancariaOuAplicacao, aplicarRegraBancaria } from '@/lib/conta-classificacao';
import { logger } from '@/lib/logger';

// ── Dados por (empresa + competência) — cache local ───────────────────────────

interface EmpresaDados {
  companyInfo: CompanyInfo;
  contas: Conta[];
  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  importHistory: ImportHistory[];
  reconciledRazaoIndices: number[];
}

const emptyDados: EmpresaDados = {
  companyInfo: { nome: '', cnpj: '', responsavel: '' },
  contas: [], balanceteData: [], razaoData: [], importHistory: [], reconciledRazaoIndices: [],
};

// Chave composta do escopo ativo. Cada (empresa, competência) tem dados isolados.
function scopeKey(empresaId: string, competencia: string): string {
  return `${empresaId}::${competencia}`;
}

function mapDbCompetencia(c: DbCompetencia): Competencia {
  return {
    id: c.id,
    empresaId: c.empresa_id,
    competencia: c.competencia,
    status: (c.status as CompetenciaStatus) ?? 'EM_ANDAMENTO',
    concluidaEm: c.concluida_em ? new Date(c.concluida_em) : undefined,
    concluidaPor: c.concluida_por ?? undefined,
    kpisSnapshot: (c.kpis_snapshot as KPIData | null) ?? undefined,
    createdAt: new Date(c.criado_em),
    updatedAt: new Date(c.atualizado_em),
  };
}

// Aplica um patch aos campos ativos E ao cache do escopo (empresa+competência) corrente.
function sync(
  state: {
    selectedEmpresaId: string | null;
    selectedCompetencia: string | null;
    dadosPorChave: Record<string, EmpresaDados>;
  },
  updates: Partial<EmpresaDados>,
) {
  if (!state.selectedEmpresaId || !state.selectedCompetencia) {
    return updates as Record<string, unknown>;
  }
  const key = scopeKey(state.selectedEmpresaId, state.selectedCompetencia);
  return {
    ...updates,
    dadosPorChave: {
      ...state.dadosPorChave,
      [key]: {
        ...(state.dadosPorChave[key] ?? emptyDados),
        ...updates,
      },
    },
  };
}

// ── Interface ─────────────────────────────────────────────────────────────────

interface AccountingState {
  // Sessão
  tenantId: string | null;
  currentUser: Usuario | null;
  isInitialized: boolean;

  // Campos ativos (empresa + competência selecionadas)
  companyInfo: CompanyInfo;
  contas: Conta[];
  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  importHistory: ImportHistory[];
  reconciledRazaoIndices: number[];

  // Multi-empresa
  empresas: Empresa[];
  selectedEmpresaId: string | null;

  // Competências (da empresa selecionada)
  competencias: Competencia[];
  selectedCompetencia: string | null;             // 'AAAA-MM'
  selectedCompetenciaStatus: CompetenciaStatus | null;

  // Cache offline por (empresa+competência)
  dadosPorChave: Record<string, EmpresaDados>;

  // Usuários (cache local)
  usuarios: Usuario[];

  // Configurações globais
  prazoMedioRegularizacao: number;
  setPrazoMedioRegularizacao: (dias: number) => void;

  // Ações de inicialização
  initSession: () => Promise<void>;
  loadTenantData: (tenantId: string, userId: string) => Promise<void>;

  // Auth via Supabase
  login: (email: string, password: string) => Promise<'ok' | 'invalid' | 'inactive' | 'confirme-email'>;
  logout: () => Promise<void>;
  signUpTenant: (params: { tenantNome: string; tenantCnpj?: string; adminNome: string; email: string; password: string }) => Promise<'ok' | 'confirme-email'>;
  requestPasswordReset: (email: string) => Promise<void>;

  // Setters de dados (sincronizam com Supabase em background)
  setCompanyInfo: (info: CompanyInfo) => void;
  setContas: (contas: Conta[]) => void;
  updateConta: (numero: string, updates: Partial<Conta>) => void;
  setBalanceteData: (data: BalanceteRow[]) => void;
  setRazaoData: (data: RazaoRow[]) => void;
  mergeRazaoData: (newRows: RazaoRow[]) => { added: number; duplicates: number };
  addImportHistory: (history: ImportHistory) => void;
  removeImportHistory: (id: string) => void;
  clearImportHistory: () => void;
  resetEmpresaData: () => void;
  reconcileAccount: (numero: string, status: Conta['status']) => void;
  updateRazaoTransaction: (index: number, updates: Partial<RazaoRow>) => void;
  deleteRazaoTransaction: (index: number) => void;
  reconcileRazaoTransactions: (indices: number[]) => void;
  unreconcileRazaoTransactions: (indices: number[]) => void;
  logConciliacaoAuditoria: (params: {
    contaNumero: string;
    lancamentos: { data: string; lote: string; historico: string; valor: number }[];
    score: number;
    criterios: MatchReasons;
  }) => Promise<void>;
  calculateKPIs: () => KPIData;
  getProcessedContas: () => Conta[];
  isCompetenciaReadonly: () => boolean;

  // Empresas
  addEmpresa: (e: Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEmpresa: (id: string, updates: Partial<Omit<Empresa, 'id' | 'createdAt'>>) => Promise<void>;
  deleteEmpresa: (id: string) => Promise<void>;
  selectEmpresa: (id: string) => Promise<void>;

  // Competências
  selectCompetencia: (competencia: string) => Promise<void>;
  criarCompetencia: (competencia: string) => Promise<void>;
  concluirConciliacao: () => Promise<void>;
  reabrirCompetencia: () => Promise<void>;

  // Internos de escopo
  _saveCurrentScope: () => void;
  _loadScopeData: (empresaId: string, competencia: string) => Promise<void>;

  // Usuários
  addUsuario: (u: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt' | 'email'>, email: string) => Promise<{ token: string; emailEnviado: boolean }>;
  updateUsuario: (id: string, updates: Partial<Omit<Usuario, 'id' | 'createdAt'>>) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  requestPasswordReset_user: (email: string) => Promise<void>;
  reenviarConvite: (email: string, token: string) => Promise<boolean>;
}

// ── Fila de gravações por escopo ──────────────────────────────────────────────
// As gravações ao Supabase são assíncronas (fire-and-forget). Ao trocar de
// competência, _loadScopeData recarrega do Supabase — se a última gravação ainda
// não terminou, ele leria dados desatualizados (corrida read-after-write).
// Solução: serializar as gravações por escopo (empresa+competência) e permitir
// aguardar as pendentes antes de recarregar aquele escopo.

const pendingScopeWrites = new Map<string, Promise<void>>();

function trackWrite(key: string, run: () => Promise<unknown>): Promise<void> {
  const prev = pendingScopeWrites.get(key) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => run()).then(() => undefined, () => undefined);
  pendingScopeWrites.set(key, next);
  void next.finally(() => {
    if (pendingScopeWrites.get(key) === next) pendingScopeWrites.delete(key);
  });
  return next;
}

async function awaitScopeWrites(key: string): Promise<void> {
  const p = pendingScopeWrites.get(key);
  if (!p) return;
  // Nunca bloqueia a navegação por mais de 4s: se uma gravação ficar presa na rede,
  // seguimos e carregamos o que houver (a gravação continua em segundo plano).
  await Promise.race([p, new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
}

interface ScopeIds { tenantId: string; empresaId: string; competencia: string }

// Executa uma gravação no escopo (empresa+competência) ATIVO NO MOMENTO DA CHAMADA,
// serializada e rastreada. Os ids são capturados agora — não quando a gravação roda —
// pois o usuário pode ter trocado de escopo até lá.
function scopeWrite(
  get: () => AccountingState,
  run: (ids: ScopeIds) => Promise<unknown>,
  action: string,
  ctxData?: Record<string, unknown>,
) {
  const { tenantId, selectedEmpresaId, selectedCompetencia, currentUser } = get();
  if (!tenantId || !selectedEmpresaId || !selectedCompetencia) return;
  const ids: ScopeIds = { tenantId, empresaId: selectedEmpresaId, competencia: selectedCompetencia };
  const key = scopeKey(selectedEmpresaId, selectedCompetencia);
  trackWrite(key, () =>
    run(ids).catch((error) => {
      logger.error(`store/${action}-failed`, {
        context: { tenantId, empresaId: selectedEmpresaId, userId: currentUser?.id, action, data: ctxData },
        error,
      });
    }),
  );
}

// Persiste um patch de dados (balancete/razão/conciliados/histórico) no escopo ativo.
function persistDados(
  get: () => AccountingState,
  patch: {
    balanceteData?: BalanceteRow[];
    razaoData?: RazaoRow[];
    reconciledIndices?: number[];
    importHistory?: ImportHistory[];
  },
  action: string,
) {
  scopeWrite(get, ({ tenantId, empresaId, competencia }) =>
    svc.upsertDadosEmpresa(tenantId, empresaId, competencia, patch), action);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      currentUser: null,
      isInitialized: false,

      companyInfo: { nome: '', cnpj: '', responsavel: '' },
      contas: [],
      balanceteData: [],
      razaoData: [],
      importHistory: [],
      reconciledRazaoIndices: [],
      empresas: [],
      selectedEmpresaId: null,
      competencias: [],
      selectedCompetencia: null,
      selectedCompetenciaStatus: null,
      dadosPorChave: {},
      usuarios: [],
      prazoMedioRegularizacao: 15,

      // ── Inicialização ─────────────────────────────────────────────────────

      initSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          set({ isInitialized: true });
          return;
        }
        await get().loadTenantData('', session.user.id);
      },

      loadTenantData: async (_tenantId, userId) => {
        try {
          let profile = await svc.loadMyProfile();

          // Sessão válida sem profile = cadastro que parou na confirmação de
          // e-mail. Conclui aqui também (ex.: usuário volta pelo link do e-mail).
          if (!profile) {
            const concluiu = await svc.finalizarCadastroPendente();
            if (concluiu) profile = await svc.loadMyProfile();
          }

          if (!profile) { set({ isInitialized: true }); return; }

          const tenantId = profile.tenant_id;
          const currentUser: Usuario = {
            id: profile.id,
            nome: profile.nome,
            email: (await supabase.auth.getUser()).data.user?.email ?? '',
            role: profile.role as Usuario['role'],
            status: profile.status as Usuario['status'],
            permissoes: profile.permissoes as unknown as PermissoesUsuario,
            createdAt: new Date(profile.criado_em),
            updatedAt: new Date(profile.atualizado_em),
          };

          const [dbEmpresas, dbUsuarios, dbConvites] = await Promise.all([
            svc.loadEmpresas(tenantId),
            svc.loadUsuarios(tenantId),
            svc.loadConvitesPendentes(tenantId),
          ]);

          const empresas: Empresa[] = dbEmpresas.map((e) => ({
            id: e.id,
            razaoSocial: e.razao_social,
            nomeFantasia: e.nome_fantasia ?? undefined,
            cnpj: e.cnpj ?? '',
            responsavel: e.responsavel ?? '',
            email: e.email ?? undefined,
            telefone: e.telefone ?? undefined,
            ativa: e.ativa,
            createdAt: new Date(e.criado_em),
            updatedAt: new Date(e.atualizado_em),
          }));

          const usuarios: Usuario[] = dbUsuarios.map((p) => ({
            id: p.id,
            nome: p.nome,
            email: p.email ?? '',
            role: p.role as Usuario['role'],
            status: p.status as Usuario['status'],
            permissoes: p.permissoes as unknown as PermissoesUsuario,
            createdAt: new Date(p.criado_em),
            updatedAt: new Date(p.atualizado_em),
          }));

          // Convidados que ainda nao criaram a conta aparecem na lista como
          // pendentes — antes existiam so em memoria e sumiam ao recarregar,
          // deixando o admin sem como reenviar o link.
          const emailsComConta = new Set(usuarios.map((u) => u.email.toLowerCase()));
          for (const c of dbConvites) {
            if (emailsComConta.has(c.email.toLowerCase())) continue;
            usuarios.push({
              id: c.id,
              nome: c.nome,
              email: c.email,
              role: c.role as Usuario['role'],
              status: 'ativo',
              permissoes: c.permissoes as unknown as PermissoesUsuario,
              convitePendente: true,
              conviteToken: c.token,
              createdAt: new Date(c.criado_em),
              updatedAt: new Date(c.criado_em),
            });
          }

          const { selectedEmpresaId } = get();
          const primeiraEmpresa = empresas.find((e) => e.ativa);
          const empresaParaCarregar = (selectedEmpresaId && empresas.some((e) => e.id === selectedEmpresaId))
            ? selectedEmpresaId
            : primeiraEmpresa?.id ?? null;

          set({ tenantId, currentUser, empresas, usuarios, isInitialized: true });

          if (empresaParaCarregar) {
            await get().selectEmpresa(empresaParaCarregar);
          }
        } catch (error) {
          logger.fatal('store/load-tenant-data-failed', { error });
          set({ isInitialized: true });
        }
      },

      // ── Auth ──────────────────────────────────────────────────────────────

      login: async (email, password) => {
        const { data, error } = await svc.signIn(email, password);
        if (error || !data.user) {
          // Com "Confirm email" ligado, senha certa + e-mail não confirmado
          // cai aqui: precisa de mensagem própria, não "usuário ou senha".
          if (error && /email not confirmed|not_confirmed/i.test(error.message)) {
            return 'confirme-email';
          }
          return 'invalid';
        }

        let profile = await svc.loadMyProfile();

        // Cadastro interrompido pela confirmação de e-mail: agora há sessão,
        // então concluímos o vínculo (convite aceito ou escritório criado).
        if (!profile) {
          const concluiu = await svc.finalizarCadastroPendente();
          if (concluiu) profile = await svc.loadMyProfile();
        }

        if (!profile) return 'invalid';
        if (profile.status === 'inativo') return 'inactive';

        await get().loadTenantData(profile.tenant_id, data.user.id);
        return 'ok';
      },

      logout: async () => {
        await svc.signOut();
        set({
          currentUser: null, tenantId: null, isInitialized: true,
          empresas: [], selectedEmpresaId: null,
          competencias: [], selectedCompetencia: null, selectedCompetenciaStatus: null,
          dadosPorChave: {},
          usuarios: [], contas: [], balanceteData: [], razaoData: [],
          importHistory: [], reconciledRazaoIndices: [],
          companyInfo: { nome: '', cnpj: '', responsavel: '' },
        });
      },

      signUpTenant: async (params) => {
        const res = await svc.createTenantAndAdmin(params);
        if (res.status === 'confirme-email') return 'confirme-email';
        await get().login(params.email, params.password);
        return 'ok';
      },

      requestPasswordReset: async (email) => {
        await svc.resetPasswordForEmail(email);
      },

      setPrazoMedioRegularizacao: (dias) => set({ prazoMedioRegularizacao: dias }),

      isCompetenciaReadonly: () => get().selectedCompetenciaStatus === 'CONCLUIDA',

      // ── Setters com sync ao Supabase ──────────────────────────────────────

      setCompanyInfo: (companyInfo) => set((state) => sync(state, { companyInfo })),

      setContas: (contas) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { contas }));
        scopeWrite(get, ({ tenantId, empresaId, competencia }) =>
          svc.upsertContas(tenantId, empresaId, competencia, get().contas), 'sync-contas');
      },

      updateConta: (numero, updates) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, ...updates, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        });
        if (updates.status) {
          const status = updates.status;
          scopeWrite(get, ({ empresaId, competencia }) =>
            svc.updateContaStatus(empresaId, competencia, numero, status), 'sync-conta-status', { numero });
        }
      },

      setBalanceteData: (balanceteData) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { balanceteData }));
        persistDados(get, { balanceteData }, 'sync-balancete');
      },

      setRazaoData: (razaoData) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { razaoData }));
        persistDados(get, { razaoData }, 'sync-razao');
      },

      mergeRazaoData: (newRows) => {
        if (get().isCompetenciaReadonly()) return { added: 0, duplicates: 0 };
        const existing = get().razaoData;

        const dayKey = (d: Date | string): string => {
          const dt = d instanceof Date ? d : new Date(d as string);
          return isNaN(dt.getTime()) ? '' : `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
        };

        const existingByKey = new Map<string, RazaoRow[]>();
        for (const r of existing) {
          const k = `${r.conta}|${dayKey(r.data)}|${r.debito.toFixed(2)}|${r.credito.toFixed(2)}`;
          const arr = existingByKey.get(k);
          if (arr) arr.push(r); else existingByKey.set(k, [r]);
        }

        const docNums = (text: string): Set<string> =>
          new Set((text.match(/\d{5,}/g) ?? []));

        const isDuplicate = (r: RazaoRow): boolean => {
          const k = `${r.conta}|${dayKey(r.data)}|${r.debito.toFixed(2)}|${r.credito.toFixed(2)}`;
          const candidates = existingByKey.get(k);
          if (!candidates) return false;
          return candidates.some((ex) => {
            const numsNew = docNums(r.historico);
            const numsEx  = docNums(ex.historico);
            if (numsNew.size > 0 && numsEx.size > 0) {
              const hasCommon = [...numsNew].some((n) => numsEx.has(n));
              if (!hasCommon) return false;
            }
            return computeTextScore(r.historico, ex.historico).score >= 0.75;
          });
        };

        const toAdd = newRows.filter((r) => !isDuplicate(r));
        const duplicates = newRows.length - toAdd.length;

        if (toAdd.length > 0) {
          const razaoData = [...existing, ...toAdd];
          set((state) => sync(state, { razaoData }));
          persistDados(get, { razaoData: get().razaoData }, 'sync-razao-merge');
        }

        return { added: toAdd.length, duplicates };
      },

      addImportHistory: (history) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { importHistory: [history, ...state.importHistory] }));
        persistDados(get, { importHistory: get().importHistory }, 'sync-import-history-add');
      },

      removeImportHistory: (id) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { importHistory: state.importHistory.filter((h) => h.id !== id) }));
        persistDados(get, { importHistory: get().importHistory }, 'sync-import-history-remove');
      },

      clearImportHistory: () => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => sync(state, { importHistory: [] }));
        persistDados(get, { importHistory: [] }, 'sync-import-history-clear');
      },

      resetEmpresaData: () => {
        if (get().isCompetenciaReadonly()) return;
        const empty = { contas: [], balanceteData: [], razaoData: [], reconciledRazaoIndices: [], importHistory: [] };
        set((state) => sync(state, empty));
        scopeWrite(get, ({ tenantId, empresaId, competencia }) =>
          Promise.all([
            svc.upsertDadosEmpresa(tenantId, empresaId, competencia, { balanceteData: [], razaoData: [], reconciledIndices: [], importHistory: [] }),
            svc.upsertContas(tenantId, empresaId, competencia, []),
          ]), 'sync-reset-empresa');
      },

      reconcileAccount: (numero, status) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, status, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        });
        scopeWrite(get, ({ empresaId, competencia }) =>
          svc.updateContaStatus(empresaId, competencia, numero, status), 'sync-reconcile-account', { numero, status });
      },

      updateRazaoTransaction: (index, updates) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const razaoData = [...state.razaoData];
          razaoData[index] = { ...razaoData[index], ...updates };
          return sync(state, { razaoData });
        });
        persistDados(get, { razaoData: get().razaoData }, 'sync-update-razao');
      },

      deleteRazaoTransaction: (index) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const razaoData = state.razaoData.filter((_, i) => i !== index);
          const reconciledRazaoIndices = state.reconciledRazaoIndices
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i));
          return sync(state, { razaoData, reconciledRazaoIndices });
        });
        persistDados(get, { razaoData: get().razaoData, reconciledIndices: get().reconciledRazaoIndices }, 'sync-delete-razao');
      },

      reconcileRazaoTransactions: (indices) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const reconciledRazaoIndices = [...new Set([...state.reconciledRazaoIndices, ...indices])];
          return sync(state, { reconciledRazaoIndices });
        });
        persistDados(get, { reconciledIndices: get().reconciledRazaoIndices }, 'sync-reconcile-razao');
      },

      unreconcileRazaoTransactions: (indices) => {
        if (get().isCompetenciaReadonly()) return;
        set((state) => {
          const remove = new Set(indices);
          const reconciledRazaoIndices = state.reconciledRazaoIndices.filter((i) => !remove.has(i));
          return sync(state, { reconciledRazaoIndices });
        });
        persistDados(get, { reconciledIndices: get().reconciledRazaoIndices }, 'sync-unreconcile-razao');
      },

      logConciliacaoAuditoria: async ({ contaNumero, lancamentos, score, criterios }) => {
        const { tenantId, selectedEmpresaId, selectedCompetencia, currentUser } = get();
        if (!tenantId || !selectedEmpresaId || !selectedCompetencia || !currentUser) return;
        try {
          await svc.insertConciliacaoAuditoria({
            tenantId, empresaId: selectedEmpresaId, competencia: selectedCompetencia,
            contaNumero, lancamentos, score, criterios, usuarioId: currentUser.id,
          });
        } catch (error) {
          logger.error('store/log-conciliacao-auditoria-failed', {
            context: { tenantId: tenantId ?? undefined, empresaId: selectedEmpresaId ?? undefined, userId: currentUser.id, action: 'logConciliacaoAuditoria' },
            error,
          });
        }
      },

      // ── Empresas ──────────────────────────────────────────────────────────

      addEmpresa: async (e) => {
        const { tenantId } = get();
        if (!tenantId) throw new Error('Sem tenant');

        const dbEmpresa = await svc.insertEmpresa(tenantId, e);
        const nova: Empresa = {
          id: dbEmpresa.id,
          razaoSocial: dbEmpresa.razao_social,
          nomeFantasia: dbEmpresa.nome_fantasia ?? undefined,
          cnpj: dbEmpresa.cnpj ?? '',
          responsavel: dbEmpresa.responsavel ?? '',
          email: dbEmpresa.email ?? undefined,
          telefone: dbEmpresa.telefone ?? undefined,
          ativa: dbEmpresa.ativa,
          createdAt: new Date(dbEmpresa.criado_em),
          updatedAt: new Date(dbEmpresa.atualizado_em),
        };

        const isFirst = get().empresas.length === 0;
        set((state) => ({ empresas: [...state.empresas, nova] }));
        if (isFirst) {
          await get().selectEmpresa(nova.id);
        }
      },

      updateEmpresa: async (id, updates) => {
        await svc.updateEmpresaDb(id, updates);
        set((state) => {
          const empresas = state.empresas.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e,
          );
          const extra =
            state.selectedEmpresaId === id
              ? { companyInfo: {
                  nome: (updates.razaoSocial ?? state.empresas.find((e) => e.id === id)?.razaoSocial) ?? '',
                  cnpj: (updates.cnpj ?? state.empresas.find((e) => e.id === id)?.cnpj) ?? '',
                  responsavel: (updates.responsavel ?? state.empresas.find((e) => e.id === id)?.responsavel) ?? '',
                } }
              : {};
          return { empresas, ...extra };
        });
      },

      deleteEmpresa: async (id) => {
        await svc.deleteEmpresaDb(id);
        const wasSelected = get().selectedEmpresaId === id;
        set((state) => {
          const empresas = state.empresas.filter((e) => e.id !== id);
          const dadosPorChave = Object.fromEntries(
            Object.entries(state.dadosPorChave).filter(([k]) => !k.startsWith(`${id}::`)),
          );
          return { empresas, dadosPorChave };
        });
        if (wasSelected) {
          const proxima = get().empresas[0];
          if (proxima) {
            await get().selectEmpresa(proxima.id);
          } else {
            set({
              selectedEmpresaId: null, selectedCompetencia: null, selectedCompetenciaStatus: null,
              competencias: [], ...emptyDados,
            });
          }
        }
      },

      selectEmpresa: async (id) => {
        const { tenantId } = get();

        // 1. Salva o escopo atual (empresa+competência anteriores) no cache local
        get()._saveCurrentScope();

        // 2. Define a empresa e limpa o escopo até carregar a competência (evita salvar dados errados)
        const nova = get().empresas.find((e) => e.id === id);
        const companyInfo = nova
          ? { nome: nova.razaoSocial, cnpj: nova.cnpj, responsavel: nova.responsavel }
          : emptyDados.companyInfo;
        set({
          selectedEmpresaId: id,
          selectedCompetencia: null,
          selectedCompetenciaStatus: null,
          companyInfo,
          contas: [], balanceteData: [], razaoData: [], importHistory: [], reconciledRazaoIndices: [],
        });

        // 3. Carrega as competências da empresa e garante a competência do mês corrente
        let competencias: Competencia[] = [];
        const alvo = currentCompetencia();
        try {
          if (tenantId) {
            const rows = await svc.loadCompetencias(id);
            competencias = rows.map(mapDbCompetencia);
            if (!competencias.some((c) => c.competencia === alvo)) {
              const created = await svc.ensureCompetencia(tenantId, id, alvo);
              competencias = [mapDbCompetencia(created), ...competencias];
            }
          }
        } catch (error) {
          logger.warn('store/load-competencias-failed', {
            context: { empresaId: id, userId: get().currentUser?.id, action: 'selectEmpresa' },
            error,
          });
        }
        set({ competencias });

        // 4. Carrega o escopo da competência alvo (mês corrente)
        await get()._loadScopeData(id, alvo);
      },

      // ── Competências ──────────────────────────────────────────────────────

      selectCompetencia: async (competencia) => {
        const { selectedEmpresaId } = get();
        if (!selectedEmpresaId) return;
        get()._saveCurrentScope();
        await get()._loadScopeData(selectedEmpresaId, competencia);
      },

      criarCompetencia: async (competencia) => {
        const { tenantId, selectedEmpresaId } = get();
        if (!selectedEmpresaId) return;
        if (tenantId) {
          try {
            const created = await svc.ensureCompetencia(tenantId, selectedEmpresaId, competencia);
            set((state) => {
              const rest = state.competencias.filter((c) => c.competencia !== competencia);
              const merged = [mapDbCompetencia(created), ...rest]
                .sort((a, b) => b.competencia.localeCompare(a.competencia));
              return { competencias: merged };
            });
          } catch (error) {
            logger.error('store/criar-competencia-failed', {
              context: { empresaId: selectedEmpresaId, userId: get().currentUser?.id, action: 'criarCompetencia', data: { competencia } },
              error,
            });
          }
        }
        await get().selectCompetencia(competencia);
      },

      concluirConciliacao: async () => {
        const { tenantId, selectedEmpresaId, selectedCompetencia, currentUser } = get();
        if (!tenantId || !selectedEmpresaId || !selectedCompetencia) return;
        const kpis = get().calculateKPIs();
        try {
          await svc.updateCompetenciaStatus(selectedEmpresaId, selectedCompetencia, 'CONCLUIDA', {
            concluidaPor: currentUser?.id ?? null, kpisSnapshot: kpis,
          });
          set((state) => ({
            selectedCompetenciaStatus: 'CONCLUIDA',
            competencias: state.competencias.map((c) =>
              c.competencia === selectedCompetencia
                ? { ...c, status: 'CONCLUIDA', concluidaEm: new Date(), concluidaPor: currentUser?.id, kpisSnapshot: kpis }
                : c,
            ),
          }));
        } catch (error) {
          logger.error('store/concluir-conciliacao-failed', {
            context: { empresaId: selectedEmpresaId, userId: currentUser?.id, action: 'concluirConciliacao', data: { competencia: selectedCompetencia } },
            error,
          });
          throw error;
        }
      },

      reabrirCompetencia: async () => {
        const { tenantId, selectedEmpresaId, selectedCompetencia, currentUser } = get();
        if (!tenantId || !selectedEmpresaId || !selectedCompetencia) return;
        try {
          await svc.updateCompetenciaStatus(selectedEmpresaId, selectedCompetencia, 'EM_ANDAMENTO');
          set((state) => ({
            selectedCompetenciaStatus: 'EM_ANDAMENTO',
            competencias: state.competencias.map((c) =>
              c.competencia === selectedCompetencia
                ? { ...c, status: 'EM_ANDAMENTO', concluidaEm: undefined, concluidaPor: undefined }
                : c,
            ),
          }));
        } catch (error) {
          logger.error('store/reabrir-competencia-failed', {
            context: { empresaId: selectedEmpresaId, userId: currentUser?.id, action: 'reabrirCompetencia', data: { competencia: selectedCompetencia } },
            error,
          });
          throw error;
        }
      },

      // ── Internos de escopo ─────────────────────────────────────────────────

      _saveCurrentScope: () => {
        set((state) => {
          if (!state.selectedEmpresaId || !state.selectedCompetencia) return {};
          const key = scopeKey(state.selectedEmpresaId, state.selectedCompetencia);
          return {
            dadosPorChave: {
              ...state.dadosPorChave,
              [key]: {
                companyInfo: state.companyInfo,
                contas: state.contas,
                balanceteData: state.balanceteData,
                razaoData: state.razaoData,
                importHistory: state.importHistory,
                reconciledRazaoIndices: state.reconciledRazaoIndices,
              },
            },
          };
        });
      },

      _loadScopeData: async (empresaId, competencia) => {
        const { tenantId } = get();
        const status = get().competencias.find((c) => c.competencia === competencia)?.status ?? 'EM_ANDAMENTO';
        set({ selectedCompetencia: competencia, selectedCompetenciaStatus: status });

        // Aguarda gravações pendentes deste escopo terminarem antes de reler do
        // Supabase — evita corrida read-after-write (conciliação feita logo antes
        // de trocar de competência poderia voltar desatualizada).
        await awaitScopeWrites(scopeKey(empresaId, competencia));

        try {
          const [dbContas, dbDados] = await Promise.all([
            tenantId ? svc.loadContas(empresaId, competencia) : Promise.resolve([]),
            tenantId ? svc.loadDadosEmpresa(empresaId, competencia) : Promise.resolve(null),
          ]);

          const contas: Conta[] = dbContas.map((c) => ({
            id: c.id,
            numero: c.numero,
            descricao: c.descricao ?? '',
            natureza: (c.natureza ?? 'ATIVO') as Conta['natureza'],
            contabilidade: 0,
            composicao: 0,
            diferenca: 0,
            status: c.status as Conta['status'],
            documentos: (c.documentos as Conta['documentos']) ?? [],
            prazoRegularizacao: c.prazo_regularizacao ? new Date(c.prazo_regularizacao) : undefined,
            movimentacoes: [],
            createdAt: new Date(c.criado_em),
            updatedAt: new Date(c.atualizado_em),
          }));

          set({
            contas,
            balanceteData: (dbDados?.balancete_data as BalanceteRow[]) ?? [],
            razaoData: (dbDados?.razao_data as RazaoRow[]) ?? [],
            reconciledRazaoIndices: (dbDados?.reconciled_indices as number[]) ?? [],
            importHistory: (dbDados?.import_history as ImportHistory[]) ?? [],
          });
        } catch (error) {
          logger.warn('store/load-scope-supabase-failed-using-cache', {
            context: { empresaId, userId: get().currentUser?.id, action: 'loadScopeData', data: { competencia } },
            error,
          });
          const cached = get().dadosPorChave[scopeKey(empresaId, competencia)] ?? emptyDados;
          set({
            contas: cached.contas,
            balanceteData: cached.balanceteData,
            razaoData: cached.razaoData,
            reconciledRazaoIndices: cached.reconciledRazaoIndices,
            importHistory: cached.importHistory,
          });
        }
      },

      // ── Usuários ──────────────────────────────────────────────────────────

      addUsuario: async (u, email) => {
        const { tenantId } = get();
        if (!tenantId) throw new Error('Sem tenant');

        const convite = await svc.createConvite({
          tenantId,
          email,
          nome: u.nome,
          role: u.role,
          permissoes: u.permissoes,
        });

        const pendingUser: Usuario = {
          id: convite.id,
          nome: u.nome,
          email,
          role: u.role,
          status: 'ativo',
          permissoes: u.permissoes,
          convitePendente: true,
          conviteToken: convite.token,
          createdAt: new Date(convite.criado_em),
          updatedAt: new Date(convite.criado_em),
        };
        set((state) => ({ usuarios: [...state.usuarios, pendingUser] }));

        // Envia o convite por e-mail. Falha aqui não invalida o convite: a
        // tela mostra o link para envio manual como alternativa.
        const emailEnviado = await svc.enviarConvitePorEmail(email, convite.token);

        return { token: convite.token, emailEnviado };
      },

      reenviarConvite: async (email, token) => svc.enviarConvitePorEmail(email, token),

      updateUsuario: async (id, updates) => {
        await svc.updateProfile(id, {
          nome: updates.nome,
          role: updates.role,
          status: updates.status,
          permissoes: updates.permissoes as unknown as Record<string, boolean>,
        });
        set((state) => ({
          usuarios: state.usuarios.map((u) =>
            u.id === id ? { ...u, ...updates, updatedAt: new Date() } : u,
          ),
          currentUser:
            state.currentUser?.id === id
              ? { ...state.currentUser, ...updates, updatedAt: new Date() }
              : state.currentUser,
        }));
      },

      deleteUsuario: async (id) => {
        await svc.deleteProfile(id);
        set((state) => ({ usuarios: state.usuarios.filter((u) => u.id !== id) }));
      },

      requestPasswordReset_user: async (email) => {
        await svc.resetPasswordForEmail(email);
      },

      // ── KPIs ──────────────────────────────────────────────────────────────

      // Deriva as contas a partir de balancete + razão + conciliados — MESMA regra
      // da tela de Status (processedContas). Composição = saldo corrido considerando
      // apenas lançamentos NÃO conciliados; status recalculado pela diferença.
      // Garante que Dashboard e Status mostrem sempre o mesmo estado.
      getProcessedContas: () => {
        const { contas, balanceteData, razaoData, reconciledRazaoIndices } = get();
        // Sem balancete, a regra de banco/aplicacao ainda vale sobre as contas salvas.
        if (balanceteData.length === 0) return contas.map(aplicarRegraBancaria);

        const reconciledSet = new Set(reconciledRazaoIndices);

        // Índices O(1): agrupa lançamentos do razão por conta e mapeia contas
        // persistidas por número — evita a varredura O(contas × razão) que
        // congelava a UI em competências com muitos lançamentos.
        const movsByConta = new Map<string, { debito: number; credito: number; idx: number }[]>();
        razaoData.forEach((razao, globalIdx) => {
          const key = (razao.conta ?? '').trim();
          if (!key) return;
          const item = { debito: razao.debito, credito: razao.credito, idx: globalIdx };
          const arr = movsByConta.get(key);
          if (arr) arr.push(item); else movsByConta.set(key, [item]);
        });
        const storedByNumero = new Map(contas.map((c) => [c.numero, c]));

        return balanceteData
          .filter((balancete) => Math.abs(balancete.saldoAtual) >= 0.01)
          .map((balancete) => {
            const stored = storedByNumero.get(balancete.codigo);
            let saldoPendente = 0;
            const movs = movsByConta.get(balancete.codigo.trim()) ?? [];
            for (const m of movs) {
              if (!reconciledSet.has(m.idx)) {
                saldoPendente += balancete.natureza === 'ATIVO'
                  ? m.debito - m.credito
                  : m.credito - m.debito;
              }
            }
            const composicao = saldoPendente;
            const diferenca = Math.abs(balancete.saldoAtual) - Math.abs(composicao);
            // Contas bancárias e aplicações financeiras são conciliadas pelo
            // extrato bancário, fora do sistema — entram sempre como CONCILIADAS.
            const bancaria = isContaBancariaOuAplicacao(balancete);
            const status: Conta['status'] = bancaria || Math.abs(diferenca) < 0.01
              ? 'CONCILIADO'
              : stored?.status === 'EM_ANALISE'
                ? 'EM_ANALISE'
                : 'NAO_CONCILIADO';
            return {
              numero: balancete.codigo,
              descricao: balancete.descricao,
              natureza: balancete.natureza,
              contabilidade: balancete.saldoAtual,
              composicao,
              diferenca,
              status,
              conciliadoPorRegra: bancaria,
              documentos: stored?.documentos ?? [],
              prazoRegularizacao: stored?.prazoRegularizacao,
              movimentacoes: [],
              createdAt: stored?.createdAt ?? new Date(),
              updatedAt: stored?.updatedAt ?? new Date(),
            } as Conta;
          });
      },

      calculateKPIs: () => {
        const effectiveContas = get().getProcessedContas();
        const totalContas = effectiveContas.length;
        const contasConciliadas = effectiveContas.filter((c) => c.status === 'CONCILIADO').length;
        const contasAlerta = effectiveContas.filter((c) => c.prazoRegularizacao && new Date() > c.prazoRegularizacao).length;
        return {
          totalContas, contasConciliadas,
          contasPendentes: effectiveContas.filter((c) => c.status === 'NAO_CONCILIADO').length,
          percentualConciliacao: totalContas > 0 ? (contasConciliadas / totalContas) * 100 : 0,
          contasAlerta, prazoMedioRegularizacao: get().prazoMedioRegularizacao,
        };
      },
    }),
    {
      name: 'accounting-store-v3',
      storage: createJSONStorage(() => localStorage),
      // Persiste APENAS estado de UI leve. Os dados (balancete/razão/contas) vêm sempre
      // do Supabase via _loadScopeData; NÃO persistimos `dadosPorChave` no localStorage —
      // ele guardava o balancete+razão de todas as competências visitadas e era
      // re-serializado a cada set(), o que congelava a UI (e podia estourar a cota de
      // ~5MB do localStorage). Ele continua em memória durante a sessão como fallback.
      partialize: (state) => ({
        selectedEmpresaId: state.selectedEmpresaId,
        selectedCompetencia: state.selectedCompetencia,
        prazoMedioRegularizacao: state.prazoMedioRegularizacao,
      }),
    },
  ),
);
