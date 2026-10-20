import type { Summary } from '../engine/types';

interface Props {
  summary: Summary | null;
  onStart: () => void;
  onRepeat: () => void;
}

export function PracticeDone({ summary, onStart, onRepeat }: Props) {
  return (
    <section className="card">
      <h2>Practice complete</h2>
      {summary && (
        <p className="lead">
          You caught {summary.hits} of {summary.targetCount} targets and made {summary.falseAlarms} false alarm
          {summary.falseAlarms === 1 ? '' : 's'}. Practice results are not saved.
        </p>
      )}
      <p className="muted">The scored session has 30 trials and takes about a minute. Ready?</p>
      <div className="actions">
        <button className="btn primary" onClick={onStart}>
          Start scored session
        </button>
        <button className="btn ghost" onClick={onRepeat}>
          Practice again
        </button>
      </div>
    </section>
  );
}
