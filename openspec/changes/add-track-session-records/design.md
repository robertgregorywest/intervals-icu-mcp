# Design

## The record is the export plus its basis, and nothing else

A record file holds two things: the measurement basis needed to read the splits, and the splits.
Everything else is prose for a human.

````markdown
---
id: 2026-09-06-bmrc-ip
date: 2026-09-06
kind: race
event: 2 km IP
venue: Newport
gear: 64x16
rolloutMm: 2099
crankLengthMm: 165
suit: race
lapDistanceMeters: 250
activityId: i183857008
source: timing export
runs:
  qualifying:
    start: gate
    prescription: race split
---

Prose. Conditions, what was prescribed, contamination.

​`splits
run,cumDist,cumTime,lap
qualifying,250,22.86,22.86
qualifying,500,38.73,15.87
​`
````

`id` is the filename stem and the identity; a run is addressed `<id>#<run>`, reusing the `run`
label that `RunSplits` already carries verbatim from the export
(`src/services/track-lap-alignment/types.ts:22`).

The `splits` block is handed to `parseLapSplits` **unmodified**. That buys the reconciliation it
already performs — lap times must sum to the cumulative column within a per-lap tolerance, distance
must advance by the lap length, every run needs at least two laps — and it buys it at the point where
it matters most. Today a transcription slip in a pasted export is caught once, at the moment of the
tool call. In a record it is caught on **every read, forever**, and the error already names the run
and the size of the disagreement because the fix is always a transcription one.

Writing a second parser to be more permissive about the record format would throw that away. The
export's shape is not a burden worth easing.

## Why nothing derived is stored

`track-context.md` §4 stores `Modelled W` and `% MAP (415)` columns. Both are stale the moment MAP or
ρ moves, and neither announces it. The `% MAP` columns are pinned to a MAP of 415 in a heading; the
modelled watts are pinned to ρ = 1.20 nowhere in the table at all.

Splits are not like that. A lap time is a measurement, and it is still the same measurement in ten
years. So the record holds only what was measured, and the tool computes the rest on read. This is
the same argument ADR 0005 makes for workout templates — render from source, never re-anchor a stored
artefact — applied to a measurement rather than a prescription.

## Development, and the trap it sits next to

Cadence per lap needs metres per crank revolution:

```
development = (chainring / cog) × rolloutMm / 1000
```

For 65×16 at 2099 mm that is 8.5272 m/rev. **Never expressed in inches** — `CONTEXT.md:116` and
`track-context.md` §1 record that the nominal-27" convention lands ~2.9% low and cost a full analysis
cycle. The service therefore has no gear-inch output and no gear-inch input; `gear` is a ratio string
and `rolloutMm` a length.

`developmentMeters` may be given directly in frontmatter to override the computation, for a session
where the gear is not known but the development is.

Two developments exist and must not be confused. This one is **known** — the drivetrain's, from gear
and rollout. `track-lap-alignment` returns a **fitted** development, which is distance ridden per
revolution and equals the known one only if the rider covered exactly the assumed lap distance
(§1 records it landing ~0.4% under on both gears). This service reports the known one; the two
disagreeing is a finding, not a bug, and comparing them is the point.

## The derived quantities, and their exact definitions

Given lap times `t₁…tₙ` and lap distance `d`:

- **speed** `vᵢ = d / tᵢ`. Model-free and exact.
- **cadence** `= vᵢ × 60 / development`. Exact given the gear.
- **flying portion**: laps 2…n when the run's `start` is `gate` or `standing`; all laps when it is
  `flying`. Every aggregate below is taken over the flying portion, because a standing lap is a
  different measurement and averaging it in makes two runs incomparable.
- **segments**: the first `N` and last `N` laps of the flying portion, where
  `N = min(3, floor((flyingLaps − 1) / 2))`, overridable. The `−1` guarantees the two segments never
  overlap and always leave at least one lap between them — the decline is a comparison of distinct
  ends of the effort, not of two overlapping windows. For the 7 flying laps of a 2 km IP this gives
  laps 2–4 and 6–8, which is what the prose already uses.
- **decline** `= (v_close / v_open)³ − 1`, where `v_open` and `v_close` are the segments' mean
  speeds. Aero work over a fixed distance scales with `v³`, so this is a power ratio expressed as a
  percentage change, and it carries no aero constant — only the exponent.

  Note the prose label is inverted: `season.md:84` calls it `(v₂₋₄/v₆₋₈)³`, which is the reciprocal
  and would read +20% where the table correctly says −16.8%. The numbers in that row are right and
  the label is wrong, which is a good argument for the quantity having one definition in code.

- **Σv², RMS speed, flat-equivalent time**: `Σv²` over the flying portion, `v_rms = √(Σv²/n)`,
  `t_flat = D_flying / v_rms`. The **redistribution gain** is `t_actual − t_flat`: what perfectly
  even pacing would have been worth. §5 computes 0.15 s for 2026 and 0.08 s for 2025 by hand.

None of these needs power, an aero model, or an anchor. That is what makes them safe to store nothing
about and compute every time.

## Three tools, and why comparison is one of them

`list_track_sessions` and `get_track_session` are the obvious pair. `compare_track_sessions` is the
one that earns the change: it is the table `season.md:71–84` builds by hand every time a race
happens, against every race already on file. Doing it in code makes adding a race O(1) prose instead
of O(n) hand-typed cells.

It takes an ordered list of run references and reports per-lap columns, per-lap deltas against the
first reference, and the summary rows: totals, flying portion, segment sums, decline per column. It
**refuses runs of differing lap counts** rather than aligning what it can — a 1500 m run and a 2 km
run have no lap-to-lap correspondence, and producing four matched rows and two blank ones would
invite exactly the reading the refusal prevents.

The first reference is the baseline by position, not by date, so the caller controls what the deltas
are against. `season.md`'s table puts the new ride last and deltas against both older ones; that is
recovered by listing the new ride first and reading the sign.

## Where the files live, and why the loader is lenient

`docs/personal/track/`, in the private `intervals-icu-personal` repo — the same repo as
`coaching-log.md`, `season.md` and `track-context.md`, gitignored from this one. Race splits are
personal data and this is where personal data already lives, already committed and pushed by the
`coaching-session` checkpoint.

The resolution copies `workout-library/loader.ts` — module-relative so repo, `tsx` and bundle agree —
with `INTERVALS_TRACK_SESSIONS_DIR` as an override. **One behaviour is deliberately opposite.**
`loadTemplates` throws on a missing directory, correctly: it ships that directory inside the bundle,
so its absence is corruption. This loader ships nothing. For every install but this athlete's the
directory does not exist and never will, so a missing or empty directory returns an empty list plus a
note naming the path it looked at. An MCP server that refuses to start because an athlete has no
track records would be a bug caused by copying the pattern too faithfully.

This makes it the first Tool in the registry that reads no Intervals.icu endpoint and needs no API
key. Nothing in the adapters assumes otherwise — `ToolDef.handler` takes the client and may ignore it.

## Considered and rejected

- **A single `track-splits.md` holding every session.** Rejected: one file that every race appends to
  is the shape the problem already has. A file per session gives each record its own basis block,
  its own prose, and its own line in `git log`.
- **JSON or YAML records.** Rejected: splits arrive from a helper at the trackside and get corrected
  by hand. Markdown with frontmatter is the format this repo already edits by hand, and the fenced
  CSV block is the export's own shape — a record can be produced by pasting.
- **Storing the derived table alongside the splits, so a record reproduces what was reported at the
  time.** Rejected, and it was a real option: it would pin a past analysis exactly. But it stores the
  same numbers twice with no mechanism to keep them agreeing, which is the failure ADR 0005 documents
  for `Rationale.intensities`. A past analysis is pinned by the coaching log entry that reported it,
  which is prose and is meant to be a snapshot.
- **Implementing the aero model so `Modelled W` comes from a tool.** Rejected: §6 measures it
  over-reading ~6% against the SRM and §3 puts ±5–10% on it from ρ alone. A Tool would lend those
  numbers an authority the measurement denies them. Where there is no SRM the modelled column stays
  in prose, labelled.
- **A writeback tool that files a record from a `compute_track_lap_power` run.** Deferred, not
  rejected. Records are authored as files exactly as `coaching-log.md` is, and that path is already
  well-worn. A `sessionId` input on `compute_track_lap_power`, so a stored export never needs pasting
  again, is the natural follow-up once records exist.
- **Deleting `track-context.md` §4 outright.** Rejected: §4 holds interpretation as well as tables —
  the head-to-head narrative, "the openings were identical", "this retires the hot-opening
  hypothesis". The tables go, the findings stay, and the section keeps its number because `src/`
  comments and an archived change cite §1, §6 and §8 positionally.
