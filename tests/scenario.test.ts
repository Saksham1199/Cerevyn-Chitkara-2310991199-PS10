import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Session } from '../src/engine/session';
import { generateSequence } from '../src/engine/sequence';
import { summarise } from '../src/engine/stats';
import { CFG, T0 } from './helpers';

const readJson = (name: string) =>
  JSON.parse(readFileSync(new URL(`../sample_data/${name}`, import.meta.url), 'utf8'));

describe('fixtures (sample_data/)', () => {
  it('the seeded sequence matches the committed expected sequence', () => {
    const fixture = readJson('trial_sequence_seed_20261020.json');
    const generated = generateSequence(fixture.seed, fixture.trialCount, fixture.targetFrequency);
    expect(generated).toEqual(fixture.trials);
    expect(fixture.targetCount).toBe(9);
  });

  it('a full scripted session produces the hand-computed expected summary', () => {
    const seq = readJson('trial_sequence_seed_20261020.json');
    const scripted = readJson('scripted_session.json');

    const session = new Session(1, { ...CFG, trialCount: seq.trialCount }, seq.trials);
    session.start(T0);

    for (const action of scripted.actions as { trialIndex: number; press: boolean; offsetMs: number }[]) {
      if (!action.press) continue;
      const t = T0 + session.onsetOf(action.trialIndex) + action.offsetMs;
      expect(session.respond(t).accepted).toBe(true);
    }
    session.tick(T0 + session.totalDurationMs + 1);

    expect(session.phase).toBe('finished');
    expect(summarise(session.getResults())).toMatchObject(scripted.expected);
  });

  it('a perfect player scores 100% target accuracy with zero false alarms', () => {
    const seq = readJson('trial_sequence_seed_20261020.json');
    const session = new Session(1, { ...CFG, trialCount: seq.trialCount }, seq.trials);
    session.start(T0);
    for (const trial of seq.trials as { index: number; isTarget: boolean }[]) {
      if (trial.isTarget) session.respond(T0 + session.onsetOf(trial.index) + 300);
    }
    session.tick(T0 + session.totalDurationMs + 1);
    const s = summarise(session.getResults());
    expect(s.targetAccuracyPct).toBe(100);
    expect(s.falseAlarms).toBe(0);
    expect(s.misses).toBe(0);
    expect(s.medianRtMs).toBe(300);
  });

  it('a player who never responds misses every target and withholds correctly on all others', () => {
    const seq = readJson('trial_sequence_seed_20261020.json');
    const session = new Session(1, { ...CFG, trialCount: seq.trialCount }, seq.trials);
    session.start(T0);
    session.tick(T0 + session.totalDurationMs + 1);
    const s = summarise(session.getResults());
    expect(s).toMatchObject({ hits: 0, misses: 9, falseAlarms: 0, correctWithholds: 21, targetAccuracyPct: 0 });
    expect(s.medianRtMs).toBeNull();
  });
});
