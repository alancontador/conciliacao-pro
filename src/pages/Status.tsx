import { useState, useMemo } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Conta } from '@/types/accounting';
import * as XLSX from 'xlsx';

export function Status() {
  const { contas, balanceteData, razaoData, reconcileAccount, setContas, reconciledRazaoIndices, reconcileRazaoTransactions } = useAccountingStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [naturezaFilter, setNaturezaFilter] = useState<string>('all');
  const [selectedConta, setSelectedConta] = useState<Conta | null>(null);
  const [selectedGlobalIndices, setSelectedGlobalIndices] = useState<Set<number>>(new Set());
  const [showReconciled, setShowReconciled] = useState(false);
  const { toast } = useToast();

  // Todos os lançamentos da conta com índice global no razaoData
  const allMovsWithIdx = useMemo(() => {
    if (!selectedConta) return [];
    return razaoData
      .map((r, globalIdx) => ({ ...r, globalIdx }))
      .filter(r => r.conta.trim() === selectedConta.numero.trim());
  }, [selectedConta, razaoData]);

  const reconciledSet = useMemo(() => new Set(reconciledRazaoIndices), [reconciledRazaoIndices]);

  // Filtra pendentes ou conciliados conforme a aba ativa
  const visibleMovs = useMemo(() =>
    showReconciled
      ? allMovsWithIdx.filter(m => reconciledSet.has(m.globalIdx))
      : allMovsWithIdx.filter(m => !reconciledSet.has(m.globalIdx)),
    [allMovsWithIdx, reconciledSet, showReconciled],
  );

  const pendingCount = useMemo(() =>
    allMovsWithIdx.filter(m => !reconciledSet.has(m.globalIdx)).length,
    [allMovsWithIdx, reconciledSet],
  );
  const reconciledCount = useMemo(() =>
    allMovsWithIdx.filter(m => reconciledSet.has(m.globalIdx)).length,
    [allMovsWithIdx, reconciledSet],
  );

  // Totais da seleção e verificação de equilíbrio
  const selectionInfo = useMemo(() => {
    let debito = 0, credito = 0;
    for (const idx of selectedGlobalIndices) {
      const mov = razaoData[idx];
      if (mov) { debito += mov.debito; credito += mov.credito; }
    }
    return { debito, credito, balanced: selectedGlobalIndices.size > 0 && Math.abs(debito - credito) < 0.01 };
  }, [selectedGlobalIndices, razaoData]);

  const handleToggleSelect = (globalIdx: number) => {
    setSelectedGlobalIndices(prev => {
      const next = new Set(prev);
      if (next.has(globalIdx)) next.delete(globalIdx); else next.add(globalIdx);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allVisible = visibleMovs.map(m => m.globalIdx);
    const allSelected = allVisible.every(idx => selectedGlobalIndices.has(idx));
    setSelectedGlobalIndices(allSelected ? new Set() : new Set(allVisible));
  };

  const handleReconcileSelected = () => {
    reconcileRazaoTransactions(Array.from(selectedGlobalIndices));
    setSelectedGlobalIndices(new Set());
    setShowReconciled(false);
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedConta(null);
      setSelectedGlobalIndices(new Set());
      setShowReconciled(false);
    }
  };

  // Sempre recalcula composição e movimentações a partir dos dados atuais do razão.
  // Status e documentos são preservados da store (caso o usuário já tenha reconciliado).
  const processedContas = useMemo(() => {
    if (balanceteData.length === 0) return contas;

    return balanceteData.map(balancete => {
      const stored = contas.find(c => c.numero === balancete.codigo);

      const movimentacoes = razaoData
        .filter(razao => razao.conta.trim() === balancete.codigo.trim())
        .map((razao, index) => ({
          id: `${balancete.codigo}-${index}`,
          data: razao.data,
          lote: razao.lote,
          historico: razao.historico,
          debito: razao.debito,
          credito: razao.credito,
          saldoExercicio: razao.saldoExercicio,
        }));

      // ATIVO: saldo devedor (D-C); PASSIVO: saldo credor (C-D)
      const composicao = movimentacoes.reduce((acc, mov) =>
        balancete.natureza === 'ATIVO'
          ? acc + mov.debito - mov.credito
          : acc + mov.credito - mov.debito,
        0,
      );

      const diferenca = balancete.saldoAtual - composicao;
      const autoStatus: Conta['status'] = Math.abs(diferenca) < 0.01 ? 'CONCILIADO' : 'NAO_CONCILIADO';

      return {
        numero: balancete.codigo,
        descricao: balancete.descricao,
        natureza: balancete.natureza,
        contabilidade: balancete.saldoAtual,
        composicao,
        diferenca,
        status: stored?.status ?? autoStatus,
        documentos: stored?.documentos ?? [],
        movimentacoes,
        createdAt: stored?.createdAt ?? new Date(),
        updatedAt: stored?.updatedAt ?? new Date(),
      } as Conta;
    });
  }, [contas, balanceteData, razaoData]);

  // Filter accounts
  const filteredContas = useMemo(() => {
    return processedContas.filter(conta => {
      const matchesSearch = 
        conta.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conta.descricao.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || conta.status === statusFilter;
      const matchesNatureza = naturezaFilter === 'all' || conta.natureza === naturezaFilter;

      return matchesSearch && matchesStatus && matchesNatureza;
    });
  }, [processedContas, searchTerm, statusFilter, naturezaFilter]);

  const getStatusBadge = (status: Conta['status']) => {
    switch (status) {
      case 'CONCILIADO':
        return <Badge variant="default" className="bg-success text-success-foreground">Conciliado</Badge>;
      case 'EM_ANALISE':
        return <Badge variant="default" className="bg-warning text-warning-foreground">Em Análise</Badge>;
      default:
        return <Badge variant="destructive">Não Conciliado</Badge>;
    }
  };

  const handleExportExcel = () => {
    if (filteredContas.length === 0) {
      toast({
        title: 'Nenhum dado para exportar',
        description: 'Importe os dados primeiro.',
        variant: 'destructive',
      });
      return;
    }

    const exportData = filteredContas.map(conta => ({
      'Conta': conta.numero,
      'Descrição': conta.descricao,
      'Natureza': conta.natureza,
      'Contabilidade': conta.contabilidade,
      'Composição': conta.composicao,
      'Diferença': conta.diferenca,
      'Status': conta.status.replace('_', ' '),
      'Documentos': conta.documentos.length > 0 ? 'Sim' : 'Não',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Status das Contas');
    XLSX.writeFile(wb, `status-contas-${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Exportação concluída',
      description: 'Arquivo Excel foi baixado com sucesso.',
    });
  };

  const handleReconcile = (numero: string, status: Conta['status']) => {
    if (contas.length === 0) {
      setContas(processedContas);
    }
    reconcileAccount(numero, status);
    toast({
      title: 'Status atualizado',
      description: `Conta ${numero} marcada como ${status.replace('_', ' ')}.`,
    });
  };

  if (processedContas.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Status das Contas</h1>
          <p className="text-muted-foreground">Visualize e gerencie o status de conciliação das contas</p>
        </div>

        <Card className="text-center py-12">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Nenhuma conta encontrada</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              Para visualizar as contas, primeiro importe os dados do balancete e razão contábil.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Status das Contas</h1>
        <p className="text-muted-foreground">
          {filteredContas.length} de {processedContas.length} contas
        </p>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros e Ações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por número ou descrição da conta..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="CONCILIADO">Conciliado</SelectItem>
                <SelectItem value="NAO_CONCILIADO">Não Conciliado</SelectItem>
                <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={naturezaFilter} onValueChange={setNaturezaFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Natureza" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Naturezas</SelectItem>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="PASSIVO">Passivo</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleExportExcel} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de lançamentos da conta */}
      <Dialog open={!!selectedConta} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0">
          {selectedConta && (
            <>
              {/* Cabeçalho fixo */}
              <DialogHeader className="px-8 pt-8 pb-4 border-b shrink-0">
                <DialogTitle className="text-xl font-mono">
                  {selectedConta.numero} — {selectedConta.descricao}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Natureza</p>
                      <p className="font-semibold">{selectedConta.natureza}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contabilidade</p>
                      <p className="font-mono font-semibold">R$ {selectedConta.contabilidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Composição (Razão)</p>
                      <p className="font-mono font-semibold">R$ {selectedConta.composicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`rounded-lg p-3 ${Math.abs(selectedConta.diferenca) < 0.01 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Diferença</p>
                      <p className={`font-mono font-semibold ${Math.abs(selectedConta.diferenca) < 0.01 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        R$ {selectedConta.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/* Barra de abas + ações */}
              <div className="px-8 py-3 border-b shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Abas Pendentes / Conciliados */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={!showReconciled ? 'default' : 'outline'}
                    onClick={() => { setShowReconciled(false); setSelectedGlobalIndices(new Set()); }}
                  >
                    Pendentes ({pendingCount})
                  </Button>
                  <Button
                    size="sm"
                    variant={showReconciled ? 'default' : 'outline'}
                    onClick={() => { setShowReconciled(true); setSelectedGlobalIndices(new Set()); }}
                  >
                    Ver lançamentos conciliados ({reconciledCount})
                  </Button>
                </div>

                {/* Informação da seleção + botão Conciliado */}
                {!showReconciled && (
                  <div className="flex items-center gap-4 sm:ml-auto flex-wrap">
                    {selectedGlobalIndices.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedGlobalIndices.size} selecionado(s) &nbsp;|&nbsp;
                        Déb: <span className="font-mono">R$ {selectionInfo.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        &nbsp;/&nbsp;
                        Cré: <span className="font-mono">R$ {selectionInfo.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </span>
                    )}
                    <Button
                      size="sm"
                      disabled={!selectionInfo.balanced}
                      onClick={handleReconcileSelected}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Conciliado
                    </Button>
                  </div>
                )}
              </div>

              {/* Tabela com scroll independente */}
              <div className="flex-1 overflow-auto px-8 py-4">
                {visibleMovs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-16">
                    {showReconciled ? 'Nenhum lançamento conciliado para esta conta.' : 'Nenhum lançamento pendente para esta conta.'}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">{visibleMovs.length} lançamento(s)</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {!showReconciled && (
                            <TableHead className="w-10">
                              <Checkbox
                                checked={visibleMovs.length > 0 && visibleMovs.every(m => selectedGlobalIndices.has(m.globalIdx))}
                                onCheckedChange={handleSelectAll}
                              />
                            </TableHead>
                          )}
                          <TableHead className="w-28">Data</TableHead>
                          <TableHead className="w-28">Lote</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right w-36">Débito</TableHead>
                          <TableHead className="text-right w-36">Crédito</TableHead>
                          <TableHead className="text-right w-36">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleMovs.map((mov) => (
                          <TableRow
                            key={mov.globalIdx}
                            className={selectedGlobalIndices.has(mov.globalIdx) ? 'bg-blue-50 dark:bg-blue-950' : ''}
                          >
                            {!showReconciled && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedGlobalIndices.has(mov.globalIdx)}
                                  onCheckedChange={() => handleToggleSelect(mov.globalIdx)}
                                />
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap">
                              {mov.data
                                ? (mov.data instanceof Date ? mov.data : new Date(mov.data)).toLocaleDateString('pt-BR')
                                : '—'}
                            </TableCell>
                            <TableCell className="font-mono">{mov.lote}</TableCell>
                            <TableCell>
                              <span title={mov.historico}>{mov.historico}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {mov.debito > 0 ? `R$ ${mov.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {mov.credito > 0 ? `R$ ${mov.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              R$ {mov.saldoExercicio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Contabilidade</TableHead>
                  <TableHead className="text-right">Composição</TableHead>
                  <TableHead className="text-right">Diferença</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Doc. Suporte</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContas.map((conta) => (
                  <TableRow key={conta.numero}>
                    <TableCell className="font-mono font-medium">
                      {conta.numero}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={conta.descricao}>
                        {conta.descricao}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={conta.natureza === 'ATIVO' ? 'default' : 'secondary'}>
                        {conta.natureza}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      R$ {conta.contabilidade.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      R$ {conta.composicao.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-medium ${
                      Math.abs(conta.diferenca) < 0.01 
                        ? 'text-success' 
                        : 'text-destructive'
                    }`}>
                      R$ {conta.diferenca.toLocaleString('pt-BR', { 
                        minimumFractionDigits: 2 
                      })}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(conta.status)}
                    </TableCell>
                    <TableCell>
                      {conta.documentos.length > 0 ? (
                        <FileText className="w-4 h-4 text-success" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedConta(conta)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        {conta.status !== 'CONCILIADO' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleReconcile(conta.numero, 'CONCILIADO')}
                            className="text-success hover:text-success"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}

                        {conta.status !== 'EM_ANALISE' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleReconcile(conta.numero, 'EM_ANALISE')}
                            className="text-warning hover:text-warning"
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}