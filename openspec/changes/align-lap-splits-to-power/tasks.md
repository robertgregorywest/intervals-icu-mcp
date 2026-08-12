## 1. Fixture and service skeleton

- [x] 1.1 Cut a stream fixture from activity `i173732945` — the four effort windows plus 25 s either side of `time`, `watts`, `cadence`, `heartrate` — into `tests/fixtures/track-session-2026-08-08.json`, with a note recording the source activity and that offsets are relative to the fixture's own origin
- [x] 1.2 Create `src/services/track-lap-alignment/types.ts`: `LapSplit`, `RunSplits`, `AlignedLap`, `AlignedRun`, `AlignmentConfidence` (rms, offset interval, next-best offset and its residual, verdict, thresholds used), `TrackLapAlignmentResult`
- [x] 1.3 Create `src/services/track-lap-alignment/index.ts` exporting `ITrackLapAlignment` and a `createTrackLapAlignment(activitiesApi)` factory, with a stub implementation so the module type-checks

## 2. Split parsing and reconciliation

- [x] 2.1 Implement `splits.ts`: parse the exported CSV text (header row tolerated, columns run / cumulative distance / cumulative time / lap time) into `RunSplits[]`, preserving run order
- [x] 2.2 Reject with a named error when the text cannot be parsed, when a run's lap times do not sum to its cumulative times within tolerance, or when cumulative distance does not advance by the lap distance
- [x] 2.3 Support a caller-supplied lap distance defaulting to 250 m
- [x] 2.4 Tests for 2.1–2.3, including the issue's 2026-08-08 export pasted verbatim and a deliberately inconsistent run

## 3. Candidate window detection

- [x] 3.1 Implement `windows.ts`: smooth cadence, find maximal stretches above a high-cadence threshold derived from the session's own distribution, and drop stretches shorter than the shortest run
- [x] 3.2 Assign runs to windows one-to-one in chronological order; reject a run by name when no unclaimed window can hold its duration
- [x] 3.3 Tests: the fixture yields four windows and the four runs claim them in order; two same-length runs never claim the same window

## 4. Offset fit and confidence

- [x] 4.1 Implement `fit.ts`: for a candidate offset, compute each lap's mean recorded cadence by time-weighted apportionment, solve the closed-form optimal rollout, and return the residual
- [x] 4.2 Sweep each run's window ±25 s in a single 0.02 s pass (coarse-then-refine dropped: the curve is cheap and too flat for a coarse basin choice to be safe)
- [x] 4.3 Derive the offset interval (offsets whose residual is within tolerance of the best) and the next-best distinct offset more than 2 s away
- [x] 4.4 Classify the verdict — strong ≤ 1.0 rpm, marginal ≤ 2.0 rpm, weak above, ambiguous when the next-best distinct residual is within 15%, and weak whenever the offset interval covers half the range searched however low the residual — and return the thresholds alongside it
- [x] 4.5 Exclude laps with missing or non-positive cadence samples from the fit; report the run weak when too few laps remain
- [x] 4.6 Tests: each fixture run fits under 1.0 rpm; the rollout recovered by the four runs agrees within 0.5%; an unconstrained global search is not reachable by any input

## 5. Aligned readings

- [x] 5.1 Implement `align.ts`: cut per-lap power, cadence and heart rate at the fitted boundaries with straddling samples apportioned, plus the run-level aggregates
- [x] 5.2 Re-evaluate every figure at both edges of the offset interval and attach the resulting spread to each lap and to the run
- [x] 5.3 Report absent streams as absent rather than zero; withhold per-lap output and state why when the run's verdict is weak or ambiguous, or when the streams carry fewer than 8 samples per lap
- [x] 5.4 Reject the request with a named error when the activity carries no cadence stream
- [x] 5.5 Tests: run 1 reads 376 W over 114.26 s and run 2 380 W over 113.42 s; the final lap carries a visibly wider band than the middle laps; run 3 is reported ambiguous with per-lap withheld; a fixture stripped of cadence is rejected; a fixture decimated to a 3 s stride withholds per-lap output

## 6. Tool and registration

- [x] 6.1 Implement `src/tools/track-lap-alignment.ts` — `computeTrackLapPowerSchema`, handler, and output schema
- [x] 6.2 Register `compute_track_lap_power` in `src/registry.ts` with read-only annotations
- [x] 6.3 Verify both Projections: `./bin/icu describe` lists the command, and `./bin/icu compute_track_lap_power --json ...` reproduces the fixture's answer against the live activity
- [x] 6.4 Tool-level tests with injected fetch

## 7. Documentation

- [x] 7.1 Update `docs/personal/track-context.md` §8 — point the manual method at the Tool, and correct the 3-second-stride claim to the 1 Hz the API returns for this session, keeping the trap it documents
- [x] 7.2 Record the fitted-development finding against `track-context.md` §1 — 8.332–8.369 m per assumed 250 m lap, ~2% below the 8.526 m/rev the 110" gear gives, with both candidate explanations left open
- [x] 7.3 Add the capability to `CONTEXT.md` vocabulary if alignment or rollout introduces a term the glossary does not already carry
