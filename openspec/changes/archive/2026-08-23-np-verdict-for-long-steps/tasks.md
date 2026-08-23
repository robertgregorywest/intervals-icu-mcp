## 1. Verify the stream/window assumption

- [x] 1.1 Using the `intervals-api-research` skill, pull the raw `watts` stream for activity `i177831477` (the issue's own coasting-heavy example) and confirm that array index `i` corresponds to elapsed second `i` from activity start, matching `DeliveredInterval.startTime`/`durationSeconds`. If it doesn't hold (e.g. auto-pause elides seconds), determine the correct index source (likely the `time` stream) before writing any slicing code.

## 2. Types

- [x] 2.1 Add `normalizedWatts?: number` and `coastingFraction?: number` to `AlignedStep["delivered"]` in `src/services/session-review/types.ts`.
- [x] 2.2 Add a `verdictBasis` field to `AlignedStep` (or fold the fallback case into it per design.md's Open Question — decide when writing `judgeStep`'s return type) naming which metric drove the verdict.
- [x] 2.3 Add `watts?: number[]` to `ReviewInputs` in `review.ts`.

## 3. Window slicing and NP/coasting computation

- [x] 3.1 In `review.ts`, add a helper that slices a step's window out of the raw watts stream using `delivered.startTime`/`delivered.durationSeconds` (adjusted per task 1.1's finding), returning `undefined` when the stream is absent or the window falls outside it.
- [x] 3.2 Compute `coastingFraction` from the sliced window (fraction of samples `=== 0`).
- [x] 3.3 Compute `normalizedWatts` from the sliced window by importing and calling `normalizedPower` from `../training-load-forecast/load.ts`, only when the window is at least `ROLLING_WINDOW_SECONDS` (30 s) long; `undefined` otherwise.
- [x] 3.4 Attach both fields to each step's `delivered` block in `reviewSession`, independent of which metric the verdict below uses.

## 4. Verdict-basis logic

- [x] 4.1 In `judgeStep`, determine verdict basis before comparing to target: normalized power when the target is a band (`low`/`high` set, not `ramp`) and `planned.durationSeconds > 300`; average power otherwise.
- [x] 4.2 When the NP basis applies but `normalizedWatts` didn't resolve (task 3.1 returned `undefined`), fall back to average power and report that the fallback occurred.
- [x] 4.3 Compute `deltas.watts`/`deltas.wattsFraction` from whichever metric was actually used (post-fallback), so they never disagree with the reported verdict.
- [x] 4.4 Report the resolved `verdictBasis` on every judged step (including `unmatched`/`not-attempted` steps, where it should reflect what the rule would have chosen even though no comparison was reached — decide the exact convention when implementing, per design.md).

## 5. Wire the stream fetch

- [x] 5.1 In `session-review.ts`, after the activity/event pair resolves, call `activitiesApi.getActivityStreams(activity.id, ["watts"])` once (alongside the existing `getActivityLaps` call), tolerating a failure the same way lap-fetch failures are tolerated today — the comparison proceeds with `watts` undefined, and every step falls back to average-watts verdicts.
- [x] 5.2 Thread the resolved `watts` array into `reviewSession`'s `ReviewInputs`.

## 6. Tests

- [x] 6.1 Add fixture-based tests in `tests/services/session-review/` covering: a long band step with coasting judged on NP; a short band step staying on average watts despite coasting; a point target and a ramp staying on average watts at long duration; the no-stream fallback; `coastingFraction`/`normalizedWatts` reported on a step whose verdict still uses average watts.
- [x] 6.2 Update `tests/tools/session-review.test.ts` if the tool's response shape assertions need the new fields.
- [x] 6.3 Run the full suite (`npm test` or repo equivalent) and `tsc --noEmit`.

## 7. Coaching skill doc

- [x] 7.1 Add the reading rule to `.claude/skills/coaching-session/execution-review.md`, alongside the existing `executionRecord` rule: on a long band step with non-trivial `coastingFraction`, trust the NP-based verdict and don't independently quote the average-watts delta.

## 8. Domain docs

- [x] 8.1 Add `Verdict basis` (or whatever name task 2.2 settles on) to `CONTEXT.md`'s glossary, following the existing entry style (definition + `_Avoid_` line), since it's a new term a per-step response now carries.
