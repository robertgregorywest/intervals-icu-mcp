## 1. Record format and loader

- [x] 1.1 Create `src/services/track-sessions/types.ts`: `SessionBasis` (id, date, kind, event, venue, gear, rolloutMm, developmentMeters, crankLengthMm, suit, lapDistanceMeters, activityId, source, per-run overrides), `TrackSessionRecord`, `RunStart`, and the derived shapes `DerivedLap`, `SegmentSummary`, `RunSummary`, `DerivedRun`, `TrackSessionDetail`, `TrackSessionListing`, `RunComparison`
- [x] 1.2 Implement `record.ts`: parse one record file — frontmatter validated by Zod, prose, and the fenced ` ```splits ` block — and hand the block **verbatim** to `parseLapSplits` from `track-lap-alignment`. No second splits parser
- [x] 1.3 Reject with a named error when frontmatter is missing or invalid, when there is no `splits` block, or when a run named in `runs:` is absent from the export
- [x] 1.4 Implement `loader.ts`: module-relative default `../../../docs/personal/track`, overridable by `INTERVALS_TRACK_SESSIONS_DIR`. A missing or empty directory returns an empty list plus a note naming the path — **not** a throw, unlike `workout-library/loader.ts`
- [x] 1.5 Reject a duplicate `id` across files, naming both files, the way `loadTemplates` does for `seedId`
- [x] 1.6 Tests for 1.2–1.5 against fixtures in `tests/fixtures/track-sessions/`, including a record whose lap times do not reconcile and one whose directory is absent

## 2. Derivation

- [x] 2.1 Implement `derive.ts` development: `(chainring / cog) × rolloutMm / 1000`, overridden by an explicit `developmentMeters`. No gear-inch input or output anywhere
- [x] 2.2 Per-lap speed (`lapDistance / lapTime`) and cadence (`speed × 60 / development`)
- [x] 2.3 Flying portion: laps 2…n for a `gate` or `standing` start, all laps for `flying`. Every aggregate is taken over it; the standing lap is reported in full and excluded from all of them
- [x] 2.4 Segments: first and last `N = min(3, floor((flyingLaps − 1) / 2))` laps of the flying portion, overridable; report absent rather than overlapping when `N < 1`
- [x] 2.5 Decline `(v_close / v_open)³ − 1`, and the Σv² block — sum of squared speeds, RMS speed, flat-equivalent time, and the redistribution gain `t_actual − t_flat`
- [x] 2.6 Tests: Nationals 2026 reproduces `track-context.md` §4 — lap 2 at 16.036 m/s, flying 112.21 s / 15.60 m/s / 16.03 s mean, Σv² 1707.29, RMS 15.617, flat-equivalent 112.06, gain 0.15 s; 2025 reproduces its 0.08 s; the 6 Sept and both Nationals reproduce the −12.3 / −16.8 / −12.5% decline row from `season.md:84`
- [x] 2.7 Test that cadence lands within 0.05 rpm of §4's stated figures, and record in the test why it is not exact (§1's development is quoted to 4 significant figures)

## 3. Comparison

- [x] 3.1 Implement `compare.ts`: resolve `<sessionId>` or `<sessionId>#<run>` references, defaulting a bare session id to its only run and rejecting a bare id for a multi-run session by naming the runs available
- [x] 3.2 Per lap position, report each run's value and its difference against the **first** reference listed; per run, report total, flying, segment times and decline
- [x] 3.3 Refuse runs whose flying portions differ in lap count, naming both runs and their counts. No partial table
- [x] 3.4 Tests: the three-race comparison reproduces `season.md:71–84` including the +0.92 / −0.20 totals and the +0.94 / +0.15 flying row; reversing the reference order flips the sign and leaves lap values unchanged; a 1500 m run against a 2 km run is refused

## 4. Service, tools and registration

- [x] 4.1 `src/services/track-sessions/index.ts` — `ITrackSessions` plus a `createTrackSessions(deps)` factory taking the records directory, following the service pattern in `CLAUDE.md`
- [x] 4.2 Compose into `IntervalsClient` (`src/index.ts`) and add the three methods to `IIntervalsClient`. The service takes no `IHttpClient` — it is the first that reads no endpoint
- [x] 4.3 `src/tools/track-sessions.ts` — schemas, handlers and output schemas for `list_track_sessions`, `get_track_session`, `compare_track_sessions`
- [x] 4.4 Three `READ_ONLY` entries in `src/registry.ts`; verify both adapters pick them up (`./bin/icu describe | grep track_session`)
- [x] 4.5 Tool-level tests under `tests/tools/`

## 5. Migrate the records

- [x] 5.1 `docs/personal/track/2026-nationals-ip.md` from `track-context.md:157–166`
- [x] 5.2 `docs/personal/track/2025-nationals-ip.md` from `track-context.md:182–191` — no `activityId`, `source: timing export`
- [x] 5.3 `docs/personal/track/2026-07-12-training.md` from `track-context.md:245–264` — three runs, all flying, prescriptions carried into `runs:`
- [x] 5.4 `docs/personal/track/2026-09-06-bmrc-ip.md` from `season.md:71–84` (`i183857008`), with the lapped-rider contamination in the prose
- [x] 5.5 **Skipped — the export is not to hand.** Everything the repo holds for 8 Aug is aggregate: `coaching-log.md:77` gives per-run mean lap times and SDs (16.32 / SD 0.084, 16.20 / SD 0.102), `track-context.md:74` gives fitted developments per run, and `i173732945`'s laps are the four whole-run windows `write_track_runs` put there (114 s, 113 s, 132 s, 131 s), not laps. A mean and an SD do not determine seven lap times, so there is no record to write without inventing one
- [x] 5.6 Verify every migrated record loads and reproduces its prose figures — reconciliation catches a transcription slip, and §4's stated speeds are the oracle

## 6. Thin the prose

- [x] 6.1 `track-context.md` §4 — delete the lap tables, keep the findings and the section number (`src/` comments and an archived change cite §1, §6 and §8 positionally). Point at `docs/personal/track/` and at `compare_track_sessions`
- [x] 6.2 Keep the 2025/2026 `Modelled W` columns in §4, explicitly labelled as aero-model output at ρ = 1.20 and read against §6's ~6% over-read — they are the one thing with no tool behind them
- [x] 6.3 `season.md` — delete the benchmark table, keep the three findings and the SRM line, add the `compare_track_sessions` pointer
- [x] 6.4 Correct the inverted decline label while moving it: the quantity is `(v_close/v_open)³ − 1`, not `(v₂₋₄/v₆₋₈)³`

## 7. Vocabulary, ADR and skills

- [x] 7.1 `CONTEXT.md` — extend the existing **Lap-split record** entry (`:99-101`) rather than duplicating it, and add **Track session record**, **Run** vs **Session**, **Flying portion**, **Decline**
- [x] 7.2 `docs/adr/0008-timed-splits-are-tracked-records.md` — why splits are the durable measurement, why nothing derived is stored, why the aero model stays out of code
- [x] 7.3 `.claude/skills/coaching-session/SKILL.md` — a Scope row for track/IP analysis and a session-start line: a new race is filed as a record, not typed into `season.md`
- [x] 7.4 `.claude/agents/ride-analyst.md` — point it at `get_track_session` for timed laps, keeping "the SRM is the reference" for power
- [x] 7.5 `README.md` tool table and count

## 8. Close out

- [ ] 8.1 `npm test` green; `tsc --noEmit` clean
- [ ] 8.2 Commit along the natural seams: OpenSpec proposal, service + tools, records (private repo), prose + docs
- [ ] 8.3 `git -C docs/personal status -sb --porcelain` clean and pushed — a record that is never pushed exists on one machine only
- [ ] 8.4 Sync specs, then archive the change as separate commits
