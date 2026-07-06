import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import { useLogBuffer } from '@/hooks/use-log-buffer';
import { type LogEntry, type LogLevel } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { History, Trash2, Building2, ExternalLink, Info, Bug, Copy, Download, ChevronDown, ChevronRight } from 'lucide-react';

function formatDate(value: Date | string | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'SUCESSO':
      return <Badge className="bg-green-100 text-green-800 border-green-200">Sucesso</Badge>;
    case 'ERRO':
      return <Badge variant="destructive">Erro</Badge>;
    case 'PARCIAL':
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Parcial</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// ── Log Viewer ────────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<LogLevel, { label: string; className: string }> = {
  debug: { label: 'DEBUG', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  info:  { label: 'INFO',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  warn:  { label: 'AVISO', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  error: { label: 'ERRO',  className: 'bg-red-100 text-red-700 border-red-200' },
  fatal: { label: 'FATAL', className: 'bg-red-700 text-white border-red-800' },
};

type LogFilter = 'all' | 'warn' | 'error';

function formatLogTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return iso;
  }
}

function buildReport(entries: LogEntry[], user: { email?: string } | null | undefined): string {
  const lines: string[] = [
    '=== RELATÓRIO DE DIAGNÓSTICO — ConciliaçãoPRO ===',
    `Gerado em : ${new Date().toLocaleString('pt-BR')}`,
    `Usuário   : ${user?.email ?? '—'}`,
    `Registros : ${entries.length}`,
    '',
    '─'.repeat(60),
    '',
  ];

  for (const e of [...entries].reverse()) {
    lines.push(`[${formatLogTimestamp(e.timestamp)}] ${e.level.toUpperCase().padEnd(5)} ${e.message}`);
    if (e.context) lines.push(`  ctx   : ${JSON.stringify(e.context)}`);
    if (e.error)   lines.push(`  erro  : ${JSON.stringify(e.error)}`);
    if (e.data)    lines.push(`  dados : ${JSON.stringify(e.data)}`);
    lines.push('');
  }

  return lines.join('\n');
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.info;
  const hasDetails = !!(entry.context || entry.error || entry.data);

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${entry.level === 'error' || entry.level === 'fatal' ? 'bg-red-50/40 dark:bg-red-950/20' : entry.level === 'warn' ? 'bg-yellow-50/30 dark:bg-yellow-950/10' : ''}`}
        onClick={() => hasDetails && setOpen((v) => !v)}
      >
        <TableCell className="w-36 whitespace-nowrap text-xs text-muted-foreground font-mono">
          {formatLogTimestamp(entry.timestamp)}
        </TableCell>
        <TableCell className="w-20">
          <Badge variant="outline" className={`text-xs font-mono ${cfg.className}`}>
            {cfg.label}
          </Badge>
        </TableCell>
        <TableCell className="font-mono text-sm">{entry.message}</TableCell>
        <TableCell className="w-6 text-muted-foreground">
          {hasDetails && (open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
        </TableCell>
      </TableRow>
      {open && hasDetails && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={4} className="py-2 px-4">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed">
              {entry.context && `contexto : ${JSON.stringify(entry.context, null, 2)}\n`}
              {entry.error   && `erro     : ${JSON.stringify(entry.error,   null, 2)}\n`}
              {entry.data    && `dados    : ${JSON.stringify(entry.data,    null, 2)}`}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    importHistory, removeImportHistory, clearImportHistory,
    empresas, selectedEmpresaId, currentUser,
  } = useAccountingStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);

  const { entries: allLogs, clear: clearLogs } = useLogBuffer();
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [clearLogsOpen, setClearLogsOpen] = useState(false);

  const filteredLogs = useMemo(() => {
    const reversed = [...allLogs].reverse();
    if (logFilter === 'warn') return reversed.filter((e) => e.level === 'warn');
    if (logFilter === 'error') return reversed.filter((e) => e.level === 'error' || e.level === 'fatal');
    return reversed;
  }, [allLogs, logFilter]);

  const errorCount = allLogs.filter((e) => e.level === 'error' || e.level === 'fatal').length;
  const warnCount  = allLogs.filter((e) => e.level === 'warn').length;

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'gerente';
  const selectedEmpresa = empresas.find((e) => e.id === selectedEmpresaId);

  const handleDelete = () => {
    if (!deleteId) return;
    removeImportHistory(deleteId);
    setDeleteId(null);
    toast({ title: 'Registro removido do histórico' });
  };

  const handleClearAll = () => {
    clearImportHistory();
    setClearAll(false);
    toast({ title: 'Histórico de importações limpo' });
  };

  const handleCopyLogs = () => {
    const report = buildReport(allLogs, currentUser);
    navigator.clipboard.writeText(report).then(() => {
      toast({ title: 'Logs copiados!', description: 'Cole no e-mail ou chat de suporte.' });
    });
  };

  const handleDownloadLogs = () => {
    const report = buildReport(allLogs, currentUser);
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conciliacao-pro-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie as configurações e histórico do sistema</p>
      </div>

      {/* Empresa selecionada */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Empresa Selecionada
          </CardTitle>
          <CardDescription>
            Informações da empresa ativa no momento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedEmpresa ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Razão Social</p>
                <p className="font-medium">{selectedEmpresa.razaoSocial}</p>
              </div>
              {selectedEmpresa.nomeFantasia && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nome Fantasia</p>
                  <p className="font-medium">{selectedEmpresa.nomeFantasia}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CNPJ</p>
                <p className="font-medium">{selectedEmpresa.cnpj || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Período</p>
                <p className="font-medium">{selectedEmpresa.periodo || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Responsável</p>
                <p className="font-medium">{selectedEmpresa.responsavel || '—'}</p>
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={() => navigate('/empresas')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Gerenciar Empresas
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Building2 className="w-10 h-10 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma empresa selecionada</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/empresas')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Ir para Empresas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Importações */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Importações
              </CardTitle>
              <CardDescription>
                Registro de todos os arquivos importados para a empresa selecionada
              </CardDescription>
            </div>
            {canManage && importHistory.length > 0 && (
              <AlertDialog open={clearAll} onOpenChange={setClearAll}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar histórico
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todos os {importHistory.length} registros de importação serão removidos. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearAll} className="bg-destructive hover:bg-destructive/90">
                      Limpar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {importHistory.length === 0 ? (
            <div className="text-center py-10">
              <History className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma importação realizada ainda</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-right">Lidas</TableHead>
                    <TableHead className="text-right">Ignoradas</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(item.data)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.tipo === 'BALANCETE' ? 'default' : 'secondary'}>
                          {item.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={item.arquivo}>
                        {item.arquivo}
                      </TableCell>
                      <TableCell className="text-sm">{item.usuario}</TableCell>
                      <TableCell className="text-right text-sm">{item.linhasLidas}</TableCell>
                      <TableCell className="text-right text-sm">{item.linhasIgnoradas}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      {canManage && (
                        <TableCell>
                          <AlertDialog
                            open={deleteId === item.id}
                            onOpenChange={(open) => setDeleteId(open ? item.id : null)}
                          >
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O registro de importação do arquivo <strong>{item.arquivo}</strong> será removido do histórico.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Painel de Logs / Diagnóstico */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                Logs do Sistema
                {errorCount > 0 && (
                  <Badge variant="destructive" className="ml-1">{errorCount} erro{errorCount !== 1 ? 's' : ''}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Em caso de problema, copie ou baixe os logs e envie ao suporte
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopyLogs} disabled={allLogs.length === 0}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar logs
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadLogs} disabled={allLogs.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Baixar .txt
              </Button>
              <AlertDialog open={clearLogsOpen} onOpenChange={setClearLogsOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-muted-foreground" disabled={allLogs.length === 0}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Limpar todos os logs?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Os {allLogs.length} registros em memória serão apagados. Os logs do servidor não são afetados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { clearLogs(); setClearLogsOpen(false); toast({ title: 'Logs limpos' }); }}>
                      Limpar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex gap-2 mb-4">
            {([
              { key: 'all',   label: `Todos (${allLogs.length})` },
              { key: 'warn',  label: `Avisos (${warnCount})` },
              { key: 'error', label: `Erros (${errorCount})` },
            ] as { key: LogFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setLogFilter(key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  logFilter === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredLogs.length === 0 ? (
            <div className="text-center py-10">
              <Bug className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">
                {allLogs.length === 0
                  ? 'Nenhum log registrado ainda. Use o sistema normalmente e os logs aparecerão aqui.'
                  : 'Nenhum registro para o filtro selecionado.'}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-36">Horário</TableHead>
                      <TableHead className="w-20">Nível</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="w-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((entry, i) => (
                      <LogRow key={`${entry.timestamp}-${i}`} entry={entry} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3">
            Armazena os últimos 200 registros em memória. Os logs são resetados ao recarregar a página.
          </p>
        </CardContent>
      </Card>

      {/* Informações do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Informações do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">v1.0.0</div>
              <div className="text-sm text-muted-foreground">Versão do Sistema</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">ConciliaçãoPRO</div>
              <div className="text-sm text-muted-foreground">Sistema Contábil</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{new Date().getFullYear()}</div>
              <div className="text-sm text-muted-foreground">Todos os direitos reservados</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
