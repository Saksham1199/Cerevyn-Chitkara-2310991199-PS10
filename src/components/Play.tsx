import type { Feedback } from '../engine/types';
import type { GameApi } from '../hooks/useGame';
import { EventLog } from './EventLog';

function feedbackText(f: Feedback): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  switch (f.outcome) {
    case 'hit':
      return { text: `✓ Hit! ${Math.round(f.rtMs ?? 0)} ms`, tone: 'good' };
    case 'miss':
      return { text: '✕ Missed the target', tone: 'bad' };
    case 'false_alarm':
      return { text: '! False alarm: that was not the target', tone: 'bad' };
    case 'correct_withhold':
      return { text: '✓ Correctly held back', tone: 'neutral' };
  }
}

export function Play({ game }: { game: GameApi }) {
  const { snap, screen } = game;
  const practice = screen === 'practice';
  const paused = snap?.phase === 'paused';
  const total = snap?.total ?? 0;
  const completed = snap?.completed ?? 0;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const fb = practice && snap?.feedback ? feedbackText(snap.feedback) : null;

  return (
    <section className="card play">
      <div className="hud">
        <span className={`pill ${practice ? 'pill-practice' : 'pill-scored'}`}>
          {practice ? 'Practice · not scored' : 'Scored session'}
        </span>
        <span>
          Trial {Math.min(completed + 1, total)} / {total}
        </span>
        <span>Active time {((snap?.activeMs ?? 0) / 1000).toFixed(1)} s</span>
      </div>

      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div style={{ width: `${pct}%` }} />
      </div>

      <div
        className={`arena ${paused ? 'is-paused' : ''}`}
        onPointerDown={game.onArenaPointerDown}
        aria-label="Response area. Press space or tap when the star appears."
      >
        {paused ? (
          <div className="overlay">⏸ Paused. Press P to resume</div>
        ) : snap?.stimulus ? (
          <div
            key={`${snap.stimulus.index}`}
            className={`symbol ${snap.stimulus.isTarget ? 'target' : 'nontarget'}`}
            aria-label={snap.stimulus.isTarget ? 'target' : 'not a target'}
          >
            {snap.stimulus.symbol}
          </div>
        ) : (
          <div className="fixation" aria-hidden="true">
            +
          </div>
        )}
      </div>

      <div className="feedback" aria-live="polite">
        {fb && (
          <span key={snap?.feedback?.seq} className={`fb fb-${fb.tone}`}>
            {fb.text}
          </span>
        )}
      </div>

      <div className="controls">
        <button
          className="btn"
          onClick={(e) => {
            e.currentTarget.blur();
            game.togglePause();
          }}
        >
          {paused ? 'Resume (P)' : 'Pause (P)'}
        </button>
        <button
          className="btn ghost"
          onClick={(e) => {
            e.currentTarget.blur();
            game.restart();
          }}
        >
          Restart (R)
        </button>
      </div>

      <p className="hint">
        <kbd>Space</kbd> or tap the box for ★ · do nothing for anything else
      </p>

      <EventLog entries={game.log} />
    </section>
  );
}
