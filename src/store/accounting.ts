import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory, CompanyInfo, KPIData } from '@/types/accounting';
import type { Usuario, ResetToken } from '@/types/usuario';
import type { Empresa } from '@/types/empresa';
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth';

// ── Dados por empresa ─────────────────────────────────────────────────────────

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
  contas: [],
  balanceteData: [],
  razaoData: [],
  importHistory: [],
  reconciledRazaoIndices: [],
};

// Helper: atualiza os campos flat E o registro em dadosPorEmpresa ao mesmo tempo.
// Assim nenhum componente existente precisa mudar — eles lêem sempre os campos flat.
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

// ── Interface do store ────────────────────────────────────────────────────────

interface AccountingState {
  // Campos ativos (empresa selecionada) — lidos por todos os componentes
  companyInfo: CompanyInfo;
  setCompanyInfo: (info: CompanyInfo) => void;

  contas: Conta[];
  setContas: (contas: Conta[]) => void;
  updateConta: (numero: string, updates: Partial<Conta>) => void;

  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  setBalanceteData: (data: BalanceteRow[]) => void;
  setRazaoData: (data: RazaoRow[]) => void;

  importHistory: ImportHistory[];
  addImportHistory: (history: ImportHistory) => void;

  reconciledRazaoIndices: number[];
  reconcileRazaoTransactions: (indices: number[]) => void;
  unreconcileRazaoTransactions: (indices: number[]) => void;

  calculateKPIs: () => KPIData;
  reconcileAccount: (numero: string, status: Conta['status']) => void;
  updateRazaoTransaction: (index: number, updates: Partial<RazaoRow>) => void;
  deleteRazaoTransaction: (index: number) => void;

  // Multi-empresa
  empresas: Empresa[];
  selectedEmpresaId: string | null;
  dadosPorEmpresa: Record<string, EmpresaDados>;
  addEmpresa: (e: Omit<Empresa, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEmpresa: (id: string, updates: Partial<Omit<Empresa, 'id' | 'createdAt'>>) => void;
  deleteEmpresa: (id: string) => void;
  selectEmpresa: (id: string) => void;

  // Usuários
  usuarios: Usuario[];
  addUsuario: (u: Omit<Usuario, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUsuario: (id: string, updates: Partial<Omit<Usuario, 'id' | 'createdAt'>>) => void;
  deleteUsuario: (id: string) => void;

  // Autenticação
  currentUser: Usuario | null;
  resetTokens: ResetToken[];
  login: (email: string, password: string) => Promise<'ok' | 'invalid' | 'inactive'>;
  logout: () => void;
  createFirstAdmin: (nome: string, email: string, password: string) => Promise<void>;
  setUserPassword: (userId: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => string | null;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<boolean>;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      // Estado inicial — campos flat
      companyInfo: { nome: '', cnpj: '', periodo: '', responsavel: '' },
      contas: [],
      balanceteData: [],
      razaoData: [],
      importHistory: [],
      reconciledRazaoIndices: [],

      // Multi-empresa
      empresas: [],
      selectedEmpresaId: null,
      dadosPorEmpresa: {},

      // Auth
      usuarios: [],
      currentUser: null,
      resetTokens: [],

      // ── Setters com sync duplo ──────────────────────────────────────────────

      setCompanyInfo: (companyInfo) =>
        set((state) => sync(state, { companyInfo })),

      setContas: (contas) =>
        set((state) => sync(state, { contas })),

      updateConta: (numero, updates) =>
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, ...updates, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        }),

      setBalanceteData: (balanceteData) =>
        set((state) => sync(state, { balanceteData })),

      setRazaoData: (razaoData) =>
        set((state) => sync(state, { razaoData })),

      addImportHistory: (history) =>
        set((state) => sync(state, { importHistory: [history, ...state.importHistory] })),

      reconcileAccount: (numero, status) =>
        set((state) => {
          const contas = state.contas.map((c) =>
            c.numero === numero ? { ...c, status, updatedAt: new Date() } : c,
          );
          return sync(state, { contas });
        }),

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

      // ── Multi-empresa ───────────────────────────────────────────────────────

      addEmpresa: (e) => {
        const id = crypto.randomUUID();
        const nova: Empresa = { ...e, id, createdAt: new Date(), updatedAt: new Date() };
        set((state) => {
          const isFirst = state.empresas.length === 0;
          const novosDados: Record<string, EmpresaDados> = {
            ...state.dadosPorEmpresa,
            [id]: emptyDados,
          };
          if (isFirst) {
            // Se é a primeira empresa e já existe dados legados, associa a ela
            const temDados =
              state.contas.length > 0 ||
              state.balanceteData.length > 0 ||
              state.razaoData.length > 0;
            if (temDados) {
              novosDados[id] = {
                companyInfo: state.companyInfo,
                contas: state.contas,
                balanceteData: state.balanceteData,
                razaoData: state.razaoData,
                importHistory: state.importHistory,
                reconciledRazaoIndices: state.reconciledRazaoIndices,
              };
            }
            return {
              empresas: [...state.empresas, nova],
              selectedEmpresaId: id,
              dadosPorEmpresa: novosDados,
              companyInfo: { nome: nova.razaoSocial, cnpj: nova.cnpj, periodo: nova.periodo, responsavel: nova.responsavel },
              ...(temDados ? {} : { contas: [], balanceteData: [], razaoData: [], importHistory: [], reconciledRazaoIndices: [] }),
            };
          }
          return { empresas: [...state.empresas, nova], dadosPorEmpresa: novosDados };
        });
        return id;
      },

      updateEmpresa: (id, updates) =>
        set((state) => {
          const empresas = state.empresas.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: new Date() } : e,
          );
          // Se é a empresa ativa, atualiza também companyInfo
          const extra =
            state.selectedEmpresaId === id
              ? {
                  companyInfo: {
                    nome: (updates.razaoSocial ?? state.empresas.find((e) => e.id === id)?.razaoSocial) ?? '',
                    cnpj: (updates.cnpj ?? state.empresas.find((e) => e.id === id)?.cnpj) ?? '',
                    periodo: (updates.periodo ?? state.empresas.find((e) => e.id === id)?.periodo) ?? '',
                    responsavel: (updates.responsavel ?? state.empresas.find((e) => e.id === id)?.responsavel) ?? '',
                  },
                }
              : {};
          return { empresas, ...extra };
        }),

      deleteEmpresa: (id) =>
        set((state) => {
          const empresas = state.empresas.filter((e) => e.id !== id);
          const { [id]: _removed, ...restDados } = state.dadosPorEmpresa;
          // Se excluiu a empresa ativa, seleciona a próxima ou limpa
          if (state.selectedEmpresaId === id) {
            const proxima = empresas[0];
            if (proxima) {
              const dados = restDados[proxima.id] ?? emptyDados;
              return {
                empresas,
                dadosPorEmpresa: restDados,
                selectedEmpresaId: proxima.id,
                ...dados,
                companyInfo: { nome: proxima.razaoSocial, cnpj: proxima.cnpj, periodo: proxima.periodo, responsavel: proxima.responsavel },
              };
            }
            return { empresas, dadosPorEmpresa: restDados, selectedEmpresaId: null, ...emptyDados };
          }
          return { empresas, dadosPorEmpresa: restDados };
        }),

      selectEmpresa: (id) =>
        set((state) => {
          // Salva dados atuais da empresa em uso
          const dadosAtualizados: Record<string, EmpresaDados> = {
            ...state.dadosPorEmpresa,
            ...(state.selectedEmpresaId
              ? {
                  [state.selectedEmpresaId]: {
                    companyInfo: state.companyInfo,
                    contas: state.contas,
                    balanceteData: state.balanceteData,
                    razaoData: state.razaoData,
                    importHistory: state.importHistory,
                    reconciledRazaoIndices: state.reconciledRazaoIndices,
                  },
                }
              : {}),
          };
          // Carrega dados da nova empresa
          const nova = state.empresas.find((e) => e.id === id);
          const dados = dadosAtualizados[id] ?? emptyDados;
          return {
            selectedEmpresaId: id,
            dadosPorEmpresa: dadosAtualizados,
            ...dados,
            companyInfo: nova
              ? { nome: nova.razaoSocial, cnpj: nova.cnpj, periodo: nova.periodo, responsavel: nova.responsavel }
              : dados.companyInfo,
          };
        }),

      // ── KPIs ───────────────────────────────────────────────────────────────

      calculateKPIs: () => {
        const { contas, balanceteData, razaoData } = get();

        let effectiveContas = contas;
        if (contas.length === 0 && balanceteData.length > 0) {
          effectiveContas = balanceteData.map((balancete) => {
            const movimentacoes = razaoData
              .filter((r) => r.conta.trim() === balancete.codigo.trim())
              .map((r, i) => ({
                id: `${balancete.codigo}-${i}`,
                data: r.data,
                lote: r.lote,
                historico: r.historico,
                debito: r.debito,
                credito: r.credito,
                saldoExercicio: r.saldoExercicio,
              }));

            const composicao = movimentacoes.reduce(
              (acc, m) =>
                balancete.natureza === 'ATIVO' ? acc + m.debito - m.credito : acc + m.credito - m.debito,
              0,
            );
            const diferenca = Math.abs(balancete.saldoAtual) - Math.abs(composicao);

            return {
              numero: balancete.codigo,
              descricao: balancete.descricao,
              natureza: balancete.natureza,
              contabilidade: balancete.saldoAtual,
              composicao,
              diferenca,
              status: (Math.abs(diferenca) < 0.01 ? 'CONCILIADO' : 'NAO_CONCILIADO') as Conta['status'],
              documentos: [],
              movimentacoes,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });
        }

        const totalContas = effectiveContas.length;
        const contasConciliadas = effectiveContas.filter((c) => c.status === 'CONCILIADO').length;
        const contasPendentes = effectiveContas.filter((c) => c.status === 'NAO_CONCILIADO').length;
        const contasAlerta = effectiveContas.filter((c) => {
          if (!c.prazoRegularizacao) return false;
          return new Date() > c.prazoRegularizacao;
        }).length;

        return {
          totalContas,
          contasConciliadas,
          contasPendentes,
          percentualConciliacao: totalContas > 0 ? (contasConciliadas / totalContas) * 100 : 0,
          contasAlerta,
          prazoMedioRegularizacao: 15,
        };
      },

      // ── Usuários ───────────────────────────────────────────────────────────

      addUsuario: (u) =>
        set((state) => ({
          usuarios: [
            ...state.usuarios,
            { ...u, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() },
          ],
        })),

      updateUsuario: (id, updates) =>
        set((state) => ({
          usuarios: state.usuarios.map((u) =>
            u.id === id ? { ...u, ...updates, updatedAt: new Date() } : u,
          ),
          currentUser:
            state.currentUser?.id === id
              ? { ...state.currentUser, ...updates, updatedAt: new Date() }
              : state.currentUser,
        })),

      deleteUsuario: (id) =>
        set((state) => ({ usuarios: state.usuarios.filter((u) => u.id !== id) })),

      // ── Autenticação ───────────────────────────────────────────────────────

      login: async (email, password) => {
        const { usuarios } = get();
        const user = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user || !user.senhaHash) return 'invalid';
        if (user.status === 'inativo') return 'inactive';
        const ok = await verifyPassword(password, user.senhaHash);
        if (!ok) return 'invalid';
        set({ currentUser: user });
        return 'ok';
      },

      logout: () => set({ currentUser: null }),

      createFirstAdmin: async (nome, email, password) => {
        const senhaHash = await hashPassword(password);
        const admin: Usuario = {
          id: crypto.randomUUID(),
          nome,
          email,
          senhaHash,
          role: 'admin',
          status: 'ativo',
          permissoes: {
            verDashboard: true,
            verStatus: true,
            editarStatus: true,
            importar: true,
            exportar: true,
            gerenciarUsuarios: true,
            gerenciarEmpresas: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        set((state) => ({ usuarios: [...state.usuarios, admin], currentUser: admin }));
      },

      setUserPassword: async (userId, password) => {
        const senhaHash = await hashPassword(password);
        set((state) => ({
          usuarios: state.usuarios.map((u) =>
            u.id === userId ? { ...u, senhaHash, updatedAt: new Date() } : u,
          ),
        }));
      },

      requestPasswordReset: (email) => {
        const { usuarios } = get();
        const user = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return null;
        const token = generateToken();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
        set((state) => ({
          resetTokens: [
            ...state.resetTokens.filter((t) => t.email !== email),
            { token, email, expiresAt },
          ],
        }));
        return token;
      },

      confirmPasswordReset: async (token, newPassword) => {
        const { resetTokens, usuarios } = get();
        const entry = resetTokens.find((t) => t.token === token);
        if (!entry || entry.expiresAt < Date.now()) return false;
        const user = usuarios.find((u) => u.email === entry.email);
        if (!user) return false;
        const senhaHash = await hashPassword(newPassword);
        set((state) => ({
          usuarios: state.usuarios.map((u) =>
            u.id === user.id ? { ...u, senhaHash, updatedAt: new Date() } : u,
          ),
          resetTokens: state.resetTokens.filter((t) => t.token !== token),
        }));
        return true;
      },
    }),
    {
      name: 'accounting-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
