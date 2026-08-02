## 1. Types and fixtures

- [x] 1.1 Extend the event type with `workout_doc` (`{ steps: PlannedDocStep[] }`, where a step is either `{ text, duration, power?, cadence? }` or `{ reps, text, duration, steps }`) plus `icu_training_load` and `icu_ftp`
- [x] 1.2 Extend `src/services/activities/types.ts` with `paired_event_id` and `compliance`
- [x] 1.3 Capture live fixtures under `tests/fixtures/session-review/` from probed real data: the 9-step / 3-interval trainer pair (activity `i171371339` ↔ event `123780543`), a repeat-block event (`107665970`), a clean 1:1 pair, an activity with no intervals, and an event with no `workout_doc`

## 2. Planned-side flattening

- [x] 2.1 Create `src/services/session-review/` with `types.ts` declaring `ISessionReview`, `FlatPlannedStep`, `AlignedStep`, `SessionRollup`, `AlignmentBasis`, and the reason codes
- [x] 2.2 Implement recursive flattening of `workout_doc.steps` into `FlatPlannedStep[]`, expanding `reps` and carrying `repIndex`/`stepInRep`/`sourceIndex`
- [x] 2.3 Normalise power targets to watts — `{ value }` to a point target, `{ start, end }` to a preserved range, percent units via event `icu_ftp` then activity `icu_ftp`, and a named failure when neither is available
- [x] 2.4 Unit-test flattening against the repeat-block fixture: N × M steps out, rep indices correct, nested repeats recurse

## 3. Alignment core (pure, no HTTP)

- [x] 3.1 Implement the duration-only match score with its floor, as named constants documented in place
- [x] 3.2 Implement the order-preserving gapped dynamic program over `(FlatPlannedStep[], ActivityInterval[])`
- [x] 3.3 Derive `AlignmentBasis` from the DP outcome — `sequential` when complete and gapless, `duration` when partial above the confidence floor, `none` below it
- [x] 3.4 Implement the post-DP ambiguity demotion: a match whose neighbouring candidate scores within the margin becomes unmatched
- [x] 3.5 Unit-test the core against fixtures: clean 1:1 yields `sequential`; 9-vs-3 yields `duration` with named unmatched steps; shuffled/unrelated intervals yield `none`; two identical adjacent intervals demote to unmatched rather than pairing arbitrarily
- [x] 3.6 Assert in tests that no power value influences pairing — permuting `average_watts` across intervals must not change the alignment

## 4. Verdicts and roll-up

- [x] 4.1 Implement per-step verdicts — `not-attempted` checked first on the fixed duration threshold, then `on-target`/`over`/`under` against `tolerance` (default 0.05), `unmatched` for unpaired steps with delivered fields absent
- [x] 4.2 Implement range-target handling: delivered average inside the band is `on-target` with delta `0`
- [x] 4.3 Implement the session roll-up — planned vs actual load, planned vs actual duration, platform `compliance` labelled as the platform's own figure, and unplanned intervals with duration and average power
- [x] 4.4 Ensure the roll-up is emitted on every path, including `basis: none`, with an empty step list
- [x] 4.5 Unit-test verdict boundaries: just inside and just outside tolerance in both directions, a caller-supplied tolerance echoed in the response, a step cut short

## 5. Service wiring

- [x] 5.1 Implement `SessionReview` — activity path: fetch the activity, read `paired_event_id`, fetch the event
- [x] 5.2 Implement the event path: fetch the event, list activities over `start_date_local ± 2 days`, select by matching `paired_event_id`, and return reason `no-paired-activity` when none matches
- [x] 5.3 Implement the named refusal paths — `no-paired-event`, `no-paired-activity`, `no-structured-steps`, `no-intervals`, `alignment-failed` — each returning the roll-up with an empty step list
- [x] 5.4 Add `index.ts` re-exporting the interface and factory; compose the service into `IntervalsClient` in `src/index.ts` and add the method to `IIntervalsClient`
- [x] 5.5 Test the service with injectable fetch (no global mocks) covering both entry directions and every refusal path

## 6. Tool and registry

- [x] 6.1 Add `src/tools/session-review.ts` with `comparePlannedVsActualSchema` — `activityId`, `eventId`, `tolerance` — enforcing exactly one identifier via a zod refinement, and `comparePlannedVsActualOutputSchema`
- [x] 6.2 Normalise activity IDs (`i` prefix) consistently with `src/tools/analysis.ts`
- [x] 6.3 Register `compare_planned_vs_actual` in `src/registry.ts` with `READ_ONLY` annotations and a description stating the alignment bases, the refusal reasons, and that coarse auto-detected intervals often mean partial alignment
- [x] 6.4 Test the handler: both-identifiers rejection, single-identifier success, tolerance pass-through

## 7. Validation against real sessions

- [x] 7.1 Run the CLI (`./bin/icu compare_planned_vs_actual`) over at least eight real paired sessions spanning a clean structured workout, a track session, a trainer ride, and a session ridden off-plan
- [x] 7.2 Review each result by hand for confident-but-wrong pairings; tighten the score floor, confidence floor, or ambiguity margin until none survive, accepting more `none` results as the cost
- [x] 7.3 Settle the design's open question — whether the confidence floor counts steps or weights them by planned duration — from what the real sessions show, and record the choice beside the constant
- [x] 7.4 Confirm the read-only claim: no create/update/delete request is issued on any path

## 8. Discoverability and distribution

Registering a Tool projects it onto both adapters but does not announce it. These are the manual edits the registry does not drive — a tool the calling model never hears about cannot close the verify gap.

- [x] 8.1 Add a **Verification** entry to `src/mcp/syntax-doc.ts` so the comparison is named in the instructions the MCP server supplies on connection
- [x] 8.2 Declare `compare_planned_vs_actual` in `manifest.json` and confirm `npm run check:manifest` reports tools in sync
- [x] 8.3 Add the tool's row to the README table and name session verification in the capability list

## 9. Wrap-up

- [x] 9.1 Run `npm test` and the type check; add regression tests for anything found during 7.2
- [x] 9.2 Update `CONTEXT.md` with the vocabulary this change introduces — alignment basis, planned step, delivered interval, verdict
- [x] 9.3 Note in the change's follow-ups that `coaching-session` should call the verify step before drawing block-level conclusions (out of scope here)
