import { useState, useMemo } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
  const { contas, balanceteData, razaoData, reconcileAccount, setContas } = useAccountingStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [naturezaFilter, setNaturezaFilter] = useState<string>('all');
  const [selectedConta, setSelectedConta] = useState<Conta | null>(null);
  const { toast } = useToast();

  // Generate accounts from imported data if contas is empty
  const processedContas = useMemo(() => {
    if (contas.length > 0) return contas;

    if (balanceteData.length === 0) return [];

    // Create accounts from balancete and calculate compositions from razão
    return balanceteData.map(balancete => {
      const movimentacoes = razaoData.filter(razao =>
        razao.conta.trim() === balancete.codigo.trim()
      ).map((razao, index) => ({
        id: `${balancete.codigo}-${index}`,
        data: razao.data,
        lote: razao.lote,
        historico: razao.historico,
        debito: razao.debito,
        credito: razao.credito,
        saldoExercicio: razao.saldoExercicio,
      }));

      // ATIVO: saldo devedor (D-C); PASSIVO: saldo credor (C-D)
      const composicao = movimentacoes.reduce((acc, mov) => {
        return balancete.natureza === 'ATIVO'
          ? acc + mov.debito - mov.credito
          : acc + mov.credito - mov.debito;
      }, 0);

      const diferenca = balancete.saldoAtual - composicao;

      return {
        numero: balancete.codigo,
        descricao: balancete.descricao,
        natureza: balancete.natureza,
        contabilidade: balancete.saldoAtual,
        composicao,
        diferenca,
        status: Math.abs(diferenca) < 0.01 ? 'CONCILIADO' : 'NAO_CONCILIADO' as const,
        documentos: [],
        movimentacoes,
        createdAt: new Date(),
        updatedAt: new Date(),
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

      {/* Sheet de lançamentos da conta */}
      <Sheet open={!!selectedConta} onOpenChange={(open) => { if (!open) setSelectedConta(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          {selectedConta && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-mono">{selectedConta.numero} — {selectedConta.descricao}</SheetTitle>
                <SheetDescription asChild>
                  <div className="flex flex-wrap gap-4 text-sm mt-2">
                    <span>Natureza: <strong>{selectedConta.natureza}</strong></span>
                    <span>Contabilidade: <strong className="font-mono">R$ {selectedConta.contabilidade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                    <span>Composição: <strong className="font-mono">R$ {selectedConta.composicao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                    <span className={Math.abs(selectedConta.diferenca) < 0.01 ? 'text-success' : 'text-destructive'}>
                      Diferença: <strong className="font-mono">R$ {selectedConta.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                </SheetDescription>
              </SheetHeader>

              {selectedConta.movimentacoes.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum lançamento encontrado para esta conta.</p>
              ) : (
                <div className="overflow-x-auto">
                  <p className="text-sm text-muted-foreground mb-2">{selectedConta.movimentacoes.length} lançamento(s)</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Lote</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedConta.movimentacoes.map((mov) => (
                        <TableRow key={mov.id}>
                          <TableCell className="whitespace-nowrap">
                            {mov.data instanceof Date
                              ? mov.data.toLocaleDateString('pt-BR')
                              : new Date(mov.data).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-mono">{mov.lote}</TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate" title={mov.historico}>{mov.historico}</div>
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
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

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