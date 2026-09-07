## Why

Timed lap splits are the highest-value measurement this project holds. A 2 km individual pursuit is
decided by eight numbers; they are model-free, self-verifiable, and the only quantity that survives a
change of MAP, air density or aero model. They have no home in the system.

`compute_track_lap_power` and `write_track_runs` take the lap-timer export as an inline string
(`src/tools/track-lap-alignment.ts:11`), parse it to `RunSplits[]` in memory, and discard it. What
survives a session is a hand-typed prose table, and there are now **six shapes of that table across
three files**:

- `docs/personal/track-context.md` §4 — a full race table (`Lap | Cum | Split | Speed | Cadence |
Modelled W`) for Nationals 2026 and 2025, a segment-decomposition table, a 2025-vs-2026 head-to-head
  delta table, and a transposed per-run shape for the 12 Jul 2026 training session.
- `docs/personal/season.md:71–84` — a three-race benchmark table for 6 Sept BMRC that **restates the
  2025 and 2026 Nationals lap columns** so it can show deltas against them.
- `docs/personal/coaching-log.md:107` — the same splits again, inline and slash-separated.

Every one of those is transcribed by hand from a tool response, and every derived row — the Δ column,
the flying-portion sum, the segment sums, `Decline, (v₂₋₄/v₆₋₈)³` — is recomputed by hand for each new
ride. The 2025 Nationals splits exist in the repo three times over. Adding a race means hand-building
another cross-reference table against every race already recorded, which is quadratic work with a
transcription risk on each cell.

The skill layer makes it worse: `track-context.md` is not in the `coaching-session` session-start
stack (`.claude/skills/coaching-session/SKILL.md:12-22`). It is reachable only through a prose pointer
at `season.md:131`, so a session that never opens it never sees the lap record at all. `ride-analyst`
does not read it either, and re-derives from streams what the reference tier already holds exactly.

## What Changes

- Timed splits become **tracked record files**, one per session, in the private `docs/personal/`
  repo where personal race data already lives. Frontmatter carries the measurement basis (date,
  kind, event, gear, rollout, crank length, suit, lap distance, optional `activityId`, provenance);
  the body carries prose plus one fenced `splits` block holding the export verbatim.
- The `splits` block is **exactly the CSV `parseLapSplits` already accepts and reconciles**
  (`src/services/track-lap-alignment/splits.ts`). Nothing new parses splits, and the existing
  self-verification — lap times must sum to the cumulative column, distance must advance by the lap
  length — now guards the durable record rather than one tool call.
- A new read-only service and three Tools: `list_track_sessions`, `get_track_session` (the full
  derived lap table for each run) and `compare_track_sessions` (the head-to-head table `season.md`
  builds by hand, from any 2+ run references).
- The four existing records are migrated to files, and the prose tables that duplicate them are
  replaced by pointers. The **findings** stay where they are — this moves the measurement, not the
  coaching.

**Records store raw measured splits only.** Nothing derived is stored. Speed, cadence, flying
portion, segment sums, Σv² and decline are recomputed on read, so no record can go stale when MAP,
ρ or the aero model moves — which is exactly what the stored `% MAP (415)` and `Modelled W` columns
in `track-context.md` §4 currently do.

The split of what is derived where is deliberate:

| Quantity                                                                                        | Source                                                   |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Split, cumulative, speed (`lapDistance/lapTime`), cadence (`v·60/development`)                  | This service — model-free, from the record alone         |
| Flying portion, segment sums, Σv², RMS speed, flat-equivalent gain, decline `(v_open/v_close)³` | This service — the arithmetic §4 and §5 do by hand       |
| Per-lap **watts and heart rate**                                                                | The existing `track-lap-alignment` capability, unchanged |
| Modelled W from the aero model                                                                  | **Not implemented**                                      |

The aero model stays out of code on purpose. `track-context.md` §6 measures it over-reading ~6%
against the SRM, and §3 records that its weakest constant (ρ) moves the answer by ~6% on its own.
Putting it behind a Tool would lend it an authority the measurement says it has not earned. Where a
ride has no SRM — the two Nationals races — its modelled column stays in prose, labelled as model
output.

Non-goals: writing records (they are authored and edited as files, as `coaching-log.md` already is);
storing derived figures; implementing the aero model; changing `track-lap-alignment` or
`track-lap-writeback`; any write path to Intervals.icu.

## Capabilities

### New Capabilities

- `track-session-records`: a durable, tracked record of the timed splits for one track session, and
  the model-free quantities derived from it — per-lap speed and cadence, run and flying-portion
  aggregates, segment decomposition, decline, and the head-to-head comparison of any two or more runs.

### Modified Capabilities

None. `track-lap-alignment` and `track-lap-writeback` are untouched; this capability supplies the
timing half of the same join and reuses their split parser.

## Impact

- **New service** `src/services/track-sessions/` (`types.ts`, `loader.ts`, `derive.ts`, `compare.ts`,
  `index.ts`) behind an `ITrackSessions` interface, composed into `IntervalsClient`.
- **New tool handler** `src/tools/track-sessions.ts` and three `READ_ONLY` entries in
  `src/registry.ts`; both Adapters pick them up. `list_`/`get_`/`compare_` prefixes put all three
  under the existing read-only allowlist.
- **No network access.** The service reads the filesystem only. It touches no Intervals.icu endpoint
  and needs no API key — the first Tool in the registry that does not.
- **Path resolution differs from `workout-library` and the difference matters.**
  `templates/workouts/` is tracked and ships in the bundle, so `loadTemplates` is right to be strict
  about a missing directory. `docs/personal/` is gitignored and private, so its absence is the normal
  case for anyone but this athlete: a missing or empty directory yields an empty list plus a note
  naming where it looked, never a throw. Overridable by `INTERVALS_TRACK_SESSIONS_DIR`.
- **Tests** under `tests/services/track-sessions/` and `tests/tools/`, with fixture records under
  `tests/fixtures/track-sessions/`, including one that deliberately fails reconciliation.
- **Docs**: `CONTEXT.md` gains the vocabulary (extending the existing **Lap-split record** entry at
  `CONTEXT.md:99-101` rather than duplicating it); a new ADR records why splits are the durable
  measurement and why nothing derived is stored; `track-context.md` §4 and `season.md`'s benchmark
  table lose their tables and keep their findings.
- **Skills**: `coaching-session` gains a Scope row and a session-start line; `ride-analyst` is
  pointed at the record for timed laps, keeping its rule that the SRM is the reference for power.
