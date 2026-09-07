## Why

`add-track-session-records` gave timed splits a durable home and listed changing the two alignment
tools as an explicit non-goal, to keep that change to one seam. The consequence is now visible: a
session is filed as a record **and** pasted into `compute_track_lap_power`, so the same eight numbers
are typed twice.

The second transcription is the one that is not checked. A record's `splits` block is reconciled on
every read — lap times must sum to the cumulative column, distance must advance by the lap length —
but a pasted export is reconciled only against itself. Paste the 6 Sept splits with one digit wrong
and they still reconcile; the alignment then fits a slightly wrong cadence curve against the SRM and
returns a plausible answer, and nothing in the system disagrees with it.

The activity id has the same defect in a quieter form. The record already carries `activityId:` and
`lapDistanceMeters:`, and a caller retyping the activity has one more chance to align an export
against the wrong ride.

## What Changes

- `compute_track_lap_power` and `write_track_runs` accept **`sessionId`** as an alternative to
  `splits`. Given one, they take the export, the `activityId` and the `lapDistanceMeters` from the
  stored record's basis.
- The splits handed over are **re-serialised from the parsed record**, not the raw block text, so the
  alignment receives exactly the run/lap numbers the reconciliation passed.
- `splits` and `sessionId` are **mutually exclusive**. They could disagree and there is no principled
  way to pick a winner, so a call carrying both is refused rather than silently preferring one.
- `activityId` remains overridable and remains required when there is no record to take it from. A
  record need not carry one — 2025 Nationals is a timing export with no ride behind it — and asking
  to align such a record says so rather than failing inside the stream fetch.

Non-goals: any change to how the alignment itself is fitted, scored or written; any write path into
a record; making `sessionId` the only accepted form — a session timed before it is filed still has to
be pasted.

## Capabilities

### Modified Capabilities

- `track-lap-alignment`: the lap-split input may name a stored track session record instead of
  carrying the export inline.
- `track-lap-writeback`: the same input choice, since the writeback takes the alignment's inputs
  unchanged and must stay able to write what the alignment previewed.

### New Capabilities

None. `track-session-records` gains a read path used by these two tools, which is within the
capability it already has.

## Impact

- **New shared module** `src/tools/track-inputs.ts` holding the input fields both tools share, the
  pasted-or-stored resolution, and the `normalizeActivityId` helper that was duplicated in both
  handlers. The two shapes must not drift: an alignment previewed by `compute_track_lap_power` and
  then written by `write_track_runs` has to be the same alignment.
- **The mutual exclusion lives in the handler, not the schema.** The MCP adapter registers
  `schema.shape` (`src/mcp/server.ts:26`), which only a plain `ZodObject` has — a `.refine()` would
  erase it — so `activityId` and `splits` become optional in the schema and the combination is
  checked where the call is served.
- **New service function** `resolveTrackSplits` on `ITrackSessions`, exposed on `IIntervalsClient`.
  It is synchronous, alone among the client's methods: it reads local files, and its callers are tool
  handlers assembling another call's arguments rather than returning a result.
- **Tests** at both levels — the round trip through `parseLapSplits` in
  `tests/services/track-sessions/splits-source.test.ts`, and every refused combination in
  `tests/tools/track-inputs.test.ts`.
- **Docs**: ADR 0008 gains the reasoning; the `compute_track_lap_power` registry description, the
  README row, `coaching-session` and `ride-analyst` all point at `sessionId` as the preferred form.
