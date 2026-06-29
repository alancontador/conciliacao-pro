import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Building2, Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { loadConviteByToken, aceitarConvite } from '@/services/supabase.service';
import type { DbConvite } from '@/lib/supabase';

export function AceitarConvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = params.get('token') ?? '';

  const [convite, setConvite] = useState<DbConvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [done, setDone] = useState(false);

  const [nome, setNome] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    loadConviteByToken(token).then((c) => {
      if (!c || new Date(c.expires_at) < new Date()) setInvalid(true);
      else { setConvite(c); setNome(c.nome); }
      setLoading(false);
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { toast({ title: 'Informe seu nome', variant: 'destructive' }); return; }
    if (password.length < 6) { toast({ title: 'Senha deve ter pelo menos 6 caracteres', variant: 'destructive' }); return; }
    if (password !== password2) { toast({ title: 'As senhas não coincidem', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await aceitarConvite(token, nome.trim(), password);
      setDone(true);
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao aceitar convite', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Verificando convite...</p></div>;
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
