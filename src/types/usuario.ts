export type UsuarioRole = 'admin' | 'gerente' | 'analista' | 'visualizador';
export type UsuarioStatus = 'ativo' | 'inativo';

export interface PermissoesUsuario {
  verDashboard: boolean;
  verStatus: boolean;
  editarStatus: boolean;
  importar: boolean;
  exportar: boolean;
  gerenciarUsuarios: boolean;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senhaHash?: string;
  role: UsuarioRole;
  status: UsuarioStatus;
  permissoes: PermissoesUsuario;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResetToken {
  token: string;
  email: string;
  expiresAt: number; // timestamp ms
}

export const ROLE_LABELS: Record<UsuarioRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  analista: 'Analista',
  visualizador: 'Visualizador',
};

export const PERMISSAO_LABELS: Record<keyof PermissoesUsuario, string> = {
  verDashboard: 'Ver Dashboard',
  verStatus: 'Ver Status das Contas',
  editarStatus: 'Editar Status',
  importar: 'Importar Arquivos',
  exportar: 'Exportar Dados',
  gerenciarUsuarios: 'Gerenciar Usuários',
};

export const DEFAULT_PERMISSOES: Record<UsuarioRole, PermissoesUsuario> = {
  admin: {
    verDashboard: true,
    verStatus: true,
    editarStatus: true,
    importar: true,
    exportar: true,
    gerenciarUsuarios: true,
  },
  gerente: {
    verDashboard: true,
    verStatus: true,
    editarStatus: true,
    importar: false,
    exportar: true,
    gerenciarUsuarios: false,
  },
  analista: {
    verDashboard: true,
    verStatus: true,
    editarStatus: true,
    importar: true,
    exportar: true,
    gerenciarUsuarios: false,
  },
  visualizador: {
    verDashboard: true,
    verStatus: true,
    editarStatus: false,
    importar: false,
    exportar: false,
    gerenciarUsuarios: false,
  },
};
