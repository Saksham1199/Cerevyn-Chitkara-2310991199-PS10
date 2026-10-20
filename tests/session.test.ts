import { describe, expect, it } from 'vitest';
import { Session } from '../src/engine/session';
import { CFG, makeSession, nonTarget, T0, target } from './helpers';

// Timeline with CFG (active clock):  onset(0)=1000  windowEnd(0)=2000
//                                    onset(1)=2700  windowEnd(1)=3700   (period 1700)

describe('scoring: the four outcomes', () => {
  it('correct target response (hit) measures reaction time from symbol onset', () => {
    const s = makeSession([target(0)]);
    const r = s.respond(T0 + 1000 + 312);
    expect(r).toEqual({ accepted: true, trialIndex: 0, outcome: 'hit', rtMs: 312 });
    expect(s.getResults()[0]).toMatchObject({ outcome: 'hit', rtMs: 312 });
  });

  it('missed target: no response by the end of the window', () => {
    const s = makeSession([target(0), nonTarget(1)]);
    s.tick(T0 + 1999);
    expect(s.getResults()).toHaveLength(0); // window still open
    s.tick(T0 + 2000);
    expect(s.getResults()[0]).toMatchObject({ outcome: 'miss', rtMs: null });
  });

  it('non-target response is a false alarm', () => {
    const s = makeSession([nonTarget(0)]);
    const r = s.respond(T0 + 1000 + 250);
    expect(r).toMatchObject({ accepted: true, outcome: 'false_alarm', rtMs: 250 });
  });

  it('withholding on a non-target is a correct withhold', () => {
    const s = makeSession([nonTarget(0), target(1)]);
    s.tick(T0 + 2000);
    expect(s.getResults()[0]).toMatchObject({ outcome: 'correct_withhold', rtMs: null });
  });
});

describe('event handling', () => {
  it('ignores auto-repeated key events (key held down)', () => {
    const s = makeSession([target(0)]);
    expect(s.respond(T0 + 1300, { repeat: true })).toEqual({ accepted: false, reason: 'repeat' });
    expect(s.getResults()).toHaveLength(0);
    // the real first press afterwards still counts
    expect(s.respond(T0 + 1310)).toMatchObject({ accepted: true, outcome: 'hit', rtMs: 310 });
  });

  it('allows only ONE scored response per trial', () => {
    const s = makeSession([target(0), nonTarget(1)]);
    expect(s.respond(T0 + 1300)).toMatchObject({ accepted: true });
    expect(s.respond(T0 + 1400)).toEqual({ accepted: false, reason: 'already-responded' });
    expect(s.respond(T0 + 1500)).toEqual({ accepted: false, reason: 'already-responded' });
    expect(s.getResults()).toHaveLength(1);
    expect(s.getResults()[0].rtMs).toBe(300); // the first press is the one that counted
  });

  it('ignores responses outside the scoring window (before the first onset and in the gap)', () => {
    const s = makeSession([target(0), target(1)]);
    expect(s.respond(T0 + 500)).toEqual({ accepted: false, reason: 'outside-window' }); // lead-in
    expect(s.respond(T0 + 2300)).toEqual({ accepted: false, reason: 'outside-window' }); // gap 2000-2700
    // trial 0 was not answered, so it is finalised as a miss; nothing was scored by the stray presses
    expect(s.getResults()).toHaveLength(1);
    expect(s.getResults()[0]).toMatchObject({ index: 0, outcome: 'miss' });
  });

  it('ignores responses before start, and after the session has finished', () => {
    const idle = new Session(1, CFG, [target(0)]);
    expect(idle.respond(T0)).toEqual({ accepted: false, reason: 'not-running' });

    const s = makeSession([target(0)]);
    s.tick(T0 + 2000);
    expect(s.phase).toBe('finished');
    expect(s.respond(T0 + 2100)).toEqual({ accepted: false, reason: 'not-running' });
  });

  it('a late response (after window end) cannot rescue a missed target', () => {
    const s = makeSession([target(0), target(1)]);
    expect(s.respond(T0 + 2000).accepted).toBe(false); // window is [1000, 2000): 2000 is outside
    expect(s.getResults()[0].outcome).toBe('miss');
  });
});

describe('pause', () => {
  it('excludes paused time from the reaction time', () => {
    const s = makeSession([target(0)]);
    // symbol appears at active 1000. Player sees it, then the game is paused at active 1100.
    expect(s.pause(T0 + 1100)).toBe(true);
    // 10 seconds pass in real time while paused
    expect(s.resume(T0 + 1100 + 10_000)).toBe(true);
    // the player presses 200 ms of active time later => active = 1300 => rt = 300
    const r = s.respond(T0 + 1100 + 10_000 + 200);
    expect(r).toMatchObject({ accepted: true, outcome: 'hit', rtMs: 300 });
  });

  it('does not let a response window expire while paused', () => {
    const s = makeSession([target(0), nonTarget(1)]);
    s.pause(T0 + 1500); // 500 ms into trial 0's window
    s.tick(T0 + 60_000); // a minute of real time passes: nothing may be finalised
    expect(s.phase).toBe('paused');
    expect(s.getResults()).toHaveLength(0);

    s.resume(T0 + 60_000);
    s.tick(T0 + 60_000 + 499); // active 1999 -> window still open
    expect(s.getResults()).toHaveLength(0);
    s.tick(T0 + 60_000 + 500); // active 2000 -> window closed -> miss
    expect(s.getResults()[0].outcome).toBe('miss');
  });

  it('ignores responses while paused', () => {
    const s = makeSession([target(0)]);
    s.pause(T0 + 1200);
    expect(s.respond(T0 + 1250)).toEqual({ accepted: false, reason: 'not-running' });
    expect(s.getResults()).toHaveLength(0);
  });

  it('hides the symbol while paused', () => {
    const s = makeSession([target(0)]);
    expect(s.snapshot(T0 + 1100).stimulus).not.toBeNull();
    s.pause(T0 + 1100);
    expect(s.snapshot(T0 + 1100).stimulus).toBeNull();
  });
});

describe('timeline and robustness', () => {
  it('shows the symbol only for stimulusMs after onset', () => {
    const s = makeSession([target(0)]);
    expect(s.snapshot(T0 + 999).stimulus).toBeNull();
    expect(s.snapshot(T0 + 1000).stimulus?.index).toBe(0);
    expect(s.snapshot(T0 + 1599).stimulus?.index).toBe(0);
    expect(s.snapshot(T0 + 1600).stimulus).toBeNull(); // 600 ms visible
  });

  it('finishes after the last window and never runs a trial twice', () => {
    const s = makeSession([target(0), nonTarget(1)]);
    s.tick(T0 + 10_000);
    expect(s.phase).toBe('finished');
    expect(s.getResults().map((r) => r.outcome)).toEqual(['miss', 'correct_withhold']);
    s.tick(T0 + 20_000);
    expect(s.getResults()).toHaveLength(2);
  });

  it('clamps timestamps that go backwards (clock never runs in reverse)', () => {
    const s = makeSession([target(0)]);
    s.tick(T0 + 1500);
    const r = s.respond(T0 + 1400); // older timestamp than the last tick
    expect(r).toMatchObject({ accepted: true, rtMs: 500 }); // clamped to 1500 => 500 ms after onset
  });
});
