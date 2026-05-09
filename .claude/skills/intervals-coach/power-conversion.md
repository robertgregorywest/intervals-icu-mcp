# Power conversion at the API boundary

Reason about intensity in %MAP or %FTP per the coaching context. **Emit absolute watts** when calling any tool that writes to Intervals.icu (`create_workout`, `create_workout_library_item`).

## Why

- Intervals.icu's parser does **not** understand `%MAP`.
- `%FTP` is supported but couples the workout to whatever FTP is on file at execution time. Watts are stable; if FTP changes the workout still expresses the original intent.
- For library workouts, pair watts with a **rationale block** (see below) so `refresh_workout_library` can re-anchor when MAP/FTP changes.

## Conversion

Pull `ftp` and `map.watts` from `get_coaching_context`:

- **`map.watts`** is derived server-side from the athlete's most recent `MAP ramp test*` activity in the last 90 days (best 60-sec power). `map.computedFrom` shows which activity was used.
- If `map` is null, `mapWarning` will say so. Ask the athlete for a current MAP estimate before prescribing %MAP-anchored work; do not invent a value.
- `ftp` is the static profile FTP. The Intervals.icu zones in `athlete.power_zones` are FTP-anchored (Coggan), not MAP-anchored — use them only for FTP-anchored prescriptions; map %MAP intent against `map.watts` directly.

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
