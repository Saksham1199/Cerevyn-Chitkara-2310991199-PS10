import type { Summary, TrialResult } from './types';

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Turn per-trial results into the session summary shown to the player. */
export function summarise(results: TrialResult[]): Summary {
  const hits = results.filter((r) => r.outcome === 'hit');
  const misses = results.filter((r) => r.outcome === 'miss').length;
  const falseAlarms = results.filter((r) => r.outcome === 'false_alarm').length;
  const correctWithholds = results.filter((r) => r.outcome === 'correct_withhold').length;

  const targetCount = hits.length + misses;
  const nonTargetCount = falseAlarms + correctWithholds;
  const hitRts = hits.map((r) => r.rtMs as number);

  return {
    trialCount: results.length,
    targetCount,
    nonTargetCount,
    hits: hits.length,
    misses,
    falseAlarms,
    correctWithholds,
    targetAccuracyPct: targetCount === 0 ? null : round1((hits.length / targetCount) * 100),
    overallAccuracyPct: results.length === 0 ? 0 : round1(((hits.length + correctWithholds) / results.length) * 100),
    medianRtMs: median(hitRts),
    meanRtMs: hitRts.length === 0 ? null : round1(hitRts.reduce((s, v) => s + v, 0) / hitRts.length),
  };
}
