import { useCallback, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { configFor } from '../config';
import { GameController } from '../engine/controller';
import type { Session } from '../engine/session';
import { summarise } from '../engine/stats';
import type { IgnoreReason, Mode, Snapshot, Summary } from '../engine/types';
import {
  browserStorage,
  buildExport,
  buildResult,
  createResultStore,
  downloadJson,
  type StoredResult,
} from '../storage/results';

export type Screen = 'intro' | 'practice' | 'practice-done' | 'scored' | 'summary';
export type LogKind = 'ok' | 'ignored' | 'info';
export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
  count: number;
}

const store = createResultStore(browserStorage());

const IGNORE_TEXT: Record<IgnoreReason, string> = {
  'not-running': 'Ignored: game is not running (paused or finished)',
  repeat: 'Ignored: repeated key event (key held down)',
  'outside-window': 'Ignored: outside the response window',
  'already-responded': 'Ignored: this trial already has a scored response',
  'stale-session': 'Ignored: event from a discarded session',
};

function sameSnapshot(a: Snapshot | null, b: Snapshot): boolean {
  return (
    a !== null &&
    a.phase === b.phase &&
    a.trialIndex === b.trialIndex &&
    a.completed === b.completed &&
    a.stimulus?.index === b.stimulus?.index &&
    a.feedback?.seq === b.feedback?.seq &&
    Math.floor(a.activeMs / 100) === Math.floor(b.activeMs / 100)
  );
}

export function useGame() {
  const [controller] = useState(() => new GameController(configFor));
  const [screen, setScreen] = useState<Screen>('intro');
  const [sessionId, setSessionId] = useState(0);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [practiceSummary, setPracticeSummary] = useState<Summary | null>(null);
  const [lastResult, setLastResult] = useState<StoredResult | null>(null);
  const [history, setHistory] = useState<StoredResult[]>(() => store.load());

  // A single mutable holder for the animation-frame handle and the log id counter.
  const [refs] = useState(() => ({ raf: 0, logSeq: 0 }));

  const addLog = useCallback(
    (kind: LogKind, text: string) => {
      const id = ++refs.logSeq;
      setLog((prev) => {
        const top = prev[0];
        if (top && top.kind === kind && top.text === text) {
          return [{ ...top, count: top.count + 1 }, ...prev.slice(1)];
        }
        return [{ id, kind, text, count: 1 }, ...prev].slice(0, 8);
      });
    },
    [refs],
  );

  const finish = useCallback(
    (session: Session) => {
      const trials = session.getResults();
      const summary = summarise(trials);
      if (session.config.mode === 'practice') {
        setPracticeSummary(summary);
        setScreen('practice-done');
        addLog('info', 'Practice round complete (not saved)');
        return;
      }
      const stored = buildResult({ config: session.config, summary, trials });
      store.save(stored);
      setHistory(store.load());
      setLastResult(stored);
      setScreen('summary');
      addLog('info', 'Scored session complete and saved (anonymous)');
    },
    [addLog],
  );

  /** Animation-frame loop bound to ONE session id. If a newer session exists, the loop stops itself. */
  const runLoop = useCallback(
    (id: number) => {
      cancelAnimationFrame(refs.raf);
      const frame = () => {
        const session = controller.current;
        if (!session || session.id !== id) return; // stale loop from an old session
        const t = performance.now();
        controller.tick(id, t);
        const next = session.snapshot(t);
        setSnap((prev) => (sameSnapshot(prev, next) ? prev : next));
        if (session.phase === 'finished') {
          finish(session);
          return;
        }
        refs.raf = requestAnimationFrame(frame);
      };
      refs.raf = requestAnimationFrame(frame);
    },
    [controller, finish, refs],
  );

  const begin = useCallback(
    (mode: Mode) => {
      cancelAnimationFrame(refs.raf);
      const t = performance.now();
      const session = controller.begin(mode, t);
      setSessionId(session.id);
      setSnap(session.snapshot(t));
      setScreen(mode === 'practice' ? 'practice' : 'scored');
      addLog('info', `${mode === 'practice' ? 'Practice' : 'Scored'} session #${session.id} started`);
      runLoop(session.id);
    },
    [addLog, controller, refs, runLoop],
  );

  const restart = useCallback(() => {
    cancelAnimationFrame(refs.raf); // kill the old loop first
    const t = performance.now();
    const session = controller.restart(t);
    setSessionId(session.id);
    setSnap(session.snapshot(t));
    addLog('info', `Restarted as session #${session.id}: pending events from the old session discarded`);
    runLoop(session.id);
  }, [addLog, controller, refs, runLoop]);

  const togglePause = useCallback(
    (t: number = performance.now()) => {
      const session = controller.current;
      if (!session) return;
      if (session.phase === 'running') {
        if (controller.pause(session.id, t)) addLog('info', 'Paused: timers frozen, paused time is excluded');
      } else if (session.phase === 'paused') {
        if (controller.resume(session.id, t)) addLog('info', 'Resumed');
      }
      setSnap(session.snapshot(t)); // show the paused/resumed state immediately, not on the next frame
    },
    [addLog, controller],
  );

  const handleResponse = useCallback(
    (id: number, t: number, repeat: boolean, via: 'key' | 'tap') => {
      const result = controller.respond(id, t, { repeat });
      if (result.accepted) {
        const what = result.outcome === 'hit' ? 'hit' : 'false alarm';
        addLog('ok', `${via === 'key' ? 'Key' : 'Tap'}: ${what} on trial ${result.trialIndex + 1} (${Math.round(result.rtMs)} ms)`);
      } else {
        addLog('ignored', IGNORE_TEXT[result.reason]);
      }
    },
    [addLog, controller],
  );

  // Keyboard controls: Space = respond, P = pause/resume, R = restart. Re-registered per session id.
  useEffect(() => {
    if (screen !== 'practice' && screen !== 'scored') return;
    const id = sessionId;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // never hijack browser shortcuts (Ctrl+R etc.)
      if (e.code === 'Space') {
        e.preventDefault();
        handleResponse(id, e.timeStamp, e.repeat, 'key');
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        if (!e.repeat) togglePause(e.timeStamp);
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (!e.repeat) restart();
      }
    };
    // Stop a focused button from being "clicked" when Space is released.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
    };
    // Switching tabs would otherwise let the clock run while the player cannot see the symbols.
    const onVisibility = () => {
      const session = controller.current;
      if (document.hidden && session?.phase === 'running') {
        controller.pause(session.id, performance.now());
        addLog('info', 'Auto-paused: tab was hidden');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [addLog, controller, handleResponse, restart, screen, sessionId, togglePause]);

  // Stop the animation loop when the component unmounts.
  useEffect(() => () => cancelAnimationFrame(refs.raf), [refs]);

  const onArenaPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      e.preventDefault();
      handleResponse(sessionId, e.nativeEvent.timeStamp, false, 'tap');
    },
    [handleResponse, sessionId],
  );

  return {
    screen,
    snap,
    log,
    practiceSummary,
    lastResult,
    history,
    startPractice: () => begin('practice'),
    startScored: () => begin('scored'),
    restart,
    togglePause: () => togglePause(),
    onArenaPointerDown,
    backToIntro: () => {
      cancelAnimationFrame(refs.raf);
      setScreen('intro');
    },
    exportJson: () => downloadJson('cerevyn-ps10-results.json', buildExport(store.load())),
    clearHistory: () => {
      store.clear();
      setHistory([]);
    },
  };
}

export type GameApi = ReturnType<typeof useGame>;
