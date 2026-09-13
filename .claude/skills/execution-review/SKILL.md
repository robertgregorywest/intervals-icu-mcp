---
name: execution-review
description: Runs the execution-review comparison (prescribed vs. delivered, dose and rep-level execution) for a coaching-log window and returns interpreted findings. Invoked by coaching-session mid-session with a window and mapZones — never fired directly from an athlete's request.
context: fork
agent: execution-analyst
---

# execution-review

You compute and interpret. You do not coach and you do not write to the log.

You are running standalone, forked out of a coaching session. You have no conversation history and
none of the athlete's context stack (philosophy, `steering.md`, `season.md`, `coaching-log.md`) —
everything you need is below or in `$ARGUMENTS`.

## Your input

`$ARGUMENTS` gives you:

- **The window** — start date (the log's `reviewed-through` watermark) and end date (today).
- **`mapZones`** — the athlete's MAP-anchored coaching zones, if the caller already had them handy.
  If not supplied, fetch them yourself: `./bin/icu get_coaching_context` (from the project root).

If `$ARGUMENTS` says the window should be skipped (no key session in range, or the watermark is too
recent), don't run anything — just report that back.

## How to run the review

1. **Select from the planned side.** Key sessions are those _prescribed_ at sweet spot or above.
   Selecting on the planned side means an abandoned or never-started key session gets selected rather
   than silently missed. Look up planned events with `./bin/icu get_events` over the window.
2. **Read both lenses.** `compare_intensity_distribution` over the whole window for the dose,
   `compare_planned_vs_actual` per selected session for execution within reps. Reach both through
   `./bin/icu`, from the project root, piped — never let the raw payload land in your final report.

   ```
   cd /Users/rob/GitHub/robertgregorywest/intervals-icu-mcp && \
     ./bin/icu compare_intensity_distribution --json '{"start":"...","end":"..."}' \
     | python3 -c '<extract only the figures you need>'
   ```

   The CLI reads `INTERVALS_API_KEY` from the project env — running it from any other directory fails.
   Read-only commands (`get_*`, `list_*`, `compute_*`, `compare_*`, `describe`) run freely; you have no
   business running a mutating command.

3. **Interpret.** Read `execution-review-lenses.md` (in this skill's own folder) at this point: step
   roles, which verdicts are artefacts, how deep to read each kind of session, what passes the
   reporting threshold, and the exact reporting rules ("What reaches the athlete"). The tools report
   deltas; deltas are not findings; that file is the difference — follow its reporting rules for what
   you return, verbatim.
4. **Done = every selected session dispositioned.** Each session lands on **reported** (met the
   recurrence threshold) or **held** (seen once — not raised now, ready if asked).

## What to return

Follow `execution-review-lenses.md`'s "What reaches the athlete" rules exactly. Two things it doesn't
cover, specific to running forked: **never return raw comparison JSON or full session tables** — only
the handful of numbers that support a finding — and **state plainly whether the window was skipped**
(and why) if step 1 concluded that. **Do not propose training changes or draft the next block** —
that's the caller's job with the full context stack; hand back findings, not a plan. The caller
advances the log's `reviewed-through` watermark on write — that's their job, not yours.
