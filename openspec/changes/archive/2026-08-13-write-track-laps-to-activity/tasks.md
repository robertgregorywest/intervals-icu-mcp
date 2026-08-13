## 1. Activities API surface

- [x] 1.1 Add `ActivityIntervalsDoc` (`{ id, analyzed, icu_intervals, icu_groups }`) and `IntervalWrite` (`{ type, start_index, end_index, label }`) to `src/services/activities/types.ts`, documenting that only `start_index`/`end_index`/`label` are honoured and that `type` and every metric are the platform's
- [x] 1.2 Add `getActivityIntervals(id)` to `IActivitiesApi` over `GET /api/v1/activity/{id}/intervals`
- [x] 1.3 Add `replaceActivityIntervals(id, intervals)` over `PUT /api/v1/activity/{id}/intervals?all=true`, sending a bare JSON array, returning the `ActivityIntervalsDoc` the platform responds with
- [x] 1.4 Capture the probe response from activity `i173176564` as a test fixture and add `tests/services/activities` coverage for both methods against injected fetch — asserting the request body is an array, that no metric fields are sent, and that the query carries `all=true`

## 2. Writeback service

- [x] 2.1 Create `src/services/track-lap-writeback/` with `types.ts` — `TrackRunWriteOptions` (activityId, splits, lapDistanceMeters, preview), `WrittenRun` (run, label, verdict, reason, startIndex, endIndex, startDriftSeconds, endDriftSeconds, fittedReading, snappedReading), `TrackRunWriteResult` (mode, written runs, intervalsReplaced, backfill note)
- [x] 2.2 Implement boundary snapping in `snap.ts`: map each run's fitted start and end (`startOffsetSeconds`, `+ durationSeconds`) to sample indices via the activity's own `time` stream, and return per-boundary drift in seconds
- [x] 2.3 Implement label composition: `Run <run>` for a `strong` fit, `Run <run> (<verdict> fit)` otherwise, with the run identifier taken verbatim from the lap-split record
- [x] 2.4 Implement the snapped re-read: compute each run's average power/cadence/HR over the snapped window using the existing `windowMean`, and carry it beside the alignment's fitted reading
- [x] 2.5 Implement the write path — read existing intervals to count what is being replaced, then replace; in preview mode do everything except the replace and mark the result as a preview
- [x] 2.6 Refuse before writing on every condition the alignment refuses on, letting `TrackAlignmentError` propagate untouched so the messages stay identical to the read-only tool's; write nothing when the alignment places no run
- [x] 2.7 Add `index.ts` exporting `ITrackLapWriteback`, the class, and `createTrackLapWriteback`, following the service-module convention

## 3. Service tests

- [x] 3.1 Run geometry: a four-run session produces four intervals, each spanning its run's first lap start to last lap end, with the rolling entry outside every one
- [x] 3.2 Snapping: a run boundary at a fractional second snaps to the nearer sample and reports the drift; the snapped reading is returned beside the fitted one
- [x] 3.3 Labels: a strong run is labelled with the run identifier alone; a `weak` or `ambiguous` run carries its verdict in the label and its reason in the response
- [x] 3.4 Every placed run is written regardless of verdict — a session of three strong runs and one weak run writes four intervals, none dropped
- [x] 3.5 Idempotence: writing the same session twice produces the same interval set, and the second result reports the first write's intervals as replaced
- [x] 3.6 Preview: no write is issued, the result is marked as a preview, and its intervals and labels match those a real write produces from the same input
- [x] 3.7 Refusal: no cadence stream, unparseable splits, and non-reconciling splits each reject before any write is attempted; a platform rejection of the write surfaces as a failure, not a partial success
- [x] 3.8 Nothing placeable: when the alignment places no run, nothing is written and the activity's intervals are left untouched

## 4. Tool and registration

- [x] 4.1 Add `src/tools/track-lap-writeback.ts` — `writeTrackRunsSchema` (reusing the `compute_track_lap_power` field descriptions for activityId/splits/lapDistanceMeters, plus `preview`) and `writeTrackRunsOutputSchema`
- [x] 4.2 Register `write_track_runs` in `src/registry.ts` with the destructive annotation set (`readOnlyHint: false`, `destructiveHint: true`), a description stating that one interval is written per run, that the whole interval set is replaced, that boundaries are snapped and the drift reported, and that a non-strong verdict appears in the label and is overwritten on the next write
- [x] 4.3 Compose the service into `IntervalsClient` in `src/index.ts` and expose `writeTrackRuns` on `IIntervalsClient`
- [x] 4.4 Declare the tool in `manifest.json`
- [x] 4.5 Verify the CLI projection: `./bin/icu describe` lists it and it refuses to run without `--yes`

## 5. Documentation

- [x] 5.1 Add _run label_, _boundary snap_ and _snap drift_ to `CONTEXT.md`, each with its `_Avoid_` line — in particular, never reading a written run as a device lap, and never quoting a snapped figure as the fitted one
- [x] 5.2 Add the intervals read/write endpoints, and the probe findings that are not obvious from the schema (bare array body, metrics recomputed, `type` overridden, gaps backfilled), to `.claude/skills/intervals-api-research/endpoint-reference.md`
- [x] 5.3 Note in `docs/adr/0006-device-laps-as-the-execution-record.md` that this change writes into the derived `icu_intervals` layer, and why that does not disturb the ADR's position that device laps are the record

## 6. Verify against a real session

- [x] 6.1 Preview the write for a real track session and check the run boundaries, labels and snap drift read correctly
- [x] 6.2 With the user's go-ahead, perform the write and confirm in the Intervals.icu UI that each run appears as one interval, is labelled, starts at the line rather than at the rolling entry, and that the platform's figures match the reported snapped readings
- [x] 6.3 Re-run the write and confirm the interval count is unchanged
