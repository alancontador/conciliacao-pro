import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { KPICard } from '@/components/dashboard/KPICard';
import { StatusChart } from '@/components/dashboard/StatusChart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Upload,
  BarChart3,
  Pencil,
  Check,
  X,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function Dashboard() {
  const {
    contas, balanceteData, calculateKPIs,
    prazoMedioRegularizacao, setPrazoMedioRegularizacao,
  } = useAccountingStore();
  const kpis = calculateKPIs();

  const [editingPrazo, setEditingPrazo] = useState(false);
  const [prazoInput, setPrazoInput] = useState('');

  const chartData = {
    conciliadas: kpis.contasConciliadas,
    pendentes: kpis.contasPendentes,
    emAnalise: kpis.totalContas - kpis.contasConciliadas - kpis.contasPendentes,
  };

  const hasData = contas.length > 0 || balanceteData.length > 0;

  const startEditPrazo = () => {
    setPrazoInput(String(prazoMedioRegularizacao));
    setEditingPrazo(true);
  };

  const savePrazo = () => {
    const val = parseInt(prazoInput, 10);
    if (!isNaN(val) && val > 0 && val <= 365) {
      setPrazoMedioRegularizacao(val);
    }
    setEditingPrazo(false);
  };

  const cancelPrazo = () => setEditingPrazo(false);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Bem-vindo ao Conciliação PRO</p>
        </div>

        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Comece sua conciliação</h2>
            <p className="text-muted-foreground text-sm max-w-md mb-10">
              Siga os passos abaixo para importar seus dados e iniciar o processo de conciliação contábil.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
              <div className="flex-1 flex flex-col items-center gap-3 p-5 rounded-xl bg-primary/5 border border-primary/20">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  1
                </div>
                <p className="text-sm font-semibold">Importar Balancete</p>
                <p className="text-xs text-muted-foreground text-center">
                  Carregue o balancete contábil do período
                </p>
                <Button asChild size="sm" className="mt-auto">
                  <Link to="/import/balancete">
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Importar
                  </Link>
                </Button>
              </div>

              <div className="flex-1 flex flex-col items-center gap-3 p-5 rounded-xl bg-muted/50 border border-border">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  2
                </div>
                <p className="text-sm font-semibold">Importar Razão</p>
                <p className="text-xs text-muted-foreground text-center">
                  Carregue as movimentações do razão contábil
                </p>
                <Button asChild size="sm" variant="outline" className="mt-auto">
                  <Link to="/import/razao">
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Importar
                  </Link>
                </Button>
              </div>

              <div className="flex-1 flex flex-col items-center gap-3 p-5 rounded-xl bg-muted/50 border border-border opacity-60">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  3
                </div>
                <p className="text-sm font-semibold">Conciliar Contas</p>
                <p className="text-xs text-muted-foreground text-center">
                  Analise e concilie as contas do período
                </p>
                <Button size="sm" variant="outline" disabled className="mt-auto">
                  <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
                  Acessar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Dashboard com dados ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da conciliação contábil</p>
      </div>

      {/* Hero — Barra de progresso */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Progresso de conciliação</p>
              <p className="text-4xl font-bold text-foreground leading-none">
                {kpis.percentualConciliacao.toFixed(1)}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground leading-none">
                {kpis.contasConciliadas}
                <span className="text-muted-foreground text-lg font-normal">/{kpis.totalContas}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">contas conciliadas</p>
            </div>
          </div>
          <Progress value={kpis.percentualConciliacao} className="h-2.5 mb-3" />
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--success))] inline-block" />
              {kpis.contasConciliadas} conciliadas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--warning))] inline-block" />
              {chartData.emAnalise} em análise
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--destructive))] inline-block" />
              {kpis.contasPendentes} pendentes
            </span>
            {kpis.contasAlerta > 0 && (
              <span className="flex items-center gap-1.5 text-destructive font-medium ml-auto">
                <AlertCircle className="w-3.5 h-3.5" />
                {kpis.contasAlerta} com prazo vencido
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Total de Contas"
          value={kpis.totalContas}
          icon={FileText}
          description="Para conciliar"
        />
        <KPICard
          title="Conciliadas"
          value={kpis.contasConciliadas}
          icon={CheckCircle}
          variant="success"
          description="Já conciliadas"
        />
        <KPICard
          title="Pendentes"
          value={kpis.contasPendentes}
          icon={AlertCircle}
          variant="destructive"
          description="Aguardando"
        />
        <KPICard
          title="Em Análise"
          value={chartData.emAnalise}
          icon={TrendingUp}
          variant="warning"
          description="Em andamento"
        />
        <KPICard
          title="Em Alerta"
          value={kpis.contasAlerta}
          icon={AlertCircle}
          variant={kpis.contasAlerta > 0 ? 'destructive' : 'default'}
          description="Prazos vencidos"
        />

        {/* Prazo Médio — editável inline */}
        <Card className="border-primary/20 bg-primary/5 transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <p className="text-sm font-medium text-muted-foreground">Prazo Médio</p>
            <div className="flex items-center gap-1.5">
              {!editingPrazo && (
                <button
                  onClick={startEditPrazo}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Editar prazo médio"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {editingPrazo ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={prazoInput}
                  onChange={(e) => setPrazoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') savePrazo();
                    if (e.key === 'Escape') cancelPrazo();
                  }}
                  className="h-7 w-16 text-base font-bold px-2"
                  min={1}
                  max={365}
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">dias</span>
                <button onClick={savePrazo} className="text-green-600 hover:text-green-700 transition-colors ml-0.5">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={cancelPrazo} className="text-destructive hover:text-destructive/80 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="text-2xl font-bold text-foreground">{prazoMedioRegularizacao} dias</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Para regularização</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StatusChart data={chartData} />

        <Card>
          <CardHeader>
            <CardTitle>Alertas e Pendências</CardTitle>
            <CardDescription>Contas que requerem atenção imediata</CardDescription>
          </CardHeader>
          <CardContent>
            {contas.length === 0 && balanceteData.length > 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                Acesse <strong>Status das Contas</strong> para ver os detalhes
              </p>
            ) : (
              <div className="space-y-2">
                {contas
                  .filter(
                    (c) =>
                      c.status !== 'CONCILIADO' ||
                      (c.prazoRegularizacao && new Date() > c.prazoRegularizacao),
                  )
                  .slice(0, 5)
                  .map((conta, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border-l-4',
                        conta.status === 'EM_ANALISE'
                          ? 'bg-[hsl(var(--warning)/0.05)] border-[hsl(var(--warning))]'
                          : 'bg-[hsl(var(--destructive)/0.05)] border-destructive',
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conta.numero} — {conta.descricao}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Diferença: R${' '}
                          {Math.abs(conta.diferenca).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <Badge
                        variant={conta.status === 'EM_ANALISE' ? 'outline' : 'destructive'}
                        className="ml-3 shrink-0 text-xs"
                      >
                        {conta.status === 'EM_ANALISE' ? 'Em Análise' : 'Pendente'}
                      </Badge>
                    </div>
                  ))}

                {contas.filter((c) => c.status !== 'CONCILIADO').length === 0 && contas.length > 0 && (
                  <div className="flex items-center justify-center gap-2 text-[hsl(var(--success))] py-6">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Todas as contas estão conciliadas!</span>
                  </div>
                )}

                {contas.filter((c) => c.status !== 'CONCILIADO').length > 5 && (
                  <Link
                    to="/status"
                    className="flex items-center gap-1 text-xs text-primary hover:underline mt-2 pt-1"
                  >
                    Ver todas as pendências <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
          Ações Rápidas
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/status"
            className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Status das Contas</p>
              <p className="text-xs text-muted-foreground">Visualizar e conciliar contas</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
          </Link>

          <Link
            to="/import/balancete"
            className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--success)/0.5)] hover:bg-[hsl(var(--success)/0.05)] transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--success)/0.1)] flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--success)/0.2)] transition-colors">
              <Upload className="w-5 h-5 text-[hsl(var(--success))]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Importar Balancete</p>
              <p className="text-xs text-muted-foreground">Carregar dados do balancete</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-[hsl(var(--success))] transition-colors" />
          </Link>

          <Link
            to="/import/razao"
            className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-[hsl(var(--warning)/0.5)] hover:bg-[hsl(var(--warning)/0.05)] transition-all"
          >
            <div className="w-10 h-10 rounded-lg bg-[hsl(var(--warning)/0.1)] flex items-center justify-center shrink-0 group-hover:bg-[hsl(var(--warning)/0.2)] transition-colors">
              <FileText className="w-5 h-5 text-[hsl(var(--warning))]" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Importar Razão</p>
              <p className="text-xs text-muted-foreground">Carregar movimentações</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto shrink-0 group-hover:text-[hsl(var(--warning))] transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  );
}
