# Workout templates are tracked files; the Intervals.icu library is a rendered view

Each curated workout becomes a Markdown **Workout template** in `templates/workouts/` —
frontmatter (`seedId`, `name`, `folder`, `purpose`, optional `basis`) plus a body in Intervals.icu
step syntax where a bare `%` resolves against the template's basis and every other target token is
emitted verbatim. A single `sync_workout_library` renders all templates at the current MAP/FTP and
upserts them onto Intervals.icu, matched by a `<!-- template: seedId -->` marker. The remote library
is a **projection** of the files, never a source: **every library workout has a template file
behind it**, so nothing in the library can be stranded at a stale anchor.

This replaces `CANONICAL_TEMPLATES` (a 215-line TypeScript array inside `seed.ts`), which could only
ever _create_ — `runSeed` skipped any workout whose name already existed, so editing a template had
no effect on an already-seeded library.

## Why the refresh mechanism goes

`refresh_workout_library` re-anchored watts by walking a description line by line and pairing the
_n_th step line with `rationale.intensities[n]` — **positionally**. `stepRef` was stored but never
read for matching. Adding or deleting a step line shifted every subsequent pairing (warned only
because the counts then differed); **reordering** two steps produced silently wrong watts with no
warning at all. That was tolerable while nothing but the tool itself edited those descriptions, and
untenable once the library is something actively shaped. With the file as source of truth,
re-rendering from source is exact by construction and updates structure and prose too, so the
munging has no remaining job: `refresh.ts`, `regenerateWattsInDescription` and
`Rationale.intensities` are deleted along with the whole silent-misalignment class.

This is not hypothetical. `In the red pursuit intervals (2km)` (workout 16), authored via
`create_workout_library_item`, carries **14 intensities against 19 step lines** — the hand-supplied
array was deduplicated by label. A refresh against it would misalign from step 11 onward and rewrite
a 3-minute recovery to 713 W (250% FTP). Hand-supplied `intensities` drift from the body they
describe, and nothing detects it until the watts are already wrong.

Idempotency is by **content comparison** (rendered vs remote description), not by comparing anchors.
Comparing anchors would skip a template whose steps were edited while MAP happened to be unchanged —
precisely the everyday case.

## Considered options

- **Keep the library editable in the Intervals.icu UI** (files as one-shot starters) — rejected: two
  sources of truth, and the positional matcher makes UI edits actively dangerous. UI edits are now
  overwritten by design.
- **Keep `create_workout_library_item`** so arbitrary workouts can enter the library without a file —
  rejected: it produces items frozen at the MAP that built them, which `sync` cannot re-anchor, so
  the library would quietly accumulate stale watts. Arbitrary composition is unaffected — it belongs
  on the calendar via `create_workout`, and promoting a session to permanence means writing a file.
  Cost accepted: a bundle-only install can seed the shipped templates but cannot add its own, and
  adding one requires a release.
- **Allow MAP and FTP to mix within a template** — rejected: one basis per template, mixing is a
  parse error. Preserves the existing invariant and keeps provenance to a single anchor.
- **Emit nested repeats to Intervals.icu** — rejected: Intervals.icu supports a single level of `Nx`.
  Templates may nest freely; at render a repeat block containing another repeat is **unrolled**, and
  a block containing only steps is emitted as native `Nx` (an unrolled block's label is discarded).
- **Keep `expandRamp`** — rejected: `map-ramp-test` was its only caller and is being rewritten as
  explicit fixed watts, because anything anchored moves when MAP moves and that defeats a test whose
  whole purpose is comparability across retests. `ramp` in a template is now a parse error pointing
  at explicit steps, since a long ramp collapses to one averaged target on a head unit. Generating a
  stepped protocol _scaled to current MAP_ is deferred as separate work.
- **Pass-through step directives** (`power=1s`, `Press lap`) — rejected: the athlete's own `Openers`
  uses them, but they are dropped on migration rather than carried through the grammar. The step
  form stays `label duration target cadence`.
- **Templates under `src/`** — rejected: the MCP server reads from `dist/`, so a local edit would
  silently not take effect until `npm run build`. At the repo root, the same entrypoint-relative path
  resolves in both the repo and the unpacked bundle, so the server reads the file you just edited.

## Consequences

- The committed render at MAP=415/FTP=290 lives at `tests/fixtures/rendered-templates.txt`;
  regenerate with `npm test -- -u` after an intentional template edit and review the diff.
- `seed_workout_library` and `refresh_workout_library` are replaced by `sync_workout_library`;
  `create_workout_library_item` is removed. 23 tools → 21.
- Sync is additive and **never deletes**. Renames and folder moves in a file are pushed
  (`name`, `folder_id`); a marker-bearing remote workout with no template file is reported as an
  orphan warning and left alone. Verified by live probe (2026-07-25): `PUT /workouts/{id}` honours
  both `folder_id` and `name`, and the change persists on re-read — so file-driven renames and
  folder moves are safe to implement.
- No build change is needed. `templates/` sits at the repo root, `.mcpbignore` does not exclude it,
  and `mcpb pack` therefore ships it at the bundle root — verified by packing and listing the archive
  (15 template files present). The loader resolves `../../../templates/workouts` from its own module, which is
  the same depth in `src/` and `dist/`, so the repo, `tsx` and the unpacked bundle all agree.
- Legacy `<!-- rationale {...} -->` blocks are still read for matching for one release, and rewritten
  to the new marker on first sync.
- `list_workout_library` gains `purpose` (required on every template), so the coach can select a
  template by what it is _for_ rather than by name and step count.
- Step-line detection must accept `-Label` as well as `- Label`. Intervals.icu accepts a dash with no
  following space; `STEP_LINE_RE = /^\s*-\s/` does not, so `30 on 30 off x 8 x 3` (workout 6) —
  authored in the Intervals.icu UI — currently reports as "Empty workout, 0 steps" in
  `list_workout_library`. Pre-existing bug, fixed as part of this work.
- The athlete's hand-authored workouts (`Openers`, `30 on 30 off x 8 x 3`, `2's and 3's`,
  `20 Min Warm Up`, `In the red pursuit intervals (2km)`) become templates and move under the
  `Coach:` folder scheme. Three are re-expressed on migration: `30 on 30 off` from fixed watts to
  %MAP (so it tracks fitness like its VO2 siblings), `20 Min Warm Up` from %LTHR to %FTP (its 5–10 s
  activations were unexecutable as HR targets — heart rate cannot respond inside 10 seconds), and
  `In the red pursuit intervals` re-anchored from FTP 285 to the current 290. Dropping `Press lap`
  converts three open-ended cooldowns to fixed 10-minute steps, and `sub_type: "WARMUP"` is lost. `MAP ramp test` is taken from the `Coach: Tests` copy (workout 17,
  clean +25 W/min to 490 W), not the older `Tests` copy (workout 1, ceiling 430 W with a +15 W
  irregularity) — the 2026-07-15 test's best-60s of 415 W lands exactly on a step of the former.
