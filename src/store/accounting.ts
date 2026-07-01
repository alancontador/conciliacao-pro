import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory, CompanyInfo, KPIData } from '@/types/accounting';
import type { Usuario, PermissoesUsuario } from '@/types/usuario';
import type { Empresa } from '@/types/empresa';
import * as svc from '@/services/supabase.service';
import { supabase } from '@/lib/supabase';
import type { MatchReasons } from '@/lib/reconciliation/types';

// ── Dados por empresa (cache local) ──────────────────────────────────────────

interface EmpresaDados {
  companyInfo: CompanyInfo;
  contas: Conta[];
  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  importHistory: ImportHistory[];
  reconciledRazaoIndices: number[];
}

const emptyDados: EmpresaDados = {
  companyInfo: { nome: '', cnpj: '', periodo: '', responsavel: '' },
  contas: [], balanceteData: [], razaoData: [], importHistory: [], reconciledRazaoIndices: [],
};

function sync(
  state: { selectedEmpresaId: string | null; dadosPorEmpresa: Record<string, EmpresaDados> },
  updates: Partial<EmpresaDados>,
) {
  if (!state.selectedEmpresaId) return updates as Record<string, unknown>;
  return {
    ...updates,
    dadosPorEmpresa: {
      ...state.dadosPorEmpresa,
      [state.selectedEmpresaId]: {
        ...(state.dadosPorEmpresa[state.selectedEmpresaId] ?? emptyDados),
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

  // Campos ativos (empresa selecionada)
  companyInfo: CompanyInfo;
  contas: Conta[];
  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  importHistory: ImportHistory[];
  reconciledRazaoIndices: number[];

  // Multi-empresa
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  dadosPorEmpresa: Record<string, EmpresaDados>;

  // Usuários (cache local)
  usuarios: Usuario[];

  // Ações de inicialização
  initSession: () => Promise<void>;
  loadTenantData: (tenantId: string, userId: string) => Promise<void>;

  // Auth via Supabase
  login: (email: string, password: string) => Promise<'ok' | 'invalid' | 'inactive'>;
  logout: () => Promise<void>;
  signUpTenant: (params: { tenantNome: string; tenantCnpj?: string; adminNome: string; email: string; password: string }) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;

  // Setters de dados (sincronizam com Supabase em background)
  setCompanyInfo: (info: CompanyInfo) => void;
  setContas: (contas: Conta[]) => void;
  updateConta: (numero: string, updates: Partial<Conta>) => void;
  setBalanceteData: (data: BalanceteRow[]) => void;
  setRazaoData: (data: RazaoRow[]) => void;
  addImportHistory: (history: ImportHistory) => void;
  removeImportHistory: (id: string) => void;
  clearImportHistory: () => void;
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

  // Empresas
  addEmpresa: (e: Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateEmpresa: (id: string, updates: Partial<Omit<Empresa, 'id' | 'createdAt'>>) => Promise<void>;
  deleteEmpresa: (id: string) => Promise<void>;
  selectEmpresa: (id: string) => Promise<void>;

  // Usuários
  addUsuario: (u: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt'>, email: string) => Promise<void>;
  updateUsuario: (id: string, updates: Partial<Omit<Usuario, 'id' | 'createdAt'>>) => Promise<void>;
  deleteUsuario: (id: string) => Promise<void>;
  requestPasswordReset_user: (email: string) => Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      tenantId: null,
      currentUser: null,
      isInitialized: false,

      companyInfo: { nome: '', cnpj: '', periodo: '', responsavel: '' },
      contas: [],
      balanceteData: [],
      razaoData: [],
      importHistory: [],
      reconciledRazaoIndices: [],
      empresas: [],
      selectedEmpresaId: null,
      dadosPorEmpresa: {},
      usuarios: [],

      // ── Inicialização ─────────────────────────────────────────────────────

      initSession: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          set({ isInitialized: true });
          return;
        }
        await get().loadTenantData(
          // tenantId será carregado dentro de loadTenantData via profile
          '',
          session.user.id,
        );
      },

      loadTenantData: async (_tenantId, userId) => {
        try {
          const profile = await svc.loadMyProfile();
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

          // Carrega empresas e usuários do tenant
          const [dbEmpresas, dbUsuarios] = await Promise.all([
            svc.loadEmpresas(tenantId),
            svc.loadUsuarios(tenantId),
          ]);

          const empresas: Empresa[] = dbEmpresas.map((e) => ({
            id: e.id,
            razaoSocial: e.razao_social,
            nomeFantasia: e.nome_fantasia ?? undefined,
            cnpj: e.cnpj ?? '',
            periodo: e.periodo ?? '',
            responsavel: e.responsavel ?? '',
            email: e.email ?? undefined,
            telefone: e.telefone ?? undefined,
            ativa: e.ativa,
            createdAt: new Date(e.criado_em),
            updatedAt: new Date(e.atualizado_em),
          }));

          const usuarios: Usuario[] = await Promise.all(
            dbUsuarios.map(async (p) => ({
              id: p.id,
              nome: p.nome,
              email: '', // email fica no Supabase Auth, não no profile
              role: p.role as Usuario['role'],
              status: p.status as Usuario['status'],
              permissoes: p.permissoes as unknown as PermissoesUsuario,
              createdAt: new Date(p.criado_em),
              updatedAt: new Date(p.atualizado_em),
            })),
          );

          // Seleciona a primeira empresa ativa por padrão
          const { selectedEmpresaId } = get();
          const primeiraEmpresa = empresas.find((e) => e.ativa);
          const empresaParaCarregar = selectedEmpresaId ?? primeiraEmpresa?.id ?? null;

          set({ tenantId, currentUser, empresas, usuarios, isInitialized: true });

          if (empresaParaCarregar) {
            await get().selectEmpresa(empresaParaCarregar);
          }
        } catch {
          set({ isInitialized: true });
        }
      },

      // ── Auth ──────────────────────────────────────────────────────────────

      login: async (email, password) => {
        const { data, error } = await svc.signIn(email, password);
        if (error || !data.user) return 'invalid';

        const profile = await svc.loadMyProfile();
        if (!profile) return 'invalid';
        if (profile.status === 'inativo') return 'inactive';

        await get().loadTenantData(profile.tenant_id, data.user.id);
        return 'ok';
      },

      logout: async () => {
        await svc.signOut();
        set({
          currentUser: null, tenantId: null, isInitialized: true,
          empresas: [], selectedEmpresaId: null, dadosPorEmpresa: {},
          usuarios: [], contas: [], balanceteData: [], razaoData: [],
          importHistory: [], reconciledRazaoIndices: [],
          companyInfo: { nome: '', cnpj: '', periodo: '', responsavel: '' },
        });
      },

      signUpTenant: async (params) => {
        await svc.createTenantAndAdmin(params);
        // Faz login logo em seguida
        await get().login(params.email, params.password);
      },

      requestPasswordReset: async (email) => {
        await svc.resetPasswordForEmail(email);
      },

      // ── Setters com sync ao Supabase ──────────────────────────────────────

      setCompanyInfo: (companyInfo) => set((state) => sync(state, { companyInfo })),

      setContas: (contas) => {
        set((state) => sync(state, { contas }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertContas(tenantId, selectedEmpresaId, get().contas).catch(console.error);
        }
      },

      updateConta: (numero, updates) => {
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, ...updates, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        });
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId && updates.status) {
          svc.updateContaStatus(selectedEmpresaId, numero, updates.status).catch(console.error);
        }
      },

      setBalanceteData: (balanceteData) => {
        set((state) => sync(state, { balanceteData }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertDadosEmpresa(tenantId, selectedEmpresaId, { balanceteData }).catch(console.error);
        }
      },

      setRazaoData: (razaoData) => {
        set((state) => sync(state, { razaoData }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertDadosEmpresa(tenantId, selectedEmpresaId, { razaoData }).catch(console.error);
        }
      },

      addImportHistory: (history) => {
        set((state) => sync(state, { importHistory: [history, ...state.importHistory] }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertDadosEmpresa(tenantId, selectedEmpresaId, { importHistory: get().importHistory }).catch(console.error);
        }
      },

      removeImportHistory: (id) => {
        set((state) => sync(state, { importHistory: state.importHistory.filter((h) => h.id !== id) }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertDadosEmpresa(tenantId, selectedEmpresaId, { importHistory: get().importHistory }).catch(console.error);
        }
      },

      clearImportHistory: () => {
        set((state) => sync(state, { importHistory: [] }));
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.upsertDadosEmpresa(tenantId, selectedEmpresaId, { importHistory: [] }).catch(console.error);
        }
      },

      reconcileAccount: (numero, status) => {
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, status, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        });
        const { tenantId, selectedEmpresaId } = get();
        if (tenantId && selectedEmpresaId) {
          svc.updateContaStatus(selectedEmpresaId, numero, status).catch(console.error);
        }
      },

      updateRazaoTransaction: (index, updates) =>
        set((state) => {
          const razaoData = [...state.razaoData];
          razaoData[index] = { ...razaoData[index], ...updates };
          return sync(state, { razaoData });
        }),

      deleteRazaoTransaction: (index) =>
        set((state) => {
          const razaoData = state.razaoData.filter((_, i) => i !== index);
          const reconciledRazaoIndices = state.reconciledRazaoIndices
            .filter((i) => i !== index)
            .map((i) => (i > index ? i - 1 : i));
          return sync(state, { razaoData, reconciledRazaoIndices });
        }),

      reconcileRazaoTransactions: (indices) =>
        set((state) => {
          const reconciledRazaoIndices = [...new Set([...state.reconciledRazaoIndices, ...indices])];
          return sync(state, { reconciledRazaoIndices });
        }),

      unreconcileRazaoTransactions: (indices) =>
        set((state) => {
          const remove = new Set(indices);
          const reconciledRazaoIndices = state.reconciledRazaoIndices.filter((i) => !remove.has(i));
          return sync(state, { reconciledRazaoIndices });
        }),

      logConciliacaoAuditoria: async ({ contaNumero, lancamentos, score, criterios }) => {
        const { tenantId, selectedEmpresaId, currentUser } = get();
        if (!tenantId || !selectedEmpresaId || !currentUser) return;
        try {
          await svc.insertConciliacaoAuditoria({
            tenantId, empresaId: selectedEmpresaId, contaNumero, lancamentos, score, criterios,
            usuarioId: currentUser.id,
          });
        } catch (error) {
          console.error(error);
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
          periodo: dbEmpresa.periodo ?? '',
          responsavel: dbEmpresa.responsavel ?? '',
          email: dbEmpresa.email ?? undefined,
          telefone: dbEmpresa.telefone ?? undefined,
          ativa: dbEmpresa.ativa,
          createdAt: new Date(dbEmpresa.criado_em),
          updatedAt: new Date(dbEmpresa.atualizado_em),
        };

        set((state) => {
          const isFirst = state.empresas.length === 0;
          if (isFirst) {
            return {
              empresas: [nova],
              selectedEmpresaId: nova.id,
              dadosPorEmpresa: { [nova.id]: emptyDados },
              companyInfo: { nome: nova.razaoSocial, cnpj: nova.cnpj, periodo: nova.periodo, responsavel: nova.responsavel },
            };
          }
          return { empresas: [...state.empresas, nova] };
        });
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
                  periodo: (updates.periodo ?? state.empresas.find((e) => e.id === id)?.periodo) ?? '',
                  responsavel: (updates.responsavel ?? state.empresas.find((e) => e.id === id)?.responsavel) ?? '',
                } }
              : {};
          return { empresas, ...extra };
        });
      },

      deleteEmpresa: async (id) => {
        await svc.deleteEmpresaDb(id);
        set((state) => {
          const empresas = state.empresas.filter((e) => e.id !== id);
          const { [id]: _r, ...restDados } = state.dadosPorEmpresa;
          if (state.selectedEmpresaId === id) {
            const proxima = empresas[0];
            if (proxima) {
              const dados = restDados[proxima.id] ?? emptyDados;
              return { empresas, dadosPorEmpresa: restDados, selectedEmpresaId: proxima.id, ...dados,
                companyInfo: { nome: proxima.razaoSocial, cnpj: proxima.cnpj, periodo: proxima.periodo, responsavel: proxima.responsavel } };
            }
            return { empresas, dadosPorEmpresa: restDados, selectedEmpresaId: null, ...emptyDados };
          }
          return { empresas, dadosPorEmpresa: restDados };
        });
      },

      selectEmpresa: async (id) => {
        const { tenantId } = get();

        // Salva estado atual no cache local
        set((state) => {
          const dadosAtualizados = {
            ...state.dadosPorEmpresa,
            ...(state.selectedEmpresaId ? {
              [state.selectedEmpresaId]: {
                companyInfo: state.companyInfo,
                contas: state.contas,
                balanceteData: state.balanceteData,
                razaoData: state.razaoData,
                importHistory: state.importHistory,
                reconciledRazaoIndices: state.reconciledRazaoIndices,
              },
            } : {}),
          };
          return { dadosPorEmpresa: dadosAtualizados, selectedEmpresaId: id };
        });

        const nova = get().empresas.find((e) => e.id === id);
        const companyInfo = nova
          ? { nome: nova.razaoSocial, cnpj: nova.cnpj, periodo: nova.periodo, responsavel: nova.responsavel }
          : emptyDados.companyInfo;

        // Carrega dados do Supabase
        try {
          const [dbContas, dbDados] = await Promise.all([
            tenantId ? svc.loadContas(id) : Promise.resolve([]),
            tenantId ? svc.loadDadosEmpresa(id) : Promise.resolve(null),
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
            companyInfo,
            contas,
            balanceteData: (dbDados?.balancete_data as BalanceteRow[]) ?? [],
            razaoData: (dbDados?.razao_data as RazaoRow[]) ?? [],
            reconciledRazaoIndices: (dbDados?.reconciled_indices as number[]) ?? [],
            importHistory: (dbDados?.import_history as ImportHistory[]) ?? [],
          });
        } catch {
          // Fallback para cache local
          const cached = get().dadosPorEmpresa[id] ?? emptyDados;
          set({ companyInfo, ...cached });
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

        // Adiciona ao cache local como "pendente" (sem ID de auth ainda)
        const pendingUser: Usuario = {
          id: convite.id,
          nome: u.nome,
          email,
          role: u.role,
          status: 'ativo',
          permissoes: u.permissoes,
          createdAt: new Date(convite.criado_em),
          updatedAt: new Date(convite.criado_em),
        };
        set((state) => ({ usuarios: [...state.usuarios, pendingUser] }));

        return convite.token as unknown as void;
      },

      updateUsuario: async (id, updates) => {
        await svc.updateProfile(id, {
          nome: updates.nome,
          role: updates.role,
          status: updates.status,
          permissoes: updates.permissoes,
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

      calculateKPIs: () => {
        const { contas, balanceteData, razaoData } = get();
        let effectiveContas = contas;
        if (contas.length === 0 && balanceteData.length > 0) {
          effectiveContas = balanceteData.map((balancete) => {
            const movimentacoes = razaoData
              .filter((r) => r.conta.trim() === balancete.codigo.trim())
              .map((r, i) => ({
                id: `${balancete.codigo}-${i}`,
                data: r.data, lote: r.lote, historico: r.historico,
                debito: r.debito, credito: r.credito, saldoExercicio: r.saldoExercicio,
              }));
            const composicao = movimentacoes.reduce(
              (acc, m) => balancete.natureza === 'ATIVO' ? acc + m.debito - m.credito : acc + m.credito - m.debito, 0,
            );
            const diferenca = Math.abs(balancete.saldoAtual) - Math.abs(composicao);
            return {
              numero: balancete.codigo, descricao: balancete.descricao, natureza: balancete.natureza,
              contabilidade: balancete.saldoAtual, composicao, diferenca,
              status: (Math.abs(diferenca) < 0.01 ? 'CONCILIADO' : 'NAO_CONCILIADO') as Conta['status'],
              documentos: [], movimentacoes, createdAt: new Date(), updatedAt: new Date(),
            };
          });
        }
        const totalContas = effectiveContas.length;
        const contasConciliadas = effectiveContas.filter((c) => c.status === 'CONCILIADO').length;
        const contasAlerta = effectiveContas.filter((c) => c.prazoRegularizacao && new Date() > c.prazoRegularizacao).length;
        return {
          totalContas, contasConciliadas,
          contasPendentes: effectiveContas.filter((c) => c.status === 'NAO_CONCILIADO').length,
          percentualConciliacao: totalContas > 0 ? (contasConciliadas / totalContas) * 100 : 0,
          contasAlerta, prazoMedioRegularizacao: 15,
        };
      },
    }),
    {
      name: 'accounting-store',
      storage: createJSONStorage(() => localStorage),
      // Persiste apenas UI state leve — dados críticos vêm do Supabase
      partialize: (state) => ({
        selectedEmpresaId: state.selectedEmpresaId,
        dadosPorEmpresa: state.dadosPorEmpresa, // cache offline
      }),
    },
  ),
);
