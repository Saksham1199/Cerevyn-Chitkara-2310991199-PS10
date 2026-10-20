import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/rng';
import { generateSequence, NON_TARGET_SYMBOLS, TARGET_SYMBOL } from '../src/engine/sequence';

describe('mulberry32', () => {
  it('produces the same numbers for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different numbers for different seeds and stays in [0, 1)', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toEqual(b());
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('generateSequence', () => {
  it('creates 30 trials with exactly 9 targets at 30% frequency', () => {
    const seq = generateSequence(20261020, 30, 0.3);
    expect(seq).toHaveLength(30);
    expect(seq.filter((t) => t.isTarget)).toHaveLength(9);
    seq.forEach((t, i) => expect(t.index).toBe(i));
  });

  it('is reproducible: same seed => identical sequence, different seed => different order', () => {
    expect(generateSequence(5, 30, 0.3)).toEqual(generateSequence(5, 30, 0.3));
    expect(generateSequence(5, 30, 0.3)).not.toEqual(generateSequence(6, 30, 0.3));
  });

  it('uses the target symbol only for targets', () => {
    for (const t of generateSequence(11, 30, 0.3)) {
      if (t.isTarget) expect(t.symbol).toBe(TARGET_SYMBOL);
      else expect(NON_TARGET_SYMBOLS as readonly string[]).toContain(t.symbol);
    }
  });

  it('rejects invalid input', () => {
    expect(() => generateSequence(1, 0, 0.3)).toThrow(RangeError);
    expect(() => generateSequence(1, 2.5, 0.3)).toThrow(RangeError);
    expect(() => generateSequence(1, 10, 1.5)).toThrow(RangeError);
  });
});
