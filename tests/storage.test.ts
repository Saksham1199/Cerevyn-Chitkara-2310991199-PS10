import { describe, expect, it } from 'vitest';
import { summarise } from '../src/engine/stats';
import {
  buildExport,
  buildResult,
  createResultStore,
  MAX_STORED,
  type KeyValueStorage,
} from '../src/storage/results';
import { CFG } from './helpers';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const sample = (id: string) =>
  buildResult({ config: CFG, summary: summarise([]), trials: [] }, new Date('2026-10-20T08:00:00Z'), id);

describe('result storage', () => {
  it('saves and loads results (round trip)', () => {
    const store = createResultStore(memoryStorage());
    expect(store.load()).toEqual([]);
    store.save(sample('a'));
    store.save(sample('b'));
    expect(store.load().map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('survives corrupted storage instead of crashing', () => {
    const storage = memoryStorage();
    storage.setItem('k', '{not valid json');
    const store = createResultStore(storage, 'k');
    expect(store.load()).toEqual([]);
    storage.setItem('k', '{"an":"object"}'); // valid JSON but not an array
    expect(store.load()).toEqual([]);
    expect(store.save(sample('x'))).toBe(true); // and it can recover by saving again
  });

  it('reports failure (does not throw) when storage refuses writes', () => {
    const broken: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    expect(createResultStore(broken).save(sample('x'))).toBe(false);
  });

  it('keeps only the most recent MAX_STORED sessions', () => {
    const store = createResultStore(memoryStorage());
    for (let i = 0; i < MAX_STORED + 5; i++) store.save(sample(`id-${i}`));
    const all = store.load();
    expect(all).toHaveLength(MAX_STORED);
    expect(all[0].id).toBe('id-5');
  });

  it('clear() removes everything', () => {
    const store = createResultStore(memoryStorage());
    store.save(sample('a'));
    store.clear();
    expect(store.load()).toEqual([]);
  });
});

describe('JSON export', () => {
  it('has a stable shape, a disclaimer, and only anonymous fields', () => {
    const doc = buildExport([sample('a')], new Date('2026-10-20T09:00:00Z'));
    expect(doc).toMatchObject({
      app: 'cerevyn-ps10-attention-game',
      schemaVersion: 1,
      exportedAt: '2026-10-20T09:00:00.000Z',
    });
    expect(doc.disclaimer).toMatch(/no clinical/i);
    expect(Object.keys(doc.results[0]).sort()).toEqual(['completedAt', 'config', 'id', 'summary', 'trials']);
    // round-trips through JSON without losing data
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
