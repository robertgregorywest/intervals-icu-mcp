## 1. Harvest the oracle

- [x] 1.1 Write a throwaway probe under `scripts/` that captures `(name, date, description, workout_doc, normalized_power, average_watts, icu_training_load, moving_time)` for every planned event carrying a parsed document
- [x] 1.2 Commit the whole capture as `tests/fixtures/workout-parser/events.json` — no filtering by threshold or by target style; the fixture must carry every input its assertions need, so that nothing about the test depends on live state
- [x] 1.3 Mark each entry as threshold-free or threshold-dependent for load purposes, so the assertion split below is data in the fixture rather than a rule someone has to remember
- [x] 1.4 Note in the fixture how it was harvested and when, so the re-harvest is repeatable and reviewable as a diff

## 2. Workout-text parser

- [x] 2.1 Create `src/services/workout-parser/` with `types.ts`, implementation, and `index.ts` re-exporting the interface plus factory
- [x] 2.2 Parse durations, absolute-watt targets, watt ranges, percentage targets and ranges, zone targets, cadence, and the ramp marker
- [x] 2.3 Parse repeat blocks, including the blank-line boundaries that close them
- [x] 2.4 Discard step lines carrying no parseable duration, and report each discard
- [x] 2.5 Resolve zone targets against the athlete's FTP-anchored power zones and percentage targets against the supplied threshold; report an unresolvable target rather than defaulting it
- [x] 2.6 Emit `WorkoutDoc` and carry the anchor values used
- [x] 2.7 Fidelity test: parse **every** fixture description and assert step sequence, per-step duration, and per-step target against the platform's own document. This assertion never resolves a target to watts — the platform stores a percentage target as a percentage — so it needs no threshold and cannot go stale when one moves
- [x] 2.8 Unit-test percentage and zone resolution to watts directly, against a threshold the test chooses. This is the one piece the fixture cannot assert: the platform's stored figures for a percentage-anchored prescription were resolved at whatever threshold was on file that day, which is not recorded on the event and cannot be recovered non-circularly

## 3. Load derivation

- [ ] 3.1 Create `src/services/training-load-forecast/` alongside the parser service, reusing `flattenPlannedSteps` for the flat step list
- [ ] 3.2 Build the synthetic power stream from flattened steps — range at its midpoint, ramp swept across its range
- [ ] 3.3 Compute normalised power over the stream, then intensity against the stated threshold, then load
- [ ] 3.4 Report a session whose steps cannot be resolved to watts as underivable, contributing no load
- [ ] 3.5 Fidelity test: assert derived normalised power and load against the platform's figures for the fixture's threshold-free entries — those prescribed wholly in absolute watts, which reproduce under any threshold and so cannot go stale. State the tolerance rather than assuming it

## 4. Trajectory

- [ ] 4.1 Carry fitness and fatigue forward under the athlete's time constants, reading them from sport settings and falling back to the platform defaults
- [ ] 4.2 Seed from the delivered wellness record for the seed date, or from a caller-supplied starting state, recording which
- [ ] 4.3 Read seven days of delivered history behind the first forecast day so ramp is defined from the start of the window
- [ ] 4.4 Compute form as same-day fitness minus fatigue, matching the live snapshot's existing definition
- [ ] 4.5 Regression test: seed from a wellness record and reproduce the following weeks of the committed series

## 5. Merge and roll-up

- [ ] 5.1 Read planned events across the window and overlay proposed sessions on them by date
- [ ] 5.2 Prefer a platform-computed load on an already-written session over re-deriving it
- [ ] 5.3 Carry each session's load source through to the result
- [ ] 5.4 Exclude strength sessions from the model and state the exclusion on the result
- [ ] 5.5 Roll each week up to total load, total duration, and fitness ramp
- [ ] 5.6 Assemble the basis — threshold, time constants, seed date and origin

## 6. Tool and adapters

- [ ] 6.1 Add the `forecast_training_load` handler in `src/tools/`, with input and output schemas
- [ ] 6.2 Register it in `src/registry.ts` with read-only annotations
- [ ] 6.3 Exercise it through the CLI adapter against the live account and compare a forecast week against the platform's projection once written
- [ ] 6.4 Add it to the Tool inventory in `src/mcp/syntax-doc.ts`

## 7. Documentation

- [ ] 7.1 Add the vocabulary to `CONTEXT.md` and the relationships it participates in
- [ ] 7.2 Rewrite the `coaching-session` skill's _Load check_ section around the forecast, keeping the arithmetic heuristic as the documented no-tool fallback
- [ ] 7.3 Record the endpoints and quirks relied on in the `intervals-api-research` endpoint reference
- [ ] 7.4 Consider an ADR for the local-parse-versus-platform-parse decision, since it establishes a second source for a shape the repo previously took only from the API
