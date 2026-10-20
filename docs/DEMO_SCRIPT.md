# Demo script (3 to 5 minutes)

Record your screen (Windows: `Win + G` Xbox Game Bar, or OBS; Mac: `Cmd + Shift + 5`). Talk while you click.
Keep the **Live event log** visible at the bottom of the page. It is what proves each behaviour.

| Time | What to do | What to say / what the reviewer sees |
| --- | --- | --- |
| 0:00 | Open the app, show the intro | "PS10: attention and reaction time game. ★ is the target, everything else must be ignored. Educational prototype, no clinical claims." |
| 0:20 | Click **Start practice** | Feedback appears after every trial (Hit / Missed / False alarm). Practice is not saved. |
| 0:50 | During practice, press **Space** on a ★ | Log: `Key: hit on trial N (xxx ms)`. **Correct response.** |
| 1:10 | Press **Space** on a ■ / ● / ▲ | Feedback "False alarm". Log shows it. **Non-target response.** |
| 1:20 | Let a ★ go by without pressing | Feedback "Missed the target". **Missed target.** |
| 1:40 | On a ★ press Space twice quickly, then **hold Space down** | Log: `already has a scored response` and `repeated key event ×N`. **Repeated key press ignored; only one scored response per trial.** |
| 2:10 | While a symbol is on screen press **P** | Symbol is hidden, overlay "Paused". Wait 5 seconds. Press **P**. Active time did not move. **Pause excludes paused time.** |
| 2:40 | Mid-trial press **R** | Log: `Restarted as session #n: pending events from the old session discarded`. Counter back to Trial 1, Active time 0.0 s. **Restart discards old events.** |
| 3:00 | Finish practice, click **Start scored session** | 30 trials, about 52 seconds. Say: "Same seed every time, 9 targets (30%)." |
| 4:00 | Summary screen | Target accuracy, false alarms, missed targets, median reaction time (hits only), trial-by-trial strip. |
| 4:30 | Click **Export JSON**, open the file | Anonymous: random ID, timestamp, settings, scores. No personal data. |
| 4:50 | Show the terminal: `npm test` | All tests pass. Mention `ci.yml` and the Azure plan. |

## Questions to be ready for (follow-up discussion)

- **Why does pause not leak into reaction time?** The engine uses an "active clock" that only advances while
  running; pausing freezes it (`src/engine/session.ts`).
- **How does restart discard old events?** Every restart creates a new session ID. Events carry the ID they
  were created for; `GameController` drops any that do not match (`src/engine/controller.ts`).
- **Why `event.timeStamp` and not `Date.now()`?** It is the high-resolution time the browser recorded when the
  key was actually pressed, on the same clock as `performance.now()`.
- **Where can I change the timings or target frequency?** `src/config.ts`.
- **Small live changes they may ask for:** change the target frequency (`targetFrequency`), the response window
  (`responseWindowMs`), add another non-target symbol (`NON_TARGET_SYMBOLS` in `src/engine/sequence.ts`).
  After a change run `npm run fixtures` to refresh `sample_data/` and then `npm test`.
