# execution-review lenses

How to read `get_execution_digest` **as a coach**. Read this when a review is actually running, not at session start. The window comes from the watermark — see [coaching-log-format.md](coaching-log-format.md).

`get_execution_digest` runs both lenses over the window and hands back what survived a mechanical filter. It reports deltas. Deltas are not findings. This file is the difference.

## Two lenses, two questions

| Lens                                                        | Question it answers                       | Where it shows in the digest                                                                       |
| ----------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Step** — `compare_planned_vs_actual`, per key session     | What happened _within_ the reps?          | `sessions[].flagged`, `sessions[].cadence`, `alignmentBasis`                                       |
| **Band** — `compare_intensity_distribution` over the window | How much of the prescribed _dose_ landed? | `middleBand`, `zones`, `sessions[].middleBand*` — including track, auto-lapped and abandoned rides |

Both are already run. They disagree by design, and the disagreement is information — a session can read as "one rep light, otherwise fine" on the step lens and "94% of the prescribed middle-band dose" on the band lens, and both can be true at once (see the worked example below). Don't reconcile them into one number — say which question each answered.

When they conflict on whether a session "counted", the band lens governs the _dose_ claim and the step lens governs the _execution_ claim.

**Reach for the underlying tool only when the digest raises a question it cannot answer.** `compare_planned_vs_actual` on one event id gives every step of one session, labels included, where a flagged rep needs its context read.

## Reading a step verdict

**Only work steps carry the session's intent, and the digest only ever shows you those.** A step declares its role in the first word of its own label, against a closed vocabulary the composer writes to — so a warm-up, a recovery step and a cool-down never reach `flagged` at all, and the old rule about an `under` on a recovery step being the session working is now enforced in code rather than remembered here. Don't re-derive a role from intensity: that inference is what the vocabulary replaced (see `docs/adr/0010-work-steps-declared-in-the-label.md`).

**`unclassifiedSteps` is the coverage caveat, not a fault.** It counts the session's steps that declared no role — normally its warm-up, recoveries and cool-down, which is why the number is often the larger one. It matters in one case: where a session reports few or no `workSteps` and you expected reps, the prescription's labels fell outside the vocabulary and the step lens has silently skipped that work. Say the session is unverified on the step lens rather than reading its empty `flagged` as a clean session.

**Range targets carry no tolerance, and the digest has already dropped the noise.** A range-target step is judged on its own band, so a delivery a few watts outside it returns a directional verdict with no allowance; the digest drops those under 3% before you see them. A band step that reaches `flagged` missed by more than that.

**Check `executionRecord` before quoting a single watt.** `device-laps` means the steps were read from the laps the head unit wrote — that is the ride, and rep-by-rep figures can be quoted as fact. `detected-intervals` means Intervals.icu's derived segmentation was used instead, which is free to move rep boundaries: it can merge a rep into its recovery, or clip the opening seconds off a rep and inflate its average. Where `executionRecordNote` is present the payload is telling you it has drifted from the recorded laps — read decay across reps as a hypothesis, say the boundaries are uncertain, and lean on the band lens for anything load-bearing.

**Check `verdictBasis` before quoting a step's watts.** A long band step (over 5 minutes) is judged on normalized power, not average power — outdoor terrain and coasting depress the average in a way normalized power isn't. Where `verdictBasis` reads `normalized-power` and `delivered.coastingFraction` is non-trivial, trust that verdict and don't independently quote the average-watts delta as if it were the finding; the average is still reported alongside, but it's the figure the verdict is deliberately _not_ using. `normalized-power-fallback` means the step qualified for the NP reading but the stream didn't resolve it (no power stream on the activity, or the window fell outside it) — the verdict fell back to average power exactly as it would have before this distinction existed, so read it the same as `average-watts`.

**Read `cadence` on the session before `cadenceVerdict` on its steps.** `cadence: { judged, missed }` is the session's cadence prescription rolled up: `{ judged: 6, missed: 6 }` is one finding about the whole session, not six rep-level details.

**Read `cadenceVerdict` on every work step that carries one.** Where the prescription names a cadence (`390w-410w 100rpm`), the cadence is part of the rep, not decoration: it is what makes the rep race-specific. `verdict` judges power alone, so a rep ridden in band at 85 rpm against a prescribed 100 reads `on-target` there and `under` on `cadenceVerdict`. That rep did not meet its prescription — say so, quote `deltas.cadence`, and never describe the session as "on target" or frame it purely as power decay while a work step's cadence missed. A cadence miss on every work rep is one finding about the whole session, not a later-rep detail. As with power, a cadence verdict on a warm-up, recovery or cool-down step is not a finding.

**A test is not a miss.** The digest judges every work step against its prescribed target, and a maximal effort has no meaningful one: a 1-min max test flagged `over` by +105 W is the test working. The same goes for a priming opener ridden hard on purpose. The filter cannot know the difference — you can, from the session's intent. Say what the number means rather than reporting it as a delta.

**`alignmentBasis: none` is a refusal, not a failure.** The tool declined to guess a pairing. Report the session as _unverified on the step lens_ and fall back to the band lens. It is never evidence the athlete failed to complete the session.

**Platform compliance is context, not the verdict.** `platformCompliance` may be cited. It never substitutes for your own reading — improving on it is why this review exists.

## Reading the band lens

**The middle band is the figure that matters.** 76–106% FTP, the philosophy's primary judge of a build week. Report `middleBand.plannedSeconds` vs `deliveredSeconds` for the window **every time**, whether or not it met target.

**A skipped window is not a quiet one.** `status: "skipped"` means the window held no key session to review — report it as skipped, and leave the watermark where it is.

**Zone rows are a narrower frame than the zone names suggest.** The bucketing partition is derived from the coaching bands' floors, so a partition zone runs from its coaching band's floor to the next band's floor — narrower than the coaching band's own full span, which extends up to its own ceiling. Read `boundaries` before quoting a zone row. A session ridden slightly above a prescribed range's midpoint moves seconds into the _next_ partition band, which can make a per-zone delta look severe while the middle band shows the dose landed (see the worked example below). **Trust the middle band over a single zone row.**

**A wide prescribed range that was ridden low is a real finding, not an artefact.** Planned middle-band seconds are apportioned by how much of the prescribed range overlaps the band — a Z2 block whose range sits mostly below the band's floor still contributes the overlapping fraction of its time. If delivery still falls well short, the ride genuinely sat at the bottom of its range. Whether that matters depends on whether the prescription meant the middle of the band — ask rather than assume.

**Excluded sessions are not zeroes.** `excluded` lists the sessions left out of the dose sums, with a reason. Strength sessions (`no-structured-steps`, no power) are expected and unremarkable. An unpaired _ride_ means the calendar and the delivered work drifted apart — worth a mention, not an alarm.

## How deep to read

Depth scales with how narrow the prescribed band is: the narrower the band, the more a delivery error changes which adaptation actually occurred.

| Prescribed work            | Depth                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **At or above MAP** (L6+)  | Rep by rep. **Decay across reps is the primary finding**, not a compliance detail                                            |
| **Sweet spot / threshold** | Rep level, for shortfall and decay. Small deltas _inside_ the prescribed band count as delivered                             |
| **Endurance / recovery**   | Not step-reviewed. Check only for **ceiling violations** (Z2 NP cap ≤ 68% MAP) and contribution to the window's distribution |
| **Track / no head unit**   | Band lens plus effort peaks. **Never report the absence of step alignment as a finding**                                     |

## What reaches the athlete

**Silence is the default.** A window with nothing meeting the threshold produces **one line** — "the window's key sessions landed as prescribed" — plus the middle-band figure. Never a table. Never a per-session list.

**The threshold is recurrence in the same structural position.** A rep-1 shortfall in two separate sessions is a pattern: report it, name the sessions that evidence it, and propose what would address it. The same shortfall once is not — don't raise it, but have it ready if the athlete asks about that session. **Recurrence spans windows:** once in this window, in the structural position an open thread from the log already names, is the pattern recurring — report it as continuing that thread and say whether the thread's close condition is met.

**Report the dose gap before planning further work.** If the window's delivered middle-band dose falls materially short of what was prescribed, say so explicitly _before_ drafting the next block, name the likely cause from the step-level findings, and don't quietly plan on the assumption the last block landed.

**Frame findings as what to change, never as compliance.** This is self-coaching: the coach and the athlete who blew rep 1 are the same tired person. An audit-shaped opening reads as being marked.

## Worked example — Sweet Spot 3×12

**What the tools saw.** Step lens: `under` on 5 of 8 steps. Band lens: middle band 2160 s planned, 2033 s delivered (94%); L3 −1437 s.

**What the digest dropped, and why.**

- Warm-up `under` — a warm-up ridden easy. Declares no work role.
- Cool-down `under` — likewise.
- Two recovery steps `under` — recovery taken easier than prescribed. Declares no work role, so it can no longer be read as a shortfall.

**What still needs reading.** L3 −1437 s survives, because the digest does not touch the zone rows: the reps were ridden slightly above the prescribed range's midpoint, so their seconds landed in the partition's next zone up. The work happened; the frame moved it. Trust the middle band.

**What's real.** One flagged work step: rep 1, under its prescribed band.

**What the coach says.** Nothing — on this session alone. One light rep in a session that delivered 94% of its prescribed dose is not a finding. It becomes one only if rep 1 comes in light again in the next session prescribing reps, at which point it is a pattern with two sessions evidencing it, and the conversation is about whether the first rep needs a longer or harder warm-up — not about compliance.
