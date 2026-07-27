import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Calendar, User, ChevronDown, CheckCircle2, Lock, Plus, Unlock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  currentCompetencia, formatCompetencia, competenciaFromParts, MESES_COMPETENCIA,
} from '@/lib/competencia';

export function Header() {
  const {
    companyInfo, empresas, selectedEmpresaId, selectEmpresa,
    competencias, selectedCompetencia, selectedCompetenciaStatus,
    selectCompetencia, criarCompetencia, concluirConciliacao, reabrirCompetencia,
  } = useAccountingStore();
  const { toast } = useToast();

  const hasMultiple = empresas.length > 1;
  const isReadonly = selectedCompetenciaStatus === 'CONCLUIDA';

  const anoAtual = new Date().getFullYear();
  const [novaOpen, setNovaOpen] = useState(false);
  const [novoMes, setNovoMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [novoAno, setNovoAno] = useState(String(anoAtual));
  const [confirmar, setConfirmar] = useState<null | 'concluir' | 'reabrir'>(null);

  const handleSwitch = (id: string) => {
    selectEmpresa(id);
    const emp = empresas.find((e) => e.id === id);
    toast({ title: `Empresa alterada: ${emp?.razaoSocial}` });
  };

  const handleSelectCompetencia = (comp: string) => {
    if (comp === selectedCompetencia) return;
    selectCompetencia(comp);
    toast({ title: `Competência: ${formatCompetencia(comp)}` });
  };

  const handleCriarCompetencia = async () => {
    const comp = competenciaFromParts(Number(novoAno), Number(novoMes));
    await criarCompetencia(comp);
    setNovaOpen(false);
    toast({ title: `Competência ${formatCompetencia(comp)} pronta para uso` });
  };

  const handleConcluir = async () => {
    try {
      await concluirConciliacao();
      toast({ title: 'Conciliação concluída', description: `Competência ${formatCompetencia(selectedCompetencia ?? '')} arquivada (somente leitura).` });
    } catch {
      toast({ title: 'Erro ao concluir', variant: 'destructive' });
    }
    setConfirmar(null);
  };

  const handleReabrir = async () => {
    try {
      await reabrirCompetencia();
      toast({ title: 'Competência reaberta', description: 'Você pode editar a conciliação novamente.' });
    } catch {
      toast({ title: 'Erro ao reabrir', variant: 'destructive' });
    }
    setConfirmar(null);
  };

  const anos = Array.from({ length: 6 }, (_, i) => anoAtual - 3 + i);

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

            {/* Período de análise → seletor de competência */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={!selectedEmpresaId}>
                  <Button variant="ghost" className="h-auto p-0 hover:bg-transparent hover:text-foreground text-left disabled:opacity-100">
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1">
                        {selectedCompetencia ? formatCompetencia(selectedCompetencia) : 'Selecione a competência'}
                        {selectedEmpresaId && <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        {isReadonly && <Lock className="w-3 h-3 text-amber-600" />}
                      </p>
                      <p className="text-xs text-muted-foreground">Período de análise</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Competências</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {competencias.length === 0 && (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Nenhuma competência ainda.</p>
                  )}
                  {competencias.map((c) => (
                    <DropdownMenuItem
                      key={c.competencia}
                      onClick={() => handleSelectCompetencia(c.competencia)}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <span className="font-medium text-sm">{formatCompetencia(c.competencia)}</span>
                      {c.status === 'CONCLUIDA' && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                          <Lock className="w-2.5 h-2.5" /> Concluída
                        </Badge>
                      )}
                      {c.competencia === selectedCompetencia && (
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 ml-auto" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => { e.preventDefault(); setNovaOpen(true); }}
                    className="cursor-pointer text-primary"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova competência
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status + ações da competência */}
              {selectedCompetencia && (
                isReadonly ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 border-amber-400 text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950"
                    onClick={() => setConfirmar('reabrir')}
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    Reabrir
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 gap-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => setConfirmar('concluir')}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluir
                  </Button>
                )
              )}
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

      {/* Dialog: nova competência */}
      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova competência</DialogTitle>
            <DialogDescription>
              Selecione o mês e o ano da competência (MM/AAAA). A conciliação desta competência é independente das demais.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Mês</label>
              <Select value={novoMes} onValueChange={setNovoMes}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_COMPETENCIA.map((nome, i) => (
                    <SelectItem key={i} value={String(i + 1).padStart(2, '0')}>
                      {String(i + 1).padStart(2, '0')} — {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ano</label>
              <Select value={novoAno} onValueChange={setNovoAno}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button onClick={handleCriarCompetencia}>Criar e selecionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação: concluir / reabrir */}
      <AlertDialog open={confirmar !== null} onOpenChange={(o) => { if (!o) setConfirmar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === 'concluir' ? 'Concluir conciliação?' : 'Reabrir competência?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar === 'concluir'
                ? `A competência ${formatCompetencia(selectedCompetencia ?? '')} será arquivada e ficará somente leitura para auditoria. Você poderá reabri-la depois, se necessário.`
                : `A competência ${formatCompetencia(selectedCompetencia ?? '')} voltará a ficar editável.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmar === 'concluir' ? handleConcluir : handleReabrir}
              className={confirmar === 'concluir' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {confirmar === 'concluir' ? 'Concluir e arquivar' : 'Reabrir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
