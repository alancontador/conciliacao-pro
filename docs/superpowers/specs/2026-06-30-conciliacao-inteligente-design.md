# Conciliação Inteligente de Lançamentos — Design

## Contexto

Hoje, o popup de lançamentos de uma conta (aba "Pendentes" em `src/pages/Status.tsx`) é 100% manual: o usuário marca checkboxes e clica em "Conciliado" quando débito selecionado = crédito selecionado. Não existe pareamento automático por valor.

Objetivo: adicionar um motor de sugestão de conciliação que combine múltiplas evidências (valor, texto/descrição, proximidade de data) para propor pares/grupos de lançamentos, sempre com checkpoint de revisão humana antes de qualquer aplicação — nunca conciliação automática sem aprovação.

## Decisões (confirmadas com o usuário)

- **Linguagem/arquitetura:** TypeScript, executado no navegador, dentro do app existente (React/Vite/SPA). Sem backend novo, sem Python — o deploy atual é estático (Nginx), sem runtime de servidor além do Supabase.
- **UI:** botão "Sugerir conciliação" na aba Pendentes do popup existente, que abre um painel de revisão. Fluxo manual atual (checkbox + botão Conciliado) permanece inalterado.
- **Auditoria:** nova tabela no Supabase (`conciliacoes_auditoria`), isolada por tenant via RLS — consistente com o padrão já usado no projeto (`dados_empresa`, `reconciled_indices`).
- **Testes:** adicionar `vitest` como devDependency (não afeta build/deploy de produção) para cobrir os casos pedidos.
- **Fuzzy matching:** implementação própria em TS (Levenshtein normalizado), sem adicionar lib externa — mantém o motor 100% auditável no próprio código-fonte, alinhado com a preferência do usuário por heurísticas determinísticas em vez de "caixa preta".

## Arquitetura e fluxo de dados

Novo módulo `src/lib/reconciliation-engine.ts`, com funções puras (sem estado, sem I/O):

```
razaoData pendente da conta aberta
   → generateCandidates(rows, config)   // matches exatos 1:1 + subset-sum N:M + sinais de texto
   → scoreCandidate(candidate, config)  // combina valor + texto + data em score 0–100
   → classify(score, config)            // ALTA / MEDIA / BAIXA confiança
   → [painel de revisão no Status.tsx]  // usuário aprova tudo / parte / nada
   → applyReconciliation(approved)      // chama reconcileRazaoTransactions (já existe) + grava auditoria no Supabase
```

O motor só analisa lançamentos **pendentes** da conta atualmente aberta no popup (mesmo escopo que já existe hoje). Ele nunca marca nada como conciliado por conta própria — só devolve uma lista de candidatos com score e justificativa; a aplicação é sempre um passo explícito do usuário.

## Algoritmo de matching

### Geração de candidatos

1. **Exato 1:1** — valor absoluto igual (2 casas decimais, arredondado) com sinais opostos (um débito, um crédito). Pareamento cronológico (FIFO) quando há múltiplos lançamentos com o mesmo valor absoluto.
2. **N:1 / N:M (soma de subconjunto)** — busca combinações de até `maxCombinationSize` lançamentos (padrão 4) cuja soma bate com outro lançamento (ou outro subconjunto) dentro de `valueTolerance` (padrão R$ 0,01), limitada a pares dentro de `timeWindowDays` (padrão 60 dias) um do outro. Necessário para não explodir custo computacional (soma de subconjuntos é NP-difícil em geral; com poucos itens por conta e limites de tamanho/janela, fica tratável).
3. **Sinais de texto** — para cada candidato de valor, calcula-se um sub-score textual:
   - Normalização: remove acentos, uppercase/lowercase, espaços duplicados.
   - Regex: extrai CNPJ/CPF (`\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}` / `\d{3}\.?\d{3}\.?\d{3}-?\d{2}`), número de documento/NF/boleto (sequências numéricas de 4+ dígitos após palavras-chave como "NF", "DOC", "BOL"). Match de regex = sinal forte, mesmo que o resto do texto varie.
   - Similaridade textual geral: Levenshtein normalizado (0–1) sobre o texto normalizado, implementado em TS puro (sem dependência externa).

### Score combinado (0–100)

Pesos configuráveis, centralizados em `RECONCILIATION_CONFIG`:

- **Valor** (peso 50): cheio para match exato 1:1; penalidade proporcional ao número de itens combinados em N:M (mais itens = menos confiança, mesmo com soma exata).
- **Texto/descrição** (peso 35): regex de documento/CNPJ = sinal forte (quase peso cheio); similaridade textual geral = sinal parcial proporcional ao score de Levenshtein.
- **Proximidade de data** (peso 15): decai linearmente com a distância em dias, zerando fora da `timeWindowDays`.

### Classificação de confiança

- **Alta** (score ≥ 85): elegível para sugestão automática — ainda assim exige aprovação explícita no painel de revisão.
- **Média** (60–84): mostrado no painel de revisão, sem destaque de "sugerido".
- **Baixa** (< 60): não aparece como sugestão; fica apenas registrado em log para auditoria futura (não bloqueia nem sugere).

Todos os parâmetros (`valueTolerance`, `timeWindowDays`, `maxCombinationSize`, pesos, limiares de classificação) ficam centralizados em um único objeto de configuração no topo do módulo, fácil de ajustar.

## UI — painel de revisão

- Botão "Sugerir conciliação" na aba Pendentes do popup de lançamentos (`Status.tsx`).
- Ao clicar, roda o motor sobre os lançamentos pendentes visíveis e abre um `Dialog` de revisão listando cada grupo candidato: linhas envolvidas (data, histórico, valor), score, e justificativa (qual critério pesou: valor exato / soma N:M / CNPJ encontrado / similaridade textual / proximidade de data).
- Checkbox por grupo candidato — usuário aprova todos, alguns ou nenhum.
- Ao confirmar, aplica apenas os grupos aprovados via `reconcileRazaoTransactions` (função já existente, sem mudança de comportamento) e grava um registro de auditoria por grupo aplicado.

## Auditoria — Supabase

Nova migration `supabase/migrations/003_conciliacao_auditoria.sql`, aplicada manualmente no SQL Editor do Supabase (mesmo processo das migrations 001/002):

- Tabela `conciliacoes_auditoria`: `id`, `tenant_id` (RLS via `my_tenant_id()`), `empresa_id`, `conta`, `razao_indices` (jsonb, índices/linhas envolvidas), `score`, `criterios` (jsonb — detalhamento de valor/texto/data), `usuario_id`, `created_at`.
- RLS: mesma política de isolamento por tenant já usada nas outras tabelas.

## Testes

Adicionar `vitest` como devDependency. Casos de teste cobrindo o módulo `reconciliation-engine.ts` (funções puras, sem necessidade de mocks de Supabase/React):

1. Par exato 1:1 (mesmo valor absoluto, sinais opostos) → score alto, classificado ALTA.
2. Soma N:1 (três lançamentos de R$ 400 somando R$ 1.200) dentro da janela de tempo → candidato gerado e pontuado.
3. Falso positivo de valor (dois lançamentos de R$ 500 sem relação textual) → texto reduz o score, ficando fora da faixa ALTA (idealmente BAIXA/MEDIA, não sugerido automaticamente).
4. Caso de baixa confiança (valor não bate exatamente, texto fraco, data distante) → classificado BAIXA, não aparece como sugestão.

## Fora de escopo (YAGNI)

- Qualquer uso de LLM/IA generativa como decisor de conciliação — não é necessário; heurísticas determinísticas atendem ao requisito de auditabilidade contábil.
- Alterar o fluxo manual existente (checkbox + botão Conciliado) — permanece como está, a sugestão inteligente é aditiva.
- Backend/serviço Python — descartado por desproporção de infraestrutura frente ao ganho.
