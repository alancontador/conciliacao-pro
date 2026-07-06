import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useAccountingStore } from '@/store/accounting';

const NotFound = () => {
  const location = useLocation();
  const { currentUser } = useAccountingStore();

  useEffect(() => {
    logger.warn('router/not-found', {
      context: { userId: currentUser?.id, action: 'navigation' },
      data: { path: location.pathname },
    });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="text-primary underline hover:text-primary/80">
          Voltar para o início
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
