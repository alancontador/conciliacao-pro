# Conciliação Inteligente de Lançamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side reconciliation-suggestion engine (value + text + date evidence, combined score, human-approval checkpoint) to the existing "olho" popup in `Status.tsx`, without touching the manual reconciliation flow.

**Architecture:** Pure, stateless TypeScript modules under `src/lib/reconciliation/` generate and score candidate matches from the pending `RazaoRow`s of one account; `Status.tsx` calls this engine, shows a review dialog, and only applies approved candidates through the existing `reconcileRazaoTransactions` store action plus a new Supabase audit log.

**Tech Stack:** TypeScript (no new runtime deps), `vitest` (new devDependency, tests only), Supabase (new table + RLS for audit log).

## Global Constraints

- No Python, no new backend service — deploy stays a static Nginx SPA (see `docs/superpowers/specs/2026-06-30-conciliacao-inteligente-design.md`).
- No fuzzy-matching npm dependency — Levenshtein/token similarity implemented in-repo for auditability.
- The system must NEVER mark anything reconciled without an explicit user approval step in a review dialog.
- All matching parameters (tolerance, time window, max combination size, weights, thresholds) live in one config object (`RECONCILIATION_CONFIG` in `src/lib/reconciliation/types.ts`).
- **Scope decision (flag to user):** subset-sum matching covers N:1 in both directions (many small entries summing to one, or vice-versa). True N:M (multiple items on both sides simultaneously) is out of scope — not required by the spec's test cases and would multiply combinatorial cost.
- Existing manual checkbox + "Conciliado" button flow in `Status.tsx` must keep working unchanged.

---

### Task 1: Vitest setup + shared utils

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/reconciliation/utils.ts`
- Test: `src/lib/reconciliation/utils.test.ts`

**Interfaces:**
- Produces: `toTime(date: Date | string): number`, `roundCents(n: number): number` — used by every later reconciliation module.

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest`

- [ ] **Step 2: Add test script to package.json**

In `package.json`, inside `"scripts"`, add:
```json
"test": "vitest run"
```

- [ ] **Step 3: Wire vitest into vite.config.ts**

Change the import and add a `test` block so vitest reuses the same `@` alias as the app:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
  },
}));
```

- [ ] **Step 4: Write the failing test**

Create `src/lib/reconciliation/utils.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toTime, roundCents } from './utils';

describe('toTime', () => {
  it('aceita Date', () => {
    const d = new Date('2026-03-01T00:00:00Z');
    expect(toTime(d)).toBe(d.getTime());
  });

  it('aceita string ISO', () => {
    expect(toTime('2026-03-01T00:00:00Z')).toBe(new Date('2026-03-01T00:00:00Z').getTime());
  });
});

describe('roundCents', () => {
  it('arredonda para 2 casas decimais', () => {
    expect(roundCents(400.005)).toBe(400.01);
    expect(roundCents(1199.999)).toBe(1200);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/utils.test.ts`
Expected: FAIL — `Cannot find module './utils'`

- [ ] **Step 6: Implement**

Create `src/lib/reconciliation/utils.ts`:
```ts
export function toTime(date: Date | string): number {
  return (date instanceof Date ? date : new Date(date)).getTime();
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/utils.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/lib/reconciliation/utils.ts src/lib/reconciliation/utils.test.ts
git commit -m "chore: adiciona vitest e utilitarios base da conciliacao inteligente"
```

---

### Task 2: Config and shared types

**Files:**
- Create: `src/lib/reconciliation/types.ts`
- Test: `src/lib/reconciliation/types.test.ts`

**Interfaces:**
- Consumes: `RazaoRow` from `@/types/accounting`.
- Produces: `RazaoRowWithIndex`, `ReconciliationConfig`, `RECONCILIATION_CONFIG`, `ConfidenceLevel`, `MatchReasons`, `ReconciliationCandidate` — used by every later reconciliation module.

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/types.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { RECONCILIATION_CONFIG } from './types';

describe('RECONCILIATION_CONFIG', () => {
  it('usa os valores padrao definidos no spec', () => {
    expect(RECONCILIATION_CONFIG.valueTolerance).toBe(0.01);
    expect(RECONCILIATION_CONFIG.timeWindowDays).toBe(60);
    expect(RECONCILIATION_CONFIG.maxCombinationSize).toBe(4);
    expect(RECONCILIATION_CONFIG.weights).toEqual({ valor: 50, texto: 35, data: 15 });
    expect(RECONCILIATION_CONFIG.thresholds).toEqual({ alta: 85, media: 60 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/types.test.ts`
Expected: FAIL — `Cannot find module './types'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/types.ts`:
```ts
import type { RazaoRow } from '@/types/accounting';

export interface RazaoRowWithIndex extends RazaoRow {
  globalIdx: number;
}

export interface ReconciliationConfig {
  valueTolerance: number;
  timeWindowDays: number;
  maxCombinationSize: number;
  weights: { valor: number; texto: number; data: number };
  thresholds: { alta: number; media: number };
}

export const RECONCILIATION_CONFIG: ReconciliationConfig = {
  valueTolerance: 0.01,
  timeWindowDays: 60,
  maxCombinationSize: 4,
  weights: { valor: 50, texto: 35, data: 15 },
  thresholds: { alta: 85, media: 60 },
};

export type ConfidenceLevel = 'ALTA' | 'MEDIA' | 'BAIXA';

export interface MatchReasons {
  valorScore: number;
  valorDetalhe: string;
  textoScore: number;
  textoDetalhe: string;
  dataScore: number;
  dataDetalhe: string;
}

export interface ReconciliationCandidate {
  id: string;
  groupA: RazaoRowWithIndex[];
  groupB: RazaoRowWithIndex[];
  score: number;
  confidence: ConfidenceLevel;
  reasons: MatchReasons;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/types.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reconciliation/types.ts src/lib/reconciliation/types.test.ts
git commit -m "feat: adiciona config e tipos do motor de conciliacao inteligente"
```

---

### Task 3: Text signals (normalize, regex, fuzzy similarity)

**Files:**
- Create: `src/lib/reconciliation/text.ts`
- Test: `src/lib/reconciliation/text.test.ts`

**Interfaces:**
- Produces: `normalizeText(text: string): string`, `extractDocumentSignals(text: string): string[]`, `levenshteinDistance(a: string, b: string): number`, `fuzzyTokenSimilarity(a: string, b: string): number`, `computeTextScore(historicoA: string, historicoB: string): { score: number; detalhe: string }` — used by `scoring.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/text.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  normalizeText, extractDocumentSignals, levenshteinDistance, fuzzyTokenSimilarity, computeTextScore,
} from './text';

describe('normalizeText', () => {
  it('remove acentos, baixa a caixa e colapsa espacos', () => {
    expect(normalizeText('  Pagamento   FORNECEDOR Ação  ')).toBe('pagamento fornecedor acao');
  });
});

describe('extractDocumentSignals', () => {
  it('extrai CNPJ formatado', () => {
    expect(extractDocumentSignals('pagamento cnpj 12.345.678/0001-99')).toContain('12345678000199');
  });

  it('extrai numero de NF/documento apos palavra-chave', () => {
    expect(extractDocumentSignals('recebimento nf 5001 cliente x')).toContain('5001');
  });

  it('retorna vazio quando nao ha sinais', () => {
    expect(extractDocumentSignals('pagamento diverso sem referencia')).toEqual([]);
  });
});

describe('levenshteinDistance', () => {
  it('retorna 0 para strings iguais', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
  });

  it('conta uma substituicao simples', () => {
    expect(levenshteinDistance('gato', 'pato')).toBe(1);
  });
});

describe('fuzzyTokenSimilarity', () => {
  it('mantem similaridade razoavel quando so a direcao da transacao muda', () => {
    const score = fuzzyTokenSimilarity('pagamento fornecedor a', 'recebimento fornecedor a');
    expect(score).toBeGreaterThan(0.4);
  });

  it('penaliza fortemente fornecedores diferentes mesmo com texto parecido', () => {
    const score = fuzzyTokenSimilarity('fornecedor abc comercio ltda', 'fornecedor xyz distribuidora sa');
    expect(score).toBeLessThan(0.3);
  });
});

describe('computeTextScore', () => {
  it('da score maximo quando ha documento em comum', () => {
    const result = computeTextScore('recebimento nf 5001 cliente x', 'parcela 1/3 nf 5001 cliente x');
    expect(result.score).toBe(1);
  });

  it('cai para a similaridade de texto quando nao ha documento em comum', () => {
    const result = computeTextScore('fornecedor abc comercio ltda', 'fornecedor xyz distribuidora sa');
    expect(result.score).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/text.test.ts`
Expected: FAIL — `Cannot find module './text'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/text.ts`:
```ts
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const DOCUMENT_PATTERNS = [
  /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, // CNPJ
  /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, // CPF
  /(?:nf|nota|doc|documento|bol|boleto|pedido)\.?\s*n?[ºo°]?\s*(\d{4,})/gi, // documento/NF/boleto
];

export function extractDocumentSignals(text: string): string[] {
  const signals = new Set<string>();
  for (const pattern of DOCUMENT_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1] ?? match[0];
      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 4) signals.add(digits);
    }
  }
  return [...signals];
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow.push(Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      ));
    }
    prevRow = currRow;
  }
  return prevRow[b.length];
}

function textSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function tokenize(text: string): string[] {
  return text.split(' ').filter(Boolean);
}

export function fuzzyTokenSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const usedB = new Set<number>();
  let matched = 0;
  for (const tokenA of tokensA) {
    let bestIdx = -1;
    let bestScore = 0;
    tokensB.forEach((tokenB, idx) => {
      if (usedB.has(idx)) return;
      const sim = textSimilarity(tokenA, tokenB);
      if (sim > bestScore) {
        bestScore = sim;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestScore >= 0.8) {
      matched += 1;
      usedB.add(bestIdx);
    }
  }
  const unionSize = tokensA.length + tokensB.length - matched;
  return unionSize === 0 ? 1 : matched / unionSize;
}

export interface TextScoreResult {
  score: number;
  detalhe: string;
}

export function computeTextScore(historicoA: string, historicoB: string): TextScoreResult {
  const normA = normalizeText(historicoA);
  const normB = normalizeText(historicoB);

  const signalsA = extractDocumentSignals(normA);
  const signalsB = extractDocumentSignals(normB);
  const commonSignal = signalsA.find((s) => signalsB.includes(s));
  if (commonSignal) {
    return { score: 1, detalhe: `Documento/CNPJ em comum: ${commonSignal}` };
  }

  const similarity = fuzzyTokenSimilarity(normA, normB);
  return { score: similarity, detalhe: `Similaridade textual: ${Math.round(similarity * 100)}%` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/text.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reconciliation/text.ts src/lib/reconciliation/text.test.ts
git commit -m "feat: adiciona normalizacao de texto e similaridade fuzzy por token"
```

---

### Task 4: Date proximity scoring

**Files:**
- Create: `src/lib/reconciliation/date.ts`
- Test: `src/lib/reconciliation/date.test.ts`

**Interfaces:**
- Consumes: `toTime` from `./utils` (Task 1), `RazaoRowWithIndex` from `./types` (Task 2).
- Produces: `computeDateScore(dateA, dateB, timeWindowDays): { score: number; detalhe: string }`, `computeGroupDateScore(groupA, groupB, timeWindowDays): { score: number; detalhe: string }` — used by `scoring.ts` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/date.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeDateScore, computeGroupDateScore } from './date';
import type { RazaoRowWithIndex } from './types';

describe('computeDateScore', () => {
  it('score 1 quando as datas sao iguais', () => {
    const d = new Date('2026-03-01');
    expect(computeDateScore(d, d, 60).score).toBe(1);
  });

  it('score 0 quando a diferenca excede a janela', () => {
    const a = new Date('2026-01-01');
    const b = new Date('2026-06-01');
    expect(computeDateScore(a, b, 60).score).toBe(0);
  });

  it('decai linearmente dentro da janela', () => {
    const a = new Date('2026-03-01');
    const b = new Date('2026-03-31'); // 30 dias
    expect(computeDateScore(a, b, 60).score).toBeCloseTo(0.5, 1);
  });
});

describe('computeGroupDateScore', () => {
  it('usa a data mais recente de cada grupo', () => {
    const row = (data: string, globalIdx: number): RazaoRowWithIndex => ({
      conta: '1', data: new Date(data), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0, globalIdx,
    });
    const groupA = [row('2026-03-01', 0), row('2026-03-05', 1)];
    const groupB = [row('2026-03-06', 2)];
    expect(computeGroupDateScore(groupA, groupB, 60).detalhe).toContain('1 dia');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/date.test.ts`
Expected: FAIL — `Cannot find module './date'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/date.ts`:
```ts
import { toTime } from './utils';
import type { RazaoRowWithIndex } from './types';

export interface DateScoreResult {
  score: number;
  detalhe: string;
}

export function computeDateScore(dateA: Date | string, dateB: Date | string, timeWindowDays: number): DateScoreResult {
  const diffMs = Math.abs(toTime(dateA) - toTime(dateB));
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > timeWindowDays) {
    return {
      score: 0,
      detalhe: `${Math.round(diffDays)} dia(s) de diferença (fora da janela de ${timeWindowDays} dias)`,
    };
  }
  return { score: 1 - diffDays / timeWindowDays, detalhe: `${Math.round(diffDays)} dia(s) de diferença` };
}

export function computeGroupDateScore(
  groupA: RazaoRowWithIndex[],
  groupB: RazaoRowWithIndex[],
  timeWindowDays: number,
): DateScoreResult {
  const latestA = groupA.reduce((max, r) => (toTime(r.data) > toTime(max.data) ? r : max));
  const latestB = groupB.reduce((max, r) => (toTime(r.data) > toTime(max.data) ? r : max));
  return computeDateScore(latestA.data, latestB.data, timeWindowDays);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/date.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reconciliation/date.ts src/lib/reconciliation/date.test.ts
git commit -m "feat: adiciona pontuacao de proximidade de data"
```

---

### Task 5: Candidate generation (exact 1:1 and subset-sum N:1)

**Files:**
- Create: `src/lib/reconciliation/candidates.ts`
- Test: `src/lib/reconciliation/candidates.test.ts`

**Interfaces:**
- Consumes: `toTime`, `roundCents` from `./utils` (Task 1); `RazaoRowWithIndex`, `ReconciliationConfig` from `./types` (Task 2).
- Produces: `RawCandidateGroup { groupA: RazaoRowWithIndex[]; groupB: RazaoRowWithIndex[] }`, `generateExactCandidates(rows): RawCandidateGroup[]`, `generateSubsetSumCandidates(rows, alreadyMatchedIdx, config): RawCandidateGroup[]` — used by `engine.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/candidates.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { generateExactCandidates, generateSubsetSumCandidates } from './candidates';
import { RECONCILIATION_CONFIG } from './types';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('generateExactCandidates', () => {
  it('pareia debito e credito de mesmo valor absoluto', () => {
    const rows = [
      row({ globalIdx: 0, debito: 500, historico: 'Pagamento Fornecedor A' }),
      row({ globalIdx: 1, credito: 500, historico: 'Recebimento Fornecedor A' }),
    ];
    const candidates = generateExactCandidates(rows);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA[0].globalIdx).toBe(0);
    expect(candidates[0].groupB[0].globalIdx).toBe(1);
  });

  it('nao pareia quando os valores sao diferentes', () => {
    const rows = [row({ globalIdx: 0, debito: 500 }), row({ globalIdx: 1, credito: 300 })];
    expect(generateExactCandidates(rows)).toHaveLength(0);
  });
});

describe('generateSubsetSumCandidates', () => {
  it('encontra soma de 3 debitos que bate com 1 credito', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400, data: new Date('2026-03-01') }),
      row({ globalIdx: 1, debito: 400, data: new Date('2026-03-05') }),
      row({ globalIdx: 2, debito: 400, data: new Date('2026-03-09') }),
      row({ globalIdx: 3, credito: 1200, data: new Date('2026-03-10') }),
    ];
    const candidates = generateSubsetSumCandidates(rows, new Set(), RECONCILIATION_CONFIG);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].groupA.map((r) => r.globalIdx).sort()).toEqual([0, 1, 2]);
    expect(candidates[0].groupB[0].globalIdx).toBe(3);
  });

  it('ignora combinacoes fora da janela de tempo', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400, data: new Date('2026-01-01') }),
      row({ globalIdx: 1, debito: 400, data: new Date('2026-01-05') }),
      row({ globalIdx: 2, debito: 400, data: new Date('2026-01-09') }),
      row({ globalIdx: 3, credito: 1200, data: new Date('2026-12-01') }),
    ];
    expect(generateSubsetSumCandidates(rows, new Set(), RECONCILIATION_CONFIG)).toHaveLength(0);
  });

  it('respeita indices ja pareados', () => {
    const rows = [
      row({ globalIdx: 0, debito: 400 }),
      row({ globalIdx: 1, debito: 400 }),
      row({ globalIdx: 2, credito: 400 }),
    ];
    expect(generateSubsetSumCandidates(rows, new Set([0]), RECONCILIATION_CONFIG)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/candidates.test.ts`
Expected: FAIL — `Cannot find module './candidates'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/candidates.ts`:
```ts
import type { RazaoRowWithIndex, ReconciliationConfig } from './types';
import { toTime, roundCents } from './utils';

export interface RawCandidateGroup {
  groupA: RazaoRowWithIndex[];
  groupB: RazaoRowWithIndex[];
}

export function generateExactCandidates(rows: RazaoRowWithIndex[]): RawCandidateGroup[] {
  const debitos = rows.filter((r) => r.debito > 0).sort((a, b) => toTime(a.data) - toTime(b.data));
  const creditos = rows.filter((r) => r.credito > 0).sort((a, b) => toTime(a.data) - toTime(b.data));

  const debitosByValue = new Map<number, RazaoRowWithIndex[]>();
  for (const row of debitos) {
    const key = roundCents(row.debito);
    const list = debitosByValue.get(key) ?? [];
    list.push(row);
    debitosByValue.set(key, list);
  }

  const candidates: RawCandidateGroup[] = [];
  for (const credito of creditos) {
    const key = roundCents(credito.credito);
    const debito = debitosByValue.get(key)?.shift();
    if (!debito) continue;
    candidates.push({ groupA: [debito], groupB: [credito] });
  }

  return candidates;
}

function valueOf(r: RazaoRowWithIndex): number {
  return r.debito > 0 ? r.debito : r.credito;
}

function findSubsetSum(
  pool: RazaoRowWithIndex[],
  target: number,
  tolerance: number,
  maxSize: number,
): RazaoRowWithIndex[] | null {
  const sorted = [...pool].sort((a, b) => valueOf(b) - valueOf(a));

  function search(startIdx: number, remaining: number, picked: RazaoRowWithIndex[]): RazaoRowWithIndex[] | null {
    if (Math.abs(remaining) <= tolerance && picked.length >= 2) return picked;
    if (picked.length >= maxSize) return null;
    for (let i = startIdx; i < sorted.length; i++) {
      const value = valueOf(sorted[i]);
      if (value - remaining > tolerance) continue; // maior que o restante: pula (lista ordenada desc)
      const result = search(i + 1, remaining - value, [...picked, sorted[i]]);
      if (result) return result;
    }
    return null;
  }

  return search(0, target, []);
}

export function generateSubsetSumCandidates(
  rows: RazaoRowWithIndex[],
  alreadyMatchedIdx: Set<number>,
  config: ReconciliationConfig,
): RawCandidateGroup[] {
  const debitos = rows.filter((r) => r.debito > 0 && !alreadyMatchedIdx.has(r.globalIdx));
  const creditos = rows.filter((r) => r.credito > 0 && !alreadyMatchedIdx.has(r.globalIdx));

  const candidates: RawCandidateGroup[] = [];
  const usedIdx = new Set<number>();
  const withinWindow = (a: RazaoRowWithIndex, b: RazaoRowWithIndex) =>
    Math.abs(toTime(a.data) - toTime(b.data)) <= config.timeWindowDays * 86400000;

  for (const target of creditos) {
    if (usedIdx.has(target.globalIdx)) continue;
    const pool = debitos.filter((d) => !usedIdx.has(d.globalIdx) && withinWindow(d, target));
    const combo = findSubsetSum(pool, target.credito, config.valueTolerance, config.maxCombinationSize);
    if (combo) {
      combo.forEach((r) => usedIdx.add(r.globalIdx));
      usedIdx.add(target.globalIdx);
      candidates.push({ groupA: combo, groupB: [target] });
    }
  }

  for (const target of debitos) {
    if (usedIdx.has(target.globalIdx)) continue;
    const pool = creditos.filter((c) => !usedIdx.has(c.globalIdx) && withinWindow(c, target));
    const combo = findSubsetSum(pool, target.debito, config.valueTolerance, config.maxCombinationSize);
    if (combo) {
      combo.forEach((r) => usedIdx.add(r.globalIdx));
      usedIdx.add(target.globalIdx);
      candidates.push({ groupA: [target], groupB: combo });
    }
  }

  return candidates;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/candidates.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reconciliation/candidates.ts src/lib/reconciliation/candidates.test.ts
git commit -m "feat: adiciona geracao de candidatos exatos e por soma de subconjunto"
```

---

### Task 6: Score combination and confidence classification

**Files:**
- Create: `src/lib/reconciliation/scoring.ts`
- Test: `src/lib/reconciliation/scoring.test.ts`

**Interfaces:**
- Consumes: `computeTextScore` from `./text` (Task 3); `computeGroupDateScore` from `./date` (Task 4); `RawCandidateGroup` from `./candidates` (Task 5); `RazaoRowWithIndex`, `ReconciliationConfig`, `ConfidenceLevel`, `MatchReasons`, `ReconciliationCandidate` from `./types` (Task 2).
- Produces: `classify(score, config): ConfidenceLevel`, `scoreCandidate(raw, config): ReconciliationCandidate` — used by `engine.ts` (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/scoring.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scoreCandidate, classify } from './scoring';
import { RECONCILIATION_CONFIG } from './types';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('classify', () => {
  it('classifica os limiares configurados', () => {
    expect(classify(90, RECONCILIATION_CONFIG)).toBe('ALTA');
    expect(classify(70, RECONCILIATION_CONFIG)).toBe('MEDIA');
    expect(classify(40, RECONCILIATION_CONFIG)).toBe('BAIXA');
  });
});

describe('scoreCandidate', () => {
  it('par exato 1:1 com mesmo documento referenciado recebe confianca ALTA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Pagamento Fornecedor A NF 1234' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-03-02'), historico: 'Recebimento Fornecedor A NF 1234' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).toBe('ALTA');
  });

  it('falso positivo de valor com fornecedores diferentes nunca fica ALTA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Fornecedor ABC Comercio Ltda' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-03-01'), historico: 'Fornecedor XYZ Distribuidora SA' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).not.toBe('ALTA');
  });

  it('lancamentos sem relacao de texto e com data distante ficam BAIXA', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 0, debito: 500, data: new Date('2026-01-01'), historico: 'Pagamento Aluguel Sala 302' })],
      groupB: [row({ globalIdx: 1, credito: 500, data: new Date('2026-12-01'), historico: 'Recebimento Juros Aplicacao CDB' })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.confidence).toBe('BAIXA');
  });

  it('produz um id estavel a partir dos indices globais ordenados', () => {
    const candidate = scoreCandidate({
      groupA: [row({ globalIdx: 5, debito: 100 })],
      groupB: [row({ globalIdx: 2, credito: 100 })],
    }, RECONCILIATION_CONFIG);
    expect(candidate.id).toBe('2-5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/scoring.test.ts`
Expected: FAIL — `Cannot find module './scoring'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/scoring.ts`:
```ts
import type {
  RazaoRowWithIndex, ReconciliationConfig, ConfidenceLevel, MatchReasons, ReconciliationCandidate,
} from './types';
import { computeTextScore } from './text';
import { computeGroupDateScore } from './date';
import type { RawCandidateGroup } from './candidates';

function computeGroupTextScore(groupA: RazaoRowWithIndex[], groupB: RazaoRowWithIndex[]) {
  let best = { score: 0, detalhe: 'Nenhuma similaridade textual relevante' };
  for (const a of groupA) {
    for (const b of groupB) {
      const result = computeTextScore(a.historico, b.historico);
      if (result.score > best.score) best = result;
    }
  }
  return best;
}

function computeValueScore(groupA: RazaoRowWithIndex[], groupB: RazaoRowWithIndex[]) {
  const totalItems = groupA.length + groupB.length;
  if (totalItems === 2) {
    return { score: 1, detalhe: 'Valor exato 1:1' };
  }
  const score = Math.max(0.5, 1 - (totalItems - 2) * 0.1);
  return { score, detalhe: `Soma de ${totalItems} lançamento(s) bate dentro da tolerância configurada` };
}

export function classify(score: number, config: ReconciliationConfig): ConfidenceLevel {
  if (score >= config.thresholds.alta) return 'ALTA';
  if (score >= config.thresholds.media) return 'MEDIA';
  return 'BAIXA';
}

export function scoreCandidate(raw: RawCandidateGroup, config: ReconciliationConfig): ReconciliationCandidate {
  const valor = computeValueScore(raw.groupA, raw.groupB);
  const texto = computeGroupTextScore(raw.groupA, raw.groupB);
  const data = computeGroupDateScore(raw.groupA, raw.groupB, config.timeWindowDays);

  const rawScore =
    valor.score * config.weights.valor +
    texto.score * config.weights.texto +
    data.score * config.weights.data;
  const score = Math.round(rawScore);

  const reasons: MatchReasons = {
    valorScore: valor.score, valorDetalhe: valor.detalhe,
    textoScore: texto.score, textoDetalhe: texto.detalhe,
    dataScore: data.score, dataDetalhe: data.detalhe,
  };

  const allIdx = [...raw.groupA, ...raw.groupB].map((r) => r.globalIdx).sort((a, b) => a - b);

  return {
    id: allIdx.join('-'),
    groupA: raw.groupA,
    groupB: raw.groupB,
    score,
    confidence: classify(score, config),
    reasons,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/scoring.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/reconciliation/scoring.ts src/lib/reconciliation/scoring.test.ts
git commit -m "feat: adiciona combinacao de score e classificacao de confianca"
```

---

### Task 7: Orchestrator (`generateCandidates`) + full spec scenarios

**Files:**
- Create: `src/lib/reconciliation/engine.ts`
- Test: `src/lib/reconciliation/engine.test.ts`

**Interfaces:**
- Consumes: `generateExactCandidates`, `generateSubsetSumCandidates` from `./candidates` (Task 5); `scoreCandidate` from `./scoring` (Task 6); `RECONCILIATION_CONFIG`, `ReconciliationCandidate`, `ReconciliationConfig`, `RazaoRowWithIndex` from `./types` (Task 2).
- Produces: `generateCandidates(rows: RazaoRowWithIndex[], config?: ReconciliationConfig): ReconciliationCandidate[]` — the single entry point `Status.tsx` will call (Task 11).

- [ ] **Step 1: Write the failing test**

Create `src/lib/reconciliation/engine.test.ts` — this covers the 4 scenarios required by the spec (par exato, soma N:1, falso positivo descartado pelo texto, baixa confiança):
```ts
import { describe, it, expect } from 'vitest';
import { generateCandidates } from './engine';
import type { RazaoRowWithIndex } from './types';

function row(overrides: Partial<RazaoRowWithIndex> & { globalIdx: number }): RazaoRowWithIndex {
  return {
    conta: '1', data: new Date('2026-03-01'), lote: '1', historico: '', debito: 0, credito: 0, saldoExercicio: 0,
    ...overrides,
  };
}

describe('generateCandidates', () => {
  const rows: RazaoRowWithIndex[] = [
    // Caso 1: par exato 1:1, mesmo documento referenciado -> ALTA
    row({ globalIdx: 0, debito: 500, data: new Date('2026-03-01'), historico: 'Pagamento Fornecedor A NF 1234' }),
    row({ globalIdx: 1, credito: 500, data: new Date('2026-03-02'), historico: 'Recebimento Fornecedor A NF 1234' }),

    // Caso 2: soma N:1 -- 3 parcelas de 400 fecham com 1 recebimento de 1200
    row({ globalIdx: 2, debito: 400, data: new Date('2026-03-01'), historico: 'Parcela 1/3 NF 5001' }),
    row({ globalIdx: 3, debito: 400, data: new Date('2026-03-05'), historico: 'Parcela 2/3 NF 5001' }),
    row({ globalIdx: 4, debito: 400, data: new Date('2026-03-09'), historico: 'Parcela 3/3 NF 5001' }),
    row({ globalIdx: 5, credito: 1200, data: new Date('2026-03-10'), historico: 'Recebimento NF 5001' }),

    // Caso 3: falso positivo de valor -- mesmo valor, fornecedores diferentes
    row({ globalIdx: 6, debito: 700, data: new Date('2026-04-01'), historico: 'Fornecedor ABC Comercio Ltda' }),
    row({ globalIdx: 7, credito: 700, data: new Date('2026-04-01'), historico: 'Fornecedor XYZ Distribuidora SA' }),

    // Caso 4: baixa confianca -- sem relacao de texto e data muito distante
    row({ globalIdx: 8, debito: 900, data: new Date('2026-01-01'), historico: 'Pagamento Aluguel Sala 302' }),
    row({ globalIdx: 9, credito: 900, data: new Date('2026-12-01'), historico: 'Recebimento Juros Aplicacao CDB' }),
  ];

  const candidates = generateCandidates(rows);

  it('encontra o par exato 1:1 com confianca ALTA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 0 && c.groupB[0]?.globalIdx === 1);
    expect(found?.confidence).toBe('ALTA');
  });

  it('encontra a soma N:1 das 3 parcelas', () => {
    const found = candidates.find((c) => c.groupB[0]?.globalIdx === 5);
    expect(found?.groupA.map((r) => r.globalIdx).sort()).toEqual([2, 3, 4]);
  });

  it('nao classifica o falso positivo de valor como ALTA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 6 && c.groupB[0]?.globalIdx === 7);
    expect(found?.confidence).not.toBe('ALTA');
  });

  it('classifica o caso sem relacao como BAIXA', () => {
    const found = candidates.find((c) => c.groupA[0]?.globalIdx === 8 && c.groupB[0]?.globalIdx === 9);
    expect(found?.confidence).toBe('BAIXA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/reconciliation/engine.test.ts`
Expected: FAIL — `Cannot find module './engine'`

- [ ] **Step 3: Implement**

Create `src/lib/reconciliation/engine.ts`:
```ts
import { RECONCILIATION_CONFIG } from './types';
import type { ReconciliationCandidate, ReconciliationConfig, RazaoRowWithIndex } from './types';
import { generateExactCandidates, generateSubsetSumCandidates } from './candidates';
import { scoreCandidate } from './scoring';

export function generateCandidates(
  rows: RazaoRowWithIndex[],
  config: ReconciliationConfig = RECONCILIATION_CONFIG,
): ReconciliationCandidate[] {
  const exactRaw = generateExactCandidates(rows);
  const matchedIdx = new Set(exactRaw.flatMap((c) => [...c.groupA, ...c.groupB].map((r) => r.globalIdx)));
  const subsetRaw = generateSubsetSumCandidates(rows, matchedIdx, config);

  return [...exactRaw, ...subsetRaw]
    .map((raw) => scoreCandidate(raw, config))
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/reconciliation/engine.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS — all tests from Tasks 1–7 green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reconciliation/engine.ts src/lib/reconciliation/engine.test.ts
git commit -m "feat: adiciona orquestrador do motor de conciliacao inteligente"
```

---

### Task 8: Supabase migration + audit type

**Files:**
- Create: `supabase/migrations/003_conciliacao_auditoria.sql`
- Modify: `src/lib/supabase.ts`

**Interfaces:**
- Produces: table `public.conciliacoes_auditoria`; `DbConciliacaoAuditoria` type — used by `supabase.service.ts` (Task 9).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_conciliacao_auditoria.sql`:
```sql
-- ============================================================
-- ConciliaçãoPRO — Auditoria de Conciliação Inteligente
-- Execute este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

create table if not exists public.conciliacoes_auditoria (
  id            uuid        primary key default gen_random_uuid(),
  tenant_id     uuid        not null references public.tenants(id) on delete cascade,
  empresa_id    uuid        not null references public.empresas(id) on delete cascade,
  conta_numero  text        not null,
  razao_indices jsonb       not null,
  score         integer     not null,
  criterios     jsonb       not null,
  usuario_id    uuid        references public.profiles(id) on delete set null,
  criado_em     timestamptz not null default now()
);

alter table public.conciliacoes_auditoria enable row level security;

create policy "conciliacoes_auditoria_all" on public.conciliacoes_auditoria
  for all using (tenant_id = my_tenant_id());
```

- [ ] **Step 2: Add the TypeScript type**

In `src/lib/supabase.ts`, after `DbConvite`, add:
```ts
export interface DbConciliacaoAuditoria {
  id: string;
  tenant_id: string;
  empresa_id: string;
  conta_numero: string;
  razao_indices: number[];
  score: number;
  criterios: Record<string, unknown>;
  usuario_id: string | null;
  criado_em: string;
}
```

- [ ] **Step 3: Verify the build still compiles**

Run: `npm run build`
Expected: build succeeds (no test needed — this task only adds a type and a SQL file, nothing executes it yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_conciliacao_auditoria.sql src/lib/supabase.ts
git commit -m "feat: adiciona tabela e tipo de auditoria de conciliacao"
```

- [ ] **Step 5: Tell the user to apply the migration**

Remind the user (do not run it for them — it's their Supabase project): "Execute o conteúdo de `supabase/migrations/003_conciliacao_auditoria.sql` no SQL Editor do seu projeto Supabase antes de testar a auditoria em produção."

---

### Task 9: Supabase service function for audit insert

**Files:**
- Modify: `src/services/supabase.service.ts`

**Interfaces:**
- Consumes: `DbConciliacaoAuditoria` from `@/lib/supabase` (Task 8).
- Produces: `insertConciliacaoAuditoria(params): Promise<void>` — used by the accounting store (Task 10).

- [ ] **Step 1: Implement**

At the end of `src/services/supabase.service.ts`, add:
```ts
// ── Auditoria de Conciliação Inteligente ──────────────────────────────────────

export async function insertConciliacaoAuditoria(params: {
  tenantId: string;
  empresaId: string;
  contaNumero: string;
  razaoIndices: number[];
  score: number;
  criterios: Record<string, unknown>;
  usuarioId: string;
}) {
  const { error } = await supabase.from('conciliacoes_auditoria').insert({
    tenant_id: params.tenantId,
    empresa_id: params.empresaId,
    conta_numero: params.contaNumero,
    razao_indices: params.razaoIndices,
    score: params.score,
    criterios: params.criterios,
    usuario_id: params.usuarioId,
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/services/supabase.service.ts
git commit -m "feat: adiciona insercao de auditoria de conciliacao no supabase"
```

---

### Task 10: Store action `logConciliacaoAuditoria`

**Files:**
- Modify: `src/store/accounting.ts`

**Interfaces:**
- Consumes: `insertConciliacaoAuditoria` from `@/services/supabase.service` (Task 9); reads `tenantId`, `selectedEmpresaId`, `currentUser` already in the store.
- Produces: `logConciliacaoAuditoria(params: { contaNumero: string; razaoIndices: number[]; score: number; criterios: Record<string, unknown> }): Promise<void>` — used by `Status.tsx` (Task 12).

- [ ] **Step 1: Add to the `AccountingState` interface**

In `src/store/accounting.ts`, in the interface `AccountingState`, right after `unreconcileRazaoTransactions`, add:
```ts
  logConciliacaoAuditoria: (params: {
    contaNumero: string;
    razaoIndices: number[];
    score: number;
    criterios: Record<string, unknown>;
  }) => Promise<void>;
```

- [ ] **Step 2: Implement the action**

In the store body, right after `unreconcileRazaoTransactions: (indices) => ...`, add:
```ts
      logConciliacaoAuditoria: async ({ contaNumero, razaoIndices, score, criterios }) => {
        const { tenantId, selectedEmpresaId, currentUser } = get();
        if (!tenantId || !selectedEmpresaId || !currentUser) return;
        try {
          await svc.insertConciliacaoAuditoria({
            tenantId, empresaId: selectedEmpresaId, contaNumero, razaoIndices, score, criterios,
            usuarioId: currentUser.id,
          });
        } catch (error) {
          console.error(error);
        }
      },
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/store/accounting.ts
git commit -m "feat: adiciona acao de log de auditoria de conciliacao na store"
```

---

### Task 11: "Sugerir conciliação" button and candidate state in Status.tsx

**Files:**
- Modify: `src/pages/Status.tsx`

**Interfaces:**
- Consumes: `generateCandidates` from `@/lib/reconciliation/engine` (Task 7); `ReconciliationCandidate` from `@/lib/reconciliation/types` (Task 2).
- Produces: local state `candidates`, `showSuggestions`, `approvedIds` and handler `handleSuggestReconciliation` — consumed by the review dialog (Task 12).

- [ ] **Step 1: Add imports**

In `src/pages/Status.tsx`, add to the icon import from `lucide-react`: `Sparkles`. Add two new imports after the `xlsx` import:
```ts
import { generateCandidates } from '@/lib/reconciliation/engine';
import type { ReconciliationCandidate } from '@/lib/reconciliation/types';
```

- [ ] **Step 2: Add state**

Right after the existing `const [editEntry, setEditEntry] = useState(...)` line (around line 44), add:
```ts
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add the handler**

Right after `handleUnreconcileSelected` (around line 109), add:
```ts
  const handleSuggestReconciliation = useCallback(() => {
    const pendingRows = allMovsWithIdx.filter((m) => !reconciledSet.has(m.globalIdx));
    const results = generateCandidates(pendingRows).filter((c) => c.confidence !== 'BAIXA');
    setCandidates(results);
    setApprovedIds(new Set(results.filter((c) => c.confidence === 'ALTA').map((c) => c.id)));
    setShowSuggestions(true);
  }, [allMovsWithIdx, reconciledSet]);
```

- [ ] **Step 4: Reset the new state on dialog close**

In `handleDialogClose`, after `setEditingIdx(null);`, add:
```ts
      setShowSuggestions(false);
      setCandidates([]);
      setApprovedIds(new Set());
```

- [ ] **Step 5: Add the button**

In the tab bar block (`{/* Abas Pendentes / Conciliados */}`), right after the "Novo Lançamento" `<Button>` and before its closing `</div>`, add:
```tsx
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSuggestReconciliation}
                    className="border-purple-400 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                  >
                    <Sparkles className="w-4 h-4 mr-1" />
                    Sugerir conciliação
                  </Button>
```

- [ ] **Step 6: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds (the button won't open anything meaningful yet — the dialog is Task 12 — but nothing should break).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Status.tsx
git commit -m "feat: adiciona botao sugerir conciliacao ao popup de lancamentos"
```

---

### Task 12: Review dialog and apply handler

**Files:**
- Modify: `src/pages/Status.tsx`

**Interfaces:**
- Consumes: `candidates`, `showSuggestions`, `approvedIds` state and `reconcileRazaoTransactions`, `logConciliacaoAuditoria` from the store (Task 10).
- Produces: the human-approval checkpoint — no candidate is ever applied without this dialog.

- [ ] **Step 1: Destructure the new store action**

In the top-level store destructuring (line 34), add `logConciliacaoAuditoria` to the list of destructured values from `useAccountingStore()`.

- [ ] **Step 2: Add the apply handler**

Right after `handleSuggestReconciliation` (Task 11, Step 3), add:
```ts
  const handleApplySuggestions = useCallback(async () => {
    const approved = candidates.filter((c) => approvedIds.has(c.id));
    for (const candidate of approved) {
      const indices = [...candidate.groupA, ...candidate.groupB].map((r) => r.globalIdx);
      reconcileRazaoTransactions(indices);
      await logConciliacaoAuditoria({
        contaNumero: selectedConta?.numero ?? '',
        razaoIndices: indices,
        score: candidate.score,
        criterios: candidate.reasons,
      });
    }
    toast({ title: 'Conciliação aplicada', description: `${approved.length} grupo(s) conciliado(s).` });
    setShowSuggestions(false);
    setCandidates([]);
    setApprovedIds(new Set());
  }, [candidates, approvedIds, reconcileRazaoTransactions, logConciliacaoAuditoria, selectedConta, toast]);
```

- [ ] **Step 3: Add the dialog**

Right after the closing `</Dialog>` of the lançamentos dialog (the one at line 704 in the current file), add:
```tsx
      {/* Dialog de sugestões de conciliação inteligente */}
      <Dialog open={showSuggestions} onOpenChange={setShowSuggestions}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sugestões de conciliação</DialogTitle>
            <DialogDescription>
              Revise os candidatos abaixo antes de aplicar. Nada é conciliado automaticamente sem sua aprovação.
            </DialogDescription>
          </DialogHeader>

          {candidates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum candidato de alta ou média confiança encontrado.</p>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => (
                <div key={c.id} className="border rounded-lg p-3 flex gap-3">
                  <Checkbox
                    checked={approvedIds.has(c.id)}
                    onCheckedChange={(checked) => {
                      setApprovedIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(c.id); else next.delete(c.id);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 space-y-1">
                    <Badge variant={c.confidence === 'ALTA' ? 'default' : 'secondary'}>
                      {c.confidence} · {c.score}
                    </Badge>
                    {[...c.groupA, ...c.groupB].map((r) => (
                      <div key={r.globalIdx} className="text-xs font-mono flex gap-2">
                        <span>{(r.data instanceof Date ? r.data : new Date(r.data)).toLocaleDateString('pt-BR')}</span>
                        <span className="flex-1 truncate">{r.historico}</span>
                        <span>R$ {(r.debito || r.credito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      {c.reasons.valorDetalhe} · {c.reasons.textoDetalhe} · {c.reasons.dataDetalhe}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setShowSuggestions(false)}>Cancelar</Button>
            <Button disabled={approvedIds.size === 0} onClick={handleApplySuggestions}>
              Aplicar {approvedIds.size} selecionado(s)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Status.tsx
git commit -m "feat: adiciona painel de revisao e aplicacao de sugestoes de conciliacao"
```

---

### Task 13: Manual verification and final commit

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests from Tasks 1–7 pass.

- [ ] **Step 2: Run the dev server**

Run: `npm run dev`

- [ ] **Step 3: Exercise the feature manually**

In the browser: import a balancete + razão with some pending lançamentos containing a few obvious pairs (same value, opposite signs, similar description) and at least one 3-installment sum. Open the 👁 popup for that account, click "Sugerir conciliação", confirm:
- Candidates show with score and justification.
- ALTA candidates are pre-checked, MEDIA are not.
- Unchecking/checking works.
- Clicking "Aplicar" only reconciles the approved ones, leaves everything else pending, and the manual checkbox flow still works exactly as before.

- [ ] **Step 4: Confirm nothing else regressed**

Manually re-test the pre-existing manual flow (checkbox selection → "Conciliado" button) and the "Novo Lançamento" flow once, to confirm they are unaffected.

- [ ] **Step 5: Report back to the user**

Summarize what was verified before considering the feature done — do not mark this complete without actually running the dev server and clicking through the flow.
