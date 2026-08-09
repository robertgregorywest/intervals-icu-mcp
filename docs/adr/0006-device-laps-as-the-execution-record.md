# Device laps are the execution record; `icu_intervals` is a fallback

`compare_planned_vs_actual` compares **Planned steps** against the laps the head unit recorded,
decoded from the original upload (`GET /api/v1/activity/{id}/file`). Intervals.icu's own
`icu_intervals` analysis is used only when the laps are unavailable or cannot explain the session,
and the result always names which it read, in `executionRecord`.

`icu_intervals` looks like the recording and is not one. It is a **derived, editable segmentation**:
Intervals.icu detects it at upload, re-detects it on demand, and the UI can edit it. When it agrees
with the laps — which is most of the time — nothing is lost by reading it. When it disagrees it does
so by **moving rep boundaries**, which is precisely the quantity this comparison measures, so the
tool is wrong exactly where it matters and gives no signal that it is.

## The session that forced this

Activity `i173176564` (2026-08-06, "Pursuit race-pace — hold the floor"), a Wahoo ELEMNT BOLT
recording of a 4×2:30 prescribed at 390–410 W. The device lapped all 17 prescribed steps. The API
returned 18 `icu_intervals` with `icu_intervals_edited: true` against `icu_lap_count: 17`.

| Step       | Device lap  | `icu_intervals` | Reported before |
| ---------- | ----------- | --------------- | --------------- |
| Rep 1      | 150s @396 W | 134s @394 W     | on-target       |
| Recovery 1 | 300s @99 W  | 418s @209 W     | **over, +59 W** |
| Rep 2      | 150s @393 W | — (swallowed)   | **unmatched**   |
| Rep 3      | 150s @346 W | 128s @387 W     | **under, −3 W** |
| Rep 4      | 149s @350 W | 149s @353 W     | under           |

The detection merged rep 2 into the recovery around it (150s@393 plus 268s@110 averages to exactly
the 209 W reported) and clipped 22s off the front of rep 3, inflating it from 346 W to 387 W. The
tool therefore reported **394 / missing / 387 / 353** — "held the floor for three reps, faded on the
last" — where the ride was **396 / 393 / 346 / 350**: two clean reps, then a 44 W collapse on rep 3.
It reversed which reps failed, while reporting `alignmentBasis: "duration"` and
`matchedFraction: 0.88`.

Sampled against the other paired rides in the same block (`i172660347`, `i172265185`, `i173287176`),
`icu_intervals` matched the FIT laps to ±1s. That is the shape of the hazard: correct on almost
every session, silently inverted on the occasional one, with nothing in the output to tell them
apart.

## Laps are preferred, not "whichever fits best"

The obvious alternative — align against both records and keep the better score — is rejected.
Detection re-cuts step boundaries to whatever the power trace suggests, so it can **out-score the
laps precisely on the sessions where it has invented the structure**. Scoring would hand the review
back to the record that was wrong on exactly the case this exists to catch.

So the laps lose only when they explain nothing: candidates are tried in preference order and the
first that aligns at all (`alignmentBasis !== "none"`) wins. When neither aligns, the preferred
candidate's refusal is the one reported.

Two exceptions keep the fallback honest rather than dogmatic:

- **A single lap is not structure.** A ride the athlete never lapped yields one lap covering
  everything; preferring it would collapse every session to one step. Below two laps the detection
  is the only reading with anything in it.
- **Not every activity has a file.** Strava-synced activities carry no original upload, and not
  every upload is FIT. Every failure mode — 404, non-FIT bytes, an unwalkable record stream —
  collapses to `null` and falls through to detection. Losing the laps must never cost the review.

When detection _is_ used and the payload says it has drifted (`icu_intervals_edited`, or a
`icu_lap_count` that disagrees with the interval count), `executionRecordNote` says so. Both signals
ship in the activity payload and cost nothing to check.

## Why a hand-written FIT decoder

`src/services/activities/fit-laps.ts` walks the FIT record stream itself, reading global message 19
and skipping everything else by declared field size — roughly 250 lines, no new dependency.

- The server ships as an MCP bundle with three runtime dependencies; a FIT SDK is a large amount of
  surface for one message type.
- `@garmin/fitsdk` is the official decoder but is not OSI-licensed, which sits awkwardly in an
  MIT-licensed published package.
- The failure mode is contained by design: the decoder never throws, and anything it cannot read
  becomes `null` and falls back to today's behaviour.

Correctness is pinned against the `fitparse` reference decoder: four real uploads, 59 laps, every
field exact. `tests/fixtures/session-review/pursuit-race-pace.fit` is the 2026-08-06 file reduced to
its `file_id` and lap records, **copied verbatim** — the device's own field layout, endianness and
scaling — and verified to decode identically to the full 184 KB original.

## Scope

Only `compare_planned_vs_actual` reads laps. `compare_intervals` and `get_activity` with
`includeIntervals` still surface `icu_intervals`, correctly: they exist to expose Intervals.icu's
interval analysis, not to judge a prescription against it. `compare_intensity_distribution` is
unaffected — it buckets the raw power stream and never reads either record.

## Cost

One extra GET per comparison, and it downloads the original upload (~100–500 KB for a long ride)
rather than a JSON summary. Acceptable for a per-session coaching tool that already fetches the
activity and its event; not something to fold into a range-wide aggregate without reconsidering.
