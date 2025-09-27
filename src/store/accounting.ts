import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Conta, BalanceteRow, RazaoRow, ImportHistory, CompanyInfo, KPIData } from '@/types/accounting';

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
        const { contas } = get();
        const totalContas = contas.length;
        const contasConciliadas = contas.filter(c => c.status === 'CONCILIADO').length;
        const contasPendentes = contas.filter(c => c.status === 'NAO_CONCILIADO').length;
        const contasAlerta = contas.filter(c => {
          if (!c.prazoRegularizacao) return false;
          return new Date() > c.prazoRegularizacao;
        }).length;

        return {
          totalContas,
          contasConciliadas,
          contasPendentes,
          percentualConciliacao: totalContas > 0 ? (contasConciliadas / totalContas) * 100 : 0,
          contasAlerta,
          prazoMedioRegularizacao: 15, // Placeholder calculation
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
    }),
    {
      name: 'accounting-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);