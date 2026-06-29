import { useState } from 'react';
import { useAccountingStore } from '@/store/accounting';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { UserPlus, Pencil, Trash2, Search, ShieldCheck, ShieldX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Usuario, UsuarioRole } from '@/types/usuario';
import {
  ROLE_LABELS,
  PERMISSAO_LABELS,
  DEFAULT_PERMISSOES,
} from '@/types/usuario';

const ROLE_COLORS: Record<UsuarioRole, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  gerente: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  analista: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  visualizador: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function initials(nome: string) {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const EMPTY_FORM = {
  nome: '',
  email: '',
  role: 'analista' as UsuarioRole,
  status: 'ativo' as Usuario['status'],
  permissoes: { ...DEFAULT_PERMISSOES.analista },
};

export function Usuarios() {
  const { usuarios, addUsuario, updateUsuario, deleteUsuario } = useAccountingStore();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, permissoes: { ...EMPTY_FORM.permissoes } });

  const filtered = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      ROLE_LABELS[u.role].toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, permissoes: { ...DEFAULT_PERMISSOES.analista } });
    setDialogOpen(true);
  };

  const openEdit = (u: Usuario) => {
    setEditId(u.id);
    setForm({
      nome: u.nome,
      email: u.email,
      role: u.role,
      status: u.status,
      permissoes: { ...u.permissoes },
    });
    setDialogOpen(true);
  };

  const handleRoleChange = (role: UsuarioRole) => {
    setForm((prev) => ({ ...prev, role, permissoes: { ...DEFAULT_PERMISSOES[role] } }));
  };

  const handlePermissaoToggle = (key: keyof typeof form.permissoes) => {
    setForm((prev) => ({
      ...prev,
      permissoes: { ...prev.permissoes, [key]: !prev.permissoes[key] },
    }));
  };

  const handleSave = () => {
    if (!form.nome.trim() || !form.email.trim()) {
      toast({ title: 'Preencha nome e e-mail', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }
    const emailConflict = usuarios.find(
      (u) => u.email === form.email && u.id !== editId,
    );
    if (emailConflict) {
      toast({ title: 'E-mail já cadastrado', variant: 'destructive' });
      return;
    }

    if (editId) {
      updateUsuario(editId, {
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
        permissoes: form.permissoes,
      });
      toast({ title: 'Usuário atualizado' });
    } else {
      addUsuario({
        nome: form.nome.trim(),
        email: form.email.trim(),
        role: form.role,
        status: form.status,
        permissoes: form.permissoes,
      });
      toast({ title: 'Usuário criado com sucesso' });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteUsuario(deleteId);
    toast({ title: 'Usuário excluído' });
    setDeleteId(null);
  };

  const handleToggleStatus = (u: Usuario) => {
    const next = u.status === 'ativo' ? 'inativo' : 'ativo';
    updateUsuario(u.id, { status: next });
    toast({ title: `Usuário ${next === 'ativo' ? 'ativado' : 'desativado'}` });
  };

  const ativos = usuarios.filter((u) => u.status === 'ativo').length;

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Usuários</h1>
          <p className="text-muted-foreground text-sm">
            {usuarios.length} usuário(s) cadastrado(s) — {ativos} ativo(s)
          </p>
        </div>
        <Button onClick={openCreate}>
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['admin', 'gerente', 'analista', 'visualizador'] as UsuarioRole[]).map((role) => {
          const count = usuarios.filter((u) => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="p-4 flex items-center gap-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[role]}`}>
                  {ROLE_LABELS[role]}
                </span>
                <span className="text-2xl font-bold ml-auto">{count}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou perfil..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              {usuarios.length === 0
                ? 'Nenhum usuário cadastrado. Clique em "Novo Usuário" para começar.'
                : 'Nenhum usuário encontrado para a busca.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id} className={u.status === 'inativo' ? 'opacity-50' : ''}>
                    {/* Avatar + nome/email */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
                          {initials(u.nome)}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{u.nome}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Perfil */}
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </TableCell>

                    {/* Permissões (ícones) */}
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(Object.entries(u.permissoes) as [keyof typeof u.permissoes, boolean][]).map(
                          ([key, val]) =>
                            val ? (
                              <span
                                key={key}
                                title={PERMISSAO_LABELS[key]}
                                className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0.5 leading-none"
                              >
                                {PERMISSAO_LABELS[key].split(' ')[0]}
                              </span>
                            ) : null,
                        )}
                      </div>
                    </TableCell>

                    {/* Status toggle */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.status === 'ativo'}
                          onCheckedChange={() => handleToggleStatus(u)}
                        />
                        <span className="text-xs text-muted-foreground">
                          {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Data */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {(u.createdAt instanceof Date ? u.createdAt : new Date(u.createdAt))
                        .toLocaleDateString('pt-BR')}
                    </TableCell>

                    {/* Ações */}
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(u)}
                          title="Editar usuário"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(u.id)}
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar / editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Atualize os dados e permissões do usuário.' : 'Preencha os dados para criar o usuário.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Dados básicos */}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <Label>Nome completo</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={(v) => handleRoleChange(v as UsuarioRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [UsuarioRole, string][]).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((p) => ({ ...p, status: v as Usuario['status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Permissões */}
            <div>
              <p className="text-sm font-medium mb-3">Permissões de acesso</p>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(PERMISSAO_LABELS) as (keyof typeof form.permissoes)[]).map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <Checkbox
                      id={key}
                      checked={form.permissoes[key]}
                      onCheckedChange={() => handlePermissaoToggle(key)}
                    />
                    <label htmlFor={key} className="text-sm cursor-pointer select-none">
                      {PERMISSAO_LABELS[key]}
                    </label>
                    {form.permissoes[key] ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />
                    ) : (
                      <ShieldX className="w-3.5 h-3.5 text-muted-foreground ml-auto shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editId ? 'Salvar alterações' : 'Criar usuário'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog confirmar exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O usuário será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
