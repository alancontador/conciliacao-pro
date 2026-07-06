import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Eye, EyeOff, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const params = new URLSearchParams(window.location.search);
  const emailFromUrl = params.get('email') ?? '';
  const codeFromUrl = params.get('code') ?? '';

  const [mode, setMode] = useState<'pkce' | 'otp' | 'form' | 'invalid'>('otp');
  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Se veio com erro no hash → link antigo inválido
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get('error')) {
      setMode('invalid');
      return;
    }

    // Se veio com ?code= → fluxo PKCE (link do e-mail clicado antes do Gmail consumir)
    if (codeFromUrl) {
      setMode('pkce');
      supabase.auth.exchangeCodeForSession(codeFromUrl).then(({ error }) => {
        if (error) setMode('invalid');
        else setMode('form');
      });
      return;
    }

    // Padrão: exibir formulário de código OTP
    setMode('otp');
  }, [codeFromUrl]);

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !code.trim()) {
      toast({ title: 'Preencha o e-mail e o código', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== password2) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });

    if (verifyError) {
      setLoading(false);
      toast({ title: 'Código inválido ou expirado', description: 'Solicite um novo código de recuperação.', variant: 'destructive' });
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      toast({ title: 'Erro ao redefinir senha', description: updateError.message, variant: 'destructive' });
    } else {
      setDone(true);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' });
      return;
    }
    if (password !== password2) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Senha redefinida com sucesso!</h2>
            <p className="text-muted-foreground text-sm">Você já pode entrar com a nova senha.</p>
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Link inválido ou expirado</h2>
            <p className="text-muted-foreground text-sm">
              Solicite um novo código de recuperação de senha.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === 'pkce') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Verificando link...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">ConciliaçãoPRO</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Redefinir senha</CardTitle>
            <CardDescription>
              {mode === 'form'
                ? 'Crie sua nova senha de acesso.'
                : 'Informe o código que chegou no seu e-mail e crie uma nova senha.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === 'form' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                      className="pl-9 pr-9" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Repita a senha"
                      className="pl-9" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label>E-mail cadastrado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" placeholder="seu@email.com" className="pl-9"
                      value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Código de recuperação</Label>
                  <Input
                    placeholder="Cole ou digite o código do e-mail"
                    className="font-mono text-center tracking-widest text-base"
                    value={code}
                    onChange={(e) => setCode(e.target.value.trim())}
                    autoFocus={!emailFromUrl}
                    autoComplete="one-time-code"
                  />
                  <p className="text-xs text-muted-foreground">
                    O código foi enviado para o seu e-mail. Verifique também a lixeira eletrônica.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                      className="pl-9 pr-9" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPass((p) => !p)}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Confirmar nova senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type={showPass ? 'text' : 'password'} placeholder="Repita a senha"
                      className="pl-9" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Verificando...' : 'Redefinir senha'}
                </Button>
                <div className="text-center">
                  <Link to="/login" className="text-sm text-muted-foreground hover:underline">
                    Voltar ao login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
