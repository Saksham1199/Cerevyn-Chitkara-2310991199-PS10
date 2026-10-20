import { Session } from '../src/engine/session';
import type { SessionConfig, Trial } from '../src/engine/types';

/** Timings used in tests (same as the real game): period = 1000 + 700 = 1700 ms. */
export const CFG: SessionConfig = {
  mode: 'scored',
  seed: 1,
  trialCount: 3,
  targetFrequency: 0.5,
  stimulusMs: 600,
  responseWindowMs: 1000,
  interTrialMs: 700,
  leadInMs: 1000,
};

/** Wall-clock time at which test sessions are started. */
export const T0 = 5000;

export const target = (index: number): Trial => ({ index, isTarget: true, symbol: '★' });
export const nonTarget = (index: number): Trial => ({ index, isTarget: false, symbol: '■' });

/** Build a running session with an explicit trial list. */
export function makeSession(trials: Trial[], id = 1): Session {
  const session = new Session(id, { ...CFG, trialCount: trials.length }, trials);
  session.start(T0);
  return session;
}
