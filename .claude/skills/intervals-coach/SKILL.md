---
name: intervals-coach
description: Compose and schedule a single cycling/running workout on Intervals.icu via the intervals-icu-mcp server. Use when the user asks to plan, build, or design a workout or intervals session. For a broader training conversation (load review, week/block planning, race readiness) use coaching-session instead.
---

# intervals-coach

Workout-generation skill for the `intervals-icu-mcp` server. Activates when the user asks for a workout — planning, building, scheduling, designing intervals — for Intervals.icu.

## Session-start moves

**Reuse, don't repeat.** If you arrived from a `coaching-session` (or already pulled them this turn), the `get_coaching_context` snapshot and the personal files (`steering.md`, `season.md`) are already in context — reuse them, don't re-fetch. `list_workout_library` is _not_ usually among them, so run it regardless. Invoked cold, do both calls in parallel:

1. **`get_coaching_context`** — pulls today's snapshot: athlete profile (FTP, LTHR, max HR, weight, HR/pace zones), **MAP** (`map.watts`, with `map.computedFrom` naming the source test) and the **MAP-anchored power zones** derived from it (`mapZones` — REC / L1–L7 / NMP watt bands, the canonical coaching zones), today's CTL/ATL/TSB and ramp rate, and a 7-day wellness trend with subjective metrics (fatigue, soreness, motivation, sleep). Default 7-day window; pass `days` up to 30 when planning a longer block. Don't ask the athlete for FTP, MAP, zones, or current fitness — read them. If `map` is null, follow `mapWarning` — ask the athlete for a current MAP estimate before prescribing %MAP-anchored work.
2. **`list_workout_library`** — surfaces the workouts the athlete has curated. Each carries a **`purpose`** saying what it is _for_ — select on that, not on the name. `hasTemplate: true` means `sync_workout_library` maintains it, so its watts track the athlete's current tests. Reusing a library workout is almost always preferable to composing fresh.

The athlete's coaching philosophy is the tracked **`coaching-philosophy` skill** — read `.claude/skills/coaching-philosophy/SKILL.md` for pillars, intensity anchor, execution rules, biases, and "never" rules (drill into its topic subfiles as needed) unless it's already in context. Personal overrides live in **`docs/personal/steering.md`** (they **win on conflict** — apply them and say so) and the current season in **`docs/personal/season.md`**. The philosophy skill ships with the server; if `steering.md` or `season.md` is missing, suggest running the `setup_coaching` MCP prompt.

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
                ├── Yes → write templates/workouts/<seedId>.md, then sync_workout_library
                │          — see power-conversion.md
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
- **Emit absolute watts**, never `%MAP` (unparseable) and not `%FTP` in saved workouts (fragile) — see [power-conversion.md](power-conversion.md).
- **Defer** to library workouts when the intent matches. Calibration drift between library and ad-hoc is real.
- **Respect** the `coaching-philosophy` skill and the personal `docs/personal/` docs: bias, execution rules, "never" rules, weekly volume caps. `docs/personal/steering.md` overrides the philosophy on conflict.

## Ramp test naming convention

For `get_coaching_context` to surface MAP, the athlete's ramp test activities must be named with the prefix `MAP ramp test` (case-insensitive). Suffixes are fine: `MAP ramp test 2026-03-15`, `MAP ramp test #4`. To exclude a botched test, rename it in Intervals.icu so the name contains `(skip)` — e.g. `MAP ramp test (skip)`. The server takes the most recent matching activity and reports the source in `map.computedFrom`.
