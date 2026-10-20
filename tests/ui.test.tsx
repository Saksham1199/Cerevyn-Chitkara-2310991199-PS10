// @vitest-environment jsdom
/**
 * UI integration tests: the real React app running in a simulated browser (jsdom) with fake timers.
 * They exercise keyboard handling, pause, restart and the summary screen end to end.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Dispatch a key event whose timeStamp matches the (fake) performance clock. */
function press(code: string, opts: { repeat?: boolean } = {}) {
  const event = new KeyboardEvent('keydown', { code, repeat: opts.repeat ?? false, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'timeStamp', { value: performance.now() });
  act(() => {
    window.dispatchEvent(event);
  });
}

function clickButton(label: RegExp) {
  const button = [...container.querySelectorAll('button')].find((b) => label.test(b.textContent ?? ''));
  if (!button) throw new Error(`No button matching ${label}`);
  act(() => {
    button.click();
  });
}

const text = () => container.textContent ?? '';
const eventLog = () => container.querySelector('.eventlog')?.textContent ?? '';

/** Step frame by frame until a target symbol is on screen. */
function waitForTarget() {
  for (let i = 0; i < 4000; i++) {
    advance(16);
    if (container.querySelector('.symbol.target')) return;
  }
  throw new Error('no target symbol appeared');
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout', 'Date'],
  });
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UI flow', () => {
  it('shows the intro, then a practice round labelled "not scored"', () => {
    expect(text()).toContain('How to play');
    expect(text()).toContain('no clinical');
    clickButton(/Start practice/);
    expect(text()).toContain('Practice · not scored');
    expect(text()).toContain('Trial 1 / 8');
  });

  it('scores a hit, ignores a second press and a held-down key, and logs each decision', () => {
    clickButton(/Skip to scored/);
    waitForTarget();

    press('Space');
    expect(eventLog()).toMatch(/hit on trial \d+/);

    press('Space'); // a second press in the same trial
    expect(eventLog()).toContain('already has a scored response');

    press('Space', { repeat: true }); // key auto-repeat
    expect(eventLog()).toContain('repeated key event');
  });

  it('pause freezes the game, and resume continues it', () => {
    clickButton(/Skip to scored/);
    advance(2000);
    press('KeyP');
    expect(container.querySelector('.overlay')?.textContent).toContain('Paused');
    const before = text().match(/Active time ([\d.]+) s/)?.[1];

    advance(10_000); // ten seconds of real time while paused
    expect(text().match(/Active time ([\d.]+) s/)?.[1]).toBe(before);
    press('Space'); // responses are not accepted while paused
    expect(eventLog()).toContain('not running');

    press('KeyP');
    expect(container.querySelector('.overlay')).toBeNull();
    expect(eventLog()).toContain('Resumed');
  });

  it('restart in the middle of a trial resets progress and discards the old session', () => {
    clickButton(/Skip to scored/);
    waitForTarget();
    press('Space');
    advance(3000);
    expect(text()).not.toContain('Trial 1 / 30');

    press('KeyR');
    expect(eventLog()).toContain('Restarted');
    expect(text()).toContain('Trial 1 / 30');
    expect(text()).toContain('Active time 0.0 s');
    expect(eventLog()).toContain('discarded');
  });

  it('finishes with a summary, saves the result anonymously, and exports JSON', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    clickButton(/Skip to scored/);
    advance(60_000); // player never responds: every target is missed

    expect(text()).toContain('Session summary');
    expect(text()).toContain('Target accuracy');
    expect(text()).toContain('0 of 9 targets');
    expect(text()).toContain('Missed targets');

    const saved = JSON.parse(localStorage.getItem('cerevyn.ps10.results.v1') ?? '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].summary).toMatchObject({ hits: 0, misses: 9, correctWithholds: 21 });

    clickButton(/Export JSON/);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    clickButton(/Clear saved results/);
    expect(localStorage.getItem('cerevyn.ps10.results.v1')).toBeNull();
  });
});
