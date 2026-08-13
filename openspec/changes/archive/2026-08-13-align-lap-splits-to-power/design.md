## Context

See `proposal.md` — Why. Two things the issue left open were settled by probing the live API against the 2026-08-08 session (`i173732945`), and both shape this design.

**Streams are 1 Hz.** `GET /api/v1/activity/{id}/streams.json?types=time,watts,cadence,heartrate` returned 7884 samples for a 7883 s session with every time delta equal to 1. The 3-second stride recorded in `docs/personal/track-context.md` §8 does not apply here; `icu_median_time_delta` on the activity is 1. Sixteen samples per 250 m lap is enough for per-lap output, so nothing in this design needs the FIT record stream.

**The session is indoors.** `stream_types` for a track activity is `time, watts, cadence, heartrate, temp, left_right_balance, torque` — no distance, no velocity, no latlng. Distance-based alignment is not merely unwise here (§8's fictitious split), it is impossible. Cadence is the only channel that carries speed, which is what makes the documented manual method the only method.

**A prototype of the fit reproduced the manual result.** Four runs, rms 0.48–0.89 rpm on lap-mean cadence, development recovered independently by each run at 8.332–8.369 m per assumed 250 m lap (spread 0.45%). Run 1: 376 W over 114.26 s; run 2: 380 W over 113.42 s. Numbers quoted below come from that prototype.

## Goals / Non-Goals

**Goals:**

- Fold the §8 method into a Tool so it runs the same way every time.
- Make the alignment's precision measurable in the unit the caller reasons in — watts — not only in rpm.
- Keep the whole thing inside the existing shape: one service, one handler, one registry entry, one existing endpoint.

**Non-Goals:**

- Reading the original FIT file. The lap decoder in `src/services/activities/fit-laps.ts` stays scoped to laps; this session recorded `icu_lap_count: 1`, so device laps carry nothing here anyway.
- Deriving `ρ·CdA`. It becomes possible once this lands, and it is a separate change.
- Persisting alignments, or writing anything back to Intervals.icu.

## Decisions

### Fit lap-mean cadence, not sample-by-sample cadence

The objective is the residual between each lap's mean recorded cadence and the cadence its timed speed implies, over the run's laps.

Measured on the same four runs, sampling cadence every 0.25 s against a piecewise-constant speed model gave rms 1.5–2.0 rpm; lap-means gave 0.48–0.89 rpm. The difference is not noise in the data — cadence oscillates ±2.5 rpm within every lap as the rider works the bankings, and a per-lap-constant model cannot represent that, so the sub-second residual is dominated by structure the model deliberately ignores. Averaging over the lap removes it. This is also the objective the manual method used, so the Tool's rms is directly comparable to the 0.4–0.7 rpm recorded in §8.

Alternative considered: modelling the within-lap oscillation to sharpen phase. Rejected for now — it needs a track-geometry model the repo does not have, and the sensitivity analysis below shows the flat objective is already good enough for run-level answers.

### Development is fitted, not supplied

Predicted cadence is `60 · v_lap / development`, linear in `1/development`, so for any candidate offset the optimal figure has a closed form (`development = 60 · Σv² / Σvc`) and the search is one-dimensional over the offset alone.

This matters beyond convenience. The prototype recovered 8.33–8.37 m per assumed 250 m lap on 2026-08-08, which was ridden on 64×16 — **0.51% under** that gear's 8.396 m/rev. The 2026-07-12 session, on 65×16, fits 0.34% under its 8.526. Two gears, cleanly told apart, with the same small bias: most likely a lap ridden ~1 m longer than the 250 m assumed, and in any case the same size as the fit's own spread across runs. A supplied constant would have absorbed all of that silently. Agreement across independent runs then serves as a free consistency check: runs landing within 0.3–0.45% is strong evidence the alignment is right, and a run disagreeing with its siblings is evidence it is not.

What the fit returns is distance ÷ crank revolutions, which equals true development only when the rider covered exactly the assumed lap distance. The result names it in metres per revolution and never in gear inches, for the reason §1 gives.

### Search inside detected candidate windows, never globally

Candidate windows are maximal stretches where smoothed cadence stays high, long enough to contain the run. Each run is searched only within its window ±25 s, in a single sweep at 0.02 s. A coarse-then-refine pass was the first plan and was dropped: the range is only tens of seconds wide so the whole curve is cheap, having it in hand is what makes the offset interval and the next-best rival measurable rather than assumed, and on a curve this flat a coarse first pass can lock onto the wrong basin.

An unconstrained search over the whole activity was tried first and is exactly the failure mode the issue warns about: it returned rms ≈ 0.84 with a "development" of 10.25 m in a 133 W stretch of easy riding — a confident, plausible-looking, entirely fictitious answer. With a free scale parameter, any near-constant cadence fits any near-constant speed profile. Constraining the search to windows the athlete was actually riding hard in is what makes the fitted development meaningful.

Runs are assigned to windows one-to-one and in chronological order. Without that, runs 3 and 4 — same distance, lap times within 0.6 s — both matched the same window in the prototype.

### Report offset precision as watts, not just as rpm

The rms curve is flat near its minimum: moving the offset ±1 s changes rms by 1–3%, and the next distinct minimum 2 s away sits only 8–9% above the best. Reporting rms alone would overstate how precisely the run is placed.

So the Tool derives an offset interval — the offsets whose residual sits within a tolerance of the best — and re-evaluates every reading at that interval's edges, returning the resulting spread alongside each figure. On the prototype this gives run-level power good to ±0.3–6 W (three of four runs within 2.2 W), and per-lap power good to 1–13 W in the body of a run but 21–38 W on the final lap, where the offset uncertainty slides the window into the post-line power collapse. That last-lap fragility is real and currently invisible; surfacing it per lap is the point. A caller comparing two runs' power can then see whether the difference clears its own uncertainty band — which is precisely the question the issue could not answer.

Verdict thresholds: strong at rms ≤ 1.0 rpm, marginal to 2.0 rpm, weak above; ambiguous when a distinct offset more than 2 s away is within 15% of the best residual. These are set from the prototype and from §8's 0.4–0.7 rpm, and the response states them so a reader is not reverse-engineering them from a label.

A residual threshold alone turned out not to be enough. Perfectly flat cadence scores a _low_ residual at every offset, finds no rival outside its own interval, and would report itself strong while having placed nothing. So a fit whose offset interval covers half or more of the range searched is `weak` whatever its residual — the second line of defence behind the candidate windows.

### Guard on stream resolution before fitting

If the streams carry fewer than 8 samples per lap, per-lap output is withheld and the sampling interval is named. The floor is set from the documented failure rather than from taste: the 3-second stride §8 records gives 5.4 samples per 16 s lap, and that is the resolution that manufactured the "18.10 → 15.71" split. A quarter-of-a-lap rule was the first draft and would have let exactly that stride through. This is the §8 trap stated as a precondition rather than a warning: on a session that does return a 3-second stride, four or five samples per lap cannot support lap boundaries, and the Tool must say so rather than interpolate.

### Boundaries are apportioned, not snapped

Lap boundaries fall at arbitrary fractions of a second (16.26, 32.69, …). A sample straddling a boundary contributes to each adjacent lap in proportion. Snapping to the nearest sample would move a boundary by up to 0.5 s — the same order as the whole offset uncertainty — for no reason.

### Placement in the codebase

New service `src/services/track-lap-alignment/` behind `ITrackLapAlignment`, split as `types.ts`, `splits.ts` (parse and reconcile the export), `windows.ts` (candidate detection), `fit.ts` (offset search and confidence), `align.ts`, `index.ts` — the `workout-library/` shape, since this has the same "several distinct steps, one interface" character.

The Tool is named `compute_track_lap_power`. Registered once in `src/registry.ts`; both Adapters project it. The `compute_` prefix puts it in the existing read-only allowlist (see `CLAUDE.md` — CLI adapter), which is accurate: it reads one endpoint and writes nothing.

### Fixture strategy

Tests inject a fetch returning a stream fixture cut from the four windows of `i173732945` (roughly 550 s of the 7883 s session, decimated to the three streams the Tool reads), paired with the lap splits from the issue. The known answer — offsets, rms under 1 rpm, rollout within 0.5% across runs, run 1 at 376 W and run 2 at 380 W — is asserted directly, so the regression lock is on the real session rather than on synthetic cadence.

## Risks / Trade-offs

- **The objective is flat, so the offset is only good to ~±1 s.** → Do not hide it: the offset interval and the resulting per-figure spread are part of the response, and the verdict downgrades when the interval is wide.
- **The final lap of a run is the least trustworthy reading** (21–38 W of spread), because the finish-line power collapse sits just outside it. → It is reported with its band like every other lap, so a reader sees which lap is soft.
- **Candidate-window detection is heuristic** and could miss a run ridden below the cadence threshold, or merge two runs separated by a short soft-pedal. → A run that finds no window that can hold it is rejected by name rather than fitted to a wrong window; the one-to-one chronological assignment stops a missed window cascading into a wrong match for its neighbours.
- **On the calibrating session, one run of four is genuinely ambiguous.** Run 3's rival offset, 4.7 s away, fits within 9% of the best and returns a development equally consistent with the other runs, so nothing available breaks the tie. → It is reported `ambiguous` and its per-lap readings are withheld; its run-level power moves only 2.6 W between the two candidates (337.9 vs 335.3 W) while per-lap power moves up to 40 W, which is exactly why the line is drawn between run-level and per-lap rather than at the run.
- **A wheel speed stream would not improve this, and was measured rather than assumed.** Running the same objective on `velocity_smooth` (2026-07-12, the session whose sensor worked) gave a slightly higher normalised residual on all three runs and a wider offset interval on all three, with one run's best and next-best offsets tying exactly — the head unit has already smoothed out the per-lap structure the fit needs. Speed ÷ cadence also reads 0.6% over the known development, so it cannot settle the development question either. → Cadence stays the only channel read; a session with a dead speed sensor loses nothing.
- **Only one session exists to calibrate the thresholds against.** → They are published in the response rather than baked into a bare label, so a future session that contradicts them is visible as a mismatch between the number and the verdict rather than as a silent misclassification.
- **Cadence dropouts would corrupt a lap mean.** Heart rate in the probed session already shows implausible values (61 bpm mid-run). → Laps whose cadence samples are missing or non-positive are excluded from the fit, and a run losing too many is reported weak rather than fitted on what remains.
