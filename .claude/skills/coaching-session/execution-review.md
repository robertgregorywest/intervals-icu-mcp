# execution-review

How to read `compare_planned_vs_actual` and `compare_intensity_distribution` **as a coach**. Read this when a review is actually running, not at session start. The window comes from the watermark — see [coaching-log-format.md](coaching-log-format.md).

The tools report deltas. Deltas are not findings. This file is the difference.

## Two lenses, two questions

| Lens                                        | Question it answers                       | Use it for                                                                                  |
| ------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Step** — `compare_planned_vs_actual`      | What happened _within_ the reps?          | Structured work executed off the head unit, where planned steps align to recorded intervals |
| **Band** — `compare_intensity_distribution` | How much of the prescribed _dose_ landed? | Everything — including track, auto-lapped rides, and abandoned sessions                     |

Run **both** where both apply. They disagree by design, and the disagreement is information: the 2026-07-29 session read as "rep 1 light, otherwise fine" on the step lens and "94% of the prescribed middle-band dose" on the band lens. Both were true. Don't reconcile them into one number — say which question each answered.

When they conflict on whether a session "counted", the band lens governs the _dose_ claim and the step lens governs the _execution_ claim.

## Reading a step verdict

**Only work steps carry the session's intent.** A verdict on a warm-up, a recovery step, or a cool-down is not a finding. The 07-29 session returns `under` on 5 of 8 steps; 4 are artefacts.

**Deriving the role.** No marker exists on the planned side, and the delivered `type` field is auto-detected and unreliable — a probed track session reports a `RECOVERY` interval averaging 384 W. So derive it from two signals _used together_:

- **Prescribed intensity** relative to the athlete's coaching zones (from `get_coaching_context`'s `mapZones`).
- **Structural position** — steps inside a `reps` block alternate work and recovery; the first and last top-level steps are warm-up and cool-down.

Step labels are a weak third signal: reliable across this athlete's own templates, not a rule. **Where the two signals disagree, state the role as uncertain** rather than classifying silently.

**`under` inverts on a recovery step.** A recovery step delivered below its prescribed power means recovery was taken at least as easily as prescribed. That is the session working, not a shortfall. Never report it as a miss.

**Range targets carry no tolerance.** The `tolerance` parameter applies to point targets only; a step prescribing 255–275 W is judged on its own band, so a delivery 2 W outside returns a directional verdict with no allowance. Small deltas on range targets are noise.

**Check `executionRecord` before quoting a single watt.** `device-laps` means the steps were read from the laps the head unit wrote — that is the ride, and rep-by-rep figures can be quoted as fact. `detected-intervals` means Intervals.icu's derived segmentation was used instead, which is free to move rep boundaries: it can merge a rep into its recovery, or clip the opening seconds off a rep and inflate its average. Where `executionRecordNote` is present the payload is telling you it has drifted from the recorded laps — read decay across reps as a hypothesis, say the boundaries are uncertain, and lean on the band lens for anything load-bearing.

**`alignmentBasis: none` is a refusal, not a failure.** The tool declined to guess a pairing. Report the session as _unverified on the step lens_ and fall back to the band lens. It is never evidence the athlete failed to complete the session.

**Platform compliance is context, not the verdict.** `rollup.platformCompliance` may be cited. It never substitutes for your own reading — improving on it is why this review exists.

## Reading the band lens

**The middle band is the figure that matters.** 76–106% FTP, the philosophy's primary judge of a build week. Report `middleBand.plannedSeconds` vs `deliveredSeconds` for the window **every time**, whether or not it met target.

**Zone rows are a narrower frame than the zone names suggest.** The bucketing partition is derived from the coaching bands' floors, so its L3 is 249–270 W where the coaching L3 is 249–291 W. Read `boundaries` before quoting a zone row. A session ridden slightly above a prescribed range's midpoint moves seconds into the _next_ partition band, which can make a per-zone delta look severe while the middle band shows the dose landed — on 07-29, L3 read −1437 s while the middle band read 94%. **Trust the middle band over a single zone row.**

**A wide prescribed range that was ridden low is a real finding, not an artefact.** Planned middle-band seconds are apportioned by how much of the prescribed range sits inside the band, so a `200–245 W` Z2 block contributes 56% of its time. If delivery still falls well short, the ride genuinely sat at the bottom of its range. Whether that matters depends on whether the prescription meant the middle of the band — ask rather than assume.

**Excluded sessions are not zeroes.** A range result lists sessions excluded from its sums with a reason. Strength sessions (`no-structured-steps`, no power) are expected and unremarkable. An unpaired _ride_ means the calendar and the delivered work drifted apart — worth a mention, not an alarm.

## How deep to read

Depth scales with how narrow the prescribed band is: the narrower the band, the more a delivery error changes which adaptation actually occurred.

| Prescribed work            | Depth                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **At or above MAP** (L6+)  | Rep by rep. **Decay across reps is the primary finding**, not a compliance detail                                            |
| **Sweet spot / threshold** | Rep level, for shortfall and decay. Small deltas _inside_ the prescribed band count as delivered                             |
| **Endurance / recovery**   | Not step-reviewed. Check only for **ceiling violations** (Z2 NP cap ≤ 68% MAP) and contribution to the window's distribution |
| **Track / no head unit**   | Band lens plus effort peaks. **Never report the absence of step alignment as a finding**                                     |

Select sessions for review from the **planned** side, sweet spot and above — so a prescribed key session that was abandoned or never started is selected rather than missed.

## What reaches the athlete

**Silence is the default.** A window with nothing meeting the threshold produces **one line** — "the window's key sessions landed as prescribed" — plus the middle-band figure. Never a table. Never a per-session list.

**The threshold is recurrence in the same structural position.** A rep-1 shortfall in two separate sessions is a pattern: report it, name the sessions that evidence it, and propose what would address it. The same shortfall once is not — don't raise it, but have it ready if the athlete asks about that session.

**Report the dose gap before planning further work.** If the window's delivered middle-band dose falls materially short of what was prescribed, say so explicitly _before_ drafting the next block, name the likely cause from the step-level findings, and don't quietly plan on the assumption the last block landed.

**Frame findings as what to change, never as compliance.** This is self-coaching: the coach and the athlete who blew rep 1 are the same tired person. An audit-shaped opening reads as being marked.

## Worked example — 2026-07-29, Sweet Spot 3×12

**Raw output.** Step lens: `under` on 5 of 8 steps. Band lens: middle band 2160 s planned, 2033 s delivered (94%); L3 −1437 s.

**What's an artefact.**

- Warm-up `under` — a warm-up ridden easy. Support step.
- Cool-down `under` — likewise.
- Two recovery steps `under` — recovery taken easier than prescribed. Inverts; this is good.
- L3 −1437 s — the reps were ridden slightly above the 265 W midpoint, so their seconds landed in the partition's L4 (270–291 W) instead. The work happened; the frame moved it.

**What's real.** One work step: rep 1, 11 W under its prescribed band.

**What the coach says.** Nothing — on this session alone. One rep, 11 W, in a session that delivered 94% of its prescribed dose, is not a finding. It becomes one only if rep 1 comes in light again in the next session prescribing reps, at which point it is a pattern with two sessions evidencing it, and the conversation is about whether the first rep needs a longer or harder warm-up — not about compliance.
