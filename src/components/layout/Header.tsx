import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Calendar, User, ChevronDown, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function Header() {
  const { companyInfo, empresas, selectedEmpresaId, selectEmpresa } = useAccountingStore();
  const { toast } = useToast();

  const hasMultiple = empresas.length > 1;

  const handleSwitch = (id: string) => {
    selectEmpresa(id);
    const emp = empresas.find((e) => e.id === id);
    toast({ title: `Empresa alterada: ${emp?.razaoSocial}` });
  };

  return (
    <Card className="rounded-none border-x-0 border-t-0">
      <CardContent className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Empresa com seletor rápido */}
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
              {hasMultiple ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-auto p-0 hover:bg-transparent hover:text-foreground text-left">
                      <div>
                        <p className="font-semibold flex items-center gap-1">
                          {companyInfo.nome || 'Selecione uma empresa'}
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {companyInfo.cnpj || 'CNPJ não informado'}
                        </p>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuLabel>Trocar empresa</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {empresas
                      .filter((e) => e.ativa)
                      .map((e) => (
                        <DropdownMenuItem
                          key={e.id}
                          onClick={() => handleSwitch(e.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                            {e.razaoSocial
                              .split(' ')
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((p) => p[0])
                              .join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{e.razaoSocial}</p>
                            <p className="text-xs text-muted-foreground">{e.cnpj}</p>
                          </div>
                          {e.id === selectedEmpresaId && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div>
                  <p className="font-semibold">{companyInfo.nome || 'Empresa não definida'}</p>
                  <p className="text-xs text-muted-foreground">
                    {companyInfo.cnpj || 'CNPJ não informado'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{companyInfo.periodo || 'Período não definido'}</p>
                <p className="text-xs text-muted-foreground">Período de análise</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {companyInfo.responsavel || 'Responsável não definido'}
                </p>
                <p className="text-xs text-muted-foreground">Contador responsável</p>
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
