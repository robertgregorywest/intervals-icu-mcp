## Context

See `proposal.md` — Why. Two facts from probing live athlete data shape every decision below.

**The planned side carries no work/support marker.** `workout_doc.steps` gives `text`, `power`, `duration`, and `reps` nesting — nothing classifying a step as work or recovery. The delivered side has `type: WORK | RECOVERY`, but it is auto-detected and unreliable: the 2026-08-01 track session reports a `RECOVERY` interval averaging 384 W, and a `WORK` interval of 6451 s on a 3296 s session.

**A distribution comparison is worth making, and the platform's own figures show why.** `workout_doc.zoneTimes` and `icu_zone_times` both exist and nothing compares them. For the 2026-07-29 `Sweet Spot 3×12` they read: planned `SS 2160 s`, delivered `SS 1727 s` — 80% of the prescribed sweet-spot dose, with 322 s leaking into `Z3` that was never prescribed. The step lens called the same session "5 of 8 under", of which 5 were artefacts. Those figures motivated this lens; they are not what it ends up reading (see the contract decision below).

Cost was measured and accepted by the athlete: `get_events` over a fortnight is ~56 KB, `get_activities` ~85 KB, and each `compare_planned_vs_actual` is 0.8–3 KB. Selection costs several times more than the comparisons it selects for; the athlete wants full context regardless.

**Two further facts came from probing the streams endpoint, and both contradicted assumptions this design was first written against.** They are recorded in `tasks.md` §1.1–1.2 with the probed activities, and the decisions they forced are below under _A partition is derived from the MAP-zone ladder_ and _The delivered side is always measured_.

## Goals / Non-Goals

**Goals**

- One review producing one narrative, drawing on two lenses that fail in different places.
- Keep every coaching judgement in the skill layer and every data operation in the server layer.
- Make the philosophy's middle-band metric a number the coach reads, not an impression.

**Non-Goals**

- Changing `planned-vs-actual-comparison`. It is consumed as-is.
- Scoring or grading sessions. No compliance percentage of our own — the platform already has one, and it is the thing the review exists to improve on.
- Reviewing strength sessions. They carry no power and no intensity distribution.
- Automating the athlete-facing narrative. What surfaces is a coaching judgement made per session, governed by rules in the skill, not computed by a tool.

## Decisions

### The band lens is a tool, not skill-side arithmetic

Both inputs are already fetchable, so the coach _could_ difference them in-model. Rejected: it would mean holding two large payloads to produce a dozen numbers, the range-aggregation case is real work (summing across sessions, excluding unpaired ones), and arithmetic done in-model is neither testable nor reproducible. A service behind `IIntensityDistribution` with a registry entry follows the established pattern and both adapters pick it up for free.

_Alternative considered:_ extend `compare_planned_vs_actual` with a distribution section. Rejected — it would couple an alignment-free comparison to a tool that refuses when alignment fails, which is exactly the case the band lens exists to cover.

### The prescribed workout is the contract, so both distributions are computed

The athlete's stated principle: _if I execute a planned workout I have committed to completing it as planned — the planned workout is the contract I want to be held to._ Reading the platform's precomputed tables cannot honour that. `workout_doc.zoneTimes` is a snapshot taken when the workout was authored and `icu_zone_times` a snapshot taken at upload; neither is the contract, and being two independently-anchored snapshots they can disagree with each other for reasons that have nothing to do with what was ridden.

So the service computes both sides: the planned distribution from `workout_doc.steps`, and the delivered distribution from the recorded power stream, bucketed against one set of boundaries. Because the athlete's workouts are authored in **absolute watts** (the repo's standing rule), the prescription is anchor-free — a 720 s step at 255–275 W is that whether or not FTP has moved since. Threshold drift stops being a risk to tolerate and stops existing.

_Alternative considered:_ keep the platform snapshots and simply drop the drift check, since the athlete maintains planned workouts when FTP moves. Rejected — it makes correctness depend on that maintenance discipline holding indefinitely, and it leaves the planned side as an authoring-time rendering rather than the prescription itself.

Two consequences follow, one good and one a cost. The good one: because _we_ now choose the bucketing frame, it can be anchored on the athlete's **MAP zones** — the canonical coaching vocabulary — instead of the platform's FTP zones, which the previous design settled for only because both snapshots happened to use them. (What "anchored on" has to mean is the next decision.) The cost: the delivered side needs the power stream, one extra fetch per session. That fetch happens inside the service, so it costs HTTP time, not model context.

### A partition is derived from the MAP-zone ladder

The MAP zones cannot be bucketed into as they stand. `ZONE_DEFS` (`src/services/power-profile/compute.ts:29`) defines deliberately **overlapping** training bands, which is correct for the Ric Stern model they come from — a band answers "what is this ride for", and rides of different purposes legitimately share wattages. At MAP 415 W the bands run REC 0–166, L1 166–228, L2 208–270, L3 249–291, L4 270–311, L5 291–353, L6 332–457, L7 457–623, NMP 623–846, so every watt from 208 to 457 falls in two or more of them. Assigning a second to "its zone" is undefined, and per-zone seconds would sum to more than the session.

The frame is therefore a **partition derived from the ladder of `lowW` bounds**, which is strictly increasing (0, 166, 208, 249, 270, 291, 332, 457, 623): each watt is assigned to the highest zone whose `lowW` does not exceed it. That yields REC 0–166, L1 166–208, L2 208–249, L3 249–270, L4 270–291, L5 291–332, L6 332–457, L7 457–623, NMP 623+ — total, disjoint, and carrying the zone names the athlete already thinks in.

The cost is that a reported zone is _not_ its coaching band: the partition's L2 is 208–249 where the coaching L2 is 208–270. Read as "the lowest band this wattage qualifies for", which is what the ladder means, but it is a distinct frame and must not be presented as the coaching zones themselves. This is why §2.8 requires the boundaries to be reported on every comparison — the frame travels with the numbers rather than being assumed.

_Alternative considered:_ report per-band seconds against the true overlapping bands and accept that the columns over-sum. Rejected — it is faithful to the zone model but stops being a distribution, and the deltas would no longer be readable as "where the dose went".

_Alternative considered:_ bucket into the platform's FTP zones, which are a partition already. Rejected — it gives up the coaching vocabulary that motivated computing our own distribution in the first place, and the middle band already covers the FTP-anchored question.

### The delivered side is always measured

The delivered distribution was to have been marked _measured_ or _estimated_ according to whether a long ride's stream came back reduced in resolution. Probing shows that never happens at this layer: `samples` / `original_samples` / `downsampled` / `stride` are produced by `packStreams` in `src/tools/activities.ts`, a model-context budget applied in the **tool** layer, while `IActivitiesApi.getActivityStreams` — what the service calls — returns the full 1 Hz stream at any length. A 6.5 h ride returned all 23 160 samples.

So the distinction is dropped rather than specified into a branch nothing can reach. The delivered distribution is computed at full resolution, always, and the result says nothing about resolution because there is nothing to say.

_Alternative considered:_ retain the marker as a constant `measured`, against the API changing. Rejected — an untestable branch, and if the API does start striding, that is a change to the service's input contract that should be noticed rather than silently absorbed by a field that was already there.

_Alternative considered:_ repurpose the marker to report stream coverage, since the probed `time` streams do carry pause gaps. Rejected as scope — it is a real data-quality signal but a different requirement from the one written, and the seconds rule below already makes the treatment of pauses explicit.

### A sample is one second of recording time

Streams come back with a co-indexed `time` array in seconds-from-start, at 1 Hz but with gaps where the recording was paused: the probed track session spans 7169 s elapsed in 3322 samples, and the 6.5 h ride 27 842 s in 23 160. Sample count is therefore neither elapsed time nor moving time — it is recording time (`icu_recording_time`, 3371 and 23 314 on those two, within a percent of the sample counts).

Each sample counts as **one second**, and pauses simply do not exist in the distribution. Crediting a gap's duration to the wattage on either side of it would invent time at an intensity that was not ridden, which is the failure this whole comparison exists to prevent. The consequence to state plainly: delivered seconds sum to recording time, not to elapsed time, so a session with a long café stop shows a smaller total than its elapsed duration — correctly.

_Alternative considered:_ weight each sample by its `time` delta, capped, so short gaps are absorbed. Rejected — the cap would be an invented constant, and the error it corrects (a second or two per gap) is far below the resolution any coaching reading of a distribution has.

### The middle band is its own window, not a sum of zones

The philosophy states the load-bearing metric in %FTP (76–106%). Under the previous design that was approximated by summing `Z3`+`Z4`. Now that bucketing is ours, the band is computed from its own bounds directly, and reported alongside the MAP-zone breakdown rather than derived from it. The two answer different questions and neither is a roll-up of the other.

This also removes the `SS`-bucket hazard entirely: the platform's overlapping sweet-spot bucket was something the previous design had to remember never to sum into the middle band, and it no longer participates.

### Range targets are bucketed by their midpoint

The athlete does not use ramps — confirmed against a month of real data, where **no step carries `ramp: true`** and all 41 `{start, end}` targets are ranges. But bucketing a _range_ needs the same rule a ramp would, and ranges are used constantly: a 255–275 W band has to land somewhere when its ends fall in different zones.

The rule is the range's midpoint, chosen because `session-review` already judges a progression against its midpoint. Reusing the convention keeps the two lenses coherent — a step the step lens judges against 265 W is bucketed by the band lens at 265 W.

_Alternative considered:_ distribute the step's seconds proportionally across every zone the range spans. Rejected — it is more faithful to a ramp, but the athlete prescribes bands as _acceptable spreads_, not as progressions to be traversed, so spreading the seconds would invent a time-at-intensity pattern the prescription never asked for.

Midpoint bucketing is accurate in proportion to how narrow the prescribed ranges are, so it carries a standing assumption: that authored ranges stay tight. The athlete has flagged tightening the range-width guidance in `intervals-coach` as a **future change**, out of scope here. For _zone assignment_ the assumption is not load-bearing — a wide range degrades the precision of one step's zone, and the comparison records when a range spanned a boundary, so the imprecision is visible rather than silent. For the middle band it turned out to be load-bearing, which is the next decision.

### The middle band takes a range proportionally, not at its midpoint

Validating the range aggregate against the probed fortnight showed midpoint bucketing wrecking the one figure the review reports every window. The athlete's endurance prescriptions are wide bands straddling the middle band's floor — `3600s @ 200–245 W`, `7800s @ 200–250 W` — whose midpoints (222.5 W, 225 W) sit a couple of watts _inside_ a band starting at 220 W. Midpoint therefore credited the entire block to the prescribed middle-band dose, and the athlete, riding the lower half of a range they were entitled to ride, came out at 0.21 and 0.34 delivered on sessions executed as prescribed. Those artefacts then dominated the window figure, dragging a fortnight whose four real key sessions landed at 0.89–0.97 down to 0.64.

The middle band is asking a different question from zone assignment. Zone assignment asks _which band is this step in_, where an acceptable spread has to resolve to one answer and the midpoint is the same convention `session-review` judges against. The middle band asks _how much of this step is inside that window_, and a spread answers that on its own terms: if every wattage in 200–245 W is acceptable, then 56% of what was accepted is in the band, and 56% of the seconds is what was prescribed there.

So the roll-up takes the overlap fraction of the prescribed range with the band's bounds; a point target is in or out. Zone assignment is untouched. The delivered side needs no equivalent — it is measured per sample and each sample is in the band or not.

_Alternative considered:_ count a step toward the band only when its whole range lies inside. Rejected — it reports Z2 prescriptions as prescribing zero middle-band time, discarding the real signal that a ride sat at the bottom of its range.

_Alternative considered:_ leave the arithmetic alone and have the interpretation rules discount straddling steps. Rejected for the reason this lens is a tool at all: arithmetic done in prose is neither testable nor reproducible.

### Work versus support steps is derived, and derived in the skill

No marker exists, so the classification is inference; inference about coaching intent belongs in the coaching layer, not encoded into a tool's output where it would look authoritative. The skill derives it from two signals used together: prescribed intensity relative to the athlete's coaching zones, and structural position (steps inside a `reps` block alternate work and recovery; the first and last top-level steps are warm-up and cool-down). Step labels are a weak third signal — reliable across this athlete's own templates, but not something to encode as a rule.

_Alternative considered:_ trust the delivered `type` field. Rejected on the 384 W `RECOVERY` evidence above.

### Watermark clamps: skip below one day, cap at 28

The floor prevents a second conversation on the same day from re-reviewing; the watermark only advances on a confirmed log write, so an unconfirmed session leaves the window intact for next time. The ceiling is 28 days, matching the 3–4 week block cadence in the philosophy — a longer absence gets the most recent 28 days with an explicit statement that earlier work was not reviewed. With no watermark at all, the window is the current block from `season.md`, bounded by the same ceiling.

### Interpretation rules live in a new subfile, philosophy untouched for now

`coaching-session/SKILL.md` gains the trigger, the window mechanism, and a pointer; the interpretation rules go in a new `execution-review.md` alongside `coaching-log-format.md`, matching the existing progressive-disclosure pattern — the rules are only needed once a review is actually running. `coaching-log-format.md` gains the watermark line and its maintenance step. Whether "progression only counts if it's delivered" should be restated in `coaching-philosophy` as a delivery-side rule is left open below.

## Risks / Trade-offs

- ~~Planned zone times are computed at authoring time against the then-current FTP.~~ **Resolved, not mitigated.** Computing both distributions in one frame from a prescription expressed in absolute watts removes the failure mode rather than tolerating it. Retained here because the earlier design's drift tolerance was specified and then withdrawn.
- ~~Long rides come back stride-downsampled, so their delivered distribution is estimated rather than measured.~~ **Withdrawn — the premise was false.** Striding is a tool-layer context budget the service never sees; see _The delivered side is always measured_. Retained here because the resolution marker was specified before being probed.
- **A reported zone is not its coaching band.** The derived partition's L2 is 208–249 W where the coaching L2 is 208–270 W, so a reader who takes the label at face value will mis-read the frame. → Every comparison reports the boundaries it used, and the partition is named as derived rather than presented as the coaching zones.
- **Delivered seconds sum to recording time, not elapsed time.** A session with a long stop reports fewer total seconds than its elapsed duration. → Correct behaviour, but it will look like a shortfall to anyone comparing against elapsed; the skill states which total the distribution sums to.
- **Range midpoint bucketing is lossy at a boundary.** A step prescribed 255–275 W whose midpoint sits just one side of a zone edge puts all its seconds on that side. → The comparison records that the range spanned a boundary, so a reader can see where the assignment was a close call rather than clear-cut. The middle band, where this proved to distort the headline figure rather than one step's precision, takes the range proportionally instead.
- **A wide prescribed range still reads as a shortfall when ridden at its bottom.** Proportional splitting fixes the fabricated collapse but a Z2 block prescribed 200–245 W and ridden at 205 W genuinely reports well under its proportional share. → That is a true reading, not an artefact, but it is only actionable if the prescription meant the middle of its range. The standing fix is tightening authored range widths, already flagged as a future change.
- **Opening every conversation with an audit reads as being marked** — particularly in self-coaching, where the coach and the athlete who blew rep 1 are the same tired person. → Silence is the default output: nothing meeting the threshold produces one line, not a table. Findings are framed as what to change, never as compliance.
- **Pattern claims from small samples.** Two sessions with a rep-1 shortfall is not yet a pattern. → The threshold requires recurrence in the same structural position, and reports the evidencing sessions so the athlete can judge the claim.
- **Derived work/support classification will sometimes be wrong** on unusual session shapes (over-unders, sessions with no distinct warm-up). → Both signals must agree; where they disagree, the step is reported with its role stated as uncertain rather than silently classified.
- **Two lenses can disagree** — the same session read as "rep 1 light, otherwise fine" and "80% of prescribed dose". Both were true of the 07-29 session. → This is a feature, not a conflict to resolve: the step lens says _what happened within reps_, the band lens says _how much of the prescribed dose landed_. The skill states which question each answers rather than reconciling them into one number.
- **Review lengthens every session start.** → Accepted explicitly by the athlete, who wants full context even for a narrow request.

## Migration Plan

Additive throughout. The new tool is read-only and new; no existing tool, service, or spec changes. The watermark line is absent from existing coaching logs and its absence is a specified case, so the first review after this ships falls back to the current block and then establishes the watermark on its first confirmed write. Rollback is removing the registry entry and reverting the skill files.

## Open Questions

- **Does the philosophy gain a delivery-side rule?** "Progression only counts if it's delivered" currently governs only projected load at planning time. Restating it to cover delivered dose would be a `coaching-philosophy` edit — a commit against the shared, tracked layer — and is a separate decision from wiring the review. Deferrable: the review reports the middle-band gap either way; the philosophy edit only changes whether the rule is stated in the base layer or lives as procedure in the skill.
- **Should the range comparison also surface the polarisation index?** `polarization_index` is present on activities and speaks directly to the polarisation-by-subtraction failure mode. Deferrable — it is an additional reported field on a shape the specs already fix, not a change to the approach.
