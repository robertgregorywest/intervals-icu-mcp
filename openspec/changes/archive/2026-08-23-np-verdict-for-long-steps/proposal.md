## Why

`compare_planned_vs_actual` judges every step on average watts. Outdoors, average power over a long block is depressed by junctions, descents, and terrain — coasting counts as zero watts against the prescribed target. Two consecutive endurance-block closers evidenced this as a false "recurring shortfall": normalized power (NP) computed over the same windows showed no such pattern (issue #16). Short reps ridden on a repeatable stretch of road stay clean regardless of band width, so the driver is step **duration**, not target width.

## What Changes

- Every step's `delivered` fields gain `normalizedWatts` (NP over the step's window, 30 s rolling mean / 4th power / mean / 4th root — the same algorithm `training-load-forecast` already uses on the planned side) and `coastingFraction` (fraction of the window's samples at zero watts). Both are computed from the activity's raw watts stream and reported whenever that stream is available, regardless of which metric drives the verdict.
- A step's verdict is judged against `normalizedWatts` instead of `averageWatts` when the step prescribes a band target (not a ramp) **and** its prescribed duration exceeds 5 minutes (300 s). Point targets and ramps keep the existing average-watts verdict at every duration, and a band step under 5 minutes also keeps it. `deltas.watts`/`deltas.wattsFraction` are computed from whichever metric drove the verdict, so they never disagree with it.
- Each judged step reports which metric its verdict used (`verdictBasis`), so a reader — human or the coaching skill — never has to re-derive it from target shape and duration.
- When the activity carries no power stream (or the window can't be resolved), a step that would otherwise use NP falls back to today's average-watts verdict rather than going unjudged.
- `docs/agents/coaching-session/execution-review.md` gets a reading rule, alongside the existing `executionRecord` rule: on a long band step with non-trivial `coastingFraction`, the NP-based verdict is the one to trust, and a large average-watts delta on the same step is not independently quotable.

## Capabilities

### Modified Capabilities

- `planned-vs-actual-comparison`: per-step delivered data gains `normalizedWatts` and `coastingFraction`; the verdict for long band-target steps is computed against normalized power instead of average watts, with the basis reported per step.
- `coaching-execution-review`: adds a reading rule for the new fields, so a step's verdict is trusted or discounted based on `verdictBasis` and `coastingFraction` rather than read as compliance.

## Impact

- `src/services/session-review/types.ts` — new fields on `AlignedStep.delivered` and `AlignedStep` (`verdictBasis`).
- `src/services/session-review/review.ts` — `judgeStep` gains the duration/target-shape split and computes deltas from the chosen metric; a new helper slices the raw watts stream to a step's window and computes NP + coasting fraction, reusing `normalizedPower` from `src/services/training-load-forecast/load.ts`.
- `src/services/session-review/session-review.ts` — fetches the activity's `watts` stream (as `intensity-distribution` already does) and threads it into `reviewSession`.
- `.claude/skills/coaching-session/execution-review.md` — new rule.
- No API surface change beyond additive response fields; no breaking change.
