import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Eye, EyeOff, CheckCircle2, XCircle, MailCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadConviteByToken, aceitarConvite, definirSenhaEAceitarConvite, resetPasswordForEmail } from '@/services/supabase.service';
import { supabase } from '@/lib/supabase';
import type { ConviteInfo } from '@/services/supabase.service';

export function AceitarConvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = params.get('token') ?? '';

  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);
  const [precisaConfirmar, setPrecisaConfirmar] = useState(false);
  // Quem chega pelo link do e-mail de convite já vem autenticado (magic link):
  // basta definir a senha, sem criar conta de novo.
  const [temSessao, setTemSessao] = useState(false);
  const [contaExistente, setContaExistente] = useState(false);

  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    Promise.all([loadConviteByToken(token), supabase.auth.getSession()])
      .then(([c, { data }]) => {
        if (!c || new Date(c.expires_at) < new Date()) setInvalid(true);
        else { setConvite(c); setNome(c.nome); }
        setTemSessao(Boolean(data.session));
        setLoading(false);
      })
      .catch(() => { setInvalid(true); setLoading(false); });
  }, [token]);

  // O link do e-mail traz a sessão no fragmento da URL, e o supabase-js a
  // processa de forma assíncrona — o getSession() acima pode rodar antes disso.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) setTemSessao(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast({ title: 'Informe seu nome', variant: 'destructive' }); return; }
    if (password.length < 6) { toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' }); return; }
    if (password !== password2) { toast({ title: 'As senhas não coincidem', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (temSessao) {
        // Veio pelo e-mail de convite: já autenticado, só falta a senha.
        await definirSenhaEAceitarConvite(token, nome.trim(), password);
        setDone(true);
      } else {
        const resultado = await aceitarConvite(token, nome.trim(), password);
        if (resultado === 'confirme-email') setPrecisaConfirmar(true);
        else if (resultado === 'conta-existente') setContaExistente(true);
        else setDone(true);
      }
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao aceitar convite', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Verificando convite...</p></div>;
  }

  if (contaExistente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <MailCheck className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Sua conta já foi criada</h2>
            <p className="text-muted-foreground text-sm">
              Falta apenas definir a senha. Vamos enviar um código para{' '}
              <strong>{convite?.email}</strong> — com ele você cria a senha e entra.
            </p>
            <Button
              className="w-full"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await resetPasswordForEmail(convite?.email ?? '');
                  toast({ title: 'Código enviado', description: 'Verifique seu e-mail (e a caixa de spam).' });
                  navigate(`/reset-password?email=${encodeURIComponent(convite?.email ?? '')}`, { replace: true });
                } catch (err: unknown) {
                  toast({
                    title: 'Não foi possível enviar',
                    description: err instanceof Error ? err.message : undefined,
                    variant: 'destructive',
                  });
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? 'Enviando...' : 'Receber código para definir a senha'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (precisaConfirmar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <MailCheck className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Confirme seu e-mail</h2>
            <p className="text-muted-foreground text-sm">
              Sua conta foi criada. Enviamos um link de confirmação para{' '}
              <strong>{convite?.email}</strong>.
            </p>
            <p className="text-muted-foreground text-sm">
              Clique no link do e-mail e depois faça login com a senha que você acabou
              de cadastrar — seu acesso ao escritório já estará liberado.
            </p>
            <p className="text-xs text-muted-foreground">
              Não achou? Verifique a caixa de spam.
            </p>
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Ir para o login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Conta criada com sucesso!</h2>
            <p className="text-muted-foreground text-sm">Você já pode fazer login com o e-mail e senha cadastrados.</p>
            <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>Fazer login</Button>
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
            <h2 className="text-xl font-bold">Convite inválido ou expirado</h2>
            <p className="text-muted-foreground text-sm">Solicite um novo convite ao administrador do escritório.</p>
          </CardContent>
        </Card>
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
            <CardTitle>Aceitar convite</CardTitle>
            <CardDescription>
              Você foi convidado para acessar o sistema.<br />
              E-mail: <strong>{convite?.email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label>Seu nome</Label>
                <Input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Criar senha</Label>
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
                <Label>Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type={showPass ? 'text' : 'password'} placeholder="Repita a senha"
                    className="pl-9" value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Criando conta...' : 'Criar conta e acessar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
