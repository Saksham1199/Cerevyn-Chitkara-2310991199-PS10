import { Session } from './session';
import type { Mode, ResponseResult, SessionConfig } from './types';

/**
 * Owns the current session and hands out a fresh session ID on every (re)start.
 *
 * Every event that comes from outside (a key press, a scheduled callback, an animation frame)
 * carries the session ID it was created for. If the ID no longer matches the current session,
 * the event is dropped. This is how "restarting discards pending events from the old session"
 * is guaranteed: a late callback from the old game can never touch the new one.
 */
export class GameController {
  private nextId = 1;
  private _current: Session | null = null;
  private _mode: Mode = 'practice';

  constructor(private readonly configFor: (mode: Mode) => SessionConfig) {}

  get current(): Session | null {
    return this._current;
  }

  get mode(): Mode {
    return this._mode;
  }

  /** Discard whatever is running and start a brand-new session. */
  begin(mode: Mode, t: number): Session {
    this._mode = mode;
    const session = new Session(this.nextId++, this.configFor(mode));
    this._current = session;
    session.start(t);
    return session;
  }

  /** Restart the same mode with a new session ID. The old session is dropped entirely. */
  restart(t: number): Session {
    return this.begin(this._mode, t);
  }

  respond(sessionId: number, t: number, opts: { repeat?: boolean } = {}): ResponseResult {
    const session = this.guard(sessionId);
    if (!session) return { accepted: false, reason: 'stale-session' };
    return session.respond(t, opts);
  }

  tick(sessionId: number, t: number): boolean {
    const session = this.guard(sessionId);
    if (!session) return false;
    session.tick(t);
    return true;
  }

  pause(sessionId: number, t: number): boolean {
    return this.guard(sessionId)?.pause(t) ?? false;
  }

  resume(sessionId: number, t: number): boolean {
    return this.guard(sessionId)?.resume(t) ?? false;
  }

  private guard(sessionId: number): Session | null {
    return this._current !== null && this._current.id === sessionId ? this._current : null;
  }
}
