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

            const composicao = movimentacoes.length > 0
              ? movimentacoes[movimentacoes.length - 1].saldoExercicio
              : 0;
            const diferenca = balancete.saldoAtual - composicao;

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