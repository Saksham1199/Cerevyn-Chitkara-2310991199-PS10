import { mulberry32 } from './rng';
import type { Trial } from './types';

/** The one symbol the player must respond to. */
export const TARGET_SYMBOL = '★';
/** Symbols the player must NOT respond to. Different shapes, so no reliance on colour alone. */
export const NON_TARGET_SYMBOLS = ['■', '●', '▲'] as const;

/**
 * Build a reproducible trial sequence.
 * The number of targets is exactly round(trialCount * targetFrequency); their positions
 * are shuffled with a seeded Fisher-Yates shuffle.
 */
export function generateSequence(seed: number, trialCount: number, targetFrequency: number): Trial[] {
  if (!Number.isInteger(trialCount) || trialCount <= 0) {
    throw new RangeError('trialCount must be a positive integer');
  }
  if (!(targetFrequency >= 0 && targetFrequency <= 1)) {
    throw new RangeError('targetFrequency must be between 0 and 1');
  }

  const rand = mulberry32(seed);
  const targetCount = Math.round(trialCount * targetFrequency);
  const flags = Array.from({ length: trialCount }, (_, i) => i < targetCount);

  for (let i = flags.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [flags[i], flags[j]] = [flags[j], flags[i]];
  }

  return flags.map((isTarget, index) => ({
    index,
    isTarget,
    symbol: isTarget ? TARGET_SYMBOL : NON_TARGET_SYMBOLS[Math.floor(rand() * NON_TARGET_SYMBOLS.length)],
  }));
}
