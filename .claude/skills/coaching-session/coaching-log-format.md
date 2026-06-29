# coaching-log format

Maintenance procedure for `docs/personal/coaching-log.md` — the session-by-session tier beneath `philosophy.md` (timeless) and `season.md` (between-blocks). Read this at a logging checkpoint, before writing.

## File structure

Two sections, header first:

```
## Current state / open threads
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
- **Log** = dated entries, newest first. Rolling 12-week window of detail.
- `→[open: id]` tags a line whose state must survive in the header after the entry ages out.

## Writing an entry

1. Heading: today's date + the current block, computed from `season.md`'s macro table + today's date (fuzzy is fine — e.g. "Re-build").
2. One bullet per loggable item — apply the re-derivability test (see `SKILL.md`): log only what a future session couldn't re-derive from `philosophy.md`, `season.md`, `get_coaching_context`, or Intervals.icu data. Tag any line that opens or updates a live thread.
3. Mirror new or changed threads into the header with an open-condition.

## At every checkpoint write — maintain

1. **Compact** — for entries older than 12 weeks: promote any still-live thread into the header (if not already there), then drop the dated detail.
2. **Review the header** — for each thread, test its open-condition against this session. Resolved or lapsed → retire it (remove from header, add a closing line to today's entry). Ambiguous → ask before retiring; never drop a live thread silently.
3. **Promote durable facts up** — if a fact is durable _season-state_ (a race result, a confirmed benchmark, a lasting pattern finding) rather than transient execution-state, write it into `season.md` instead of (or as well as) keeping it here. Compaction must never let a durable fact age out with nowhere to land.

## Bootstrap

If `coaching-log.md` doesn't exist, create it on the first write with the two section headers and an empty header list.
