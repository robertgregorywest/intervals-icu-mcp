## Why

`compute_track_lap_power` recovers where every scored run of a track session sits inside the activity, but the answer lives only in a tool response. The activity on Intervals.icu still shows whatever its auto-detection guessed, so the athlete cannot see the runs on the chart, cannot click through to one, and cannot use any of Intervals.icu's own interval machinery — the power curve per interval, the interval-search across sessions, the side-by-side comparison — against the efforts they actually rode. The alignment is the hard part and it is already done; what is missing is writing the result back so the runs become first-class objects in the tool the athlete works in.

## What Changes

- A new Tool, `write_track_runs`, that takes the same inputs as `compute_track_lap_power` (activity, lap-split record, lap distance), runs the same alignment, and writes the fitted runs onto the activity as Intervals.icu intervals via `PUT /api/v1/activity/{id}/intervals`.
- **One interval per scored run**, spanning the start of the run's first timed lap to the end of its last. Individual laps are not written. The run interval therefore inherits the alignment's exclusion of the rolling entry: the wind-up laps fall outside it, which is precisely the boundary Intervals.icu's own detection gets wrong.
- Each written interval carries a **run label** naming the run verbatim as the lap-split record gave it, plus its alignment verdict when that verdict is not `strong` (e.g. `Run 2 (ambiguous fit)`). The label is the only field Intervals.icu preserves — every metric it recomputes itself from the boundaries — so it is also the only place a shaky placement can be flagged where the athlete will actually see it.
- The write **replaces** the activity's whole interval set (`?all=true`), so re-running is idempotent rather than accumulating duplicates. Intervals.icu backfills the stretches between runs with its own intervals, so the athlete keeps a complete partition of the activity rather than isolated efforts.
- Because Intervals.icu anchors intervals to integer stream sample indices while the alignment places runs at fractional seconds, each boundary is **snapped** to the nearest sample and the tool reports, per run, how far the boundary moved and how the snapped reading differs from the fitted one. Snapping is never silent.
- Every run the alignment placed is written, whatever its verdict — run-level readings are robust across the offset interval even where per-lap ones are withheld, so a `weak` or `ambiguous` run is written and labelled as such rather than dropped.
- A dry-run mode returns the intervals that _would_ be written, with their labels and snap drift, without touching the activity.
- The Tool is mutating and destructive (it discards the activity's existing intervals), so it is annotated as such and gated behind `--yes` on the CLI adapter.

## Capabilities

### New Capabilities

- `track-lap-writeback`: Writing a fitted track lap alignment onto the Intervals.icu activity as intervals — the run as the written unit, label composition, boundary snapping and its disclosure, and replace-the-whole-set semantics.

### Modified Capabilities

<!-- None. `track-lap-alignment` keeps its requirements unchanged: the new capability consumes its result and adds nothing to what the alignment itself must do. -->

## Impact

- **New service** `src/services/track-lap-writeback/` — composes labels, snaps run boundaries to sample indices, and calls the intervals write. Depends on the existing `ITrackLapAlignment` and on a new write method on `IActivitiesApi`.
- **`src/services/activities/`** — `IActivitiesApi` gains `replaceActivityIntervals(id, intervals)` wrapping `PUT /api/v1/activity/{id}/intervals?all=true`, plus `getActivityIntervals(id)` over `GET .../intervals` so the tool can report what it replaced.
- **`src/tools/`, `src/registry.ts`** — one new Tool entry; both adapters project it automatically.
- **`src/index.ts`** — `IntervalsClient` composes the new service.
- **`manifest.json`** — declare the new tool for the mcpb build.
- **`CONTEXT.md`** — new vocabulary: _run label_, _boundary snap_, _snap drift_.
- **Intervals.icu API** — first write against `/api/v1/activity/{id}/intervals`. Production data: the write discards an activity's existing interval analysis.
