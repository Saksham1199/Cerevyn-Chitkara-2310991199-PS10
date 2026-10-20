import type { LogEntry } from '../hooks/useGame';

export function EventLog({ entries }: { entries: LogEntry[] }) {
  return (
    <div className="eventlog" aria-label="Live event log">
      <h3>Live event log</h3>
      {entries.length === 0 ? (
        <p className="muted">Responses and ignored events appear here.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.id} className={`log-${e.kind}`}>
              <span className="dot" aria-hidden="true" />
              {e.text}
              {e.count > 1 && <span className="count"> ×{e.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
