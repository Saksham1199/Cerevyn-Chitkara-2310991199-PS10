# Attention and Reaction Time Game (PS10)

| | |
| --- | --- |
| **Problem ID** | PS10: Attention and Reaction Time Game |
| **Candidate** | `Saksham Dogra` |
| **Roll number** | `2310991199` |
| **Branch** | `CSE` |
| **Assessment** | Cerevyn Chitkara University, Round One Technical Assessment (Software Developer Trainee) |

> **Educational prototype.** This game makes no clinical, diagnostic or medical claims.

## Problem

Build a browser game that shows target and non-target symbols. The player responds to targets and withholds
a response to non-targets. The game records timing and mistakes and shows a session summary.

## What it does

- **Seeded sequence of 30 trials**, 30% targets (exactly 9), reproducible from a seed.
- **Practice round** (8 trials, feedback after every trial, not saved) before the **scored session**.
- Target **★** versus non-targets **■ ● ▲**. They differ in shape, not just colour.
- Respond with **Space** or by **clicking / tapping** the box. **P** pauses and resumes, **R** restarts.
- Records the four outcomes: **hit**, **missed target**, **false alarm** (non-target response), **correct withhold**.
- Summary: target accuracy, false-alarm count, missed-target count, **median reaction time of correct target responses**,
  and a trial-by-trial strip.
- Saves each scored session **anonymously** in the browser (`localStorage`) and exports it as **JSON**.
- A **live event log** shows every accepted and ignored event, which makes the edge cases easy to demonstrate.

## Approach (how the tricky requirements are met)

The game logic is a pure TypeScript module (`src/engine/`) with no React, no browser APIs and **no timers**.
Callers pass a timestamp with every call. That makes timing fully deterministic and unit-testable.

| Requirement | How it is implemented |
| --- | --- |
| Reaction timing starts when the symbol is displayed | RT = active time at the response minus the scheduled symbol onset. The UI draws the symbol from the same clock. |
| Only one scored response per trial | The first accepted response is stored; later ones return `already-responded`. |
| Ignore repeated key events | Auto-repeat events (`event.repeat`) are rejected with reason `repeat`. |
| Ignore responses outside the scoring window | A trial's window is `[onset, onset + 1000 ms)`. Anything in the gap, before the first symbol or after a window closes is ignored. |
| Pause excludes paused time | The engine uses an **active clock** that only advances while running. Pausing freezes it, so RT excludes paused time and a window cannot expire while paused. The symbol is hidden while paused. |
| Restart discards pending events | Each (re)start creates a **new session ID**. Events carry the ID they were made for and `GameController` drops any that do not match. The old animation loop also stops itself. |
| Reproducible sequence | `mulberry32` seeded RNG plus a seeded Fisher-Yates shuffle. Default seed `20261020` (override with `VITE_SESSION_SEED`). |
| Median RT of correct target responses | Only `hit` trials enter the median. False alarms are excluded. |

### Timing parameters (in `src/config.ts`)

| Parameter | Value |
| --- | --- |
| Trials (scored / practice) | 30 / 8 |
| Target frequency | 30% (9 of 30) / 37.5% (3 of 8) |
| Symbol visible | 600 ms |
| Scoring (response) window | 1000 ms from symbol onset |
| Gap between windows | 700 ms (trial period 1700 ms) |
| Lead-in before first symbol | 1000 ms |
| Scored session length | about 52 s |

Responses count if they arrive within 1000 ms of onset, even after the symbol has disappeared at 600 ms.

## Setup

**Prerequisites:** [Node.js](https://nodejs.org) 20 or newer (developed on Node 22.22, npm 10.9) and Git.

```bash
npm install        # install dependencies (uses package-lock.json)
npm run dev        # start the game at http://localhost:5173
npm test           # run all automated tests (45 tests)
npm run typecheck  # TypeScript check
npm run build      # production build into dist/
npm run preview    # serve the production build locally
npm run fixtures   # regenerate sample_data/ (only needed if you change the sequence or timings)
```

### Dependency versions

| Package | Version |
| --- | --- |
| react / react-dom | 19.3.1 |
| typescript | 5.9.3 |
| vite | 7.3.7 |
| @vitejs/plugin-react | 5.2.0 |
| vitest | 5.0.5 |
| jsdom (UI tests only) | 29.1.1 |
| tsx (fixture script only) | 4.23.15 |

Exact versions are pinned in `package-lock.json`. No model downloads or external services are needed.

## Tests

`npm test` runs 45 automated tests in 7 files:

| File | What it covers |
| --- | --- |
| `tests/session.test.ts` | Hit, miss, false alarm, correct withhold; repeated keys; one response per trial; outside-window and late responses; pause excludes paused time; windows do not expire while paused; stimulus timing; clock clamping |
| `tests/controller.test.ts` | Restart creates a new session; stale events are dropped; a pending timer from the old game cannot change the new game |
| `tests/stats.test.ts` | Median (odd, even, empty) and summary maths |
| `tests/rng-sequence.test.ts` | Seeded RNG and sequence reproducibility, exactly 9 targets, input validation |
| `tests/storage.test.ts` | Save/load, corrupted storage, write failures, size cap, anonymous JSON export shape |
| `tests/scenario.test.ts` | Fixtures in `sample_data/`: committed sequence, a scripted player vs hand-computed expected result, perfect player, no-response player |
| `tests/ui.test.tsx` | The real React app in jsdom: practice flow, hit + ignored events, pause/resume, restart mid-trial, summary + save + export |

The complete local test output is in [`docs/test-output.txt`](docs/test-output.txt). CI runs the same steps on
every push (`.github/workflows/ci.yml`): `npm ci`, typecheck, tests, build.
CI run link: `<PASTE YOUR GITHUB ACTIONS RUN LINK AFTER YOUR FIRST PUSH>`

## Sample data and expected outputs (`sample_data/`)

- `trial_sequence_seed_20261020.json`: the exact 30-trial sequence for the default seed.
- `scripted_session.json`: a scripted player (actions with reaction offsets) plus the **expected summary**,
  computed by hand in `scripts/generate-fixtures.ts`, independent of the engine:

| Expected | Value |
| --- | --- |
| Targets / non-targets | 9 / 21 |
| Hits | 7 (reaction times 280, 305, 355, 380, 405, 455, 480 ms) |
| Missed targets | 2 |
| False alarms | 2 |
| Correct withholds | 19 |
| Target accuracy | 77.8% |
| Median RT (hits only) | 380 ms |

### Example of an exported result (shortened)

```json
{
  "app": "cerevyn-ps10-attention-game",
  "schemaVersion": 1,
  "exportedAt": "2026-10-20T09:00:00.000Z",
  "disclaimer": "Educational prototype. It makes no clinical or diagnostic claims.",
  "results": [
    {
      "id": "b1f3c0de-…",
      "completedAt": "2026-10-20T08:59:12.000Z",
      "config": { "seed": 20261020, "trialCount": 30, "targetFrequency": 0.3,
                  "stimulusMs": 600, "responseWindowMs": 1000, "interTrialMs": 700 },
      "summary": { "hits": 7, "misses": 2, "falseAlarms": 2, "correctWithholds": 19,
                   "targetAccuracyPct": 77.8, "medianRtMs": 380, "…": "…" },
      "trials": [ { "index": 0, "isTarget": false, "symbol": "■", "outcome": "correct_withhold", "rtMs": null } ]
    }
  ]
}
```

## Project structure

```
src/engine/       pure game logic: rng, sequence, session (timing/scoring), controller (restart safety), stats
src/hooks/        useGame: connects the engine to React, keyboard handling, animation loop
src/components/   Intro, Play, PracticeDone, SummaryView, EventLog
src/storage/      anonymous result storage and JSON export
src/config.ts     all timings and counts
tests/            automated tests          sample_data/   fixtures with expected outputs
docs/             azure-plan.md, DEMO_SCRIPT.md, test-output.txt
.github/workflows ci.yml (tests on every push) and deploy-azure.yml (manual, optional)
```

## Azure and GitHub automation

- [`docs/azure-plan.md`](docs/azure-plan.md): hosting design (Azure Static Web Apps), identity and secrets,
  monitoring, deployment steps and cost assumptions. Live deployment is optional and was not performed.
- `.github/workflows/ci.yml`: installs dependencies and runs typecheck, tests and build.
- `.github/workflows/deploy-azure.yml`: manual deployment workflow (needs one repository secret).
- `.env.example`: credential-free configuration example.

## Limitations

- **Display and input latency are not measured.** Reaction times are measured from the *scheduled* symbol onset on the
  browser clock. The symbol is drawn on the next animation frame (up to about 16.7 ms at 60 Hz), plus monitor and
  keyboard latency. Numbers are suitable for a game, not for a laboratory measurement.
- Responses are mapped to the trial by time, so a response to symbol N that arrives after window N closes is ignored
  rather than guessed to belong to another trial.
- The tab auto-pauses when hidden. Pausing during a symbol hides it, and the trial resumes with the remaining time.
- Results live in the browser only (`localStorage`, last 50 sessions). Clearing site data removes them.
- UI behaviour is tested in jsdom (a simulated browser) with fake timers, not in a real browser or on real hardware.
- No accessibility audit beyond labels, keyboard control and reduced-motion support.
- Educational prototype only. It must not be used to assess attention, ADHD or any other condition.

## Contributions and AI assistance

- **My work:** I selected PS10 (Attention and Reaction Time Game) from the ten problem
  statements and provided the assessment document and requirements to the AI assistant. I set
  up the development environment (VS Code and Node.js), installed the dependencies, ran the
  project locally, played the practice and scored sessions, and verified the results screen
  and the exported JSON file against my own play. I also reviewed the README and prepared
  the repository for submission.
- **AI assistance:** The code in this repository (game engine, React UI, automated tests,
  GitHub Actions workflows, Azure plan and this README) was generated by Claude (Anthropic's
  AI assistant) from the assessment document, in a conversation that I directed. I did not
  write the initial code myself.
- **Reused code:** none, apart from the open-source libraries listed above. The `mulberry32`
  generator is a well-known public-domain algorithm.
