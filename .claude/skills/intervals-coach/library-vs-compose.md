# Library-first vs. compose-fresh

The athlete may have curated a library of saved workouts in Intervals.icu. **Always check `list_workout_library` before composing fresh.** A saved workout carries calibrated intent the athlete trusts; an ad-hoc workout may diverge silently.

## When to reuse

Reuse when **all** of these hold:

- A library workout matches the **intent** (session type, duration, intensity).
- The workout's calibration is current — either it's anchored on watts directly, or it has a rationale block and the anchor in the rationale matches the athlete's current MAP/FTP from `get_coaching_context`.
- The athlete hasn't asked for explicit variation ("not 4×4 again, do something different").

To reuse: pull the body via `get_workout_library_item`, then schedule with `create_workout` using the workout's description text.

## When to compose

Compose when:

- No library workout fits the intent (rare for canonical sessions, more common for race-prep / specific intervals).
- The athlete asks for a one-off variation ("longer warm-up", "extra interval", "drop the 30/30s").
- You're building something genuinely new — block opener, taper session, race simulation.

After composing, ask: **should this be saved to the library?**

- Yes → `create_workout_library_item` with a rationale block (`basis`, `anchorWatts`, `seedId`, `intensities`). Now `refresh_workout_library` can re-anchor it on test changes.
- No → `create_workout` only. Calendar event, no library entry.

## Don't

- **Don't compose silently** when a library workout fits — surprises the athlete and creates calibration drift.
- **Don't reuse blindly** when the rationale block's `anchorWatts` is far from current MAP/FTP without flagging it. Suggest a `refresh_workout_library` first.
- **Don't save every ad-hoc workout** to the library. Only save things the athlete will plausibly reuse.

## Edge cases

- **Library exists, but nothing matches**: tell the user what's in the relevant folder, ask if a near-match would do, then compose if not.
- **Library not seeded**: suggest `seed_workout_library` if the athlete wants a canonical starter set (FTP test, MAP ramp, VO2 4×4, threshold 2×20, etc.).
- **MAP/FTP just changed**: run `refresh_workout_library` (dry-run first) before composing — re-anchors the seeded workouts so future reuse is calibrated.
