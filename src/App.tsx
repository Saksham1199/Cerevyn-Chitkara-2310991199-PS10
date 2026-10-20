import { Intro } from './components/Intro';
import { Play } from './components/Play';
import { PracticeDone } from './components/PracticeDone';
import { SummaryView } from './components/SummaryView';
import { useGame } from './hooks/useGame';

export default function App() {
  const game = useGame();

  return (
    <div className="app">
      <header className="brand">
        <span className="logo" aria-hidden="true">
          ★
        </span>
        <div>
          <h1>Attention &amp; Reaction Time</h1>
          <p>Cerevyn technical assessment · PS10 · educational prototype</p>
        </div>
      </header>

      <main>
        {game.screen === 'intro' && <Intro onPractice={game.startPractice} onSkip={game.startScored} />}
        {(game.screen === 'practice' || game.screen === 'scored') && <Play game={game} />}
        {game.screen === 'practice-done' && (
          <PracticeDone
            summary={game.practiceSummary}
            onStart={game.startScored}
            onRepeat={game.startPractice}
          />
        )}
        {game.screen === 'summary' && game.lastResult && (
          <SummaryView
            result={game.lastResult}
            savedCount={game.history.length}
            onExport={game.exportJson}
            onClear={game.clearHistory}
            onAgain={game.startScored}
            onHome={game.backToIntro}
          />
        )}
      </main>

      <footer>This game is an educational prototype. It makes no clinical or diagnostic claims.</footer>
    </div>
  );
}
