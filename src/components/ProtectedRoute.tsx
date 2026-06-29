import { Navigate, useLocation } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import type { PermissoesUsuario } from '@/types/usuario';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: keyof PermissoesUsuario;
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { currentUser } = useAccountingStore();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (permission && !currentUser.permissoes[permission]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
