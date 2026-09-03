import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Copy,
  HelpCircle,
  Lightbulb,
  LifeBuoy,
  Mail,
  MessageCircle,
  MessagesSquare,
  Search,
  Send,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAccountingStore } from '@/store/accounting';
import { useLogBuffer } from '@/hooks/use-log-buffer';
import { formatCompetencia } from '@/lib/competencia';
import {
  AJUDA_POR_ROTA, FAQ, GUIA, SUPORTE, matchesTermo, temWhatsApp,
  type FaqItem, type GuideStep,
} from '@/lib/support-content';

const VISTO_KEY = 'conciliacaopro:ajuda-vista';

/** WhatsApp/mailto truncam mensagens muito longas — mantém o link utilizável. */
const MAX_MENSAGEM = 1500;

function lerVisto(): boolean {
  try {
    return localStorage.getItem(VISTO_KEY) === '1';
  } catch {
    return true; // sem storage, não insiste com o destaque
  }
}

function marcarVisto() {
  try {
    localStorage.setItem(VISTO_KEY, '1');
  } catch {
    /* modo privado / storage bloqueado — só perde o destaque */
  }
}

export function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState('guia');
  const [busca, setBusca] = useState('');
  const [passoAberto, setPassoAberto] = useState('');
  const [novo, setNovo] = useState(() => !lerVisto());
  const buscaRef = useRef<HTMLInputElement>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { entries: logs } = useLogBuffer();
  const { currentUser, companyInfo, selectedCompetencia, selectedCompetenciaStatus } =
    useAccountingStore();

  const contexto = AJUDA_POR_ROTA[location.pathname];

  const abrir = useCallback(() => {
    setOpen(true);
    setNovo((era) => {
      if (era) marcarVisto();
      return false;
    });
  }, []);

  // Atalho "?" — ignora digitação em campos de texto.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (
        alvo?.tagName === 'INPUT' ||
        alvo?.tagName === 'TEXTAREA' ||
        alvo?.tagName === 'SELECT' ||
        alvo?.isContentEditable
      ) return;
      e.preventDefault();
      abrir();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [abrir]);

  // Foca a busca ao abrir o painel.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => buscaRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  const irPara = (href: string) => {
    setOpen(false);
    navigate(href);
  };

  const podeAcessar = (step: GuideStep) =>
    !step.permission || !!currentUser?.permissoes[step.permission];

  const guiaFiltrado = useMemo(
    () =>
      busca.trim()
        ? GUIA.filter((s) => matchesTermo(busca, s.titulo, s.resumo, s.itens, s.dica, s.keywords))
        : GUIA,
    [busca],
  );

  const faqFiltrado = useMemo(
    () =>
      busca.trim()
        ? FAQ.filter((f) => matchesTermo(busca, f.pergunta, f.resposta, f.categoria, f.keywords))
        : FAQ,
    [busca],
  );

  const buscando = busca.trim().length > 0;
  const semResultado = buscando && guiaFiltrado.length === 0 && faqFiltrado.length === 0;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={abrir}
            aria-label="Abrir central de ajuda e suporte"
            className={cn(
              'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground shadow-lg shadow-primary/30',
              'transition-transform hover:scale-105 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              open && 'scale-95 opacity-90',
            )}
          >
            {novo && (
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" aria-hidden />
            )}
            <HelpCircle className="relative h-7 w-7" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          Ajuda e suporte <span className="ml-1 text-muted-foreground">(tecle ?)</span>
        </TooltipContent>
      </Tooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-primary" />
              Central de Ajuda
            </SheetTitle>
            <SheetDescription>
              Passo a passo, dúvidas frequentes e contato direto com o suporte.
            </SheetDescription>
          </SheetHeader>

          <div className="border-b border-border px-6 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={buscaRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar ajuda (ex.: balancete, cadeado, exportar)"
                className="pl-9 pr-9"
              />
              {buscando && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {contexto && !buscando && (
              <button
                type="button"
                onClick={() => { setAba('guia'); setPassoAberto(contexto.stepId); }}
                className="mt-3 flex w-full items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left text-xs transition-colors hover:bg-primary/10"
              >
                <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1">
                  Você está em <b>{contexto.tela}</b> — ver como usar esta tela
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-6 mt-3 grid w-auto grid-cols-3">
              <TabsTrigger value="guia" className="gap-1.5 text-xs">
                <BookOpen className="h-3.5 w-3.5" /> Passo a passo
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-1.5 text-xs">
                <MessagesSquare className="h-3.5 w-3.5" /> Dúvidas
              </TabsTrigger>
              <TabsTrigger value="suporte" className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Suporte
              </TabsTrigger>
            </TabsList>

            {semResultado && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nada encontrado para <b>“{busca}”</b>.
                </p>
                <Button variant="link" className="mt-1" onClick={() => setAba('suporte')}>
                  Perguntar ao suporte
                </Button>
              </div>
            )}

            <TabsContent value="guia" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Da primeira empresa até o fechamento da competência — na ordem em que o trabalho acontece.
              </p>
              <Accordion
                type="single"
                collapsible
                value={passoAberto}
                onValueChange={setPassoAberto}
                className="space-y-2"
              >
                {guiaFiltrado.map((step) => (
                  <PassoItem
                    key={step.id}
                    step={step}
                    numero={GUIA.indexOf(step) + 1}
                    podeAcessar={podeAcessar(step)}
                    onIr={irPara}
                  />
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="faq" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <Accordion type="single" collapsible className="space-y-2">
                {faqFiltrado.map((item) => (
                  <FaqItemView key={item.id} item={item} />
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="suporte" className="mt-0 min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
              <FalarComSuporte
                tela={contexto?.tela ?? location.pathname}
                empresa={companyInfo.nome}
                competencia={
                  selectedCompetencia
                    ? `${formatCompetencia(selectedCompetencia)}${selectedCompetenciaStatus === 'CONCLUIDA' ? ' (concluída)' : ''}`
                    : '—'
                }
                usuario={currentUser?.email}
                errosRecentes={logs.filter((l) => l.level === 'error' || l.level === 'fatal')}
                onCopiado={() =>
                  toast({ title: 'Mensagem copiada', description: 'Cole no canal de atendimento que preferir.' })
                }
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ── Passo do guia ─────────────────────────────────────────────────────────────

function PassoItem({
  step, numero, podeAcessar, onIr,
}: {
  step: GuideStep;
  numero: number;
  podeAcessar: boolean;
  onIr: (href: string) => void;
}) {
  return (
    <AccordionItem value={step.id} className="rounded-lg border border-border px-3">
      <AccordionTrigger className="py-3 text-left hover:no-underline">
        <div className="flex items-center gap-3 pr-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {numero}
          </span>
          <span className="text-sm font-medium">{step.titulo}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-4 pl-9">
        <p className="mb-2 text-xs text-muted-foreground">{step.resumo}</p>
        <ul className="space-y-1.5 text-sm">
          {step.itens.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {step.dica && (
          <div className="mt-3 flex gap-2 rounded-md bg-muted/60 p-2.5 text-xs text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span>{step.dica}</span>
          </div>
        )}
        {step.href && podeAcessar && (
          <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={() => onIr(step.href!)}>
            Ir para a tela
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {step.href && !podeAcessar && (
          <p className="mt-3 text-xs text-muted-foreground">
            Seu perfil não tem acesso a esta tela — peça ao administrador da conta.
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

// ── Pergunta frequente ────────────────────────────────────────────────────────

function FaqItemView({ item }: { item: FaqItem }) {
  return (
    <AccordionItem value={item.id} className="rounded-lg border border-border px-3">
      <AccordionTrigger className="py-3 text-left text-sm hover:no-underline">
        {item.pergunta}
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <Badge variant="secondary" className="mb-2 text-[10px]">{item.categoria}</Badge>
        <p className="text-sm leading-relaxed text-muted-foreground">{item.resposta}</p>
      </AccordionContent>
    </AccordionItem>
  );
}

// ── Contato com o suporte ─────────────────────────────────────────────────────

interface FalarComSuporteProps {
  tela: string;
  empresa: string;
  competencia: string;
  usuario?: string;
  errosRecentes: { timestamp: string; message: string }[];
  onCopiado: () => void;
}

function FalarComSuporte({
  tela, empresa, competencia, usuario, errosRecentes, onCopiado,
}: FalarComSuporteProps) {
  const [descricao, setDescricao] = useState('');
  const [anexarDiagnostico, setAnexarDiagnostico] = useState(errosRecentes.length > 0);
  const [copiado, setCopiado] = useState(false);

  const mensagem = useMemo(() => {
    const linhas = [
      'Olá! Preciso de ajuda no ConciliaçãoPRO.',
      '',
      descricao.trim() || '(descreva aqui o que está acontecendo)',
      '',
      '--- Contexto ---',
      `Tela        : ${tela}`,
      `Empresa     : ${empresa || '—'}`,
      `Competência : ${competencia}`,
      `Usuário     : ${usuario ?? '—'}`,
      `Data/hora   : ${new Date().toLocaleString('pt-BR')}`,
    ];

    if (anexarDiagnostico && errosRecentes.length > 0) {
      linhas.push('', '--- Últimos erros registrados ---');
      for (const e of errosRecentes.slice(-5).reverse()) {
        linhas.push(`• [${new Date(e.timestamp).toLocaleTimeString('pt-BR')}] ${e.message}`);
      }
    }

    const texto = linhas.join('\n');
    return texto.length > MAX_MENSAGEM ? `${texto.slice(0, MAX_MENSAGEM)}\n[...]` : texto;
  }, [descricao, tela, empresa, competencia, usuario, anexarDiagnostico, errosRecentes]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      onCopiado();
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const whatsappUrl = `https://wa.me/${SUPORTE.whatsapp}?text=${encodeURIComponent(mensagem)}`;
  const mailtoUrl = `mailto:${SUPORTE.email}?subject=${encodeURIComponent(
    `Suporte ConciliaçãoPRO — ${tela}`,
  )}&body=${encodeURIComponent(mensagem)}`;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium" htmlFor="suporte-descricao">
          O que está acontecendo?
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Quanto mais específico, mais rápido resolvemos. O contexto da tela vai junto automaticamente.
        </p>
        <Textarea
          id="suporte-descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={5}
          placeholder="Ex.: importei o balancete de 03/2026 mas a conta 1.1.2.01 continua com diferença de R$ 1.240,00."
        />
      </div>

      {errosRecentes.length > 0 && (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/60 p-3">
          <Checkbox
            checked={anexarDiagnostico}
            onCheckedChange={(v) => setAnexarDiagnostico(v === true)}
            className="mt-0.5"
          />
          <span className="text-xs">
            <b>Anexar diagnóstico técnico</b>
            <span className="block text-muted-foreground">
              Inclui os últimos erros registrados nesta sessão ({errosRecentes.length}). Senhas e tokens
              já são removidos automaticamente.
            </span>
          </span>
        </label>
      )}

      <div className="space-y-2">
        {temWhatsApp() && (
          <Button asChild className="w-full gap-2 bg-[#25D366] text-white hover:bg-[#1da851]">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
        )}
        <Button asChild variant={temWhatsApp() ? 'outline' : 'default'} className="w-full gap-2">
          <a href={mailtoUrl}>
            <Mail className="h-4 w-4" />
            Enviar por e-mail
          </a>
        </Button>
        <Button variant="ghost" className="w-full gap-2" onClick={copiar}>
          {copiado ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copiado ? 'Mensagem copiada' : 'Copiar mensagem'}
        </Button>
      </div>

      <Separator />

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {SUPORTE.horario}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {SUPORTE.email}
        </p>
      </div>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-xs font-medium">Prévia da mensagem</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
          {mensagem}
        </pre>
      </details>
    </div>
  );
}
