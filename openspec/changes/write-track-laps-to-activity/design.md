## Context

See `proposal.md` — Why. The alignment already exists (`src/services/track-lap-alignment/`, spec `openspec/specs/track-lap-alignment/spec.md`); this change is the write half.

The design rests on a live probe of `PUT /api/v1/activity/{id}/intervals` run against activity `i173176564` on 2026-08-13 (snapshot taken, test intervals written, response inspected, original restored and diffed). What it established:

- **The body is a bare JSON array of `Interval`, not an object.** `?all=true` (the default) replaces; `all=false` merges. The response is an `IntervalsDTO`: `{ id, analyzed, icu_intervals[], icu_groups[] }`.
- **Intervals.icu recomputes every metric from the boundaries.** Sending `{type, start_index, end_index, label}` for indices 904–920 came back with `average_watts: 359`, `average_cadence: 84.06`, `average_heartrate: 114`, `distance: 160.32`, `intensity`, `training_load`, `zone`, weather — the full derived set. Nothing we send in a metric field survives, so sending metrics is at best noise and at worst a lie we cannot enforce.
- **`label` is the one field preserved verbatim.** It came back exactly as sent. It is the entire channel we own — which is why the alignment verdict rides in it.
- **`type` is NOT honoured.** An interval sent as `RECOVERY` came back `WORK`. Restoring the snapshot confirmed it from the other direction: two intervals whose original type was `RECOVERY` came back `WORK` when re-sent with that type. Intervals.icu derives `type` itself for a caller-supplied set.
- **Gaps are backfilled.** Writing two intervals covering samples 904–934 of a 4340-sample activity returned **four** intervals: ours, plus `0–904` and `934–4340` that Intervals.icu invented to partition the whole ride. You cannot write efforts in isolation; the platform always returns a complete partition.
- **Boundaries are stream sample indices.** For a 1 Hz recording they equal seconds, but the code must derive the mapping from the `time` stream rather than assume it — the alignment already computes `samplingIntervalSeconds` and must not lose that discipline here.
- **The restore was exact.** Re-sending the snapshot's boundaries reproduced every metric to the digit, which is what makes replace-and-rewrite a safe, reversible operation.

`docs/adr/0006-device-laps-as-the-execution-record.md` matters for scope: `icu_intervals` is explicitly documented in this repo as a _derived, editable interpretation_, not the execution record. That is exactly what makes it legitimate to overwrite — and exactly why the written runs must not be confused with device laps.

## Goals / Non-Goals

**Goals:**

- Get the fitted runs onto the activity with the least surface area: two boundaries and a label per run.
- Make every difference between what the alignment computed and what the platform will show visible in the response, at the run level.
- Keep the write idempotent, so it is safe to re-run after correcting a lap-split record.
- Reuse the alignment unchanged. This change adds no fitting logic.

**Non-Goals:**

- Writing individual laps as intervals. A track lap is 15–20 s; a session of four runs would put ~30 intervals on the chart, each shorter than Intervals.icu's own analysis resolution, and the chart would be unreadable at exactly the moment it was supposed to become useful. The run is the unit the athlete reasons about.
- Editing individual intervals in place (`PUT /activity/{id}/intervals/{intervalId}`) or splitting them (`/split-interval`). Replace-the-set is simpler and idempotent.
- Preserving the activity's prior interval analysis. It is derived and Intervals.icu can re-derive it; ADR 0006 says so.
- Controlling `type` or `group_id`. The probe shows both are the platform's to decide.
- Writing to the FIT file or to device laps. Those are the immutable record; this writes the interpretation layer beside them.
- A general-purpose "write intervals" Tool. The capability is scoped to track writeback; a generic interval editor is a different change with different safety questions.

## Decisions

### The scored run is the written unit

**Chosen.** Each interval spans the start of a run's first timed lap to the end of its last — which is exactly the `AlignedRun`'s `startOffsetSeconds` through `startOffsetSeconds + durationSeconds`, so no new geometry is computed here.

The property that makes this worth writing at all is the one the alignment already fought for: the scored run **excludes the rolling entry**. Intervals.icu's own detection includes the wind-up, because from the power stream alone there is no way to see where the line was. That boundary is the single most valuable thing the alignment knows and the platform does not, and a run interval is how it gets onto the chart.

_Alternative considered:_ one interval per lap. Rejected — see Non-Goals. It also drags in problems that vanish at run granularity: shared boundaries needing to snap to a single index to stay contiguous, and per-lap snap drift of up to half a sample against a 16 s lap (~3%) rather than against a 114 s run (~0.4%).

### Replace the whole set (`?all=true`) rather than merge

**Chosen** because it is the only mode that makes re-running the tool a no-op-shaped operation. A merge (`all=false`) would leave the previous run's intervals in place alongside the new ones, and the caller has no handle to remove them — a correction to a lap-split record would compound rather than replace.

The cost is the activity's prior auto-detected intervals. Two things make that acceptable: they are derived (ADR 0006), and the response reports how many were discarded, so the loss is stated rather than silent.

_Alternative considered:_ merge, then delete the stale intervals by id via `/delete-intervals`. Rejected — it needs the tool to recognise its own prior writes by label, which turns a stateless operation into one that depends on labels it may not have written.

### Send `{start_index, end_index, label}` and nothing else

**Chosen** on the probe's evidence that everything else is either recomputed (metrics) or overridden (`type`). Sending a fitted average power in `average_watts` would be actively harmful: it would look authoritative in the request, be silently discarded, and mislead the next person reading the code into thinking the tool controls the figure.

`type` is sent as `WORK` for completeness of shape and documented as not honoured, rather than omitted and later mistaken for an oversight.

### The verdict rides in the label

Every placed run is written regardless of verdict — the alignment's own position is that run-level readings stay robust across the offset interval even where per-lap ones are withheld, so there is no ground to drop a run the alignment considers placed.

That makes disclosure the whole job, and the label is the only channel the platform preserves. A `weak` or `ambiguous` run written with a bare label would appear on the chart as a confidently-placed block, indistinguishable from a strong one, and the confidence report would be a response-shaped footnote nobody re-reads six weeks later. So: `Run 2` when strong, `Run 2 (ambiguous fit)` otherwise.

_Alternative considered:_ verdict in the response only. Rejected — it puts the caveat everywhere except where the data will actually be read.

### Snap to the nearest sample, and report the drift per run

The fitted boundaries are fractional; interval boundaries are sample indices. Something must give.

**Chosen:** snap to nearest, then re-read the run's average over the _snapped_ window and return it beside the fitted one. The caller sees two numbers and the boundary movement that separates them, so any disagreement between the activity and `compute_track_lap_power` is explained in the response rather than discovered later as a puzzle.

At run granularity the drift is bounded by half a sample on each end against a run of 100 s or more, so the readings will usually agree to the digit. That is a reason to report the drift cheaply, not a reason to skip it — the case where it _does_ matter is a coarse-sampled recording, which is exactly when nobody is watching for it.

_Alternative considered:_ silent snapping. Rejected — it makes the activity and the alignment tool disagree with no way to tell why, which is the failure mode this whole feature family is built to avoid.

### A `preview` flag rather than a separate Tool

One Tool with a boolean keeps the alignment, labelling and snapping on a single code path, so a preview cannot drift from the write it previews. The response carries the mode so a preview can never be misread as a completed write.

_Alternative considered:_ a separate `preview_track_runs` Tool. Rejected — two registry entries, two schemas, and one more place for the two paths to diverge.

### Service placement

A new `src/services/track-lap-writeback/` rather than extending `track-lap-alignment`. The alignment service is a pure computation over streams; adding a mutating dependency to it would compromise that. The new service depends on `ITrackLapAlignment` and on `IActivitiesApi`, and `IActivitiesApi` grows two methods (`getActivityIntervals`, `replaceActivityIntervals`) which belong there because they are activity-API surface, not track-specific.

The capability keeps the name `track-lap-writeback` even though runs are the written unit: what is being written back is the track _lap_ alignment, and the input is still a lap-split record.

## Risks / Trade-offs

- **The write destroys the activity's existing interval analysis** → Reported in the response (count of intervals replaced), declared `destructiveHint: true` so the CLI adapter gates it behind `--yes` and MCP clients can prompt, and offset by a preview mode. Intervals.icu can re-derive its analysis; ADR 0006 already establishes it as derived rather than a record.
- **Per-lap detail is no longer visible on the chart** → Deliberate. It remains available in full from `compute_track_lap_power`, which is where per-lap analysis belongs; the chart gets the unit the athlete reasons in.
- **Backfilled intervals between runs may confuse the caller** → The response distinguishes the intervals the tool wrote from those the platform added, and states the backfill behaviour explicitly, so an interval count larger than the run count reads as expected rather than as a bug.
- **A verdict qualifier in a label is permanent-looking** → It is overwritten on the next write, and the write is idempotent, so a re-run after an improved fit clears it. Worth stating in the tool description so nobody hand-edits the label in the UI expecting it to stick.
- **Snap drift makes the activity disagree with `compute_track_lap_power`** → Both figures are returned per run. This is disclosure, not elimination; the disagreement is inherent to a platform that indexes by sample.
- **`type` and `group_id` are outside our control** → Documented in the service, and the spec deliberately asserts nothing about them, so a future platform change in this area cannot break a requirement we made up.
- **Tests must not hit the live API** → The existing injectable-fetch convention covers it; the write path is exercised against a recorded response fixture captured from the probe, not against production.

## Migration Plan

No migration. The Tool is additive; no existing Tool changes behaviour. Rollback is deleting the registry entry. For an activity already written to, the rollback path for the _data_ is Intervals.icu's own interval re-detection, which is unaffected by anything this change installs.
