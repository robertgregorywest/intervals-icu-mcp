## Context

`compare_planned_vs_actual` (`src/services/session-review/`) currently judges every step on `DeliveredInterval.averageWatts`, which comes straight off the device lap or platform interval — no raw stream is read anywhere in this service. `reviewSession` (`review.ts`) is a pure function taking planned steps, delivered intervals, and a tolerance; it performs no I/O so it can be exercised directly against fixture pairs. The only place in the codebase that already reads a raw watts stream to compute a windowed figure is `intensity-distribution.ts`, which calls `activitiesApi.getActivityStreams(activity.id, ["watts"])`. The only place that already implements the NP algorithm (30 s rolling mean, 4th power, mean, 4th root) is `training-load-forecast/load.ts`'s `normalizedPower(stream: number[])`, built and validated against the platform's own figures on the _planned_ side. See `proposal.md` for why the average-watts verdict misleads on long outdoor steps.

## Goals / Non-Goals

**Goals:**

- Add `normalizedWatts` and `coastingFraction` to every step's `delivered` block whenever the activity's raw watts stream resolves the step's window.
- Move the verdict (and its deltas) onto normalized power for band-target steps prescribed longer than 300 s; leave every other step on average power.
- Report which metric a step's verdict used, so the coaching skill (and any other caller) doesn't have to re-derive it from target shape and duration.
- Keep `reviewSession` a pure, I/O-free function.

**Non-Goals:**

- Changing the verdict enum, tolerance semantics, alignment, or execution-record selection — untouched.
- Changing how `training-load-forecast` computes planned-side NP — reused as-is, not modified.
- A configurable duration threshold. 300 s is a fixed constant, matching the maintainer's resolution of the issue's open question; making it caller-tunable is not asked for and would reopen the tolerance-vs-band-width conflation the current tool already avoids.

## Decisions

**Reuse `normalizedPower` from `training-load-forecast/load.ts` rather than re-implementing it.** It's already the validated NP algorithm in this codebase, exported as a plain function of `number[]`. Importing it into `session-review` is a one-line dependency; duplicating the rolling-window logic would risk the two implementations drifting.

**Fetch the stream in `session-review.ts`, slice windows in `review.ts`.** `getActivityStreams` is I/O and belongs in the service class alongside the existing `getActivityLaps` call, fetched once per comparison after the activity/event pair resolves — not per candidate, since only the chosen candidate's steps need it. `reviewSession` stays pure: it receives the already-fetched `watts: number[] | undefined` as a new field on `ReviewInputs` and, for each aligned step, slices `watts[delivered.startTime, delivered.startTime + delivered.durationSeconds)` to get that step's window. This mirrors how `intensity-distribution.ts` already treats the stream as plain data once fetched.

**Window slicing keys off `DeliveredInterval.startTime`/`durationSeconds`, both already populated** by `lapsToDeliveredIntervals` (from `lap.startTimeSeconds`) and `toDeliveredIntervals` (from `iv.start_time`). No new fields are needed on `DeliveredInterval` to support this — the new fields live only on `AlignedStep.delivered`, the already-paired, reported shape.

**Verdict-basis rule lives in `judgeStep`, decided from target shape + prescribed duration, not from whether NP happened to compute.** A step qualifies for the NP verdict when `planned.target` is a band (`low`/`high` set, `ramp` falsy) and `planned.durationSeconds > 300`. This is evaluated before checking whether `normalizedWatts` actually resolved, so the fallback (below) is a distinct, reported path rather than a silent tie-break.

**Fallback to average power when NP can't be resolved is explicit, not silent.** A step that qualifies for the NP verdict but has no resolvable window (no stream on the activity, or the window falls outside the fetched stream's bounds) is judged on average power exactly as it is today, and the response says the fallback happened (a new field, `verdictBasisFallback`, or folded into `verdictBasis` itself — see Open Questions). This keeps existing behavior for activities with no power stream data.

**`coastingFraction` counts samples equal to exactly `0`.** Matches the issue's own worked table and the platform's own semantics for a stopped/coasting sample; no dead-zone threshold (e.g. `< 5 W`) is introduced, since that would be a second judgement call the issue doesn't ask for.

**`normalizedWatts` is only reported when the window is at least 30 s** (reusing `training-load-forecast`'s `ROLLING_WINDOW_SECONDS` constant), because the issue itself states NP is meaningless below the rolling window's own length. This can only affect a step that would use average-watts anyway (the NP-verdict rule already requires `durationSeconds > 300`), so it only changes whether the _reported, non-load-bearing_ NP figure appears on short steps — never whether a verdict flips.

## Risks / Trade-offs

- **Window/stream index alignment is an assumption, not yet verified against a live payload.** `getActivityStreams` returns `watts` as a plain array; whether index `i` reliably means "elapsed second `i` from activity start" for every activity (versus a stream with gaps where auto-pause elides paused seconds) needs a real check per the repo's own probe-before-typing rule. If it doesn't line up 1:1, the slicing needs an elapsed-time index (likely from the `time` stream) rather than a raw array offset. → Verify with `intervals-api-research` against a real coasting-heavy activity (`i177831477` from the issue is a ready-made fixture) before writing `review.ts`'s slicing code; adjust to index off the `time` stream if raw offsets don't hold.
- **A stream fetch on every comparison is a new request this tool didn't make before.** `intensity-distribution` already pays this cost per comparison, so it's a known, accepted shape; `getActivityLaps` failures are already tolerated without failing the comparison (see `executionCandidates`), and a `getActivityStreams` failure should be treated the same way — the whole comparison falls back to average-watts verdicts everywhere rather than erroring.

## Open Questions

- Whether the fallback (NP could not be resolved) is its own field or a third `verdictBasis` value (e.g. `"average-watts-fallback"`). Either reads fine; pick whichever keeps `judgeStep`'s return type simplest once the stream-slicing code is written. Doesn't affect the spec, which only requires that the fallback is reported.
