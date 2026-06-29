import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccountingStore } from '@/store/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Mail, Eye, EyeOff, UserPlus, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Tab = 'login' | 'signup' | 'reset';

export function Login() {
  const { login, signUpTenant, requestPasswordReset } = useAccountingStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('login');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup
  const [tenantNome, setTenantNome] = useState('');
  const [tenantCnpj, setTenantCnpj] = useState('');
  const [adminNome, setAdminNome] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');
  const [signupPass2, setSignupPass2] = useState('');

  // Reset
  const [resetEmail, setResetEmail] = useState('');

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantNome.trim() || !adminNome.trim() || !signupEmail.trim() || !signupPass) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (signupPass.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (signupPass !== signupPass2) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      await signUpTenant({
        tenantNome: tenantNome.trim(),
        tenantCnpj: tenantCnpj.trim() || undefined,
        adminNome: adminNome.trim(),
        email: signupEmail.trim(),
        password: signupPass,
      });
      toast({ title: 'Escritório criado! Bem-vindo ao ConciliaçãoPRO.' });
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta';
      toast({ title: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setLoading(true);
    try {
      await requestPasswordReset(resetEmail.trim());
      toast({ title: 'E-mail de recuperação enviado!', description: 'Verifique sua caixa de entrada.' });
      setTab('login');
    } catch {
      toast({ title: 'E-mail não encontrado', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
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
                    <Input type="email" placeholder="seu@email.com" className="pl-9"
                      value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="••••••••" className="pl-9 pr-9"
                      value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>

              <div className="mt-4 pt-4 border-t flex flex-col gap-2 text-center">
                <button type="button" className="text-sm text-primary hover:underline"
                  onClick={() => setTab('reset')}>
                  Esqueci minha senha
                </button>
                <button type="button" className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setTab('signup')}>
                  Novo escritório? Criar conta
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── SIGNUP DE NOVO ESCRITÓRIO ── */}
        {tab === 'signup' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Criar conta do escritório
              </CardTitle>
              <CardDescription>
                Registre seu escritório de contabilidade para começar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome do escritório <span className="text-destructive">*</span></Label>
                  <Input placeholder="Ex: Contabilidade Silva & Associados"
                    value={tenantNome} onChange={(e) => setTenantNome(e.target.value)} autoFocus />
                </div>
                <div className="space-y-1">
                  <Label>CNPJ do escritório</Label>
                  <Input placeholder="00.000.000/0000-00"
                    value={tenantCnpj} onChange={(e) => setTenantCnpj(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Seu nome (administrador) <span className="text-destructive">*</span></Label>
                  <Input placeholder="Nome completo"
                    value={adminNome} onChange={(e) => setAdminNome(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>E-mail <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="admin@escritorio.com" className="pl-9"
                      value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Senha <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres" className="pl-9 pr-9"
                      value={signupPass} onChange={(e) => setSignupPass(e.target.value)} />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar senha <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Repita a senha" className="pl-9"
                      value={signupPass2} onChange={(e) => setSignupPass2(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full mt-1" disabled={loading}>
                  {loading ? 'Criando...' : 'Criar escritório e entrar'}
                </Button>
              </form>
              <div className="mt-4 pt-4 border-t text-center">
                <button type="button" className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setTab('login')}>
                  Já tenho conta — fazer login
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── RECUPERAR SENHA ── */}
        {tab === 'reset' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5" />
                Recuperar senha
              </CardTitle>
              <CardDescription>
                Enviaremos um link de redefinição para o seu e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleReset} className="space-y-4">
                <div className="space-y-1">
                  <Label>E-mail cadastrado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" className="pl-9"
                      value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} autoFocus />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </Button>
              </form>
              <div className="mt-4 pt-4 border-t text-center">
                <button type="button" className="text-sm text-muted-foreground hover:underline"
                  onClick={() => setTab('login')}>
                  Voltar para o login
                </button>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
