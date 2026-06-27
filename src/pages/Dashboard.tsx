import { useAccountingStore } from '@/store/accounting';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusChart } from '@/components/dashboard/StatusChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  Upload,
  BarChart3
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { contas, balanceteData, calculateKPIs } = useAccountingStore();
  const kpis = calculateKPIs();

  const chartData = {
    conciliadas: kpis.contasConciliadas,
    pendentes: kpis.contasPendentes,
    emAnalise: kpis.totalContas - kpis.contasConciliadas - kpis.contasPendentes,
  };

  const hasData = contas.length > 0 || balanceteData.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo ao sistema de conciliação contábil</p>
        </div>

        <Card className="text-center py-12">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Nenhum dado importado</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Para começar a usar o sistema, importe seus dados de balancete e razão contábil.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild variant="default">
                <Link to="/import/balancete">
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Balancete
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/import/razao">
                  <FileText className="w-4 h-4 mr-2" />
                  Importar Razão
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da conciliação contábil</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total de Contas"
          value={kpis.totalContas}
          icon={FileText}
          description="Contas para conciliar"
        />
        
        <KPICard
          title="Conciliadas"
          value={kpis.contasConciliadas}
          icon={CheckCircle}
          variant="success"
          description="Contas já conciliadas"
        />
        
        <KPICard
          title="Pendentes"
          value={kpis.contasPendentes}
          icon={AlertCircle}
          variant="destructive"
          description="Aguardando conciliação"
        />
        
        <KPICard
          title="% Conciliação"
          value={`${kpis.percentualConciliacao.toFixed(1)}%`}
          icon={TrendingUp}
          variant={kpis.percentualConciliacao > 80 ? 'success' : 'warning'}
          description="Taxa de conclusão"
        />
        
        <KPICard
          title="Em Alerta"
          value={kpis.contasAlerta}
          icon={AlertCircle}
          variant="warning"
          description="Prazos vencidos"
        />
        
        <KPICard
          title="Prazo Médio"
          value={`${kpis.prazoMedioRegularizacao} dias`}
          icon={Calendar}
          description="Para regularização"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusChart data={chartData} />
        
        <Card>
          <CardHeader>
            <CardTitle>Alertas e Pendências</CardTitle>
            <CardDescription>Contas que requerem atenção imediata</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contas
                .filter(conta => 
                  conta.status !== 'CONCILIADO' || 
                  (conta.prazoRegularizacao && new Date() > conta.prazoRegularizacao)
                )
                .slice(0, 5)
                .map((conta, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{conta.numero} - {conta.descricao}</p>
                      <p className="text-sm text-muted-foreground">
                        Diferença: R$ {conta.diferenca.toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        conta.status === 'CONCILIADO' 
                          ? 'bg-success text-success-foreground'
                          : conta.status === 'EM_ANALISE'
                          ? 'bg-warning text-warning-foreground'
                          : 'bg-destructive text-destructive-foreground'
                      }`}>
                        {conta.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))}
                
              {contas.length === 0 && balanceteData.length > 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Acesse <strong>Status das Contas</strong> para ver os detalhes
                </p>
              )}
              {contas.length === 0 && balanceteData.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conta requer atenção no momento
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
          <CardDescription>Acesse as funcionalidades principais do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button asChild variant="outline" className="h-auto p-4">
              <Link to="/status" className="flex flex-col items-center space-y-2">
                <BarChart3 className="w-8 h-8" />
                <span className="font-medium">Status das Contas</span>
                <span className="text-xs text-muted-foreground text-center">
                  Visualizar e conciliar contas
                </span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <Link to="/import/balancete" className="flex flex-col items-center space-y-2">
                <Upload className="w-8 h-8" />
                <span className="font-medium">Importar Balancete</span>
                <span className="text-xs text-muted-foreground text-center">
                  Carregar dados do balancete
                </span>
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="h-auto p-4">
              <Link to="/import/razao" className="flex flex-col items-center space-y-2">
                <FileText className="w-8 h-8" />
                <span className="font-medium">Importar Razão</span>
                <span className="text-xs text-muted-foreground text-center">
                  Carregar movimentações
                </span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}