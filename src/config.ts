import type { Mode, SessionConfig } from './engine/types';

export const DEFAULT_SEED = 20261020;

const envSeed = Number(import.meta.env.VITE_SESSION_SEED);
const seed = Number.isInteger(envSeed) && envSeed > 0 ? envSeed : DEFAULT_SEED;

/** Timings shared by both rounds. Documented in the README. */
const TIMING = {
  stimulusMs: 600, // symbol visible for 600 ms
  responseWindowMs: 1000, // scoring window: 0-1000 ms after onset
  interTrialMs: 700, // blank gap before the next symbol
  leadInMs: 1000, // 1 s of fixation before the first symbol
} as const;

/** Scored session: 30 trials, 30% targets (= exactly 9 targets). */
export const SCORED_CONFIG: SessionConfig = {
  mode: 'scored',
  seed,
  trialCount: 30,
  targetFrequency: 0.3,
  ...TIMING,
};

/** Practice round: 8 trials, 3 targets, feedback shown after each trial. Never saved. */
export const PRACTICE_CONFIG: SessionConfig = {
  mode: 'practice',
  seed: 7,
  trialCount: 8,
  targetFrequency: 0.375,
  ...TIMING,
};

export const configFor = (mode: Mode): SessionConfig => (mode === 'practice' ? PRACTICE_CONFIG : SCORED_CONFIG);
