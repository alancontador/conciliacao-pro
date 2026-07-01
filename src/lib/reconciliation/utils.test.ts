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
