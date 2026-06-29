import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory, CompanyInfo, KPIData } from '@/types/accounting';
import type { Usuario, ResetToken } from '@/types/usuario';
import { hashPassword, verifyPassword, generateToken } from '@/lib/auth';

interface AccountingState {
  // Company and session data
  companyInfo: CompanyInfo;
  setCompanyInfo: (info: CompanyInfo) => void;

  // Accounts data
  contas: Conta[];
  setContas: (contas: Conta[]) => void;
  updateConta: (numero: string, updates: Partial<Conta>) => void;

  // Import data
  balanceteData: BalanceteRow[];
  razaoData: RazaoRow[];
  setBalanceteData: (data: BalanceteRow[]) => void;
  setRazaoData: (data: RazaoRow[]) => void;

  // Import history
  importHistory: ImportHistory[];
  addImportHistory: (history: ImportHistory) => void;

  // Calculations
  calculateKPIs: () => KPIData;
  reconcileAccount: (numero: string, status: Conta['status']) => void;

  // Edição e exclusão de lançamentos do razão
  updateRazaoTransaction: (index: number, updates: Partial<RazaoRow>) => void;
  deleteRazaoTransaction: (index: number) => void;

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

  // Conciliação de lançamentos individuais do razão
  reconciledRazaoIndices: number[];
  reconcileRazaoTransactions: (indices: number[]) => void;
  unreconcileRazaoTransactions: (indices: number[]) => void;
}

export const useAccountingStore = create<AccountingState>()(
  persist(
    (set, get) => ({
      companyInfo: {
        nome: '',
        cnpj: '',
        periodo: '',
        responsavel: '',
      },

      contas: [],
      balanceteData: [],
      razaoData: [],
      importHistory: [],
      usuarios: [],
      currentUser: null,
      resetTokens: [],
      reconciledRazaoIndices: [],

      setCompanyInfo: (info) => set({ companyInfo: info }),

      setContas: (contas) => set({ contas }),

      updateConta: (numero, updates) => 
        set((state) => ({
          contas: state.contas.map((conta) =>
            conta.numero === numero 
              ? { ...conta, ...updates, updatedAt: new Date() }
              : conta
          ),
        })),

      setBalanceteData: (data) => set({ balanceteData: data }),

      setRazaoData: (data) => set({ razaoData: data }),

      addImportHistory: (history) =>
        set((state) => ({
          importHistory: [history, ...state.importHistory],
        })),

      calculateKPIs: () => {
        const { contas, balanceteData, razaoData } = get();

        let effectiveContas = contas;
        if (contas.length === 0 && balanceteData.length > 0) {
          effectiveContas = balanceteData.map(balancete => {
            const movimentacoes = razaoData
              .filter(r => r.conta.trim() === balancete.codigo.trim())
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
              (acc, m) => balancete.natureza === 'ATIVO'
                ? acc + m.debito - m.credito
                : acc + m.credito - m.debito,
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
        const contasConciliadas = effectiveContas.filter(c => c.status === 'CONCILIADO').length;
        const contasPendentes = effectiveContas.filter(c => c.status === 'NAO_CONCILIADO').length;
        const contasAlerta = effectiveContas.filter(c => {
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

      reconcileAccount: (numero, status) =>
        set((state) => ({
          contas: state.contas.map((conta) =>
            conta.numero === numero
              ? { ...conta, status, updatedAt: new Date() }
              : conta
          ),
        })),

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
            u.id === id ? { ...u, ...updates, updatedAt: new Date() } : u
          ),
          // Atualiza currentUser se for o mesmo
          currentUser:
            state.currentUser?.id === id
              ? { ...state.currentUser, ...updates, updatedAt: new Date() }
              : state.currentUser,
        })),

      deleteUsuario: (id) =>
        set((state) => ({ usuarios: state.usuarios.filter((u) => u.id !== id) })),

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
            u.id === userId ? { ...u, senhaHash, updatedAt: new Date() } : u
          ),
        }));
      },

      requestPasswordReset: (email) => {
        const { usuarios } = get();
        const user = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) return null;
        const token = generateToken();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24h
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
            u.id === user.id ? { ...u, senhaHash, updatedAt: new Date() } : u
          ),
          resetTokens: state.resetTokens.filter((t) => t.token !== token),
        }));
        return true;
      },

      updateRazaoTransaction: (index, updates) =>
        set((state) => {
          const next = [...state.razaoData];
          next[index] = { ...next[index], ...updates };
          return { razaoData: next };
        }),

      deleteRazaoTransaction: (index) =>
        set((state) => ({
          razaoData: state.razaoData.filter((_, i) => i !== index),
          reconciledRazaoIndices: state.reconciledRazaoIndices
            .filter(i => i !== index)
            .map(i => (i > index ? i - 1 : i)),
        })),

      reconcileRazaoTransactions: (indices) =>
        set((state) => ({
          reconciledRazaoIndices: [...new Set([...state.reconciledRazaoIndices, ...indices])],
        })),

      unreconcileRazaoTransactions: (indices) =>
        set((state) => {
          const remove = new Set(indices);
          return { reconciledRazaoIndices: state.reconciledRazaoIndices.filter(i => !remove.has(i)) };
        }),
    }),
    {
      name: 'accounting-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);