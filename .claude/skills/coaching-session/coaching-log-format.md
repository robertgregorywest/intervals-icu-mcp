# coaching-log format

Maintenance procedure for `docs/personal/coaching-log.md` — the session-by-session tier at the bottom of the four-tier coaching-context stack: the `coaching-philosophy` skill (timeless, tracked) → `docs/personal/steering.md` (personal overrides) → `season.md` (between-blocks) → this log (session-by-session). Read this at a logging checkpoint, before writing.

## File structure

Two sections, header first:

```
## Current state / open threads
reviewed-through: YYYY-MM-DD
- <thread> — <open-condition> (since YYYY-MM-DD)
...

---

## Log
### YYYY-MM-DD — <block>
- Decided: <call> — <rationale>   →[open: <thread-id>]
- Signal: <subjective context>     →[open: <thread-id>]
- <other loggable item>
...
```

- **Header** = live state only. Each thread names the condition that keeps it open. Read in full every session.
- **`reviewed-through`** = the execution-review watermark: the date through which delivered sessions have already been reviewed. One line, first in the header, before the thread list. Absent on an existing log written before this line existed, and on a freshly bootstrapped one — see _Review window_ below for what happens then.
- **Log** = dated entries, newest first. Rolling 12-week window of detail.
- `→[open: id]` tags a line whose state must survive in the header after the entry ages out.

## Writing an entry

1. Heading: today's date + the current block, computed from `season.md`'s macro table + today's date (fuzzy is fine — e.g. "Re-build").
2. One bullet per loggable item — apply the re-derivability test (see `SKILL.md`): log only what a future session couldn't re-derive from the `coaching-philosophy` skill, `steering.md`, `season.md`, `get_coaching_context`, or Intervals.icu data. Tag any line that opens or updates a live thread.
3. Mirror new or changed threads into the header with an open-condition.

## At every checkpoint write — maintain

1. **Compact** — for entries older than 12 weeks: promote any still-live thread into the header (if not already there), then drop the dated detail.
2. **Review the header** — for each thread, test its open-condition against this session. Resolved or lapsed → retire it (remove from header, add a closing line to today's entry). Ambiguous → ask before retiring; never drop a live thread silently.
3. **Advance the watermark** — set `reviewed-through` to today as part of this write. Only as part of a confirmed write, never before: if the athlete doesn't confirm, the line stays where it was and the next session re-reviews the same window rather than silently skipping it. Advance it whenever a review ran, including when the review found nothing worth reporting — a quiet window is still a reviewed one.
4. **Promote durable facts up** — if a fact is durable _season-state_ (a race result, a confirmed benchmark, a lasting pattern finding) rather than transient execution-state, write it into `season.md` instead of (or as well as) keeping it here. If instead it's a durable _training belief_ that would hold next season (a coaching principle, not season-state), it graduates further up: into `docs/personal/steering.md`, and once it's clearly proven, into the `coaching-philosophy` skill itself (a git commit). Compaction must never let a durable fact age out with nowhere to land.

## Review window

The window the execution review sweeps at session start (see [execution-review.md](execution-review.md) for how the findings are read). Derived from the watermark, never from "the last few days":

| Watermark state                                     | Window                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Present                                             | `reviewed-through` → today                                                                           |
| Absent (pre-existing log, or freshly bootstrapped)  | The current block from `season.md`, capped at 28 days                                                |
| Older than 28 days                                  | The most recent 28 days. **Say so** — state plainly that sessions before that date were not reviewed |
| Less than a day, or the window holds no key session | Skip the review. Leave the watermark unchanged                                                       |

The 28-day ceiling matches the 3–4 week block cadence in the philosophy: a longer window stops describing one block. The floor stops a second conversation on the same day re-reviewing what the first one already covered.

## Bootstrap

If `coaching-log.md` doesn't exist, create it on the first write with the two section headers and an empty header list. A bootstrapped log has no `reviewed-through` line until its first confirmed write that follows a review.
