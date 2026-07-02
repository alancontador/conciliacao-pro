import { useState, useMemo, useCallback, useRef } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Clock,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  Paperclip,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import type { Conta, RazaoRow, Documento } from '@/types/accounting';
import * as XLSX from 'xlsx';
import { generateCandidates } from '@/lib/reconciliation/engine';
import type { ReconciliationCandidate } from '@/lib/reconciliation/types';

export function Status() {
  const { contas, balanceteData, razaoData, setRazaoData, updateRazaoTransaction, deleteRazaoTransaction, reconcileAccount, updateConta, setContas, reconciledRazaoIndices, reconcileRazaoTransactions, unreconcileRazaoTransactions, logConciliacaoAuditoria, resetEmpresaData, currentUser, empresas, selectedEmpresaId } = useAccountingStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [naturezaFilter, setNaturezaFilter] = useState<string>('all');
  const [selectedConta, setSelectedConta] = useState<Conta | null>(null);
  const [selectedGlobalIndices, setSelectedGlobalIndices] = useState<Set<number>>(new Set());
  const [showReconciled, setShowReconciled] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualEntry, setManualEntry] = useState({ data: '', lote: '', historico: '', debito: '', credito: '' });
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState({ data: '', lote: '', historico: '', debito: '', credito: '' });
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTargetRef = useRef<string | null>(null);

  // Todos os lançamentos da conta com índice global no razaoData
  const allMovsWithIdx = useMemo(() => {
    if (!selectedConta) return [];
    return razaoData
      .map((r, globalIdx) => ({ ...r, globalIdx }))
      .filter(r => r.conta.trim() === selectedConta.numero.trim());
  }, [selectedConta, razaoData]);

  const reconciledSet = useMemo(() => new Set(reconciledRazaoIndices), [reconciledRazaoIndices]);

  // Saldo corrido considerando apenas lançamentos ainda não conciliados (mesma regra da
  // Composição): lançamentos conciliados não alteram o saldo, apenas herdam o valor corrente.
  const recalculatedSaldoByIdx = useMemo(() => {
    const map = new Map<number, number>();
    if (!selectedConta) return map;
    let saldoPendente = 0;
    for (const mov of allMovsWithIdx) {
      if (!reconciledSet.has(mov.globalIdx)) {
        saldoPendente += selectedConta.natureza === 'ATIVO'
          ? mov.debito - mov.credito
          : mov.credito - mov.debito;
      }
      map.set(mov.globalIdx, saldoPendente);
    }
    return map;
  }, [allMovsWithIdx, reconciledSet, selectedConta]);

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

  const handleUnreconcileSelected = () => {
    unreconcileRazaoTransactions(Array.from(selectedGlobalIndices));
    setSelectedGlobalIndices(new Set());
  };

  const handleSuggestReconciliation = useCallback(() => {
    const pendingRows = allMovsWithIdx.filter((m) => !reconciledSet.has(m.globalIdx));
    const results = generateCandidates(pendingRows).filter((c) => c.confidence !== 'BAIXA');
    setCandidates(results);
    setApprovedIds(new Set(results.filter((c) => c.confidence === 'ALTA').map((c) => c.id)));
    setShowSuggestions(true);
  }, [allMovsWithIdx, reconciledSet]);

  const allSuggestionsSelected = candidates.length > 0 && candidates.every((c) => approvedIds.has(c.id));

  const handleToggleSelectAllSuggestions = () => {
    setApprovedIds(allSuggestionsSelected ? new Set() : new Set(candidates.map((c) => c.id)));
  };

  const handleApplySuggestions = useCallback(async () => {
    const approved = candidates.filter((c) => approvedIds.has(c.id));
    for (const candidate of approved) {
      const rows = [...candidate.groupA, ...candidate.groupB];
      const indices = rows.map((r) => r.globalIdx);
      reconcileRazaoTransactions(indices);
      await logConciliacaoAuditoria({
        contaNumero: selectedConta?.numero ?? '',
        lancamentos: rows.map((r) => ({
          data: (r.data instanceof Date ? r.data : new Date(r.data)).toISOString(),
          lote: r.lote,
          historico: r.historico,
          valor: r.debito || r.credito,
        })),
        score: candidate.score,
        criterios: candidate.reasons,
      });
    }
    toast({ title: 'Conciliação aplicada', description: `${approved.length} grupo(s) conciliado(s).` });
    setShowSuggestions(false);
    setCandidates([]);
    setApprovedIds(new Set());
  }, [candidates, approvedIds, reconcileRazaoTransactions, logConciliacaoAuditoria, selectedConta, toast]);

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setSelectedConta(null);
      setSelectedGlobalIndices(new Set());
      setShowReconciled(false);
      setShowManualForm(false);
      setManualEntry({ data: '', lote: '', historico: '', debito: '', credito: '' });
      setEditingIdx(null);
      setShowSuggestions(false);
      setCandidates([]);
      setApprovedIds(new Set());
    }
  };

  // Totais de débito e crédito dos lançamentos visíveis
  const totaisVisiveis = useMemo(() => ({
    debito: visibleMovs.reduce((acc, m) => acc + m.debito, 0),
    credito: visibleMovs.reduce((acc, m) => acc + m.credito, 0),
  }), [visibleMovs]);

  const handleAddManualEntry = useCallback(() => {
    if (!selectedConta) return;
    const debito = parseFloat(manualEntry.debito.replace(',', '.')) || 0;
    const credito = parseFloat(manualEntry.credito.replace(',', '.')) || 0;
    if (debito === 0 && credito === 0) return;

    const lastSaldo = allMovsWithIdx.length > 0
      ? allMovsWithIdx[allMovsWithIdx.length - 1].saldoExercicio
      : 0;
    const saldoExercicio = lastSaldo + debito - credito;

    const newRow: RazaoRow = {
      conta: selectedConta.numero,
      data: manualEntry.data ? new Date(manualEntry.data + 'T00:00:00') : new Date(),
      lote: manualEntry.lote || 'MANUAL',
      historico: manualEntry.historico,
      debito,
      credito,
      saldoExercicio,
      isManual: true,
    };

    setRazaoData([...razaoData, newRow]);
    setManualEntry({ data: '', lote: '', historico: '', debito: '', credito: '' });
    setShowManualForm(false);
    toast({ title: 'Lançamento adicionado', description: `Lançamento manual incluído na conta ${selectedConta.numero}.` });
  }, [selectedConta, manualEntry, allMovsWithIdx, razaoData, setRazaoData, toast]);

  const handleStartEdit = useCallback((globalIdx: number) => {
    const mov = razaoData[globalIdx];
    if (!mov) return;
    const d = mov.data instanceof Date ? mov.data : new Date(mov.data);
    setEditingIdx(globalIdx);
    setEditEntry({
      data: d.toISOString().split('T')[0],
      lote: mov.lote,
      historico: mov.historico,
      debito: mov.debito > 0 ? mov.debito.toFixed(2).replace('.', ',') : '',
      credito: mov.credito > 0 ? mov.credito.toFixed(2).replace('.', ',') : '',
    });
  }, [razaoData]);

  const handleSaveEdit = useCallback(() => {
    if (editingIdx === null) return;
    const debito = parseFloat(editEntry.debito.replace(',', '.')) || 0;
    const credito = parseFloat(editEntry.credito.replace(',', '.')) || 0;
    updateRazaoTransaction(editingIdx, {
      data: editEntry.data ? new Date(editEntry.data + 'T00:00:00') : razaoData[editingIdx].data,
      lote: editEntry.lote || razaoData[editingIdx].lote,
      historico: editEntry.historico,
      debito,
      credito,
    });
    setEditingIdx(null);
    toast({ title: 'Lançamento atualizado' });
  }, [editingIdx, editEntry, razaoData, updateRazaoTransaction, toast]);

  const handleDeleteManual = useCallback((globalIdx: number) => {
    deleteRazaoTransaction(globalIdx);
    // Se estava selecionado, remove da seleção
    setSelectedGlobalIndices(prev => {
      const next = new Set(prev);
      next.delete(globalIdx);
      return next;
    });
    toast({ title: 'Lançamento excluído' });
  }, [deleteRazaoTransaction, toast]);

  // Sempre recalcula composição e movimentações a partir dos dados atuais do razão.
  // Composição = saldo corrido considerando apenas lançamentos ainda NÃO conciliados
  // (lançamentos conciliados não alteram o saldo corrido, como se tivessem "saído" da conta).
  // Status e documentos são preservados da store (caso o usuário já tenha reconciliado).
  const processedContas = useMemo(() => {
    if (balanceteData.length === 0) return contas;

    return balanceteData.map(balancete => {
      const stored = contas.find(c => c.numero === balancete.codigo);

      let saldoPendente = 0;
      const movimentacoes = razaoData
        .map((razao, globalIdx) => ({ razao, globalIdx }))
        .filter(({ razao }) => razao.conta.trim() === balancete.codigo.trim())
        .map(({ razao, globalIdx }, index) => {
          if (!reconciledSet.has(globalIdx)) {
            saldoPendente += balancete.natureza === 'ATIVO'
              ? razao.debito - razao.credito
              : razao.credito - razao.debito;
          }
          return {
            id: `${balancete.codigo}-${index}`,
            data: razao.data,
            lote: razao.lote,
            historico: razao.historico,
            debito: razao.debito,
            credito: razao.credito,
            saldoExercicio: saldoPendente,
            globalIdx,
          };
        });

      const composicao = saldoPendente;

      const diferenca = Math.abs(balancete.saldoAtual) - Math.abs(composicao);
      const computedStatus: Conta['status'] = Math.abs(diferenca) < 0.01
        ? (stored?.status ?? 'CONCILIADO')
        : stored?.status === 'EM_ANALISE'
          ? 'EM_ANALISE'
          : 'NAO_CONCILIADO';

      return {
        numero: balancete.codigo,
        descricao: balancete.descricao,
        natureza: balancete.natureza,
        contabilidade: balancete.saldoAtual,
        composicao,
        diferenca,
        status: computedStatus,
        documentos: stored?.documentos ?? [],
        movimentacoes,
        createdAt: stored?.createdAt ?? new Date(),
        updatedAt: stored?.updatedAt ?? new Date(),
      } as Conta;
    });
  }, [contas, balanceteData, razaoData, reconciledSet]);

  // Valores ao vivo da conta aberta no pop-up: selectedConta é uma "foto" capturada ao
  // clicar no olho e não se atualiza sozinha; buscamos os valores atuais em processedContas
  // para que Composição/Diferença reflitam conciliações feitas com o pop-up já aberto.
  const liveConta = useMemo(
    () => (selectedConta ? processedContas.find(c => c.numero === selectedConta.numero) ?? selectedConta : null),
    [selectedConta, processedContas],
  );

  const handleAttachClick = useCallback((numero: string) => {
    attachTargetRef.current = numero;
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const numero = attachTargetRef.current;
    if (!file || !numero) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Limite de 10 MB por arquivo.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const doc: Documento = {
        id: crypto.randomUUID(),
        nome: file.name,
        tipo: file.type || 'application/octet-stream',
        tamanho: file.size,
        url: reader.result as string,
        uploadedAt: new Date(),
        uploadedBy: 'Usuário',
      };
      if (contas.length === 0) setContas(processedContas);
      const existing = processedContas.find(c => c.numero === numero);
      updateConta(numero, { documentos: [...(existing?.documentos ?? []), doc] });
      toast({ title: 'Documento anexado', description: file.name });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [contas, processedContas, updateConta, setContas, toast]);

  const handleRemoveDoc = useCallback((numero: string, docId: string) => {
    const existing = processedContas.find(c => c.numero === numero);
    if (!existing) return;
    if (contas.length === 0) setContas(processedContas);
    updateConta(numero, { documentos: existing.documentos.filter(d => d.id !== docId) });
    toast({ title: 'Documento removido' });
  }, [contas, processedContas, updateConta, setContas, toast]);


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
      toast({ title: 'Nenhum dado para exportar', description: 'Importe os dados primeiro.', variant: 'destructive' });
      return;
    }

    const statusLabel: Record<string, string> = {
      CONCILIADO: 'Conciliado',
      NAO_CONCILIADO: 'Não Conciliado',
      EM_ANALISE: 'Em Análise',
    };

    const empresa = empresas.find((e) => e.id === selectedEmpresaId);
    const numFmt = '#,##0.00';

    // Constrói o worksheet célula a célula para garantir tipos corretos
    const ws: XLSX.WorkSheet = {};

    const addCell = (r: number, c: number, value: string | number) => {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (typeof value === 'number' && !isNaN(value)) {
        ws[ref] = { t: 'n', v: value, z: numFmt };
      } else {
        ws[ref] = { t: 's', v: String(value ?? '') };
      }
    };

    // Linhas de cabeçalho informativo (texto)
    addCell(0, 0, 'ConciliaçãoPRO — Status das Contas');
    if (empresa) {
      addCell(1, 0, `Empresa: ${empresa.razaoSocial}`);
      if (empresa.cnpj) addCell(1, 1, `CNPJ: ${empresa.cnpj}`);
      if (empresa.periodo) addCell(1, 2, `Período: ${empresa.periodo}`);
    }
    addCell(2, 0, `Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    // linha 3 em branco

    // Linha de títulos das colunas (linha 4, índice 4)
    const colTitles = ['Conta', 'Descrição', 'Natureza', 'Contabilidade (R$)', 'Composição (R$)', 'Diferença (R$)', 'Status', 'Doc. Suporte'];
    colTitles.forEach((t, c) => addCell(4, c, t));

    // Linhas de dados — numéricos como 'n', textos como 's'
    filteredContas.forEach((conta, i) => {
      const r = 5 + i;
      addCell(r, 0, conta.numero);
      addCell(r, 1, conta.descricao ?? '');
      addCell(r, 2, conta.natureza ?? '');
      addCell(r, 3, Number(conta.contabilidade) || 0);
      addCell(r, 4, Number(conta.composicao) || 0);
      addCell(r, 5, Number(conta.diferenca) || 0);
      addCell(r, 6, statusLabel[conta.status] ?? conta.status);
      addCell(r, 7, conta.documentos.length > 0 ? `Sim (${conta.documentos.length})` : 'Não');
    });

    // Define o intervalo total da planilha
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 5 + filteredContas.length - 1, c: 7 } });

    ws['!cols'] = [
      { wch: 10 }, { wch: 40 }, { wch: 10 },
      { wch: 18 }, { wch: 16 }, { wch: 14 },
      { wch: 16 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Status das Contas');
    const nomeArquivo = `status-${empresa?.razaoSocial?.replace(/\s+/g, '-') ?? 'empresa'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);

    toast({ title: 'Exportação concluída', description: `${filteredContas.length} contas exportadas.` });
  };

  const [showResetDialog, setShowResetDialog] = useState(false);
  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'gerente';

  const handleReset = () => {
    resetEmpresaData();
    setShowResetDialog(false);
    toast({ title: 'Dados resetados', description: 'Todos os dados da empresa foram limpos.' });
  };

  const handleReconcile = (numero: string, status: Conta['status']) => {
    if (contas.length === 0) {
      setContas(processedContas);
    }
    reconcileAccount(numero, status);
    toast({
      title: 'Status atualizado',
      description: `Conta ${numero} marcada como ${{ CONCILIADO: 'Conciliado', NAO_CONCILIADO: 'Não Conciliado', EM_ANALISE: 'Em Análise' }[status]}.`,
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

            {canManage && (
              <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Resetar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Resetar todos os dados?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá apagar <strong>todos os dados</strong> da empresa selecionada: balancete, razão, status de conciliação e histórico de importações. Os dados não poderão ser recuperados. Será necessário importar os arquivos novamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">
                      Resetar tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de lançamentos da conta */}
      <Dialog open={!!selectedConta} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] flex flex-col p-0">
          {selectedConta && liveConta && (
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
                      <p className="font-semibold">{liveConta.natureza}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Contabilidade</p>
                      <p className="font-mono font-semibold">R$ {liveConta.contabilidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Composição (Razão)</p>
                      <p className="font-mono font-semibold">R$ {liveConta.composicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className={`rounded-lg p-3 ${Math.abs(liveConta.diferenca) < 0.01 ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'}`}>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Diferença</p>
                      <p className={`font-mono font-semibold ${Math.abs(liveConta.diferenca) < 0.01 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        R$ {liveConta.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </DialogDescription>
              </DialogHeader>

              {/* Formulário de lançamento manual */}
              {showManualForm && (
                <div className="px-8 py-4 border-b bg-muted/40 shrink-0">
                  <p className="text-sm font-medium mb-3">Novo lançamento manual</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={manualEntry.data} onChange={e => setManualEntry(p => ({ ...p, data: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Lote</Label>
                      <Input placeholder="Ex: 1234" value={manualEntry.lote} onChange={e => setManualEntry(p => ({ ...p, lote: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                      <Label className="text-xs">Histórico</Label>
                      <Input placeholder="Descrição do lançamento" value={manualEntry.historico} onChange={e => setManualEntry(p => ({ ...p, historico: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Débito (R$)</Label>
                      <Input placeholder="0,00" value={manualEntry.debito} onChange={e => setManualEntry(p => ({ ...p, debito: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Crédito (R$)</Label>
                      <Input placeholder="0,00" value={manualEntry.credito} onChange={e => setManualEntry(p => ({ ...p, credito: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={handleAddManualEntry}>Salvar lançamento</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowManualForm(false); setManualEntry({ data: '', lote: '', historico: '', debito: '', credito: '' }); }}>Cancelar</Button>
                  </div>
                </div>
              )}

              {/* Barra de abas + ações */}
              <div className="px-8 py-3 border-b shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Abas Pendentes / Conciliados */}
                <div className="flex gap-2 flex-wrap">
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setShowManualForm(p => !p); setShowReconciled(false); }}
                    className="border-blue-400 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950 dark:hover:text-blue-200"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Novo Lançamento
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSuggestReconciliation}
                    className="border-purple-400 text-purple-600 hover:bg-purple-50 hover:text-purple-700 dark:hover:bg-purple-950 dark:hover:text-purple-200"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Sugerir conciliação
                  </Button>
                </div>

                {/* Informação da seleção + ações */}
                <div className="flex items-center gap-4 sm:ml-auto flex-wrap">
                  {selectedGlobalIndices.size > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {selectedGlobalIndices.size} selecionado(s) &nbsp;|&nbsp;
                      Déb: <span className="font-mono">R$ {selectionInfo.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      &nbsp;/&nbsp;
                      Cré: <span className="font-mono">R$ {selectionInfo.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </span>
                  )}
                  {!showReconciled ? (
                    <Button
                      size="sm"
                      disabled={!selectionInfo.balanced}
                      onClick={handleReconcileSelected}
                      className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-40"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Conciliado
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedGlobalIndices.size === 0}
                      onClick={handleUnreconcileSelected}
                      className="border-orange-400 text-orange-600 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950 dark:hover:text-orange-200 disabled:opacity-40"
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      Mover para Pendentes
                    </Button>
                  )}
                </div>
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
                          <TableHead className="w-10">
                            <Checkbox
                              checked={visibleMovs.length > 0 && visibleMovs.every(m => selectedGlobalIndices.has(m.globalIdx))}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead className="w-28">Data</TableHead>
                          <TableHead className="w-28">Lote</TableHead>
                          <TableHead>Histórico</TableHead>
                          <TableHead className="text-right w-36">Débito</TableHead>
                          <TableHead className="text-right w-36">Crédito</TableHead>
                          <TableHead className="text-right w-36">Saldo</TableHead>
                          <TableHead className="w-16" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleMovs.map((mov) => {
                          const isEditing = editingIdx === mov.globalIdx;
                          const rowBg = selectedGlobalIndices.has(mov.globalIdx)
                            ? 'bg-blue-50 dark:bg-blue-950'
                            : mov.isManual
                            ? 'bg-amber-50 dark:bg-amber-950/40'
                            : '';
                          return isEditing ? (
                            <TableRow key={mov.globalIdx} className="bg-amber-50 dark:bg-amber-950/40">
                              <TableCell />
                              <TableCell>
                                <Input type="date" className="h-7 text-xs" value={editEntry.data} onChange={e => setEditEntry(p => ({ ...p, data: e.target.value }))} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-7 text-xs" value={editEntry.lote} onChange={e => setEditEntry(p => ({ ...p, lote: e.target.value }))} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-7 text-xs" value={editEntry.historico} onChange={e => setEditEntry(p => ({ ...p, historico: e.target.value }))} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-7 text-xs text-right" placeholder="0,00" value={editEntry.debito} onChange={e => setEditEntry(p => ({ ...p, debito: e.target.value }))} />
                              </TableCell>
                              <TableCell>
                                <Input className="h-7 text-xs text-right" placeholder="0,00" value={editEntry.credito} onChange={e => setEditEntry(p => ({ ...p, credito: e.target.value }))} />
                              </TableCell>
                              <TableCell />
                              <TableCell className="whitespace-nowrap">
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveEdit}>Salvar</Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingIdx(null)}>✕</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            <TableRow key={mov.globalIdx} className={rowBg}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedGlobalIndices.has(mov.globalIdx)}
                                  onCheckedChange={() => handleToggleSelect(mov.globalIdx)}
                                />
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {mov.data
                                  ? (mov.data instanceof Date ? mov.data : new Date(mov.data)).toLocaleDateString('pt-BR')
                                  : '—'}
                              </TableCell>
                              <TableCell className="font-mono">{mov.lote}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {mov.isManual && (
                                    <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-[10px] font-semibold px-1.5 py-0.5 leading-none shrink-0">
                                      MANUAL
                                    </span>
                                  )}
                                  <span title={mov.historico}>{mov.historico}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {mov.debito > 0 ? `R$ ${mov.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {mov.credito > 0 ? `R$ ${mov.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                R$ {(recalculatedSaldoByIdx.get(mov.globalIdx) ?? mov.saldoExercicio).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                {mov.isManual && (
                                  <div className="flex gap-0.5">
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground" onClick={() => handleStartEdit(mov.globalIdx)} title="Editar">
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteManual(mov.globalIdx)} title="Excluir">
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell />
                          <TableCell colSpan={3} className="text-sm font-semibold">Total</TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            R$ {totaisVisiveis.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            R$ {totaisVisiveis.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell />
                          <TableCell />
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de sugestões de conciliação inteligente */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-[95vw] w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões de conciliação</DialogTitle>
            <DialogDescription>
              Revise os candidatos abaixo antes de aplicar. Nada é conciliado automaticamente sem sua aprovação.
            </DialogDescription>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum candidato de alta ou média confiança encontrado.</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleToggleSelectAllSuggestions}>
                  {allSuggestionsSelected ? 'Desmarcar todos' : 'Marcar todos'}
                </Button>
              </div>
              <div className="space-y-4">
                {candidates.map((c) => (
                  <div key={c.id} className="border rounded-lg p-4 flex gap-4">
                    <Checkbox
                      className="mt-1"
                      checked={approvedIds.has(c.id)}
                      onCheckedChange={(checked) => {
                        setApprovedIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(c.id); else next.delete(c.id);
                          return next;
                        });
                      }}
                    />
                    <div className="flex-1 space-y-2">
                      <Badge variant={c.confidence === 'ALTA' ? 'default' : 'secondary'}>
                        {c.confidence} · {c.score}
                      </Badge>
                      <div className="space-y-1">
                        {[...c.groupA, ...c.groupB].map((r) => (
                          <div key={r.globalIdx} className="grid grid-cols-[6.5rem_1fr_9rem] gap-4 text-sm font-mono items-baseline">
                            <span className="text-muted-foreground">
                              {(r.data instanceof Date ? r.data : new Date(r.data)).toLocaleDateString('pt-BR')}
                            </span>
                            <span className="truncate" title={r.historico}>{r.historico}</span>
                            <span className="text-right">
                              R$ {(r.debito || r.credito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        {c.reasons.valorDetalhe} · {c.reasons.textoDetalhe} · {c.reasons.dataDetalhe}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowSuggestions(false)}>Cancelar</Button>
            <Button disabled={approvedIds.size === 0} onClick={handleApplySuggestions}>
              Aplicar {approvedIds.size} selecionado(s)
            </Button>
          </div>
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
                      <div className="flex items-center gap-1">
                        {conta.documentos.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-success hover:text-success">
                                <FileText className="w-4 h-4" />
                                <span className="text-xs font-semibold">{conta.documentos.length}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64">
                              {conta.documentos.map(doc => (
                                <DropdownMenuItem key={doc.id} className="flex items-center justify-between gap-2 pr-1" onSelect={e => e.preventDefault()}>
                                  <span className="truncate text-xs flex-1" title={doc.nome}>{doc.nome}</span>
                                  <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Baixar"
                                      onClick={() => { const a = document.createElement('a'); a.href = doc.url; a.download = doc.nome; a.click(); }}>
                                      <Download className="w-3 h-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title="Remover"
                                      onClick={() => handleRemoveDoc(conta.numero, doc.id)}>
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={e => { e.preventDefault(); handleAttachClick(conta.numero); }}>
                                <Paperclip className="w-3 h-3 mr-2" />
                                <span className="text-xs">Anexar outro arquivo</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground" onClick={() => handleAttachClick(conta.numero)} title="Anexar documento">
                            <Paperclip className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
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
                            title="Marcar como Conciliado"
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
                            title="Marcar como Em Análise"
                          >
                            <Clock className="w-4 h-4" />
                          </Button>
                        )}

                        {conta.status !== 'NAO_CONCILIADO' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReconcile(conta.numero, 'NAO_CONCILIADO')}
                            className="text-destructive hover:text-destructive"
                            title="Marcar como Não Conciliado"
                          >
                            <XCircle className="w-4 h-4" />
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

      {/* Input escondido para seleção de arquivos */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
        onChange={handleFileSelected}
      />
    </div>
  );
}