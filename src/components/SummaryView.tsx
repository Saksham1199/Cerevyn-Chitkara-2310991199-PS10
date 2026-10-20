import type { Outcome } from '../engine/types';
import type { StoredResult } from '../storage/results';

interface Props {
  result: StoredResult;
  savedCount: number;
  onExport: () => void;
  onClear: () => void;
  onAgain: () => void;
  onHome: () => void;
}

const fmtMs = (v: number | null) => (v === null ? '—' : `${Math.round(v)} ms`);
const fmtPct = (v: number | null) => (v === null ? '—' : `${v}%`);

const CHIP: Record<Outcome, { icon: string; label: string }> = {
  hit: { icon: '✓', label: 'Hit' },
  miss: { icon: '✕', label: 'Missed target' },
  false_alarm: { icon: '!', label: 'False alarm' },
  correct_withhold: { icon: '·', label: 'Correctly withheld' },
};

export function SummaryView({ result, savedCount, onExport, onClear, onAgain, onHome }: Props) {
  const s = result.summary;

  return (
    <section className="card">
      <h2>Session summary</h2>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Target accuracy</span>
          <span className="stat-value">{fmtPct(s.targetAccuracyPct)}</span>
          <span className="stat-sub">
            {s.hits} of {s.targetCount} targets
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">False alarms</span>
          <span className="stat-value">{s.falseAlarms}</span>
          <span className="stat-sub">of {s.nonTargetCount} non-targets</span>
        </div>
        <div className="stat">
          <span className="stat-label">Missed targets</span>
          <span className="stat-value">{s.misses}</span>
          <span className="stat-sub">no response in window</span>
        </div>
        <div className="stat">
          <span className="stat-label">Median reaction time</span>
          <span className="stat-value">{fmtMs(s.medianRtMs)}</span>
          <span className="stat-sub">correct target responses</span>
        </div>
      </div>

      <p className="muted small">
        Correct withholds: {s.correctWithholds} · Overall accuracy: {s.overallAccuracyPct}% · Mean reaction time:{' '}
        {fmtMs(s.meanRtMs)}
      </p>

      <h3>Trial by trial</h3>
      <div className="strip" role="list">
        {result.trials.map((t) => (
          <span
            key={t.index}
            role="listitem"
            className={`chip chip-${t.outcome}`}
            title={`Trial ${t.index + 1}: ${CHIP[t.outcome].label}${t.rtMs !== null ? ` (${Math.round(t.rtMs)} ms)` : ''}`}
            aria-label={`Trial ${t.index + 1}: ${CHIP[t.outcome].label}`}
          >
            {CHIP[t.outcome].icon}
          </span>
        ))}
      </div>
      <p className="muted small">✓ hit · ✕ missed target · ! false alarm · · correctly withheld</p>

      <div className="actions">
        <button className="btn primary" onClick={onExport}>
          Export JSON ({savedCount} saved)
        </button>
        <button className="btn" onClick={onAgain}>
          Play again
        </button>
        <button className="btn ghost" onClick={onHome}>
          Home
        </button>
        <button className="btn ghost danger" onClick={onClear}>
          Clear saved results
        </button>
      </div>
    </section>
  );
}
