import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Mail, Eye, EyeOff, UserPlus, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Tab = 'login' | 'setup-admin' | 'definir-senha';

export function Login() {
  const { usuarios, login, createFirstAdmin, setUserPassword } = useAccountingStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const semSenha = usuarios.filter((u) => !u.senhaHash);
  const isFirstAccess = usuarios.length === 0;

  const [tab, setTab] = useState<Tab>(isFirstAccess ? 'setup-admin' : 'login');
  const [loading, setLoading] = useState(false);

  // --- Login ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // --- Setup admin ---
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPass2, setAdminPass2] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

  // --- Definir senha inicial ---
  const [defEmail, setDefEmail] = useState('');
  const [defPass, setDefPass] = useState('');
  const [defPass2, setDefPass2] = useState('');
  const [showDefPass, setShowDefPass] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result === 'ok') {
      navigate('/', { replace: true });
    } else if (result === 'inactive') {
      toast({ title: 'Usuário inativo', description: 'Entre em contato com o administrador.', variant: 'destructive' });
    } else {
      toast({ title: 'E-mail ou senha incorretos', variant: 'destructive' });
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNome || !adminEmail || !adminPass) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }
    if (adminPass.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (adminPass !== adminPass2) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    await createFirstAdmin(adminNome, adminEmail, adminPass);
    setLoading(false);
    toast({ title: 'Administrador criado! Bem-vindo ao sistema.' });
    navigate('/', { replace: true });
  };

  const handleDefinirSenha = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = semSenha.find((u) => u.email.toLowerCase() === defEmail.toLowerCase());
    if (!user) {
      toast({ title: 'E-mail não encontrado ou usuário já possui senha', variant: 'destructive' });
      return;
    }
    if (defPass.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (defPass !== defPass2) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    await setUserPassword(user.id, defPass);
    setLoading(false);
    toast({ title: `Senha definida para ${user.nome}. Faça login agora.` });
    setEmail(user.email);
    setTab('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">ConciliaçãoPRO</h1>
          <p className="text-sm text-muted-foreground">Sistema de Conciliação Contábil</p>
        </div>

        {/* ── SETUP ADMIN ── */}
        {tab === 'setup-admin' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Configurar primeiro acesso
              </CardTitle>
              <CardDescription>
                Crie a conta de administrador para começar a usar o sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome completo</Label>
                  <Input placeholder="Seu nome" value={adminNome} onChange={(e) => setAdminNome(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="admin@empresa.com" className="pl-9" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showAdminPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" className="pl-9 pr-9" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowAdminPass((p) => !p)}>
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showAdminPass ? 'text' : 'password'} placeholder="Repita a senha" className="pl-9" value={adminPass2} onChange={(e) => setAdminPass2(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar administrador e entrar'}
                </Button>
              </form>

              <div className="mt-4 pt-4 border-t text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setTab('login')}
                >
                  Já possuo conta — ir para o login
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <Card>
            <CardHeader>
              <CardTitle>Entrar no sistema</CardTitle>
              <CardDescription>Use seu e-mail e senha para acessar.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="pl-9 pr-9" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>

              {/* Links auxiliares */}
              <div className="mt-4 pt-4 border-t flex flex-col gap-1 text-center">
                {semSenha.length > 0 && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => setTab('definir-senha')}
                  >
                    Primeiro acesso? Defina sua senha aqui
                  </button>
                )}
                {isFirstAccess && (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:underline"
                    onClick={() => setTab('setup-admin')}
                  >
                    Criar conta de administrador
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── DEFINIR SENHA INICIAL ── */}
        {tab === 'definir-senha' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Definir senha de acesso
              </CardTitle>
              <CardDescription>
                Para usuários cadastrados que ainda não possuem senha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDefinirSenha} className="space-y-4">
                <div className="space-y-1">
                  <Label>Seu e-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" className="pl-9" value={defEmail} onChange={(e) => setDefEmail(e.target.value)} autoFocus />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showDefPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" className="pl-9 pr-9" value={defPass} onChange={(e) => setDefPass(e.target.value)} />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowDefPass((p) => !p)}>
                      {showDefPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showDefPass ? 'text' : 'password'} placeholder="Repita a senha" className="pl-9" value={defPass2} onChange={(e) => setDefPass2(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setTab('login')}>
                    Voltar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? 'Salvando...' : 'Definir senha'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
