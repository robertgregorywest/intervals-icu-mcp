# Power conversion at the API boundary

Reason about intensity in %MAP or %FTP per the coaching context. **Emit absolute watts** when calling any tool that writes to Intervals.icu (`create_workout`, `create_workout_library_item`).

## Why

- Intervals.icu's parser does **not** understand `%MAP`.
- `%FTP` is supported but couples the workout to whatever FTP is on file at execution time. Watts are stable; if FTP changes the workout still expresses the original intent.
- For library workouts, pair watts with a **rationale block** (see below) so `refresh_workout_library` can re-anchor when MAP/FTP changes.

## Conversion

Pull `ftp` and `map.watts` from `get_coaching_context`:

- **`map.watts`** is derived server-side; `map.computedFrom` shows which activity it came from.
- If `map` is null, `mapWarning` will say so. Ask the athlete for a current MAP estimate before prescribing %MAP-anchored work; do not invent a value.
- `ftp` is the static profile FTP. For zone-based prescriptions use **`mapZones`** from `get_coaching_context` — MAP-anchored watt bands (REC / L1–L7 / NMP) that match the coaching philosophy. Intervals.icu's native FTP/Coggan zones are intentionally **not** in the coaching context; they remain on `get_athlete` if ever needed.

**Pattern**: anchor × pct = watts, rounded to nearest 5 W.

| Intent         | Basis | Pct (typical) |
| -------------- | ----- | ------------- |
| Recovery       | FTP   | 40–55%        |
| Z2 / endurance | FTP   | 56–75%        |
| Sweet spot     | FTP   | 84–94%        |
| Threshold      | FTP   | 95–105%       |
| VO2 / MAP      | MAP   | 95–110%       |
| Anaerobic      | MAP   | 120–150%      |

(Use the athlete's actual zone definitions from `get_coaching_context` if they differ.)

## Worked examples

Athlete: FTP 285 W, MAP 380 W.

- "Z2, 75 min" → `220w` (75% × 285 ≈ 213, round to 220)
- "Sweet spot 3×12 at 90% FTP" → `255w` (90% × 285 = 256.5 → 255)
- "VO2 4×4 at 95–102% MAP" → `360w-390w` (95–102% × 380)
- "Threshold 2×20 at 98% FTP" → `280w`

## Range targets

When the user gives a range (e.g. "95–105% MAP"), emit a watts range: `360w-400w`. The Intervals.icu parser supports `<min>w-<max>w`.

**Head-unit granularity (canonical rule — referenced elsewhere).** A long/wide ramp step displays as a single average wattage on a Wahoo/Garmin head unit, losing the progression. Split any ramp or progression into short steps of **≤ 2 min** and **≤ ~8% MAP (~25–30 W)** range each, stepping upward (e.g. a 20-min ramp 40→110% becomes ten 2-min steps). A steady-state **target band** (e.g. Z2 `60-72%`) is a deliberate range the rider holds — keep it as one step, never `ramp`. The `expandRamp` helper (`src/services/workout-library/ramp.ts`) applies this rule to the seed library.

## Rationale block (saved workouts only)

When persisting via `create_workout_library_item`, attach a rationale block so the workout becomes refreshable:

```json
{
  "basis": "MAP",
  "anchorWatts": 380,
  "seedId": "vo2-4x4",
  "intensities": [
    { "stepRef": "On", "pct": [95, 102] },
    { "stepRef": "Off", "pct": [50] }
  ]
}
```

`refresh_workout_library` re-derives watts from `anchorWatts` × `pct` when MAP changes — text-munges the step lines only, leaves prose/labels/durations/cadence alone.

## Rounding

Round to nearest 5 W for ranges, nearest 5 or 10 W for point targets. Avoid spurious precision like `213w` — it implies a calibration the athlete doesn't have.
