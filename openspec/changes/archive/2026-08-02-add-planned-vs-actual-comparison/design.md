## Context

See `proposal.md` — Why. Design-relevant state, confirmed by live probe on 2026-08-02:

- **Planned side.** An event carries `workout_doc` — Intervals.icu's own parse of the workout text — as `{ steps: [...] }`. A simple step is `{ text, duration, power: { units, value } | { units, start, end }, cadence? }`; a repeat block is `{ reps, text, duration, steps: [...] }`, nested one level. The event also carries `icu_training_load` (planned load) and `moving_time`.
- **Actual side.** An activity carries `paired_event_id`, `icu_intervals` (`start_time`, `elapsed_time`, `average_watts`, `average_cadence`, `average_heartrate`, `type` of `WORK`/`RECOVERY`, `group_id`), `icu_training_load`, and a scalar `compliance` (e.g. `73.97`).
- **Reverse lookup is not a filter.** There is no endpoint that fetches an activity by `paired_event_id`. However, `paired_event_id` and `compliance` are present on the `GET /athlete/{id}/activities` list payload, so event → activity resolution is a short date-window scan.
- **The mismatch is real.** Activity `i171371339` pairs to event `123780543`: nine planned steps against three auto-detected intervals, planned load 73 against actual load 54. That is the normal case, not the pathological one.
- Repo conventions from `CLAUDE.md`: service behind an interface with `types.ts`/impl/`index.ts`, tool handler in `src/tools/`, one registry entry, both adapters pick it up.

## Goals / Non-Goals

**Goals:**

- One alignment algorithm whose _outcome_ determines the reported basis, rather than a cascade of heuristics each with its own failure mode.
- Alignment evidence that is independent of the quantity being judged.
- Every "no answer" path carries a named machine-readable reason.

**Non-Goals:**

- Stream-level (per-second) reconstruction of what was ridden. Intervals are the unit; `get_activity_streams` already exists for finer work.
- Judging cadence, heart rate, or lap splits. Power and duration only in this change; cadence is carried through for display but not verdicted.
- Editing or re-detecting intervals on Intervals.icu.
- Changing `coaching-session`'s guidance to call the tool — follow-on work.

## Decisions

### Read the planned side from `workout_doc`, not from the description text

`workout_doc.steps` is the server's own parse — the same structure the head unit received — with repeats already expressed as `{ reps, steps }`.

_Alternative rejected:_ reuse `src/services/workout-library/parser.ts`. It extracts durations only (no targets), deliberately, for library summaries; extending it to full target parsing would duplicate a parser Intervals.icu already runs and would let our reading of a workout drift from the athlete's.

_Consequence:_ an event with no `workout_doc` (a plain note, or a description Intervals.icu could not parse) is a hard stop with reason `no-structured-steps`, not a fallback to text parsing.

### Align on duration and elapsed position only — never on power

The pairing must not use the measurement whose deviation it exists to detect. Aligning on power would pair a prescribed 375 W step to whichever interval came closest to 375 W, and every session would look compliant. `type: WORK`/`RECOVERY` is rejected as a corroborator for the same reason: it is derived from power.

_Consequence:_ a session ridden at entirely the wrong intensity but the right shape aligns cleanly and reports `under` across the board — which is the correct, useful answer.

### One order-preserving gapped alignment; the basis is its outcome

Flatten planned steps (expanding `reps` into individual steps that keep `repIndex`/`stepInRep`), then run a Needleman–Wunsch-style dynamic program over flattened steps × recorded intervals. Order-preserving, gaps allowed on both sides, scored purely on duration agreement:

- match score falls off with relative duration difference; below a floor (roughly 40% relative difference) a pairing scores worse than a gap, so the DP prefers leaving both sides unmatched
- gap penalties are constant, so skipping an auto-lap or an unridden step is cheap and does not cascade

Basis is read off the result rather than chosen up front:

- `sequential` — every planned step matched, every interval consumed, no gaps
- `duration` — some matched, some gapped, and the matched fraction clears a confidence floor
- `none` — matched fraction below the floor

_Alternative rejected:_ a staged cascade (try 1:1 by count, else greedy duration windows, else give up). Each stage needs its own accept/reject threshold, and greedy duration matching is precisely where confident-but-wrong pairings come from.

### Drop ambiguous matches to `unmatched` after the DP

A DP returns _a_ best path even when two paths are near-equal. After alignment, each matched pair is re-checked against its neighbouring candidate intervals; if a neighbour scores within a small margin of the chosen one, the pair is demoted to unmatched. This implements the spec's "ambiguity is not resolved by guessing" and costs recall on purpose.

### New `session-review` service, not an extension of `analysis`

`src/services/analysis/` compares intervals _across activities_ — a different question with a different shape. `src/services/session-review/` owns pairing, flattening, alignment, and verdicts behind `ISessionReview`, composed into `IntervalsClient` like the rest. The alignment core is a pure function over `(plannedSteps, intervals)` so it can be unit-tested against fixture pairs with no HTTP.

### Event → activity resolution by bounded date scan

Given only an `eventId`, fetch the event, then list activities over `start_date_local ± 2 days` and select the one whose `paired_event_id` matches. No match → reason `no-paired-activity`. The window is bounded and the scan is a single list call; a wider search is not worth it, since an activity paired to an event is dated at or adjacent to it.

### Power targets normalised to watts at read time

`power.units` is `w` in practice but the field exists, so percent units are converted using the event's `icu_ftp`, falling back to the activity's `icu_ftp`. If neither is available for a percent-unit step, that step's verdict is `unmatched` with reason rather than a guessed denominator. Range targets (`start`/`end`) are kept as ranges: a delivered average inside the band is `on-target` with delta `0`, so a deliberately wide Z2 band is not scored as a near-miss against its midpoint.

### `tolerance` applies to point targets only, never to bands

Surfaced during implementation against the real Sweet Spot 3×12 pair (event `123780516` ↔ activity `i170317118`): rep 1 delivered 244 W against a prescribed 255–275 W band. Applying the 5% tolerance outside the band widens it to an effective 242–289 W and reports that rep `on-target`, hiding an 11 W under-delivery on the first rep of a three-rep block — the exact rep-to-rep signal this comparison exists to surface.

A band is already a statement of the spread the coach will accept. Adding a second tolerance on top double-counts it. So: inside the band is `on-target` with delta `0`; outside is `over`/`under` measured from the crossed edge, with no further grace. `tolerance` governs point targets, where no spread was stated.

### Two independent thresholds

`tolerance` (caller-supplied, default `0.05`) governs power verdicts only. A separate fixed threshold — delivered duration below 50% of prescribed — produces `not-attempted`, and is checked first, since a step ridden for 20 seconds of a prescribed 5 minutes has a meaningless average power. These are deliberately not one knob: loosening the power tolerance should not change what counts as an abandoned step.

### Interval duration uses `elapsed_time`

Consistent with `src/services/analysis/intervals.ts` and the existing `ActivityInterval` type. See Risks for the coasting caveat.

## Risks / Trade-offs

- **Conservatism produces `none` on genuinely comparable sessions.** → Accepted by design; the response always carries the roll-up (planned vs actual load and duration, platform `compliance`), so `none` still answers the coarse question. The reason field names which check failed, so thresholds can be tuned against real sessions rather than in the abstract.
- **Auto-detected intervals are coarse.** The probed trainer ride collapsed nine planned steps into three laps. Sessions ridden without a structured workout loaded on the head unit will frequently land on `duration` or `none`. → Documented in the tool description; unplanned-work reporting still surfaces what was actually done.
- **`elapsed_time` includes coasting.** Track and trainer efforts with long coast-downs read longer than prescribed, which can trip the `not-attempted` check in the wrong direction (too long, not too short — the check is one-sided, so the practical risk is a duration delta that looks worse than it is). → The one-sided threshold contains it; if it bites, switch to `moving_time` where the interval carries it.
- **`workout_doc` nesting is assumed one level deep.** Probed data shows `{ reps, steps }` with only simple steps inside. → Flattening recurses rather than assuming depth, so a nested repeat degrades to more flattened steps instead of a crash.
- **Percent-unit targets are untested against live data.** Every probed event used `w`. → The conversion path is exercised by fixtures, and the no-FTP case fails loudly rather than silently.
- **Thresholds (score floor, confidence floor, ambiguity margin) are picked from one probe session.** → They live as named constants in one module with the reasoning beside them, and the tasks include validating them against a set of real paired sessions before the change is called done.

### Ramps are judged against their midpoint, not their ends

Found during validation: `workout_doc` marks a ramp step with `"ramp": true` alongside the same `power.start`/`power.end` shape a plain range uses. The two must not be judged alike. Treating a `130w-220w` ramp as an acceptable band would report a rider who sat at 135 W for the whole 20-minute warm-up as `on-target`. A ramp prescribes a progression whose expected average is its midpoint, so it is judged as a point target against `tolerance`; a plain range keeps the band treatment above. The prescribed ends are still reported, flagged `ramp: true`, so the caller sees what was asked for.

## Resolved Questions

- **Confidence floor counts steps; it is not weighted by planned duration.** Settled against real session `i168337217`, which prescribes 600/3600/300 s and was auto-lapped 1728/264/2485 s — one continuous endurance ride the detector split arbitrarily. By step count, 1 of 3 matches (0.33) and the session is correctly refused. Weighted by duration, the single 3600 s block is 80% of planned time, clearing the floor and reporting that block as delivered by a 2485 s chunk with the first 1728 s labelled unplanned work — a confident wrong reading of the exact kind this change exists to prevent. Recorded beside `CONFIDENCE_FLOOR` and pinned by a regression test.
