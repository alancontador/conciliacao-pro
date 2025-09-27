import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Calendar, User } from 'lucide-react';

export function Header() {
  const { companyInfo } = useAccountingStore();

  return (
    <Card className="rounded-none border-x-0 border-t-0">
      <CardContent className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{companyInfo.nome || 'Empresa não definida'}</p>
                <p className="text-sm text-muted-foreground">
                  {companyInfo.cnpj || 'CNPJ não informado'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{companyInfo.periodo || 'Período não definido'}</p>
                <p className="text-sm text-muted-foreground">Período de análise</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{companyInfo.responsavel || 'Responsável não definido'}</p>
                <p className="text-sm text-muted-foreground">Contador responsável</p>
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}