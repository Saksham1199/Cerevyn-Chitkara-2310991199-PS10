import { NON_TARGET_SYMBOLS, TARGET_SYMBOL } from '../engine/sequence';

interface Props {
  onPractice: () => void;
  onSkip: () => void;
}

export function Intro({ onPractice, onSkip }: Props) {
  return (
    <section className="card">
      <h2>How to play</h2>
      <div className="legend">
        <div className="legend-item">
          <span className="symbol-sm target" aria-hidden="true">
            {TARGET_SYMBOL}
          </span>
          <div>
            <strong>Target</strong>
            <p>Respond as fast as you can.</p>
          </div>
        </div>
        <div className="legend-item">
          <span className="symbol-sm nontarget" aria-hidden="true">
            {NON_TARGET_SYMBOLS.join(' ')}
          </span>
          <div>
            <strong>Not a target</strong>
            <p>Do nothing. Withhold your response.</p>
          </div>
        </div>
      </div>

      <ul className="steps">
        <li>
          Press <kbd>Space</kbd> or tap the box when you see {TARGET_SYMBOL}.
        </li>
        <li>
          <kbd>P</kbd> pauses and resumes (paused time is never counted). <kbd>R</kbd> restarts.
        </li>
        <li>Start with a short practice round (8 trials, with feedback). Then play the scored session (30 trials).</li>
        <li>Results are saved anonymously in your browser and can be exported as JSON.</li>
      </ul>

      <div className="actions">
        <button className="btn primary" onClick={onPractice}>
          Start practice
        </button>
        <button className="btn ghost" onClick={onSkip}>
          Skip to scored session
        </button>
      </div>
    </section>
  );
}
