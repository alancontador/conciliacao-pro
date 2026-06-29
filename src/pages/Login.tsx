import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Mail, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function Login() {
  const { usuarios, login, createFirstAdmin } = useAccountingStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isFirstAccess = usuarios.length === 0;

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // First admin form
  const [setupMode, setSetupMode] = useState(isFirstAccess);
  const [adminNome, setAdminNome] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPass2, setAdminPass2] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);

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

        {/* Primeiro acesso */}
        {setupMode ? (
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
                  <Input
                    placeholder="Seu nome"
                    value={adminNome}
                    onChange={(e) => setAdminNome(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="admin@empresa.com"
                      className="pl-9"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showAdminPass ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      className="pl-9 pr-9"
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                    />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowAdminPass((p) => !p)}>
                      {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showAdminPass ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      className="pl-9"
                      value={adminPass2}
                      onChange={(e) => setAdminPass2(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar administrador e entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Login normal */
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
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-9 pr-9"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button type="button" tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
