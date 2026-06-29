import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Plus, Pencil, Trash2, Search, CheckCircle2, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Empresa } from '@/types/empresa';
import { cn } from '@/lib/utils';

function initials(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

const EMPTY_FORM = {
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  periodo: '',
  responsavel: '',
  email: '',
  telefone: '',
  ativa: true,
};

export function Empresas() {
  const { empresas, selectedEmpresaId, currentUser, addEmpresa, updateEmpresa, deleteEmpresa, selectEmpresa } =
    useAccountingStore();
  const { toast } = useToast();

  const canManage = currentUser?.permissoes.gerenciarEmpresas ?? false;

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const filtered = empresas.filter(
    (e) =>
      e.razaoSocial.toLowerCase().includes(search.toLowerCase()) ||
      (e.nomeFantasia ?? '').toLowerCase().includes(search.toLowerCase()) ||
      e.cnpj.includes(search),
  );

  const ativas = empresas.filter((e) => e.ativa).length;

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (e: Empresa) => {
    setEditId(e.id);
    setForm({
      razaoSocial: e.razaoSocial,
      nomeFantasia: e.nomeFantasia ?? '',
      cnpj: e.cnpj,
      periodo: e.periodo,
      responsavel: e.responsavel,
      email: e.email ?? '',
      telefone: e.telefone ?? '',
      ativa: e.ativa,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.razaoSocial.trim()) {
      toast({ title: 'Razão Social é obrigatória', variant: 'destructive' });
      return;
    }
    if (!form.cnpj.trim()) {
      toast({ title: 'CNPJ é obrigatório', variant: 'destructive' });
      return;
    }

    if (editId) {
      updateEmpresa(editId, {
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        cnpj: form.cnpj.trim(),
        periodo: form.periodo.trim(),
        responsavel: form.responsavel.trim(),
        email: form.email.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        ativa: form.ativa,
      });
      toast({ title: 'Empresa atualizada' });
    } else {
      const id = addEmpresa({
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim() || undefined,
        cnpj: form.cnpj.trim(),
        periodo: form.periodo.trim(),
        responsavel: form.responsavel.trim(),
        email: form.email.trim() || undefined,
        telefone: form.telefone.trim() || undefined,
        ativa: form.ativa,
      });
      toast({ title: 'Empresa criada e selecionada' });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteEmpresa(deleteId);
    toast({ title: 'Empresa excluída' });
    setDeleteId(null);
  };

  const handleSelect = (id: string) => {
    if (id === selectedEmpresaId) return;
    selectEmpresa(id);
    const emp = empresas.find((e) => e.id === id);
    toast({ title: `Empresa selecionada: ${emp?.razaoSocial}` });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Empresas</h1>
          <p className="text-muted-foreground text-sm">
            {empresas.length} empresa(s) cadastrada(s) — {ativas} ativa(s)
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        )}
      </div>

      {/* Empresa ativa */}
      {selectedEmpresaId && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5 text-sm">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span>
            Empresa ativa:{' '}
            <strong>{empresas.find((e) => e.id === selectedEmpresaId)?.razaoSocial}</strong>
          </span>
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por razão social, fantasia ou CNPJ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid de empresas */}
      {filtered.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          {empresas.length === 0 ? (
            <div className="space-y-3">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40" />
              <p>Nenhuma empresa cadastrada.</p>
              {canManage && (
                <Button onClick={openCreate} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar primeira empresa
                </Button>
              )}
            </div>
          ) : (
            'Nenhuma empresa encontrada para a busca.'
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((empresa) => {
            const isSelected = empresa.id === selectedEmpresaId;
            return (
              <Card
                key={empresa.id}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md border-2',
                  isSelected
                    ? 'border-primary shadow-md'
                    : 'border-transparent hover:border-muted-foreground/20',
                  !empresa.ativa && 'opacity-60',
                )}
                onClick={() => handleSelect(empresa.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {initials(empresa.razaoSocial)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{empresa.razaoSocial}</p>
                        {isSelected && (
                          <Badge className="text-[10px] px-1.5 py-0 shrink-0">Ativa</Badge>
                        )}
                        {!empresa.ativa && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            Inativa
                          </Badge>
                        )}
                      </div>
                      {empresa.nomeFantasia && (
                        <p className="text-xs text-muted-foreground truncate">{empresa.nomeFantasia}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">{empresa.cnpj}</p>
                      {empresa.responsavel && (
                        <p className="text-xs text-muted-foreground truncate">
                          Resp.: {empresa.responsavel}
                        </p>
                      )}
                      {empresa.periodo && (
                        <p className="text-xs text-muted-foreground">Período: {empresa.periodo}</p>
                      )}
                    </div>

                    {/* Ações */}
                    {canManage && (
                      <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEdit(empresa)}
                          title="Editar empresa"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(empresa.id)}
                          title="Excluir empresa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!isSelected && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-primary font-medium">
                      <ChevronRight className="w-3 h-3" />
                      Clique para selecionar
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Atualize os dados da empresa.' : 'Preencha os dados para cadastrar a empresa.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Razão Social <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: Empresa ABC Ltda"
                value={form.razaoSocial}
                onChange={(e) => setForm((p) => ({ ...p, razaoSocial: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Nome Fantasia</Label>
              <Input
                placeholder="Ex: ABC Serviços"
                value={form.nomeFantasia}
                onChange={(e) => setForm((p) => ({ ...p, nomeFantasia: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>CNPJ <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm((p) => ({ ...p, cnpj: formatCNPJ(e.target.value) }))}
                  maxLength={18}
                />
              </div>
              <div className="space-y-1">
                <Label>Período</Label>
                <Input
                  placeholder="Ex: Jan–Dez/2025"
                  value={form.periodo}
                  onChange={(e) => setForm((p) => ({ ...p, periodo: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Responsável / Contador</Label>
              <Input
                placeholder="Ex: João Silva"
                value={form.responsavel}
                onChange={(e) => setForm((p) => ({ ...p, responsavel: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="contato@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="ativa"
                checked={form.ativa}
                onChange={(e) => setForm((p) => ({ ...p, ativa: e.target.checked }))}
                className="w-4 h-4"
              />
              <label htmlFor="ativa" className="text-sm cursor-pointer select-none">
                Empresa ativa
              </label>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? 'Salvar alterações' : 'Cadastrar empresa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados importados (balancete, razão, status de contas) desta empresa serão
              removidos permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir empresa e dados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
