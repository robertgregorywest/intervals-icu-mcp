---
name: coaching-session
description: Start a broad coaching session for cycling/running training. Loads athlete philosophy, season plan, and live fitness state, then supports training load analysis, block/week planning, recovery guidance, race prep, and performance analysis. Use when the user wants a training conversation beyond composing a single workout — e.g. "how's my training looking", "plan my week", "am I ready for my race", "talk me through my load", "review my training".
---

# coaching-session

Coaching conversation skill for `intervals-icu-mcp`. Covers training analysis, planning, and guidance. For composing or scheduling a specific workout, delegate to `/intervals-coach`.

## Session-start moves (always, in parallel)

1. **Read `docs/personal/philosophy.md`** — athlete's coaching principles, intensity anchor, execution rules, biases, "never" rules.
2. **Read `docs/personal/season.md`** — current block, upcoming races, macro structure, weekly constraints.
3. **`get_coaching_context`** — live snapshot: FTP, MAP, zones, CTL/ATL/TSB, ramp rate, 7-day wellness trend.

If either personal file is missing, note the gap and suggest running the `setup_coaching` MCP prompt to generate it.

## Scope

| Topic                | Tools                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Training load        | `get_coaching_context` (CTL/ATL/TSB, ramp rate, readiness)                 |
| Week/block planning  | Combine season position + fitness snapshot + philosophy rules              |
| Performance analysis | `get_fitness_summary`, `get_power_curve`, `compare_intervals`              |
| Aerobic efficiency   | `get_aerobic_decoupling`                                                   |
| Recovery guidance    | Wellness trend from `get_coaching_context` (fatigue, soreness, HRV, sleep) |
| Race prep            | Align current fitness + taper logic with season.md A/B races               |
| Workout composition  | Delegate to `/intervals-coach`                                             |

## Constraints

- Never invent FTP or MAP — always derive from `get_coaching_context`.
- Honor the execution rules in `philosophy.md` (Z2 caps, high-intensity scheduling, recovery week cadence, fueling rules).
- Season position from `season.md` governs what kind of work is appropriate — don't prescribe VO2 in a recovery week.
- When MAP is null, follow `mapWarning` before prescribing %MAP-anchored work.
