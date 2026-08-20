## Why

Planning a week today is write-first: sessions are drafted in conversation, upserted to Intervals.icu, and only then does `get_events` reveal the projected `icu_ctl` trajectory. Discovering that a "build week" actually lands at maintenance load costs a calendar round-trip per iteration, so the `coaching-session` skill offers a heuristic escape hatch (`weekly TSS ≈ 7 × CTL`, `+42 TSS/week per +1 CTL/week`) that is a linearisation of a model that is exactly computable.

It is exactly computable because every step in the chain was verified reproducible offline against the live account: the CTL/ATL recursion matched 41 days of wellness records with zero error; planned `icu_training_load` is `IF² × hours × 100` to the integer; and normalised power rebuilt from a workout's own steps matched the platform's `normalized_power` to a mean of 0.22 W across the 20 events authored at the current FTP.

The blocker is not the model, it is the parse. Every planned-side computation in this repo — `session-review`, `intensity-distribution` — consumes `event.workout_doc`, the platform's parse of the workout text, which only exists once the event has been written. A local parser removes that gate.

## What Changes

- **New: a local workout-text parser.** Parses the `- step` / `Nx` grammar into a `WorkoutDoc` — the same shape the platform returns — so `flattenPlannedSteps` and every existing planned-side consumer work unchanged on text that has never been written. Its contract is behavioural: reproduce what Intervals.icu would have produced for the same text.
- **New Tool `forecast_training_load`.** Takes a seed (CTL/ATL from wellness, or supplied), a set of proposed sessions, and an FTP, and returns the day-by-day CTL/ATL/TSB trajectory plus weekly roll-ups of load, hours and ramp — with no write to the calendar.
- **Replanning against the existing calendar.** The forecast reads planned events already in the window and merges the proposed sessions over them by date, so a partly-fixed week (track night already scheduled, weekend in flux) is forecastable without restating what is already there.
- **Sessions may be given as text or as numbers.** A session carries either a workout description (parsed locally) or a load figure directly, so a session whose shape is not yet decided can still be forecast as a load assumption.
- **Every result states its basis.** The FTP, the CTL/ATL time constants, the seed date, and — per session — whether its load came from a local parse, a platform-supplied figure, or a caller-supplied number.
- **Strength contributes zero load**, matching the platform exactly. `WeightTraining` events and activities carry `icu_training_load: null` on Intervals.icu and are excluded from its own projection; the forecast does not diverge from the dashboard by inventing a figure.

## Capabilities

### New Capabilities

- `workout-text-parsing`: Parsing Intervals.icu workout text into the platform's own parsed-document shape locally, so a prescription can be analysed before it is written. Covers the grammar, the reconstruction rules the platform applies, and the fidelity contract against the platform's parse.
- `training-load-forecast`: Forecasting the fitness/fatigue/form trajectory of a set of proposed sessions from a seeded starting state, including per-session load derivation, merge with already-planned work, weekly roll-up, and the basis every result carries.

### Modified Capabilities

None. `intensity-distribution-comparison` and `planned-vs-actual-comparison` gain a second source of `WorkoutDoc` but neither's requirements change.

## Impact

- **New services**: `src/services/workout-parser/` (text → `WorkoutDoc`) and `src/services/training-load-forecast/` (steps → load → trajectory).
- **New Tool**: `forecast_training_load` in `src/tools/`, registered in `src/registry.ts`; both Adapters project it automatically.
- **Existing code**: `flattenPlannedSteps` and `bucket.ts` are reused unchanged. `WorkoutBuilder.toDescription` gains an inverse but is not itself modified.
- **API**: reads only — `GET /athlete/{id}/events` and `GET /athlete/{id}/wellness`. No new endpoints, no writes.
- **Tests**: a committed fixture of `(description, workout_doc, normalized_power, icu_training_load)` tuples harvested from the live account, so the fidelity contract is asserted offline in CI, following the `tests/fixtures/<service>/` convention.
- **Docs**: `CONTEXT.md` gains the vocabulary; the `coaching-session` skill's _Load check_ section changes from a write-then-read loop plus heuristic to a forecast call.
