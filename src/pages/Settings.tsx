import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { History, Trash2, Building2, ExternalLink, Info } from 'lucide-react';

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

export function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    importHistory, removeImportHistory, clearImportHistory,
    empresas, selectedEmpresaId, currentUser,
  } = useAccountingStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearAll, setClearAll] = useState(false);

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
