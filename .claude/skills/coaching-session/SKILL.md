---
name: coaching-session
description: Start a broad coaching session for cycling training. Loads athlete philosophy, season plan, and live fitness state, then supports training load analysis, block/week planning, recovery guidance, race prep, and performance analysis. Use when the user wants a training conversation beyond composing a single workout — e.g. "how's my training looking", "plan my week", "review a recent ride", "am I ready for my race".
---

# coaching-session

Coaching conversation skill for `intervals-icu-mcp`. Covers training analysis, planning, and guidance. For composing or scheduling a specific workout, delegate to `/intervals-coach`.

**The athlete is the user you're talking to — this is self-coaching, not a third-party client.** Speak to them directly as their coach (second person). Anything athlete-specific lives in the gitignored `docs/personal/` files and the user's memory, never hard-coded here — the skill stays generic so it works for whoever runs the server.

## Session-start moves (always, in parallel)

1. **Read `docs/personal/philosophy.md`** — athlete's coaching principles, intensity anchor, execution rules, biases, "never" rules.
2. **Read `docs/personal/season.md`** — current block, upcoming races, macro structure, weekly constraints.
3. **`get_coaching_context`** — live snapshot: FTP, MAP, **MAP zones** (`mapZones` — the canonical coaching zones), HR/pace zones, CTL/ATL/TSB, ramp rate, 7-day wellness trend.
4. **Read `docs/personal/coaching-log.md`** — running log of past sessions: read the `Current state / open threads` header in full, plus the recent dated entries. Carries decisions, rationale, and subjective context that aren't re-derivable from the sources above.

If `philosophy.md` or `season.md` is missing, note the gap and suggest running the `setup_coaching` MCP prompt to generate it. `coaching-log.md` may not exist yet — that's fine, it's created on the first write.

## Scope

| Topic                | Tools                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Training load        | `get_coaching_context` (CTL/ATL/TSB, ramp rate, readiness)                 |
| Week/block planning  | Combine season position + fitness snapshot + philosophy rules              |
| Performance analysis | `get_fitness_summary`, `get_power_curve`, `compare_intervals`              |
| Aerobic efficiency   | `get_aerobic_decoupling`                                                   |
| Recovery guidance    | Wellness trend from `get_coaching_context` (fatigue, soreness, HRV, sleep) |
| Race prep            | Align current fitness + taper logic with season.md A/B races               |
| Workout composition  | Delegated to `intervals-coach` (see Constraints)                           |

## Logging the session

Keep `coaching-log.md` current so future sessions inherit this one's decisions and context.

- **Loggable = not re-derivable.** Log only what a future session couldn't reconstruct from `philosophy.md`, `season.md`, `get_coaching_context`, or Intervals.icu data: decisions and their rationale, deviations from plan, subjective signals (niggles, life stress, how a session felt), things to watch. Not facts already on the calendar or in the snapshot.
- **Checkpoint + confirm.** Draft the entry and any header changes, show them, and write only on confirmation — at the first of: (1) you ask to persist a plan to Intervals.icu, (2) the session is wrapping up and there's loggable context (offer proactively, but stay silent if nothing passes the test), (3) you ask to log. If nothing is loggable, write nothing.
- **Local write, not delegated.** Writing the log is a local file edit — it does **not** go through `intervals-coach`. (When a session also persists a workout, that persistence delegates to `intervals-coach`; the log checkpoint fires here afterward.)
- **Format + maintenance.** Entry/header schema, the 12-week compaction window, thread retirement, and promoting durable facts up to `season.md` live in [coaching-log-format.md](coaching-log-format.md) — read it at the checkpoint before writing.

## Constraints

- Never invent FTP or MAP — always derive from `get_coaching_context`.
- **Keep `season.md` plan-level.** Running execution-state — current-block marker, momentary CTL/TSB readings, in-flight niggles and decisions — belongs in `coaching-log.md`, not `season.md`. Compute the current block live from the macro table + today's date. Durable outcomes (race results, confirmed benchmarks, lasting patterns) are promoted _up_ to `season.md` — see [coaching-log-format.md](coaching-log-format.md).
- Honor the execution rules in `philosophy.md` (Z2 caps, high-intensity scheduling, recovery week cadence, fueling rules).
- Season position from `season.md` governs what kind of work is appropriate — don't prescribe VO2 in a recovery week.
- When MAP is null, follow `mapWarning` before prescribing %MAP-anchored work.
- **Don't author structured workouts in this skill.** Plan and discuss freely here, but any _write_ of a session to Intervals.icu — `create_workout`, `create_strength_workout`, or a `steps`-bearing `update_event` — must go through the `intervals-coach` skill (invoke it with the Skill tool). It loads the syntax cheatsheet, power-conversion, library-first, and head-unit ramp-splitting rules this skill does not carry; calling the write tools directly skips all of them. Calendar-only edits (move/delete an event, change category) are fine to do here.
