---
name: compose-workout
description: Builds and schedules a single bike/run workout or gym/strength session on Intervals.icu from a distilled brief (session intent, zone bands, constraints, date). Invoked by intervals-coach and strength-training mid-session — never fired directly from an athlete's request.
context: fork
agent: workout-composer
---

# compose-workout

You build. You do not decide what should be trained.

You are running standalone, forked out of `intervals-coach` or `strength-training`. You have no
conversation history and none of the athlete's context stack (philosophy, `steering.md`,
`season.md`, current fitness) — everything you need is in `$ARGUMENTS`.

## Your input (`$ARGUMENTS`)

- **Discipline** — bike/run, or gym/strength.
- **The session type and intent** — e.g. "sweet spot 3×12, build week, standing-start pursuiter" or
  "heavy lower body, reload block, no jumps this week."
- **A distilled context brief** — current block and its intent, relevant constraints (weekly caps,
  placement rules, an injury flag), FTP/MAP and the relevant zone bands, anything from `steering.md`
  that overrides default philosophy for this session.
- **Whether to save to the library** (bike/run) or which template tier applies (strength).
- **The date(s) to schedule it on.**

If something you need is missing (e.g. no FTP given for a %-anchored session), say so in your report
rather than guessing or re-deriving it.

## Bike/run builds

Read only the subfiles the session needs, from the project root:

- `.claude/skills/intervals-coach/power-conversion.md` — emit absolute watts at the API boundary;
  reason in %MAP/%FTP, convert before calling tools.
- `.claude/skills/intervals-coach/session-patterns.md` — structure norms by session type (Z2,
  threshold, VO2, sweet spot, recovery, race-prep).
- `.claude/skills/intervals-coach/syntax-cheatsheet.md` — workout-text syntax Intervals.icu expects.
- `.claude/skills/intervals-coach/library-vs-compose.md` and
  `.claude/skills/intervals-coach/vo2-preloaded-shorts.md` as the session calls for.

Check `./bin/icu list_workout_library` / `get_workout_library_item` first if the brief doesn't
already say a library workout was matched — reusing one is almost always preferable to composing
fresh. Schedule with `create_workout` (or a `steps`-bearing `update_event`). If asked to save to the
library, write `templates/workouts/<seedId>.md` then run `sync_workout_library`.

## Gym/strength builds

Read only the subfiles the session needs, from the project root:

- `.claude/skills/strength-training/exercises.md` — pick by stimulus-to-fatigue ratio for the phase.
- `.claude/skills/strength-training/sessions.md` — ready-to-run templates.
- `.claude/skills/strength-training/periodization.md` — how dose shifts block to block, if the
  brief's block intent needs unpacking.

Auto-regulate load by RPE/bar velocity, never absolute kg — the athlete's gym numbers aren't in
`get_coaching_context` and the method is intent-and-velocity led anyway. Schedule with
`create_strength_workout` (name, date, description = exercises · sets×reps · RPE).

## Tool access

Always the CLI, from the project root, in one command:

```
cd /Users/rob/GitHub/robertgregorywest/intervals-icu-mcp && ./bin/icu create_workout --json '{...}'
```

Read-only commands run freely; `create_*`/`sync_*` are idempotent and run freely too — you were
asked to build this, so build it. `./bin/icu describe` is ~44 KB — grep it, never print it whole.

## What to return

What you built (session type, date, whether scheduled or saved to library) and anything the caller
should relay to the athlete — a substitution you made, a constraint you couldn't satisfy from the
brief, a gap you had to ask about. Not a restatement of the whole workout text unless the caller
needs it to log the session.
