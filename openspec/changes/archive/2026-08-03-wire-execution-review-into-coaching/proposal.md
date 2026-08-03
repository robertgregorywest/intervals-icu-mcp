## Why

`compare_planned_vs_actual` shipped the **verify** step of the coaching loop, but nothing consumes it: no skill file references the tool, and `coaching-session`'s Performance-analysis row still lists only `get_fitness_summary` / `get_power_curve` / `compare_intervals`. Coaching conversations therefore still open from plans and dashboard aggregates — neither of which can say whether the prescribed work was actually delivered at intensity.

Two findings against real athlete data make this more than a wiring exercise:

1. **Raw verdicts mislead.** The 2026-07-29 `Sweet Spot 3×12` returns `under` on 5 of 8 steps. Five of those are coaching-irrelevant (warm-up, cool-down, and two recovery steps ridden _easier_ than prescribed — where `under` is a good sign, not a miss). The one real signal, an 11 W shortfall on rep 1, is a single row in the middle. A skill that reports verdicts verbatim will manufacture alarm out of warm-ups.
2. **The philosophy's load-bearing metric is unmeasurable today.** `coaching-philosophy` names _time in the 76–106% FTP band_ as the primary judge of a build week, and names polarisation-by-subtraction as the classic failure. Nothing in this repo measures either, though everything needed is available: the prescription's own steps on the planned event, and recorded power on the activity.

## What Changes

- **New tool `compare_intensity_distribution`** — the _band lens_. Computes the planned distribution from the prescribed session's own steps and the delivered distribution from recorded power, bucketed in one frame, and reports per-zone deltas plus a middle-band roll-up, for a session or a date range. The prescription is the contract: because workouts are authored in absolute watts, the comparison is unaffected by threshold changes between prescribing and riding. Requires no step alignment, so it works where `compare_planned_vs_actual` refuses: track sessions with no head unit, auto-lapped rides, abandoned sessions.
- **New review procedure in `coaching-session`** — execution review becomes the default opening move of an open-ended coaching session, not an on-request analysis. Sweeps the key sessions since a watermark, reads both lenses, and reports the pattern across the window rather than per-session verdicts.
- **Watermark in the coaching log** — `coaching-log.md`'s `Current state / open threads` header gains a `reviewed-through: YYYY-MM-DD` line, advanced at each log checkpoint. Makes the review window self-synchronising: never re-reviews, never silently skips.
- **Interpretation rules** — how to read a verdict as a coach: work steps carry intent and support steps do not; `under` inverts on recovery steps; band targets carry no tolerance so small warm-up deltas are noise; `alignmentBasis: none` is a refusal, not a failed session; review depth scales with how narrow the prescribed band is (VO2 studied rep-by-rep, Z2 checked only for ceiling violations).
- **Track sessions become reviewable** on the band lens and on effort peaks, having been unreviewable on the step lens.

## Capabilities

### New Capabilities

- `intensity-distribution-comparison`: planned-vs-delivered time-in-zone for a session or date range, with a middle-band roll-up; the alignment-free companion to `planned-vs-actual-comparison`.
- `coaching-execution-review`: the coaching-side procedure — window selection via the log watermark, key-session filtering by prescribed intent, lens selection, interpretation rules, and what surfaces to the athlete.

### Modified Capabilities

None. `planned-vs-actual-comparison` is consumed as-is; every interpretation rule added here lives in the coaching layer, and the work-vs-support-step distinction is derived from data the tool already returns.

## Impact

- **New**: `src/services/intensity-distribution/`, `src/tools/intensity-distribution.ts`, one `src/registry.ts` entry (both adapters pick it up automatically), tests mirroring `tests/services/` + `tests/tools/`.
- **Modified**: `.claude/skills/coaching-session/SKILL.md` (session-start moves, scope table, new procedure section), `.claude/skills/coaching-session/coaching-log-format.md` (watermark line, checkpoint maintenance step), plus a new `execution-review.md` subfile for the interpretation rules.
- **Possibly modified**: `.claude/skills/coaching-philosophy/` — if "progression only counts if it's delivered" is to be enforced against delivery as well as against projections, that is a philosophy edit (a commit) and is called out as an open decision in `design.md`.
- **Unaffected**: `intervals-coach`, `strength-training`, and the `planned-vs-actual-comparison` service.
