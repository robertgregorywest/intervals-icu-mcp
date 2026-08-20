## Context

See `proposal.md` — _Why_. The constraint that shapes everything here is that Intervals.icu's numbers are a pure function of the prescription, and that function was verified against the live account before this design was written:

| Link in the chain | Model                                                     | Verified against                                                                       |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| text → steps      | the `- step` / `Nx` grammar                               | 68/69 planned events matched the platform's own parse on step count and total duration |
| steps → NP        | 1 Hz synthetic stream, 30 s trailing mean, 4th-power mean | mean 0.22 W, max 0.62 W across the 20 events authored at the current FTP               |
| NP → load         | `IF² × hours × 100`, `IF = NP / FTP`                      | integer-exact on every event carrying a load                                           |
| load → CTL/ATL    | `x' = x + (load − x)·(1 − e^(−1/τ))`, τ = 42 / 7          | 41 consecutive days of wellness records, max error 0.0000                              |
| CTL → ramp        | `ctl(d) − ctl(d−7)`                                       | matched the platform's `rampRate` field                                                |

`ctl_days` and `atl_days` are null on the athlete's sport settings, so the 42/7 defaults apply. There is no server-side endpoint that parses workout text without saving it — the plausible routes return 422 only because Spring fails to coerce the path segment into a Long.

## Goals / Non-Goals

**Goals:**

- One parse of a prescription, consumable by every existing planned-side lens as well as the forecast.
- Numbers that match what Intervals.icu will show once the sessions are written, so the forecast is a preview and not a second opinion.
- Every figure attributable: which FTP, which time constants, which seed, and where each session's load came from.

**Non-Goals:**

- Inverting the model ("what must the weekend carry to hit +5 CTL/week?"). The forward model makes the inversion arithmetic the coaching layer can do, and a second Tool can follow if it earns its place.
- Modelling strength load. See _Decisions_.
- Replacing the platform as the source of truth for events already written — where a written event carries a platform-computed load, that figure is preferred over re-deriving it.
- A pre-flight lint for workout text. The parser makes it possible; it is not this change.

## Decisions

### The parser's output type is `WorkoutDoc`, not a bespoke shape

The local parser produces the same `WorkoutDoc` the platform returns on an event. `flattenPlannedSteps` and `bucket.ts` are then reached the same way whether the doc came from the API or from text that has never been written.

_Why:_ it makes the parser's contract behavioural and directly testable — "produce what Intervals.icu would produce for this text" — with the platform's own `workout_doc` as the oracle. Emitting `FlatPlannedStep[]` directly would be less code but would give up that oracle, leaving only downstream numbers to check against.

_Alternative rejected:_ have the forecast write drafts to a scratch folder or draft events, read back the platform's computed load, then delete. Server-authoritative and zero modelling risk, but it costs a mutation and a round-trip per draft iteration — reintroducing the write-first loop this change exists to remove.

### A range target is taken at its midpoint for the stream; a `ramp` step is swept linearly

Measured across all 69 events: modelling a range as a linear sweep gave a mean NP error of 3.71 W and landed within 1 W on 32 events; modelling it as its midpoint gave 0.41 W and 65 events. Only a step the platform marks `ramp: true` is swept.

_Why it matters beyond accuracy:_ this is what the platform does, and matching it is the point.

### One parse, three consumers — and the middle band is not read off the stream

The midpoint-collapsed stream is correct for NP and for per-zone seconds, and **wrong for the middle-band dose**. `bucket.ts` already documents why: a `3600s @ 200–245 W` block has a midpoint 1.5 W inside a band beginning at 220 W, so midpoint credits the whole hour when barely half the prescribed range qualifies — a mistake that _"turned correctly-ridden Z2 sessions into 79% shortfalls"_. The middle band takes a range proportionally, by width-share.

So the forecast derives load from the stream and any middle-band figure from `bucket.ts`'s existing width-share path over the same `FlatPlannedStep[]`. The obvious shortcut — reading seconds-in-band off the synthetic stream — would silently contradict a rule this repo already settled.

### `Z`-targets resolve against the FTP power zones, not the MAP zones

`CONTEXT.md` makes **MAP zones** the canonical coaching frame, but Intervals.icu resolves a `Z2` target in workout text against the athlete's FTP-anchored `power_zones`. The forecast mirrors the platform, so it follows the platform's anchor. Resolving `Z2` against MAP zones would produce a number the dashboard never shows.

### A step line with no parseable duration is dropped

The platform drops it: a `Standing starts 5x` block containing `- MAX standing start from near-stop` flattened to 12 steps server-side against 17 parsed naively. The parser reproduces the drop rather than inventing a zero-duration step, and records that it did so, because a dropped line is a real (and invisible) authoring bug.

### The seed prefers what actually happened

The trajectory is seeded from the wellness record for the seed date — the delivered CTL/ATL — not from the platform's projection onto planned events. On a day carrying both a delivered activity and a planned event these differ (the athlete's 2026-08-20 read CTL 55.878 delivered against 56.231 planned). Forward days are forecast from prescriptions. Because ramp is `ctl(d) − ctl(d−7)`, the forecast reads seven days of wellness before the first forecast day regardless of how the seed was supplied.

### Proposed sessions merge over already-planned events by date

The forecast reads planned events in the window and overlays the supplied sessions on them, keyed by date, so a partly-fixed week does not have to be restated. A supplied session replaces the planned work for its date; a date with no supplied session keeps whatever is on the calendar. Where a written event already carries a platform-computed `icu_training_load`, that figure is used rather than re-derived — the platform's own number is better evidence than a reproduction of it, and it keeps the forecast anchored to the dashboard.

### Load comes from one of three places, and the result says which

Per session: a **local parse** of supplied text, a **platform-supplied** figure on an already-written event, or a **caller-supplied** load number for a session whose shape is not yet decided. Mixed sources in one forecast are normal — a fixed track night, a drafted weekend, and "assume 180 for the club run" — so the source travels per session rather than per forecast.

### Strength contributes zero

Every `WeightTraining` event and activity on the account carries `icu_training_load: null`, and Intervals.icu excludes them from its own projection. The forecast does the same. This under-reads fatigue in a block running two gym sessions a week, and that is a known, stated limitation rather than a modelling choice — assigning a nominal figure would make every number diverge from the dashboard the athlete reads.

### TSB is same-day `ctl − atl`

Matching `src/services/coaching-context/coaching-context.ts`, which already defines form this way for the live snapshot. Intervals.icu's fitness chart conventionally reads form from the previous day; adopting that here would put two definitions of TSB in one server, which is worse than differing from the chart by one day in a way the basis can state.

### Fidelity is asserted offline against a committed fixture, and the fixture is self-contained

The oracle is live data, so the test cannot call the API in CI. A harvest script captures `(description, workout_doc, normalized_power, icu_training_load)` tuples from the account into `tests/fixtures/workout-parser/`, and the test asserts the local parse against them — the same shape as the committed `tests/fixtures/rendered-templates.txt` render snapshot, re-harvested deliberately and reviewed as a diff.

**Every input an assertion needs lives in the fixture.** A snapshot test that reaches outside its snapshot for an input is not a snapshot test, and the input that would otherwise leak in here is the threshold. The assertions are therefore split by what each actually requires:

- **Structure — every entry, no threshold.** The platform stores a percentage target as a percentage (`54-66%` is kept as `{units: "%ftp", start: 54, end: 66}`), so comparing parsed steps against the platform's steps never resolves anything to watts. This assertion is stable whatever the athlete's threshold does.
- **Load — the entries prescribed wholly in absolute watts, no threshold.** Normalised power and load reproduce from absolute watts alone. On the harvested corpus this is 66 of 69 events, because `WATTS_AT_API_RULE` makes everything this repo authors absolute; the three exceptions were hand-authored in the Intervals.icu UI. The share shrinks with each harvest rather than growing.
- **Percentage and zone resolution to watts — a unit test against a chosen threshold.** This is the one thing the oracle cannot assert. The platform resolved those prescriptions at whatever threshold was on file the day they were authored; the event does not record it, and recovering it by scaling from our own computed normalised power would make the assertion circular — deriving the anchor that makes the test pass and then passing.

_Alternative rejected:_ harvesting only prescriptions authored at the current threshold. It keeps the oracle green by discarding exactly the entries that exercise percentage resolution, and it leaves the underlying defect — a test input sourced from live state — in place, to resurface at the next threshold change.

## Risks / Trade-offs

- **The platform changes its parser or its load model, and the forecast drifts silently.** → The fixture is the tripwire, and re-harvesting surfaces the change as a reviewable diff. Every result naming its parse basis means a forecast figure is never mistaken for a platform figure.
- **The corpus is one athlete's.** 69 events is a real oracle but not a broad one; shapes it barely covers — sub-30 s steps against the 30 s smoothing window, deeply nested repeats, HR- or pace-targeted steps — are the likeliest source of an unmodelled case. → Steps whose target cannot be resolved to watts are reported unresolved rather than defaulted, so an unmodelled case surfaces as a gap in the result instead of a plausible wrong number.
- **`%`-anchored prescriptions drift with FTP.** Every event whose NP error exceeded 1 W was `%ftp`- or `Z`-anchored and authored at an older FTP; absolute-watt events matched at any assumed FTP. → The forecast forecasts at one stated FTP, and the basis names it. This is `WATTS_AT_API_RULE` earning its keep. Note this is a property of the prescriptions, not of the fixture: the fixture handles it by splitting its assertions, not by filtering its corpus (see _Decisions_).
- **Strength is invisible.** → Stated in the result, not silently absorbed.
- **A forecast is only as good as its prescriptions.** The model says what the sessions would cost if ridden as written; it says nothing about whether they will be. → The existing execution-review lenses remain the check on delivery, and neither replaces the other.

## Migration Plan

Additive: two new services, one new Tool, no change to existing behaviour or to any written data. The `coaching-session` skill's _Load check_ section moves from write-then-read plus heuristic to a forecast call in the same commit sequence, and the heuristic stays documented as the no-tool fallback. Rollback is removing the Tool from the registry.
