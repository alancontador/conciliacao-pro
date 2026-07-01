export function toTime(date: Date | string): number {
  return (date instanceof Date ? date : new Date(date)).getTime();
}

export function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}
