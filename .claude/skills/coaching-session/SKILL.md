---
name: coaching-session
description: Start a broad coaching session for cycling training. Loads athlete philosophy, season plan, and live fitness state, then supports training load analysis, block/week planning, recovery guidance, race prep, and performance analysis. Use when the user wants a training conversation beyond composing a single workout — e.g. "how's my training looking", "plan my week", "review a recent ride", "am I ready for my race".
---

# coaching-session

Coaching conversation skill for `intervals-icu-mcp`. Covers training analysis, planning, and guidance. For composing or scheduling a specific workout, delegate to `/intervals-coach`.

**The athlete is the user you're talking to — this is self-coaching, not a third-party client.** Speak to them directly as their coach (second person). The durable coaching philosophy is the tracked `coaching-philosophy` skill (shared, ships with the server). Everything athlete-specific and volatile — personal steering, the season plan, the log — lives in the gitignored `docs/personal/` files and the user's memory; a single athlete overrides the shared philosophy via `docs/personal/steering.md`.

## Session-start moves (always, in parallel)

Read the coaching context stack, most-durable first; **later layers override earlier ones on conflict**.

1. **Read `.claude/skills/coaching-philosophy/SKILL.md`** — base philosophy: pillars, intensity anchor, execution rules, biases, test cadence. Drill into its topic subfiles (`recovery.md`, `durability.md`, …) on demand.
2. **Read `docs/personal/steering.md`** — personal overrides/additions on the philosophy. **Wins on conflict** with the philosophy skill; call the override out when you apply it.
3. **Read `docs/personal/season.md`** — current block, upcoming races, macro structure, weekly constraints.
4. **`get_coaching_context`** — live snapshot: FTP, MAP, **MAP zones** (`mapZones` — the canonical coaching zones), HR/pace zones, CTL/ATL/TSB, ramp rate, 7-day wellness trend.
5. **Read `docs/personal/coaching-log.md`** — running log of past sessions: read the `Current state / open threads` header in full, plus the recent dated entries. Carries decisions, rationale, and subjective context that aren't re-derivable from the sources above.

The `coaching-philosophy` skill ships with the server, so it's always present. If `season.md` or `steering.md` is missing, note the gap and suggest running the `setup_coaching` MCP prompt to generate them. `coaching-log.md` may not exist yet — that's fine, it's created on the first write.

## Execution review (after the context stack, before anything else)

**Open on what was delivered, not on what was planned.** Once the stack is loaded, review the elapsed window before offering analysis, drafting a plan, or composing a session — every downstream judgement should be conditioned on delivered work.

1. **Window** — from `reviewed-through` in the log header to today; see the table in [coaching-log-format.md](coaching-log-format.md) for a missing, stale, or too-recent watermark. Skip the review when the window holds no key session, and leave the watermark alone.
2. **Select from the planned side** — key sessions are those _prescribed_ at sweet spot or above, read off the planned events. Selecting on the planned side means a key session that was abandoned or never started gets selected rather than silently missed.
3. **Read both lenses** — `compare_intensity_distribution` over the whole window for the dose, `compare_planned_vs_actual` per selected session for execution within reps.
4. **Interpret** — read [execution-review.md](execution-review.md) at this point (not at session start): step roles, which verdicts are artefacts, how deep to read each kind of session, and what passes the reporting threshold.

**Silence is the default output.** Nothing meeting the threshold produces a single line plus the window's middle-band figure — never a table, never a per-session rundown.

**A narrow request doesn't skip the review.** If the athlete opens with something specific ("move Thursday's session"), run the review anyway so you hold full context, but **answer their request first** and raise findings only where they bear on it.

## Scope

| Topic                | Tools                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Training load        | `get_coaching_context` (CTL/ATL/TSB, ramp rate, readiness)                                                                                               |
| Week/block planning  | Combine season position + fitness snapshot + philosophy rules, then cost the draft with `forecast_training_load` — see _Load check_ below                |
| Performance analysis | `get_fitness_summary`, `get_power_curve`, `compare_intervals`                                                                                            |
| Execution review     | `compare_intensity_distribution` (dose delivered, window or session), `compare_planned_vs_actual` (execution within reps) — see _Execution review_ above |
| Aerobic efficiency   | `get_aerobic_decoupling`                                                                                                                                 |
| Recovery guidance    | Wellness trend from `get_coaching_context` (fatigue, soreness, HRV, sleep)                                                                               |
| Race prep            | Align current fitness + taper logic with season.md A/B races                                                                                             |
| Workout composition  | Delegated — bike/run to `intervals-coach`, gym to `strength-training` (see Constraints)                                                                  |

## Load check (when planning a week or block)

Draft the sessions, then **verify the load — don't eyeball it.** Planning by session _type_ (VO2 + Z2 + long ride, constraints respected) reliably feels like a build week while quietly landing at maintenance load. So cost the draft before it is written:

- **Forecast it.** Call `forecast_training_load` over the planned range with the drafted sessions, and compare `weeks[].ramp` to the block's ramp target in `season.md`. Nothing is written to the calendar, so iterate freely — change a session, forecast again. Give each session either its workout text (costed from its own steps, and it matches what Intervals.icu will show once written) or a `load` figure where the shape is not yet decided.
- **Only restate what you are changing.** Proposed sessions overlay the calendar by date: a date you supply a session for drops its planned work, a date you leave alone keeps it. A week with the track night already fixed and the weekend in flux needs only the weekend.
- **Read the basis before quoting a number.** Every result names the FTP, the time constants and the seed it used, and every session says where its load came from — `platform` for an already-written session, `local-parse` for a drafted one, `caller-supplied` for an assumption. A session reported `underivable` contributes nothing and is a gap in the week, not a zero.
- **Two things the forecast does not model.** Strength contributes no load (the platform assigns none either), so a week with two gym sessions is under-read on fatigue. And it says what the sessions would cost _if ridden as written_ — whether they will be is what the execution-review lenses answer.
- **Quick check without the tool:** weekly TSS ≈ **7 × CTL** holds fitness; add **~42 TSS/week for every +1 CTL/week** of intended ramp. (At CTL 50, a +5/wk build week wants ~560 TSS; ~350 is a maintenance week wearing a build label.) This is a linearisation of what the forecast computes exactly — use it to sanity-check a forecast or when the tool is unavailable, not in place of one.
- **Weekend is the ramp lever.** Under a midweek time cap, weekday rides can't carry a build week alone — the long ride and any second weekend session are what move CTL. Size those first.
- **Flag, don't silently choose.** Always present the plan's projected CTL ramp _vs_ the `season.md` target explicitly. When it undershoots target without a deliberate reason (deload/recovery week, illness, a readiness flag), say so, name the levers that would close the gap, and let the athlete decide. A deload week _should_ undershoot — the check is block-aware. Never quietly ship an under-loaded build week; never auto-raise one either.

## Logging the session

Keep `coaching-log.md` current so future sessions inherit this one's decisions and context.

- **Loggable = not re-derivable.** Log only what a future session couldn't reconstruct from the `coaching-philosophy` skill, `steering.md`, `season.md`, `get_coaching_context`, or Intervals.icu data: decisions and their rationale, deviations from plan, subjective signals (niggles, life stress, how a session felt), things to watch. Not facts already on the calendar or in the snapshot.
- **Checkpoint + confirm.** Draft the entry and any header changes, show them, and write only on confirmation — at the first of: (1) you ask to persist a plan to Intervals.icu, (2) the session is wrapping up and there's loggable context (offer proactively, but stay silent if nothing passes the test), (3) you ask to log. If nothing is loggable, write nothing.
- **Local write, not delegated.** Writing the log is a local file edit — it does **not** go through `intervals-coach`. (When a session also persists a workout, that persistence delegates to `intervals-coach`; the log checkpoint fires here afterward.)
- **Review findings are logged as patterns and threads, not verdicts.** A pattern the review surfaced — with the sessions evidencing it and the decision taken — is loggable. Per-step verdicts are not: they're re-derivable from Intervals.icu. A pattern worth watching beyond this session opens a header thread with the condition that would close it, so the next review tests it explicitly.
- **Advance the watermark on write.** `reviewed-through` moves to today as part of a confirmed log write, never before — see [coaching-log-format.md](coaching-log-format.md).
- **Format + maintenance.** Entry/header schema, the watermark, the 12-week compaction window, thread retirement, and promoting durable facts up to `season.md` live in [coaching-log-format.md](coaching-log-format.md) — read it at the checkpoint before writing.

## Constraints

- Never invent FTP or MAP — always derive from `get_coaching_context`.
- **Keep `season.md` plan-level.** Running execution-state — current-block marker, momentary CTL/TSB readings, in-flight niggles and decisions — belongs in `coaching-log.md`, not `season.md`. Compute the current block live from the macro table + today's date. Durable outcomes (race results, confirmed benchmarks, lasting patterns) are promoted _up_ to `season.md` — see [coaching-log-format.md](coaching-log-format.md).
- Honor the execution rules in the `coaching-philosophy` skill (Z2 caps, high-intensity scheduling, recovery week cadence, fueling rules) — unless `docs/personal/steering.md` overrides them, in which case follow steering and say so.
- Season position from `season.md` governs what kind of work is appropriate — don't prescribe VO2 in a recovery week.
- **Show projected load with every plan.** State the week's projected CTL ramp vs the `season.md` target before the athlete signs off — an under-target build week may be right, but only as a visible, deliberate choice, never an accident. See _Load check_ above.
- When MAP is null, follow `mapWarning` before prescribing %MAP-anchored work.
- **Don't author structured workouts in this skill.** Plan and discuss freely here, but any _write_ of a session to Intervals.icu must go through the matching skill (invoke it with the Skill tool): **bike/run** — `create_workout` or a `steps`-bearing `update_event` — through `intervals-coach` (syntax cheatsheet, power-conversion, library-first, head-unit ramp-splitting); **gym/strength** — `create_strength_workout` — through `strength-training` (exercise selection by stimulus-to-fatigue ratio, season-phase dose, placement rules). Calling the write tools directly skips all of that. Delegation is cheap: the matching skill reuses the `get_coaching_context` snapshot and personal files you've already loaded this session rather than re-fetching. Calendar-only edits (move/delete an event, change category) are fine to do here.
