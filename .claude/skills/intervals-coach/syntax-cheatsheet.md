# Workout-text syntax cheatsheet

The format Intervals.icu expects in event `description` and saved-workout `description` fields. The MCP server's `instructions` field carries the canonical version — this doc mirrors it for skill self-containment.

## Shape

```
- [label] [duration] [target] [cadence]      # simple step
- [label] [duration] ramp [target] [cadence] # ramp step
Nx                                            # repeat block (blank lines around)
- step
- step
```

Lines starting with `- ` are steps. `Nx` introduces a repeat block whose following `- ` lines belong to it (until a blank line). Free text outside step lines renders as workout notes.

## Tokens

- **Duration**: `5m`, `30s`, `1h2m30s`, `2km`, `500mtr` (`m` = minutes, `mtr` = meters)
- **Power**: `75%`, `95-105%`, `220w`, `160w-256w`, `Z2`
- **HR**: `70% HR`, `Z2 HR`, `95% LTHR`
- **Pace**: `60% Pace`, `Z2 Pace`, `5:00/km Pace`
- **Cadence**: `90rpm`

## Examples

### Sweet spot 3×12

```
- Warm-up 10m ramp 50-80% 90rpm
- 1m 90% 100rpm
- 2m 60%

3x
- 12m 250w-265w 88rpm
- 5m 160w

- Cool 5m 50%
```

### VO2 4×4

```
- Warm-up 10m ramp 50-80%
3x
- 30s 100% 100rpm
- 30s 55%

4x
- 4m 360w-390w 95rpm
- 4m 160w

- Cool 5m 50%
```

### Z2 endurance

```
- Warm-up 10m ramp 50-65% 90rpm
- 75m 65-72% 90rpm
- Cool 5m 50%
```

## Gotchas

- **Always emit absolute watts** — `220w`, `160w-256w` — when calling tools that write to Intervals.icu. `%MAP` is **not** parseable. `%FTP` works but is fragile (couples to current FTP).
- **Split long ramps for head units.** A long/wide `ramp` step (e.g. `15m ramp 197w-236w`) collapses to a **single average wattage** on a Wahoo/Garmin — the rider loses the progression. Emit ramps and progressions as a series of short steps: **≤ 2 min** and **≤ ~8% MAP (~25–30 W)** range each, stepping upward. A steady-state target band (e.g. Z2 `60-72%`) is intentional and stays one step — only ramps/progressions get split.
- **Blank lines around `Nx`** are load-bearing. Without them the parser loses the repeat boundary.
- **Free-text workout notes** can sit above or between step blocks. They render as the workout's prose.
- **Ranges** use `-` (hyphen): `220w-260w`, `95-102%`, `5:00/km Pace`. No spaces.
