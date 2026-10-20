import type { SessionConfig, Summary, TrialResult } from '../engine/types';

/** Minimal subset of the Web Storage API, so tests can inject an in-memory fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEY = 'cerevyn.ps10.results.v1';
export const MAX_STORED = 50;

/** One saved session. Anonymous by design: a random ID, a timestamp and scores. No personal data. */
export interface StoredResult {
  id: string;
  completedAt: string;
  config: Pick<
    SessionConfig,
    'seed' | 'trialCount' | 'targetFrequency' | 'stimulusMs' | 'responseWindowMs' | 'interTrialMs'
  >;
  summary: Summary;
  trials: TrialResult[];
}

export function newResultId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildResult(
  input: { config: SessionConfig; summary: Summary; trials: TrialResult[] },
  now: Date = new Date(),
  id: string = newResultId(),
): StoredResult {
  const { seed, trialCount, targetFrequency, stimulusMs, responseWindowMs, interTrialMs } = input.config;
  return {
    id,
    completedAt: now.toISOString(),
    config: { seed, trialCount, targetFrequency, stimulusMs, responseWindowMs, interTrialMs },
    summary: input.summary,
    trials: input.trials,
  };
}

export function createResultStore(storage: KeyValueStorage, key: string = STORAGE_KEY) {
  const load = (): StoredResult[] => {
    try {
      const raw = storage.getItem(key);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredResult[]) : [];
    } catch {
      return []; // corrupted or unavailable storage must never crash the game
    }
  };

  const save = (result: StoredResult): boolean => {
    try {
      const next = [...load(), result].slice(-MAX_STORED);
      storage.setItem(key, JSON.stringify(next));
      return true;
    } catch {
      return false; // quota exceeded / storage disabled
    }
  };

  const clear = (): void => {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return { load, save, clear };
}

/** The JSON document the player can download. */
export function buildExport(results: StoredResult[], now: Date = new Date()) {
  return {
    app: 'cerevyn-ps10-attention-game',
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    disclaimer: 'Educational prototype. It makes no clinical or diagnostic claims.',
    results,
  };
}

/** localStorage if it works, otherwise an in-memory fallback (e.g. private mode / blocked storage). */
export function browserStorage(): KeyValueStorage {
  try {
    const s = window.localStorage;
    s.setItem('__ps10_probe__', '1');
    s.removeItem('__ps10_probe__');
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
