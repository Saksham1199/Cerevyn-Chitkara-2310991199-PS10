import { describe, expect, it } from 'vitest';
import { median, summarise } from '../src/engine/stats';
import type { Outcome, TrialResult } from '../src/engine/types';

const r = (index: number, outcome: Outcome, rtMs: number | null): TrialResult => ({
  index,
  isTarget: outcome === 'hit' || outcome === 'miss',
  symbol: '★',
  outcome,
  rtMs,
});

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
    expect(median([])).toBeNull();
  });

  it('does not mutate its input', () => {
    const v = [3, 1, 2];
    median(v);
    expect(v).toEqual([3, 1, 2]);
  });
});

describe('summarise', () => {
  it('counts outcomes and computes target accuracy, false alarms, misses and median RT', () => {
    const results = [
      r(0, 'hit', 300),
      r(1, 'hit', 500),
      r(2, 'hit', 400),
      r(3, 'miss', null),
      r(4, 'false_alarm', 220), // must NOT enter the median
      r(5, 'correct_withhold', null),
      r(6, 'correct_withhold', null),
    ];
    const s = summarise(results);
    expect(s).toMatchObject({
      trialCount: 7,
      targetCount: 4,
      nonTargetCount: 3,
      hits: 3,
      misses: 1,
      falseAlarms: 1,
      correctWithholds: 2,
      targetAccuracyPct: 75,
      medianRtMs: 400,
      meanRtMs: 400,
    });
    expect(s.overallAccuracyPct).toBe(71.4); // (3 + 2) / 7
  });

  it('returns null RT / accuracy when there is nothing to average', () => {
    const s = summarise([r(0, 'miss', null), r(1, 'correct_withhold', null)]);
    expect(s.medianRtMs).toBeNull();
    expect(s.meanRtMs).toBeNull();
    expect(s.targetAccuracyPct).toBe(0);

    const none = summarise([r(0, 'correct_withhold', null)]);
    expect(none.targetAccuracyPct).toBeNull();
  });
});
