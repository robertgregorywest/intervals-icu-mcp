---
name: intervals-coach
description: Compose and schedule cycling/running workouts on Intervals.icu via the intervals-icu-mcp server. Use when the user asks to plan a workout, build a training session, schedule a ride, design intervals, or program a session. Encodes power-target conversion, session structure templates, and library-first composition.
---

# intervals-coach

Workout-generation skill for the `intervals-icu-mcp` server. Activates when the user asks for a workout — planning, building, scheduling, designing intervals — for Intervals.icu.

## Session-start moves (always)

Before composing or scheduling anything, do **both** of these in parallel:

1. **`get_coaching_context`** — pulls today's snapshot: athlete profile (FTP, LTHR, max HR, weight, FTP-anchored zones), **MAP** (`map.watts`, derived from the most recent `MAP ramp test*` activity in the last 90 days — best 60-sec power), today's CTL/ATL/TSB and ramp rate, and a 7-day wellness trend with subjective metrics (fatigue, soreness, motivation, sleep). Default 7-day window; pass `days` up to 30 when planning a longer block. Don't ask the athlete for FTP, MAP, zones, or current fitness — read them. If `map` is null, follow `mapWarning` — ask the athlete for a current MAP estimate before prescribing %MAP-anchored work.
2. **`list_workout_library`** — surfaces saved workouts the athlete has curated. Their templates carry calibrated intent (rationale block: %MAP/%FTP basis + anchorWatts). Reusing a library workout is almost always preferable to composing fresh.

The athlete's coaching philosophy and current season live in **Claude Project knowledge** (`philosophy.md`, `season.md`) — already in your context if the user is in their training Project. Honor those rules; if you don't see them, ask whether you should run `setup_coaching` to bootstrap them.

## Decision tree

```
User asks for a workout
    │
    ▼
get_coaching_context  +  list_workout_library     (parallel)
    │
    ▼
Does a library workout fit the intent?
    │
    ├── Yes → schedule it via create_workout (look up the body with get_workout_library_item if needed)
    │
    └── No  → compose. Then ask: should this be saved to the library for reuse?
                │
                ├── Yes → create_workout_library_item (with rationale block — see power-conversion.md)
                └── No  → create_workout (calendar only)
```

See [library-vs-compose.md](library-vs-compose.md) for the full reasoning.

## Composing fresh

Three things to get right:

1. **Power targets at the API boundary** — emit absolute watts (`220w`, `160w-256w`). Reason in %MAP/%FTP, convert before calling tools. See [power-conversion.md](power-conversion.md).
2. **Session structure** — warm-up, main set, cool-down norms vary by session type. See [session-patterns.md](session-patterns.md) for Z2, threshold, VO2, sweet spot, recovery, race-prep templates.
3. **Workout-text syntax** — the format Intervals.icu expects in event/workout descriptions. See [syntax-cheatsheet.md](syntax-cheatsheet.md).

## Constraints

- **Never** invent FTP/MAP — always derive from `get_coaching_context`.
- **Never** use `%MAP` in a workout-text target — Intervals.icu's parser doesn't understand it. Convert to watts.
- **Avoid** `%FTP` in saved workouts — it couples to whatever FTP is on file later. Watts are stable; pair them with a rationale block so `refresh_workout_library` can re-anchor on test changes.
- **Defer** to library workouts when the intent matches. Calibration drift between library and ad-hoc is real.
- **Respect** the philosophy/season docs in Project knowledge: bias, execution rules, "never" rules, weekly volume caps.

## Ramp test naming convention

For `get_coaching_context` to surface MAP, the athlete's ramp test activities must be named with the prefix `MAP ramp test` (case-insensitive). Suffixes are fine: `MAP ramp test 2026-03-15`, `MAP ramp test #4`. To exclude a botched test, rename it in Intervals.icu so the name contains `(skip)` — e.g. `MAP ramp test (skip)`. The server takes the most recent matching activity and reports the source in `map.computedFrom`.
