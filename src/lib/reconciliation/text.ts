export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
