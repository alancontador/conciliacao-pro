import type { KPIData } from '@/types/accounting';

export type CompetenciaStatus = 'EM_ANDAMENTO' | 'CONCLUIDA';

// Competência de trabalho (MM/AAAA). Armazenada internamente como 'AAAA-MM'
// para permitir ordenação lexicográfica correta.
export interface Competencia {
  id: string;
  empresaId: string;
  competencia: string; // 'AAAA-MM'
  status: CompetenciaStatus;
  concluidaEm?: Date;
  concluidaPor?: string;
  kpisSnapshot?: KPIData;
  createdAt: Date;
  updatedAt: Date;
}
