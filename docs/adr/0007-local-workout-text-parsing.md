# Workout text is parsed locally, and the platform's parse still wins where it exists

`src/services/workout-parser/` reproduces Intervals.icu's own parse of a workout description,
emitting the same `WorkoutDoc` shape the API returns on an event. A prescription can therefore be
analysed — costed, bucketed, compared — **before it is written to the calendar**, and every existing
planned-side lens reaches that analysis by the path it already uses (`flattenPlannedSteps`, then
`bucket.ts`). The document carries a **Parse basis** naming where it came from, and where the
platform has already parsed an event, that document is the one used.

This establishes a second source for a shape the repo previously took only from the API, which is
why it warrants a record.

## Why the local parse has to exist

Every planned-side computation here — `compare_planned_vs_actual`, `compare_intensity_distribution` —
consumes `event.workout_doc`, and that field only exists once the event has been written. So
checking whether a drafted week hits its ramp target meant writing it, reading `icu_ctl` back, and
deleting it if wrong: a mutation and a round-trip per iteration.

There is no server-side alternative. Intervals.icu exposes no endpoint that parses workout text
without saving it; the plausible routes return 422 only because Spring fails to coerce the path
segment into a Long. The choice is a local parse or a write-first loop.

## Why the output type is `WorkoutDoc` and not a bespoke shape

Emitting `FlatPlannedStep[]` directly would be less code. It would also give up the oracle: with
`WorkoutDoc` as the output, the contract is **behavioural** — "produce what Intervals.icu would
produce for this text" — and the platform's own `workout_doc` on 118 harvested events is the thing
to check it against. A bespoke shape leaves only downstream numbers to check, which is a weaker test
of a stricter thing.

The measured result: steps, durations and targets match on **118 of 118** events, and the whole
document matches on 116. The two that differ do so only in a label's HTML escaping (the platform
stores `&lt;`, which is encoding rather than parsing) and in one cadence field on a step line whose
"label" is an entire paragraph.

## Why the platform's parse still wins on a written event

Where an event carries a `workout_doc`, the forecast uses it, and where it carries a
platform-computed `icu_training_load`, it uses that rather than re-deriving. The platform's own
figure is better evidence than a reproduction of it, and it keeps the forecast anchored to the
dashboard the athlete actually reads. The local parse is a **fallback for text that has never been
written**, not a replacement.

That asymmetry is the whole reason the Parse basis travels on the result: the two documents are
interchangeable to consumers by design, and the basis is what keeps the interchange visible.

## The reconstruction rules are measured, not assumed

The parser reproduces what the platform does, including where that is surprising:

- A step line carrying **no parseable duration is discarded**, not emitted as a zero-duration step.
  Verified by writing `- MAX standing start from near-stop` and `- 0s 200w` and reading back neither.
  A dropped line is a real and otherwise invisible authoring bug, so each discard is reported.
- The **label ends at the first token carrying a number against a unit** — which is why
  `Easy spin — 40–55% MAP … 45m 160w-215w` keeps only `Easy spin —`, while a lap time of `0.33s`
  inside a paragraph of prose does not truncate anything. `src/mcp/syntax-doc.ts` already warns
  authors about this; the parser now reproduces it.
- A **zone reached before the step's duration clears the label**, where one reached after it does
  not: `Easy Z2 — optional … 45m` stores no label, `Cooldown 10m Z1` stores `Cooldown`.
- `ramp` is **not** a label terminator, so `Ramp to failure 1m 140w` is a step labelled
  `Ramp to failure` rather than a ramp.

## Considered options

- **Write drafts to the calendar, read the platform's figures, delete them.** Server-authoritative,
  zero modelling risk — and it reintroduces exactly the write-first loop the forecast exists to
  remove, at a mutation per iteration. Rejected for the forecast path. It is still the right tool
  for a one-off measurement, and is how `--zones` on the fixture capture script establishes the
  zone-target oracle.
- **Parse only well-formed text and refuse the rest.** Rejected: the corpus is the athlete's own
  history, and a third of it puts prose in step labels. A parser that refuses what the platform
  accepts is not reproducing the platform.
- **Harvest only prescriptions authored at the current threshold**, so the fixture's load assertions
  stay green. Rejected: it keeps the oracle green by discarding precisely the entries that exercise
  percentage resolution, and leaves the real defect — a test input sourced from live state — in
  place to resurface at the next FTP change. The fixture splits its **assertions** by what each
  needs instead of filtering its **corpus**.

## Consequences

- The fidelity fixture is the tripwire. If Intervals.icu changes its parser or its load model, the
  committed `tests/fixtures/workout-parser/events.json` surfaces it as a failing assertion, and
  re-harvesting surfaces it as a reviewable diff.
- The corpus is one athlete's. 118 events is a real oracle but not a broad one; sub-30 s steps
  against the 30 s smoothing window, deeply nested repeats, and HR- or pace-targeted steps are
  thinly covered. A target that cannot be resolved to watts is reported unresolved rather than
  defaulted, so an unmodelled case surfaces as a gap rather than as a plausible wrong number.
- Zone-1 resolution is fitted to a single measured point (141 W at FTP 286, against a floor at four
  fifths of the zone ceiling). It is committed as a fixture with the probe that produced it, so it
  is re-checkable rather than folklore.
- `flattenPlannedSteps` and `bucket.ts` are reused unchanged. Zone targets, which
  `flattenPlannedSteps` does not know, are rewritten into watt bands by the parser service first —
  so a `ZN` step reaches the existing code as a band, and an unresolvable one reaches it as an
  unresolved target.
