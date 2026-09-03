/**
 * Conteúdo da Central de Ajuda (widget de suporte).
 *
 * Guias e FAQ ficam aqui — separados do componente — para que o texto possa ser
 * revisado/ampliado sem mexer na UI. Todo item é pesquisável pelo campo de busca
 * do widget através de `keywords`.
 */

import type { PermissoesUsuario } from '@/types/usuario';

// ── Contato do suporte ────────────────────────────────────────────────────────
// Lido de window.__env (injetado em runtime pelo Docker) ou do .env em build time.

const env = (key: 'VITE_SUPORTE_WHATSAPP' | 'VITE_SUPORTE_EMAIL' | 'VITE_SUPORTE_HORARIO'): string =>
  window.__env?.[key] || (import.meta.env[key] as string | undefined) || '';

/** Só dígitos — o link wa.me não aceita máscara. */
const somenteDigitos = (v: string) => v.replace(/\D/g, '');

// Contato oficial do suporte. As variáveis de ambiente acima sobrescrevem estes
// valores — servem para trocar o canal sem rebuild, mas o padrão já é o real,
// para o app nunca cair num contato inválido se o ambiente não estiver configurado.
const PADRAO = {
  whatsapp: '5511982593674', // DDI + DDD + número
  email: 'conciliacaopro@gmail.com',
  horario: 'Segunda a sexta, das 9h às 18h',
};

export const SUPORTE = {
  /** Ex.: 5511999999999 (DDI + DDD + número). Vazio esconde o botão do WhatsApp. */
  whatsapp: somenteDigitos(env('VITE_SUPORTE_WHATSAPP')) || PADRAO.whatsapp,
  email: env('VITE_SUPORTE_EMAIL') || PADRAO.email,
  horario: env('VITE_SUPORTE_HORARIO') || PADRAO.horario,
};

export const temWhatsApp = () => SUPORTE.whatsapp.length >= 10;

// ── Passo a passo ─────────────────────────────────────────────────────────────

export interface GuideStep {
  id: string;
  titulo: string;
  resumo: string;
  itens: string[];
  dica?: string;
  /** Rota para o botão "Ir para a tela". Ausente = a ação acontece no cabeçalho. */
  href?: string;
  /** Só mostra o botão de atalho se o usuário tiver esta permissão. */
  permission?: keyof PermissoesUsuario;
  keywords: string[];
}

export const GUIA: GuideStep[] = [
  {
    id: 'empresa',
    titulo: 'Cadastre a empresa',
    resumo: 'Cada empresa cliente tem seus próprios dados, contas e conciliações.',
    itens: [
      'Vá em Empresas e clique em Nova empresa.',
      'Informe razão social, CNPJ e o contador responsável.',
      'Com mais de uma empresa cadastrada, troque entre elas clicando no nome da empresa no topo da tela.',
    ],
    dica: 'Os dados de uma empresa nunca se misturam com os de outra — importar em uma não afeta as demais.',
    href: '/empresas',
    keywords: ['empresa', 'cadastro', 'cnpj', 'cliente', 'trocar empresa', 'razao social'],
  },
  {
    id: 'competencia',
    titulo: 'Crie a competência (mês/ano)',
    resumo: 'A conciliação é sempre feita dentro de uma competência no formato MM/AAAA.',
    itens: [
      'No topo da tela, clique no período ao lado do ícone de calendário.',
      'Escolha Nova competência e selecione mês e ano.',
      'A competência criada já fica selecionada e pronta para receber os arquivos.',
    ],
    dica: 'Cada competência é independente: o que você concilia em 03/2026 não interfere em 04/2026.',
    keywords: ['competencia', 'periodo', 'mes', 'ano', 'mm/aaaa', 'novo mes'],
  },
  {
    id: 'balancete',
    titulo: 'Importe o balancete',
    resumo: 'O balancete traz o saldo contábil de cada conta — é o lado "contabilidade" da conciliação.',
    itens: [
      'Vá em Importar Balancete e arraste o arquivo .xlsx ou .xls.',
      'O sistema localiza sozinho a linha de cabeçalho e mapeia as colunas Código, Classificação, Descrição, Saldo Anterior, Débito, Crédito e Saldo Atual.',
      'Confira a prévia na tela e confirme a importação.',
      'São consideradas apenas as contas patrimoniais — as que começam com 1 (Ativo) ou 2 (Passivo).',
    ],
    dica: 'Colunas extras (como "Carac") ou células mescladas não atrapalham: o mapeamento é feito pelo nome do cabeçalho, não pela posição.',
    href: '/import/balancete',
    permission: 'importar',
    keywords: ['balancete', 'importar', 'xlsx', 'excel', 'planilha', 'saldo', 'ativo', 'passivo', 'colunas'],
  },
  {
    id: 'razao',
    titulo: 'Importe o razão',
    resumo: 'O razão traz os lançamentos que compõem o saldo — é o lado "composição" da conciliação.',
    itens: [
      'Vá em Importar Razão e envie o arquivo exportado do seu sistema contábil.',
      'As colunas Conta, Data, Lote, Histórico, Débito e Crédito são reconhecidas automaticamente.',
      'Revise a prévia paginada antes de confirmar.',
      'Importar de novo o mesmo período não duplica: lançamentos idênticos são identificados e ignorados.',
    ],
    dica: 'Importe primeiro o balancete e depois o razão — a comparação só faz sentido com os dois lados carregados.',
    href: '/import/razao',
    permission: 'importar',
    keywords: ['razao', 'importar', 'lancamentos', 'movimentacao', 'duplicado', 'lote', 'historico'],
  },
  {
    id: 'conciliar',
    titulo: 'Concilie as contas',
    resumo: 'Em Status das Contas você compara o saldo do balancete com a soma dos lançamentos do razão.',
    itens: [
      'Filtre por status ou busque a conta pelo número/descrição.',
      'Clique na conta para abrir a composição com todos os lançamentos.',
      'Marque os lançamentos que compõem o saldo e confirme a conciliação.',
      'Use Sugestões para o sistema propor os casamentos prováveis — você aprova o que fizer sentido.',
      'Anexe comprovantes na conta e registre observações quando houver pendência.',
    ],
    dica: 'Contas de banco e aplicações financeiras entram como conciliadas automaticamente, porque são conferidas pelo extrato, fora do sistema.',
    href: '/status',
    permission: 'verStatus',
    keywords: ['conciliar', 'conciliacao', 'status', 'contas', 'diferenca', 'composicao', 'sugestoes', 'anexo', 'documento'],
  },
  {
    id: 'dashboard',
    titulo: 'Acompanhe o andamento',
    resumo: 'O Dashboard mostra o percentual conciliado e o que ainda está pendente.',
    itens: [
      'Veja total de contas, conciliadas, pendentes e contas em alerta.',
      'Clique nos indicadores para ir direto à lista filtrada em Status das Contas.',
    ],
    href: '/',
    permission: 'verDashboard',
    keywords: ['dashboard', 'indicadores', 'kpi', 'percentual', 'pendente', 'alerta', 'grafico'],
  },
  {
    id: 'concluir',
    titulo: 'Conclua e arquive a competência',
    resumo: 'Fechar a competência congela o trabalho para auditoria.',
    itens: [
      'Com a competência selecionada, clique em Concluir no topo da tela.',
      'A competência passa a somente leitura e exibe um cadeado.',
      'Se precisar corrigir algo depois, clique em Reabrir — a competência volta a ficar editável.',
    ],
    dica: 'Concluir não apaga nada: os dados continuam disponíveis para consulta e exportação.',
    keywords: ['concluir', 'fechar', 'arquivar', 'reabrir', 'cadeado', 'somente leitura', 'auditoria'],
  },
];

// ── Perguntas frequentes ──────────────────────────────────────────────────────

export type FaqCategoria = 'Importação' | 'Conciliação' | 'Competências' | 'Acesso' | 'Exportação';

export interface FaqItem {
  id: string;
  categoria: FaqCategoria;
  pergunta: string;
  resposta: string;
  keywords: string[];
}

export const FAQ: FaqItem[] = [
  {
    id: 'faq-balancete-x-razao',
    categoria: 'Conciliação',
    pergunta: 'Qual é a diferença entre balancete e razão aqui dentro?',
    resposta:
      'O balancete informa o saldo que a contabilidade registra para cada conta. O razão traz os lançamentos que deveriam formar esse saldo. A conciliação é justamente confrontar os dois: se a soma dos lançamentos do razão bate com o saldo do balancete, a conta está conciliada; se sobra ou falta, aparece uma diferença para você investigar.',
    keywords: ['balancete', 'razao', 'diferenca', 'conceito', 'contabilidade', 'composicao'],
  },
  {
    id: 'faq-arquivo-recusado',
    categoria: 'Importação',
    pergunta: 'Meu arquivo foi recusado ou as colunas não foram reconhecidas. O que fazer?',
    resposta:
      'Envie o arquivo em .xlsx ou .xls, sem senha e com a linha de títulos preservada. O sistema procura essa linha em qualquer posição da planilha, mas ela precisa existir e conter os nomes das colunas (no balancete: Código, Classificação, Descrição, Saldo Anterior, Débito, Crédito e Saldo Atual). Se você exportou do sistema contábil em PDF ou CSV, gere novamente em Excel. Persistindo o erro, fale com o suporte pela aba Suporte e anexe o arquivo.',
    keywords: ['erro', 'importar', 'arquivo', 'coluna', 'cabecalho', 'xlsx', 'csv', 'pdf', 'nao reconhece'],
  },
  {
    id: 'faq-so-1-e-2',
    categoria: 'Importação',
    pergunta: 'Por que algumas contas do balancete não apareceram?',
    resposta:
      'A conciliação trata apenas de contas patrimoniais, ou seja, as que começam com 1 (Ativo) ou 2 (Passivo). Contas de resultado (3, 4...) são ignoradas de propósito na importação.',
    keywords: ['conta', 'faltando', 'sumiu', 'ativo', 'passivo', 'resultado', 'patrimonial'],
  },
  {
    id: 'faq-duplicidade',
    categoria: 'Importação',
    pergunta: 'Importei o razão duas vezes. Os lançamentos duplicaram?',
    resposta:
      'Não. Na importação do razão o sistema compara cada linha com o que já existe na competência e ignora as repetidas — ao final ele informa quantos lançamentos foram adicionados e quantos eram duplicados. Reimportar um arquivo corrigido é seguro.',
    keywords: ['duplicado', 'duplicidade', 'importei de novo', 'repetido', 'razao'],
  },
  {
    id: 'faq-status',
    categoria: 'Conciliação',
    pergunta: 'O que significa cada status de conta?',
    resposta:
      'Conciliado: a composição do razão explica o saldo do balancete. Em análise: existe diferença sendo investigada, normalmente com observação ou prazo de regularização registrado. Não conciliado: a conta ainda não foi tratada ou a diferença permanece sem justificativa.',
    keywords: ['status', 'conciliado', 'em analise', 'nao conciliado', 'cores', 'badge'],
  },
  {
    id: 'faq-banco-automatico',
    categoria: 'Conciliação',
    pergunta: 'Por que contas de banco já aparecem conciliadas sem eu fazer nada?',
    resposta:
      'Contas correntes e aplicações financeiras são conciliadas pelo extrato bancário, fora do sistema. Por isso elas entram automaticamente como conciliadas por regra, e não pelo casamento balancete × razão. O sistema identifica essas contas pela descrição (Banco, C/C, Aplicação, CDB, Poupança, entre outras).',
    keywords: ['banco', 'conta corrente', 'aplicacao', 'cdb', 'poupanca', 'automatico', 'regra', 'extrato'],
  },
  {
    id: 'faq-sugestoes',
    categoria: 'Conciliação',
    pergunta: 'Como funcionam as Sugestões de conciliação?',
    resposta:
      'O sistema analisa valor, data e histórico dos lançamentos e propõe os casamentos mais prováveis, com uma pontuação de confiança. Nada é conciliado sozinho: as sugestões ficam aguardando a sua aprovação, e você pode aceitar apenas parte delas.',
    keywords: ['sugestao', 'automatico', 'inteligente', 'casamento', 'aprovar', 'score'],
  },
  {
    id: 'faq-lote',
    categoria: 'Conciliação',
    pergunta: 'Posso conciliar vários lançamentos de uma vez?',
    resposta:
      'Sim. Dentro da conta, marque as caixas de seleção dos lançamentos que compõem o saldo e confirme — todos são conciliados juntos. Para desfazer, abra a aba de conciliados, selecione os lançamentos e remova a conciliação.',
    keywords: ['varios', 'em lote', 'selecionar', 'desfazer', 'desconciliar', 'checkbox'],
  },
  {
    id: 'faq-lancamento-manual',
    categoria: 'Conciliação',
    pergunta: 'Um lançamento não veio no razão. Posso incluir manualmente?',
    resposta:
      'Pode. Na composição da conta, use a opção de lançamento manual e informe data, lote, histórico e o valor a débito ou a crédito. Lançamentos manuais ficam marcados como tal, para que a auditoria saiba que não vieram do arquivo importado.',
    keywords: ['manual', 'incluir', 'adicionar lancamento', 'editar', 'excluir', 'ajuste'],
  },
  {
    id: 'faq-anexo',
    categoria: 'Conciliação',
    pergunta: 'Como anexo um comprovante à conta?',
    resposta:
      'Na tela Status das Contas, use o ícone de clipe na linha da conta e selecione o arquivo. O anexo fica vinculado àquela conta na competência, servindo como documentação da conciliação.',
    keywords: ['anexo', 'documento', 'comprovante', 'clipe', 'upload', 'arquivo'],
  },
  {
    id: 'faq-exportar',
    categoria: 'Exportação',
    pergunta: 'Como exporto o resultado da conciliação?',
    resposta:
      'Em Status das Contas, use o botão de download para gerar a planilha em Excel com as contas, saldos, diferenças e status. A exportação respeita os filtros aplicados na tela e exige a permissão Exportar Dados.',
    keywords: ['exportar', 'download', 'excel', 'planilha', 'relatorio', 'xlsx'],
  },
  {
    id: 'faq-bloqueado',
    categoria: 'Competências',
    pergunta: 'Não consigo editar nada e aparece um cadeado. Por quê?',
    resposta:
      'A competência selecionada foi concluída e está em modo somente leitura, para preservar o trabalho já auditado. Para voltar a editar, clique em Reabrir no topo da tela.',
    keywords: ['bloqueado', 'cadeado', 'nao edita', 'somente leitura', 'reabrir', 'travado', 'concluida'],
  },
  {
    id: 'faq-competencia-errada',
    categoria: 'Competências',
    pergunta: 'Importei os arquivos na competência errada. Como corrijo?',
    resposta:
      'Selecione a competência correta no topo da tela e importe os arquivos novamente. Na competência errada, use a opção de limpar os dados da empresa para desfazer a importação indevida — a ação afeta apenas aquela competência.',
    keywords: ['errado', 'competencia errada', 'apagar', 'limpar', 'refazer', 'corrigir importacao'],
  },
  {
    id: 'faq-usuarios',
    categoria: 'Acesso',
    pergunta: 'Como adiciono um usuário da minha equipe?',
    resposta:
      'Em Usuários, convide a pessoa pelo e-mail e escolha o perfil. Administrador tem acesso total; Gerente acompanha e edita a conciliação e gerencia empresas; Analista importa e concilia; Visualizador apenas consulta. As permissões podem ser ajustadas individualmente depois.',
    keywords: ['usuario', 'convite', 'equipe', 'permissao', 'perfil', 'administrador', 'analista', 'acesso'],
  },
  {
    id: 'faq-senha',
    categoria: 'Acesso',
    pergunta: 'Esqueci minha senha. Como recupero?',
    resposta:
      'Na tela de login, use a opção de recuperação de senha e informe o e-mail cadastrado. Você receberá um link para definir uma nova senha. Se o e-mail não chegar, confira a caixa de spam antes de acionar o suporte.',
    keywords: ['senha', 'esqueci', 'recuperar', 'login', 'reset', 'nao consigo entrar'],
  },
  {
    id: 'faq-historico',
    categoria: 'Acesso',
    pergunta: 'Onde vejo o histórico de importações e os erros do sistema?',
    resposta:
      'Em Configurações. Lá ficam o histórico de arquivos importados, com quantidade de linhas lidas e ignoradas, e o registro técnico de erros — útil para anexar ao chamado quando algo dá errado.',
    keywords: ['historico', 'log', 'erro', 'diagnostico', 'configuracoes', 'importacoes'],
  },
];

// ── Ajuda contextual por rota ────────────────────────────────────────────────

/** Passo do guia mais relevante para cada tela. */
export const AJUDA_POR_ROTA: Record<string, { tela: string; stepId: string }> = {
  '/': { tela: 'Dashboard', stepId: 'dashboard' },
  '/status': { tela: 'Status das Contas', stepId: 'conciliar' },
  '/import/balancete': { tela: 'Importar Balancete', stepId: 'balancete' },
  '/import/razao': { tela: 'Importar Razão', stepId: 'razao' },
  '/empresas': { tela: 'Empresas', stepId: 'empresa' },
  '/usuarios': { tela: 'Usuários', stepId: 'empresa' },
  '/settings': { tela: 'Configurações', stepId: 'concluir' },
};

// ── Busca ─────────────────────────────────────────────────────────────────────

const semAcento = (s: string) =>
  s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();

/** Casa o termo contra título, texto e palavras-chave, ignorando acentos e caixa. */
export function matchesTermo(termo: string, ...campos: (string | string[] | undefined)[]): boolean {
  const alvo = semAcento(
    campos.flatMap((c) => (Array.isArray(c) ? c : [c ?? ''])).join(' '),
  );
  return semAcento(termo)
    .split(/\s+/)
    .filter(Boolean)
    .every((palavra) => alvo.includes(palavra));
}
