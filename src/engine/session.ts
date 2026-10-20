import { generateSequence } from './sequence';
import type {
  Feedback,
  IgnoreReason,
  Outcome,
  Phase,
  ResponseResult,
  SessionConfig,
  Snapshot,
  Trial,
  TrialResult,
} from './types';

const ignored = (reason: IgnoreReason): ResponseResult => ({ accepted: false, reason });

/**
 * One play-through of a trial sequence (practice or scored).
 *
 * Design notes (this is the part reviewers care about):
 *  - The engine owns NO timers. Callers pass in a timestamp (performance.now() or an event's
 *    timeStamp) with every call. That makes it deterministic and testable without a browser.
 *  - Everything is measured on an "active clock" that only advances while the session is running.
 *    Pausing freezes that clock, so paused time can never leak into a reaction time and a trial's
 *    response window cannot expire while paused.
 *  - Reaction time = active time at response - scheduled symbol onset.
 *  - Each trial accepts at most ONE scored response; repeated key events are ignored.
 *  - Timestamps are forced to be monotonic (a slightly older event time is clamped).
 *
 * Trial timeline on the active clock (period = responseWindowMs + interTrialMs):
 *     onset(i)     = leadInMs + i * period
 *     windowEnd(i) = onset(i) + responseWindowMs      (window is [onset, windowEnd))
 */
export class Session {
  readonly trials: Trial[];

  private _phase: Phase = 'idle';
  private accumulatedMs = 0;
  private runningSince: number | null = null;
  private lastT = Number.NEGATIVE_INFINITY;
  private readonly results: (TrialResult | null)[];
  private feedback: Feedback | null = null;
  private feedbackSeq = 0;

  constructor(
    readonly id: number,
    readonly config: SessionConfig,
    trials?: Trial[],
  ) {
    this.trials = trials ?? generateSequence(config.seed, config.trialCount, config.targetFrequency);
    this.results = this.trials.map(() => null);
  }

  get phase(): Phase {
    return this._phase;
  }

  get period(): number {
    return this.config.responseWindowMs + this.config.interTrialMs;
  }

  onsetOf(index: number): number {
    return this.config.leadInMs + index * this.period;
  }

  windowEndOf(index: number): number {
    return this.onsetOf(index) + this.config.responseWindowMs;
  }

  get totalDurationMs(): number {
    return this.windowEndOf(this.trials.length - 1);
  }

  // ---- lifecycle -------------------------------------------------------------------------

  start(t: number): boolean {
    if (this._phase !== 'idle') return false;
    this.runningSince = this.mono(t);
    this._phase = 'running';
    return true;
  }

  /** Advance the session: finalise every trial whose response window has ended. */
  tick(t: number): void {
    if (this._phase !== 'running') return;
    this.advance(this.activeAt(this.mono(t)));
  }

  pause(t: number): boolean {
    if (this._phase !== 'running') return false;
    const active = this.activeAt(this.mono(t));
    this.advance(active); // settle anything that ended before the pause
    if (this._phase !== 'running') return false; // session finished while settling
    this.accumulatedMs = active;
    this.runningSince = null;
    this._phase = 'paused';
    return true;
  }

  resume(t: number): boolean {
    if (this._phase !== 'paused') return false;
    this.runningSince = this.mono(t);
    this._phase = 'running';
    return true;
  }

  // ---- responses -------------------------------------------------------------------------

  /**
   * Register a player response (key press or tap) at timestamp `t`.
   * `repeat` is true for auto-repeated key events while a key is held down.
   */
  respond(t: number, opts: { repeat?: boolean } = {}): ResponseResult {
    if (this._phase !== 'running') return ignored('not-running');
    if (opts.repeat) return ignored('repeat');

    const active = this.activeAt(this.mono(t));
    this.advance(active);
    if (this._phase !== 'running') return ignored('not-running');

    const index = this.windowIndexAt(active);
    if (index < 0) return ignored('outside-window');
    if (this.results[index] !== null) return ignored('already-responded');

    const rtMs = active - this.onsetOf(index);
    const outcome: 'hit' | 'false_alarm' = this.trials[index].isTarget ? 'hit' : 'false_alarm';
    this.record(index, outcome, rtMs);
    this.checkFinished(active);
    return { accepted: true, trialIndex: index, outcome, rtMs };
  }

  // ---- read-only views -------------------------------------------------------------------

  getResults(): TrialResult[] {
    return this.results.filter((r): r is TrialResult => r !== null);
  }

  snapshot(t: number): Snapshot {
    const active =
      this._phase === 'running' ? this.activeAt(Math.max(t, this.lastT)) : this.accumulatedMs;
    const last = this.trials.length - 1;

    let trialIndex = -1;
    let stimulus: Trial | null = null;

    if (active >= this.config.leadInMs) {
      trialIndex = Math.min(Math.floor((active - this.config.leadInMs) / this.period), last);
    }
    if (this._phase === 'running' && trialIndex >= 0 && this.results[trialIndex] === null) {
      const sinceOnset = active - this.onsetOf(trialIndex);
      if (sinceOnset >= 0 && sinceOnset < this.config.stimulusMs) stimulus = this.trials[trialIndex];
    }

    return {
      phase: this._phase,
      activeMs: active,
      trialIndex,
      total: this.trials.length,
      completed: this.results.filter((r) => r !== null).length,
      stimulus,
      feedback: this.feedback,
    };
  }

  // ---- internals -------------------------------------------------------------------------

  private mono(t: number): number {
    this.lastT = Math.max(t, this.lastT);
    return this.lastT;
  }

  private activeAt(t: number): number {
    if (this._phase === 'running' && this.runningSince !== null) {
      return this.accumulatedMs + (t - this.runningSince);
    }
    return this.accumulatedMs;
  }

  /** Index of the trial whose scoring window contains `active`, or -1 (gap / before start / after end). */
  private windowIndexAt(active: number): number {
    if (active < this.config.leadInMs) return -1;
    const index = Math.floor((active - this.config.leadInMs) / this.period);
    if (index >= this.trials.length) return -1;
    return active < this.windowEndOf(index) ? index : -1;
  }

  private advance(active: number): void {
    for (let i = 0; i < this.trials.length; i++) {
      if (this.results[i] !== null) continue;
      if (active < this.windowEndOf(i)) break;
      this.record(i, this.trials[i].isTarget ? 'miss' : 'correct_withhold', null);
    }
    this.checkFinished(active);
  }

  private checkFinished(active: number): void {
    if (this._phase === 'running' && this.results[this.trials.length - 1] !== null) {
      this.accumulatedMs = active;
      this.runningSince = null;
      this._phase = 'finished';
    }
  }

  private record(index: number, outcome: Outcome, rtMs: number | null): void {
    const trial = this.trials[index];
    this.results[index] = { index, isTarget: trial.isTarget, symbol: trial.symbol, outcome, rtMs };
    this.feedback = { seq: ++this.feedbackSeq, trialIndex: index, outcome, rtMs };
  }
}
