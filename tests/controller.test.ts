import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../src/engine/controller';
import { CFG } from './helpers';

const makeController = () => new GameController(() => ({ ...CFG, trialCount: 10, targetFrequency: 0.5 }));

afterEach(() => {
  vi.useRealTimers();
});

describe('GameController: restart discards the old session', () => {
  it('gives every (re)start a new session id and a clean slate', () => {
    const c = makeController();
    const first = c.begin('scored', 0);
    c.tick(first.id, 5000); // let a few trials be finalised
    expect(first.getResults().length).toBeGreaterThan(0);

    const second = c.restart(5000);
    expect(second.id).not.toBe(first.id);
    expect(second.getResults()).toHaveLength(0);
    expect(second.snapshot(5000).activeMs).toBe(0);
    expect(c.mode).toBe('scored');
  });

  it('drops events that still carry the old session id', () => {
    const c = makeController();
    const old = c.begin('scored', 0);
    const fresh = c.restart(100);

    expect(c.respond(old.id, 1300)).toEqual({ accepted: false, reason: 'stale-session' });
    expect(c.tick(old.id, 9999)).toBe(false);
    expect(c.pause(old.id, 9999)).toBe(false);
    expect(c.resume(old.id, 9999)).toBe(false);
    expect(fresh.getResults()).toHaveLength(0);
    expect(fresh.phase).toBe('running');
  });

  it('a pending timer from the old game cannot change the new game', () => {
    vi.useFakeTimers();
    const c = makeController();
    const old = c.begin('scored', 0);

    // Something scheduled during the old session, e.g. a delayed response or feedback callback.
    const outcomes: unknown[] = [];
    setTimeout(() => outcomes.push(c.respond(old.id, 1300)), 300);

    // The player restarts while that callback is still pending.
    const fresh = c.restart(100);
    vi.advanceTimersByTime(500);

    expect(outcomes).toEqual([{ accepted: false, reason: 'stale-session' }]);
    expect(fresh.getResults()).toHaveLength(0);
  });

  it('restarting while paused starts a running session again', () => {
    const c = makeController();
    const s = c.begin('practice', 0);
    c.pause(s.id, 500);
    expect(s.phase).toBe('paused');
    const fresh = c.restart(900);
    expect(fresh.phase).toBe('running');
    expect(c.mode).toBe('practice');
  });
});
