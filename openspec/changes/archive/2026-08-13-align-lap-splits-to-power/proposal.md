## Why

Track sessions are measured in two files that cannot currently be joined: a helper's lap-timer export (cumulative distance and time per 250 m lap — self-verifiable, no modelling) and the SRM power in the activity file. Without a join, Intervals.icu's auto-detected intervals dilute a scored run with its rolling entry (a 114.26 s run reads as a 134 s effort), per-lap power does not exist at all, and the ±8 W of uncertainty left by backing the entry out by assumption swamps the differences coaching decisions turn on — on 2026-08-08 two runs both read "~390 W" yet one was 0.84 s faster over seven laps.

The manual method exists (`docs/personal/track-context.md` §8: fit the cadence trace to the cadence each lap implies, check the rms error) but has been executed by hand exactly once and is not reproducible by anyone who has not done it. Its naive alternative — interpolating streams against distance — is documented to produce confidently wrong answers (a fictitious "18.10 → 15.71" opening split for a run that actually went 16.36 → 16.24), so anything built must fail loudly rather than return a plausible fiction.

Probing the live API for the 2026-08-08 session (`i173732945`) settled the two open questions the issue flagged. Streams return at **1 Hz**, not the 3-second stride `track-context.md` §8 records, so per-lap output is honest without touching the FIT record stream. And a prototype of the cadence fit reproduced the manual result: rms 0.48–0.89 rpm across the four runs, a development independently recovered as 8.33–8.37 m per assumed 250 m lap by all four (spread 0.45%), and the headline answer — run 1 at 376 W over 114.26 s versus run 2 at 380 W over 113.42 s.

## What Changes

- A new Tool that takes an activity id and a lap-split export and returns **per-lap power, cadence and heart rate** for every run, plus the whole-run aggregates, cut at the lap-timer's boundaries rather than at detected-interval boundaries.
- Alignment is solved, not assumed: candidate effort windows are detected from the stream, each run is fitted to a window by least-squares on lap-mean cadence with the drivetrain rollout as a free scale parameter, and runs are assigned to windows one-to-one in chronological order. The flying entry falls outside the fitted window by construction, so warm-up laps are excluded rather than averaged in.
- Every result carries a **quantified confidence signal** — the fit's rms in rpm, the margin over the next-best offset, and the spread of the rollout recovered across runs — with an explicit verdict. A fit that is weak, ambiguous, or inconsistent is reported as such; where it is too weak to support per-lap numbers the Tool degrades to run-level output or refuses, never returns a plausible fiction.
- The **effective development** the fit recovers — metres of assumed lap distance per crank revolution — is returned as a first-class output, and doubles as a cross-run consistency check. It is a measurement where there is currently an assumption, and the repo has paid for assumed constants before (`track-context.md` §6, where over-assuming one by ~6% sustained a false "the SRM reads low" conclusion for several analysis cycles). On 2026-08-08 (64×16) it lands 0.51% below that gear's 8.396 m/rev, and on 2026-07-12 (65×16) 0.34% below its 8.526 — two gears told cleanly apart, carrying the same small bias, most likely a lap ridden ~1 m longer than the 250 m assumed.
- Lap splits are accepted as the CSV the timing app exports, so the export can be pasted through unmodified.

One outcome the issue hoped for does not survive contact with the data: **the session yields per-lap power for three of its four runs, not all four**. Run 3 has a rival offset 4.7 s away that fits within 9% of the best and returns an equally plausible development, so it is reported `ambiguous` and its per-lap readings are withheld. Its run-level power is unaffected (337.9 W against 335.3 W at the rival), and that gap between what survives the ambiguity and what does not is the whole point of the confidence machinery. Loosening the threshold to force run 3 through would have delivered the bullet and lost the guarantee.

Non-goals: deriving `ρ·CdA` from the aligned power and speed (a later change, once per-lap power exists); reading the FIT record stream (1 Hz streams make it unnecessary); scheduling or writing anything back to Intervals.icu.

## Capabilities

### New Capabilities

- `track-lap-alignment`: joining an external lap-split record to an activity's streams by fitting cadence, and reporting per-lap power/cadence/heart rate together with a quantified alignment confidence.

### Modified Capabilities

None. No existing spec's requirements change.

## Impact

- **New service** `src/services/track-lap-alignment/` (`types.ts`, split parsing, window detection, fit, `index.ts`) behind an `ITrackLapAlignment` interface.
- **New tool handler** `src/tools/track-lap-alignment.ts` and one entry in `src/registry.ts`; both Adapters pick it up with no further work. Read-only, `compute_`-prefixed, so it falls under the existing read-only allowlist.
- **Reads** `GET /api/v1/activity/{id}/streams.json` via the existing `IActivitiesApi.getActivityStreams`. No new endpoint, no new dependency, no write path.
- **Tests** under `tests/services/track-lap-alignment/` and `tests/tools/`, using injected fetch with a fixture cut from the 2026-08-08 session so the known answer is regression-locked.
- **Docs**: `docs/personal/track-context.md` §8's manual method note is superseded by the Tool and should point at it; the 3-second-stride claim is corrected to 1 Hz.
