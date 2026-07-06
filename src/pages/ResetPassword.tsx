import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Verifica erro no hash (otp_expired, access_denied etc.)
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.get('error')) {
      setInvalid(true);
      return;
    }

    // Fluxo PKCE: código chega como query param ?code=...
    const queryParams = new URLSearchParams(window.location.search);
    const code = queryParams.get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setInvalid(true);
        else setReady(true);
      });
      return;
    }

    // Fallback: fluxo implícito legado (hash com access_token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setReady(true); return; }
      setTimeout(() => {
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session) setInvalid(true);
          else setReady(true);
        });
      }, 800);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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

  if (invalid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Link inválido ou expirado</h2>
            <p className="text-muted-foreground text-sm">
              Solicite um novo link de recuperação de senha.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ready) {
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
            <CardDescription>Digite e confirme sua nova senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
