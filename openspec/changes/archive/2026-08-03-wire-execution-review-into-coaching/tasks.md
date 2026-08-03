## 1. Probe and fixtures

- [x] 1.1 Probe `get_activity_streams` for a short and a long key session and record the returned `samples` / `original_samples` / `stride`, confirming how seconds are recovered from a strided stream and at what activity length striding begins
      → **Answered negative.** The API never strides. `samples`/`original_samples`/`downsampled`/`stride` are produced by `packStreams` in `src/tools/activities.ts`, a model-context budget applied in the _tool_ layer only; `IActivitiesApi.getActivityStreams` returns the full 1 Hz stream at any length. Probed `i170317118` (4121 s → 4112 watts samples), `i162668771` (6.5 h, 23 217 s moving / 27 842 s elapsed → 23 160 samples), `i171371339` (track, 3296 s moving / 7169 s elapsed → 3322 samples). A `time` stream is co-returned, same length, seconds-from-start, 1 Hz with pause gaps (3 / 35 / 20 gaps respectively). No-power activity (`i170871150`, WeightTraining) returns `{}` — empty stream map, not an error. **Resolved:** the measured/estimated marker is dropped — see `design.md` → _The delivered side is always measured_.
- [x] 1.2 Confirm the MAP-zone boundaries available from `get_coaching_context` (`mapZones`) are expressible as watt bounds usable for bucketing, and record the middle band's own watt bounds derived from FTP at 76–106%
      → **Confirmation failed — MAP zones are not a partition.** `ZONE_DEFS` (`src/services/power-profile/compute.ts:29`) defines deliberately _overlapping_ training bands (Ric Stern model). At MAP 415 W: REC 0–166, L1 166–228, L2 208–270, L3 249–291, L4 270–311, L5 291–353, L6 332–457, L7 457–623, NMP 623–846. Every watt from 208 to 457 falls in two or more zones, so seconds cannot be bucketed into them without double-counting.
      → Middle band **does** hold: FTP 290 × 76–106% = **220–307 W**, independent of the zone frame, so the roll-up survives whatever §1.2 resolves to.
      → **Resolved:** bucket against a partition derived from the strictly-increasing `lowW` ladder — REC 0–166, L1 166–208, L2 208–249, L3 249–270, L4 270–291, L5 291–332, L6 332–457, L7 457–623, NMP 623+. See `design.md` → _A partition is derived from the MAP-zone ladder_.
- [x] 1.3 Capture live fixtures under `tests/fixtures/intensity-distribution/`: the clean paired case (activity `i170317118` ↔ event `123780516`), the alignment-defeating track case (`i171371339` ↔ `123780543`), a paused ride whose sample count falls well short of its elapsed time, an activity with no power (`i170871150`, returns `{}`), and an event with no structured steps
      → Captured by `scripts/capture-intensity-fixtures.ts`. The track case doubles as the paused case (3322 samples against 7169 s elapsed). `no-structured-steps` is **composed**, not captured: on this account every event with an empty `workout_doc.steps` is a strength session, which also has no power, so the two dead ends had to be separated by hand. `coaching-zones.json` pins the frame (FTP 290, MAP 415) so tests do not drift when the athlete's MAP moves.

## 2. Intensity-distribution service

- [x] 2.1 Create `src/services/intensity-distribution/` with `types.ts` declaring `IIntensityDistribution`, the per-zone comparison row, the middle-band roll-up, the range result, the reported boundaries, and the reason codes
- [x] 2.2 Reuse the existing pair resolution from `session-review` for the single-session case rather than reimplementing it — exactly one of `activityId` / `eventId`, resolved via the activity's recorded pairing, rejecting both-or-neither before any HTTP
- [x] 2.3 Derive the bucketing partition from `mapZones` — assign each wattage to the highest zone whose `lowW` it reaches, asserting the `lowW` ladder is strictly increasing rather than assuming it
- [x] 2.3a Implement planned bucketing from `workout_doc.steps` — reuse `session-review`'s flattening and watt normalisation, assign each step's prescribed duration to the partition zone containing its target (a range by its midpoint), and record when a range spanned a boundary
- [x] 2.4 Exclude steps whose target cannot be resolved to watts from the planned distribution and report them as unbucketed, never assigned by guesswork
- [x] 2.5 Implement delivered bucketing from the `watts` stream against the same partition, counting each sample as one second of recording time so paused time contributes to no zone
- [x] 2.6 Implement the middle-band roll-up from its own watt bounds — planned, delivered, delta, delivered fraction — computed independently of the MAP-zone breakdown rather than by summing zones
      → A prescribed range contributes its **overlap fraction** with the band, not all-or-nothing by midpoint. Found in §9.1 validation: the athlete's Z2 prescriptions (`3600s @ 200–245 W`) have midpoints a couple of watts inside the 220 W floor, so midpoint bucketing reported correctly-ridden endurance rides at 0.21–0.34 delivered and dragged the window figure to 0.64. Proportional gives 0.88 with the key sessions unchanged. Zone assignment still uses the midpoint. See `design.md` → _The middle band takes a range proportionally, not at its midpoint_.
- [x] 2.7 Implement the absent-input paths: no structured steps, no recorded power, and no resolvable coaching zones each return their own reason; the middle band is still reported when only the zone frame is missing
- [x] 2.8 Report the partition boundaries used on every successful comparison, as the partition's own bounds rather than the overlapping coaching bands they were derived from
- [x] 2.9 Unit-test the single-session case against the fixtures: the clean pair's planned distribution matches hand-computation from its steps; the track pair still returns a full comparison despite defeating step alignment; delivered seconds sum to the sample count on a paused ride rather than to its elapsed time; per-zone seconds never double-count a wattage that falls in two coaching bands; each dead end returns its named reason
- [x] 2.10 Test the contract property directly — bucketing the same prescribed session against two different athlete FTP values must not change the planned distribution, since targets are absolute watts

## 3. Range aggregation

- [x] 3.1 Implement the date-range variant — sum planned and delivered seconds per zone across every paired session in the range, plus the range middle-band roll-up
- [x] 3.2 Emit per-session detail rows (date, name, middle-band planned/delivered/fraction) alongside the sums so a cross-session pattern is visible
- [x] 3.3 Exclude activities with no planned event and events with no completed activity from the sums, and report them in a separate list
- [x] 3.4 Enforce the maximum range window, rejecting an over-long range before any HTTP with an error naming the limit
- [x] 3.5 Unit-test the range case: sums equal the per-session figures; an unpaired activity in the range changes neither sum; a session with no recorded power is excluded and reported rather than poisoning the aggregate

## 4. Tool and registry

- [x] 4.1 Implement `src/tools/intensity-distribution.ts` with the Zod input schema (single-session and range forms) and output schema
- [x] 4.2 Add the `compare_intensity_distribution` entry to `src/registry.ts` with `READ_ONLY` annotations and a description stating what the lens answers, that both sides are computed from the prescription and the recorded power rather than read from platform figures, that it needs no step alignment, and that it is the companion to `compare_planned_vs_actual` rather than a replacement
- [x] 4.3 Compose the service into `IntervalsClient` in `src/index.ts`
- [x] 4.4 Update `tests/registry.test.ts` and `tests/cli/main.test.ts` counts, and add `tests/tools/intensity-distribution.test.ts`
- [x] 4.5 Verify end to end through the CLI adapter against live data — `./bin/icu compare_intensity_distribution` for both the single-session and range forms

## 5. Coaching-log watermark

- [x] 5.1 Add the `reviewed-through: YYYY-MM-DD` line to the live-state header schema in `.claude/skills/coaching-session/coaching-log-format.md`, including its absence on an existing or bootstrapped log
- [x] 5.2 Add advancing the watermark to the checkpoint maintenance steps — advanced to today only as part of a confirmed write, never before
- [x] 5.3 Document the window rules in the same file: watermark to today, skipped below one day or when the window holds no key session, capped at 28 days with an explicit statement that earlier sessions were not reviewed, and falling back to the current block from `season.md` when no watermark exists

## 6. Execution-review procedure

- [x] 6.1 Write `.claude/skills/coaching-session/execution-review.md` — the interpretation rules: work steps versus support steps and how the role is derived, `under` inverting on recovery steps, range targets carrying no tolerance, `alignmentBasis: none` as a refusal rather than a failed session, platform compliance as context and not as the verdict
- [x] 6.2 Add the lens-selection table to that file: step lens for head-unit-executed structured work, band lens for everything including track and abandoned sessions, both where both apply, and what question each answers when they disagree
- [x] 6.3 Add the depth ladder: maximal-aerobic work read rep by rep with decay as the primary finding, sweet spot and threshold scanned at rep level, endurance checked only for ceiling violations, track read on distribution and effort peaks
- [x] 6.4 Add the reporting threshold: recurrence in the same structural position surfaces as a pattern with its evidencing sessions, an isolated shortfall does not surface, the window's middle-band dose is reported every time regardless of outcome
- [x] 6.5 Add the worked example from the probed 07-29 session — raw verdicts, which are artefacts, what the coach actually says — so the rule has a concrete anchor

## 7. Coaching-session wiring

- [x] 7.1 Add execution review to the session-start moves in `.claude/skills/coaching-session/SKILL.md`, after the context stack, with the watermark read from the log header
- [x] 7.2 Add the key-session selection rule: select from the planned side, sweet spot and above, so an abandoned key session is selected rather than missed
- [x] 7.3 Add the narrow-request case — review still runs so the coach holds full context, the athlete's request is answered first, findings raised only where they bear on it
- [x] 7.4 Add the silence rule — nothing meeting the threshold produces a single line, never a table
- [x] 7.5 Add `compare_planned_vs_actual` and `compare_intensity_distribution` to the scope table, and add the review's findings to the logging checkpoint as patterns and threads rather than verdicts
- [x] 7.6 Cross-reference `execution-review.md` from `SKILL.md` the way `coaching-log-format.md` is referenced, read at review time rather than at session start

## 8. Documentation

- [x] 8.1 Add the domain vocabulary to `CONTEXT.md`: **Intensity distribution**, **Middle-band dose**, **Review window / watermark**, **Work step vs support step**, each with its `_Avoid_` line, plus the invariants relating the two lenses and the rule that the prescription is the contract both lenses judge against
- [x] 8.2 Add `compare_intensity_distribution` to the `README.md` tool table
- [x] 8.3 Run the full suite and confirm no fixture or count drift

## 9. Validation against real data

- [x] 9.1 Run the band lens across the probed fortnight (2026-07-21 → 2026-08-03) and confirm the middle-band figures are coherent against the per-session step-lens findings, and that the computed distribution for the 07-29 session is defensible against the platform's own `SS 2160 s` planned / `1727 s` delivered reading
      → **Coherent.** Window middle band 17294 / 15305 = 0.88. Key sessions 0.94 / 0.94 / 0.97 / 1.16 match their step-lens readings (all work steps on-target bar one). The sessions reading low on the band lens (08-02 at 0.52, 07-23 at 0.57, 07-30 at 0.37) are the endurance prescriptions, and the step lens independently shows the same thing — 08-02's 7800 s block delivered 191 W against a 200–250 W prescription.
      → **07-29 defensible.** Both readings agree the prescription asked for **2160 s** — independent corroboration of the planned side computed from the steps. Delivered differs (2033 ours, 1727 platform) because 76–106% FTP (220–307 W) is a deliberately wider window than the platform's sweet-spot bucket (≈246–286 W): 266 s were ridden between 220 and 255 W, middle-band work by the philosophy's definition and not sweet spot by the platform's. Different windows measured correctly, not a discrepancy. This also uncovered §2.6's proportional-split defect — the first run of this task returned 0.64.
- [x] 9.2 Confirm the track session returns a usable distribution comparison where the step lens refuses
      → Step lens on `i171371339`: `alignmentBasis: none`, `reason: alignment-failed`, 0 steps. Band lens: full comparison, 4560 s planned / 3322 s delivered, per-zone breakdown including 42 s NMP of sprint work. Middle band reports 0 planned / 312 delivered with `deliveredFraction` **absent** — nothing was prescribed in the band, so the fraction is a division by zero rather than a perfect score, as specified.
- [x] 9.3 Dry-run the review procedure over that window and check the output against the silence rule and the recurrence threshold — specifically that the recurring rep-1 shortfall surfaces and the warm-up and cool-down artefacts do not
      → **Artefacts correctly silent.** Warm-ups, cool-downs, and recovery steps return `under` in nearly every session in the window (all three recoveries on 07-22, both on 07-27, two of three on 07-29, both on 08-02, plus every cool-down). All are support steps; `under` on a recovery inverts. None surface.
      → **The rep-1 shortfall does NOT recur, and correctly does not surface.** The task predicted a recurring pattern; the data does not support it. Rep 1 was on-target in every other session prescribing reps — 07-22 at 269 W in 255–273, 07-27 at 276 W against 275, 08-02 at 257 W in 255–273. The 07-29 shortfall (244 W against 255–275) is isolated, so the threshold correctly withholds it. The rule works; the task's example was written against an assumption the window disproves.
      → **What does pass the threshold:** endurance and long-ride prescriptions delivered at or below the bottom of their prescribed band, in the same structural position across three sessions (08-02 at 0.52, 07-23 at 0.57, 07-30 at 0.37 on the band lens; 08-02's step lens shows 191 W against 200–250 W). This is the philosophy's _polarisation by subtraction_ pattern — the middle emptying while hours accumulate — and it is what a coach should raise from this window. No Z2 ceiling violations (68% MAP = 282 W; all endurance well below).
