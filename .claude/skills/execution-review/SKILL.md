---
name: execution-review
description: Runs the execution-review comparison (prescribed vs. delivered, dose and rep-level execution) for a coaching-log window and returns interpreted findings. Invoked by coaching-session at session start with a window and mapZones.
context: fork
agent: execution-analyst
---

# execution-review

You compute and interpret, and hand back findings. Coaching and the log write stay with the caller.

You are running standalone, forked out of a coaching session. You have no conversation history and
none of the athlete's context stack (philosophy, `steering.md`, `season.md`, `coaching-log.md`) —
everything you need is below or in `$ARGUMENTS`.

## Your input

`$ARGUMENTS` gives you:

- **The window** — start date (settled by the caller from the log's `reviewed-through` watermark)
  and end date (today).
- **`mapZones`** — the athlete's MAP-anchored coaching zones, if the caller already had them handy.
  If not supplied, fetch them yourself: `./bin/icu get_coaching_context` (from the project root).

## How to run the review

Read `docs/agents/icu-cli.md` (from the project root) before your first CLI call — working
directory, piping, `describe`. You run at its **Read-only** tier.

1. **Select from the planned side.** Key sessions are those _prescribed_ at sweet spot or above.
   Selecting on the planned side means an abandoned or never-started key session gets selected rather
   than silently missed. Look up planned events with `./bin/icu get_events` over the window. **No
   key session in the window → the review is skipped:** stop here and report it as skipped.
2. **Read both lenses.** `compare_intensity_distribution` over the whole window for the dose,
   `compare_planned_vs_actual` per selected session for execution within reps. Reach both through
   `./bin/icu`, piped, extracting only the figures you need.

3. **Interpret.** Read `execution-review-lenses.md` (in this skill's own folder) at this point: step
   roles, which verdicts are artefacts, how deep to read each kind of session, what passes the
   reporting threshold, and the exact reporting rules ("What reaches the athlete"). The tools report
   deltas; deltas are not findings; that file is the difference.
4. **Done = every selected session dispositioned.** Each session lands on **reported** (met the
   recurrence threshold) or **held** (seen once — not raised now, ready if asked).

## What to return

Follow `execution-review-lenses.md`'s "What reaches the athlete" rules exactly. Two things it doesn't
cover, specific to running forked: **never return raw comparison JSON or full session tables** — only
the handful of numbers that support a finding — and **end on the watermark line**: either
`reviewed through: <end date>` when the review ran (a quiet window included), or `skipped: no key
session in <window>` when step 1 stopped it. The caller advances the log's `reviewed-through` to that
date on write. **Stop at findings** — what changes in training, and the next block, is the caller's
call with the full context stack loaded.
