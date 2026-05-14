# Session structure templates

Default skeletons for common cycling sessions. Adapt durations and intensities to the athlete's philosophy and current state. All targets shown as ranges in `%MAP` or `%FTP` — convert to watts before emitting (see [power-conversion.md](power-conversion.md)).

Each template assumes a 60–120 min session unless noted. Trim warm-up/cool-down for time-crunched sessions; do **not** trim the main set.

## Z2 / endurance

```
Warm-up:  10m  ramp 50–65% FTP @ 90rpm
Main:     45–120m  60–72% FTP @ 85–95rpm
Cool:     5m  50% FTP
```

Notes: NP cap per philosophy (commonly ≤ 68% FTP). Sustained — no pulses.

## Sweet spot

```
Warm-up:  10m  ramp 50–80% FTP
          1m   90% FTP @ 100rpm
          2m   60% FTP

Main:     3x  (12m  88–94% FTP @ 85–90rpm
              5m   55% FTP)

Cool:     5m  50% FTP
```

Notes: 3×12 → 3×15 → 4×12 progression over a block.

## Threshold

```
Warm-up:  10m  ramp 50–80% FTP
          2x  (1m  100% FTP
              1m   55% FTP)

Main:     2x  (20m  98–102% FTP @ 85–90rpm
              5m    55% FTP)

Cool:     5m  50% FTP
```

Notes: 2×20 is the canonical dose. Over-unders (2m @ 105% / 1m @ 95%) are a step up.

## VO2 / MAP

```
Warm-up:  10m  ramp 50–80% FTP
          3x  (30s  100% FTP @ 100rpm
              30s   55% FTP)

Main:     4x  (4m   95–102% MAP @ 95–100rpm
              4m    50% FTP)

Cool:     5m  50% FTP
```

Notes: 4×4 is the staple. 5×3 / 6×3 / 30/30s are alternates. **VO2 should not stack with heavy strength the day before** (philosophy permitting).

## 30/30 (microintervals)

```
Warm-up:  10m  ramp 50–80% FTP
          1m   90% FTP @ 100rpm
          2m   55% FTP

Main:     2x  (10x  (30s  108–115% MAP
                    30s   50% FTP)
              5m   55% FTP)

Cool:     5m  50% FTP
```

## Preloaded short intermittents (VO2 primer)

```
Warm-up:  10m  ramp 50–80% FTP
          1m   90% FTP @ 100rpm
          2m   55% FTP

Main:     3x  (2m   95–100% MAP @ 95rpm     ← preload (primer)
              30s   55% FTP                 ← short recovery
              12x  (30s  100–105% MAP @ 100rpm
                    15s   50% FTP)
              3m   55% FTP)                 ← series recovery

Cool:     5m  50% FTP
```

**Why** — Aerobic adaptation from HIT scales with _time spent at a high fraction of VO2max_ during work bouts (Odden et al. 2024). Short intermittents (15–40 s @ Z5, 1:1–3:2 work-rest) accumulate more time near VO2peak than long intervals because the short recoveries don't let VO2 fall. **But** short-format VO2 _kinetics_ are slow at series start — the first few reps sit well below 90% VO2peak before the system stabilises (Vaccari et al. 2020). Opening each series with one ~2 min long interval primes VO2 upward fast, and a short (~30 s) recovery preserves that elevated state, so the short reps that follow start _already_ near 90% VO2peak instead of climbing into it.

**When to choose this over 4×4 or 30/30** — Pick this when the athlete tolerates 30/30s well but you want more total time at high %VO2max per session, or when their last 30/30 block showed weak first-reps (HR/VO2 slow to rise). Don't use as the first VO2 session of a block — the format is dense and benefits from a base of plain 30/30s first. Avoid stacking with heavy strength the day before (philosophy permitting).

**Knobs**

- Preload: 1.5–3 min @ 95–100% MAP. Longer/harder → faster VO2 rise but more peripheral cost; keep cadence ≥ 90.
- Short on/off: 20/10, 30/15, 30/30, 40/20 are all in range. Lean shorter for fresher athletes, longer for diesels.
- Series count: 2–4. Three series at 12 reps ≈ 6 min preload + 9 min short work / session — a heavy stimulus; trim before adding.
- Anchor: %MAP. Don't use %FTP for the short reps — the kinetics argument is about VO2, not lactate threshold.

**Sources** — Odden et al. 2024 (HIT time-at-fraction-of-VO2max), Vaccari et al. 2020 (VO2 kinetics in short vs long intermittents). Slide deck cached at `docs/personal/instagram/DXUgF3DDAjv/` (Instagram @knowledgeiswatt). Seeded as `vo2-preloaded-shorts` (see `seed.ts`).

## Race-prep / race-pace

Driven by event demands — not a fixed template. Common building blocks:

- Pursuit / TT specific: 3×6m at race power (~MAP 95–98%) with full recovery.
- Crit / road race specific: race-pace tempo with hard efforts on top (5×30s @ 130% on a Z2 ride).

Pull race details from `season.md` (Project knowledge); shape the session around demands.

## Recovery

```
30–60m  45–55% FTP @ 90rpm
```

Notes: Discipline matters more than dose. NP cap strict.

## Strength (gym)

Use `create_strength_workout` — free-form description of exercises, sets, reps, load, RPE. Don't force into the watts-target format.

## Test sessions

- **MAP ramp**: ~10m warm-up, then 1-min step ramp from 100W (or 60% FTP) at +20W/min until failure. Library workout `Coach Templates / map-ramp-test` if seeded.
- **FTP**: Library workouts cover this — prefer reusing over composing.
