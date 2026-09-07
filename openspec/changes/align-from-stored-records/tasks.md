## 1. Read path on the record service

- [x] 1.1 Add `serializeSplits` in `src/services/track-sessions/splits-source.ts` — re-serialise the parsed runs, not the raw block, so the alignment gets the numbers reconciliation passed
- [x] 1.2 Add `resolveTrackSplits(sessionId, records)`: splits, `activityId` (absent when the record has none), `lapDistanceMeters` and the run labels; unknown id names the available sessions
- [x] 1.3 Add `TrackSplitsSource` to `types.ts` and `resolveTrackSplits` to `ITrackSessions`, synchronous — its callers are assembling another call's arguments
- [x] 1.4 Expose it on `IIntervalsClient` and delegate from `IntervalsClient`
- [x] 1.5 Tests: round-trip through `parseLapSplits` to the same runs, a record with no activity, an unknown id, and no records loaded

## 2. Shared tool input

- [x] 2.1 Create `src/tools/track-inputs.ts` with the four shared fields, so the two tools cannot drift apart
- [x] 2.2 Move the duplicated `normalizeActivityId` there
- [x] 2.3 Implement `resolveTrackInputs`: refuse both, refuse neither, refuse pasted splits with no activity, refuse a record with no activity, and let a supplied activity or lap distance override the record's
- [x] 2.4 Keep the check in the handler rather than a Zod refinement — the MCP adapter registers `schema.shape`, which `.refine()` erases
- [x] 2.5 Rewrite both schemas over the shared fields and both handlers over `resolveTrackInputs`
- [x] 2.6 Tests for every refused combination and both override paths

## 3. Verify against the real records

- [x] 3.1 `./bin/icu compute_track_lap_power --json '{"sessionId":"2026-09-06-bmrc-ip"}'` — strong fit, 8 laps, no pasted input
- [x] 3.2 `./bin/icu write_track_runs --json '{"sessionId":"2026-09-06-bmrc-ip","preview":true}' --yes` — one run previewed from the record
- [x] 3.3 `2025-nationals-ip` refused by name, for having no ride behind it
- [x] 3.4 Full suite and `tsc --noEmit` green

## 4. Docs

- [x] 4.1 ADR 0008 gains "Closing the loop: the export is never pasted twice"
- [x] 4.2 `compute_track_lap_power`'s registry description names `sessionId` as the preferred form
- [x] 4.3 README row, `coaching-session` session-start note, `ride-analyst` track bullet
- [x] 4.4 Sync the two spec deltas and archive this change
