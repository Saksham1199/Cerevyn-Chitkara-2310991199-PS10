export type Mode = 'practice' | 'scored';
export type Phase = 'idle' | 'running' | 'paused' | 'finished';
export type Outcome = 'hit' | 'miss' | 'false_alarm' | 'correct_withhold';

export interface Trial {
  index: number;
  isTarget: boolean;
  symbol: string;
}

export interface SessionConfig {
  mode: Mode;
  /** Seed for the reproducible trial sequence. */
  seed: number;
  trialCount: number;
  /** Fraction of trials that are targets (0..1). */
  targetFrequency: number;
  /** How long the symbol stays visible after onset (ms). */
  stimulusMs: number;
  /** Scoring window, measured from symbol onset (ms). */
  responseWindowMs: number;
  /** Blank gap between the end of one window and the next onset (ms). */
  interTrialMs: number;
  /** Delay before the first symbol (ms). */
  leadInMs: number;
}

export interface TrialResult {
  index: number;
  isTarget: boolean;
  symbol: string;
  outcome: Outcome;
  /** Reaction time in ms; only set for scored responses (hit / false alarm). */
  rtMs: number | null;
}

export type IgnoreReason =
  | 'not-running'
  | 'repeat'
  | 'outside-window'
  | 'already-responded'
  | 'stale-session';

export type ResponseResult =
  | { accepted: true; trialIndex: number; outcome: 'hit' | 'false_alarm'; rtMs: number }
  | { accepted: false; reason: IgnoreReason };

export interface Feedback {
  seq: number;
  trialIndex: number;
  outcome: Outcome;
  rtMs: number | null;
}

export interface Snapshot {
  phase: Phase;
  /** Active (un-paused) time since the session started, in ms. */
  activeMs: number;
  trialIndex: number;
  total: number;
  completed: number;
  /** The symbol currently on screen, or null when blank / paused. */
  stimulus: Trial | null;
  feedback: Feedback | null;
}

export interface Summary {
  trialCount: number;
  targetCount: number;
  nonTargetCount: number;
  hits: number;
  misses: number;
  falseAlarms: number;
  correctWithholds: number;
  /** hits / targets, in percent (1 decimal); null if the sequence had no targets. */
  targetAccuracyPct: number | null;
  /** (hits + correct withholds) / trials, in percent (1 decimal). */
  overallAccuracyPct: number;
  /** Median reaction time of correct target responses (hits only); null if none. */
  medianRtMs: number | null;
  meanRtMs: number | null;
}
