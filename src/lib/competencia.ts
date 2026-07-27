// Helpers de competência. Formato interno: 'AAAA-MM'. Exibição: 'MM/AAAA'.

const RE = /^\d{4}-\d{2}$/;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Competência do mês corrente (ou de uma data), no formato 'AAAA-MM'. */
export function currentCompetencia(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'AAAA-MM' -> 'MM/AAAA' (para exibição compacta). */
export function formatCompetencia(c: string | null | undefined): string {
  if (!c || !RE.test(c)) return c ?? '';
  const [y, m] = c.split('-');
  return `${m}/${y}`;
}

/** 'AAAA-MM' -> 'Julho / 2026' (para exibição por extenso). */
export function competenciaLabel(c: string | null | undefined): string {
  if (!c || !RE.test(c)) return c ?? '';
  const [y, m] = c.split('-');
  return `${MESES[Number(m) - 1]} / ${y}`;
}

/** (ano, mês 1-12) -> 'AAAA-MM'. */
export function competenciaFromParts(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function isValidCompetencia(c: string): boolean {
  return RE.test(c);
}

export { MESES as MESES_COMPETENCIA };
