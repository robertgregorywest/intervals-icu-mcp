# The MAP ramp ladder is fixed; only its length follows MAP

The MAP ramp test keeps a fixed start (140 W) and a fixed increment (+25 W/min), so any two tests
are the same protocol. What follows MAP is only **where the ladder stops**: it ends two rungs above
the first rung that exceeds current MAP, so the athlete cannot run out of steps and a retest after
a fitness gain simply runs further up the same ladder.

Expressed in the template as `- Ramp to failure 1m 140w +25w until MAP+2` (a **ladder** line,
`basis: MAP`, top-level only) and expanded at render time. At MAP 415 it renders exactly the
protocol from ADR 0005 (140 → 490 W).

## Comparability contract

- **Held invariant:** warm-up, start watts, step duration, increment, cooldown.
- **Varies:** the number of rungs. A shorter and a longer ladder are prefixes of one another, so a
  MAP read from either is the same measurement (highest 60 s power on the same rungs). Nothing
  needs re-normalising across a regeneration.
- The rendered workout lists every rung, so the ladder a given test was ridden against is recorded
  in the workout text on Intervals.icu.

## Considered options

- **Scale start and/or step to MAP** (the original idea in issue 10) — rejected: it changes the
  protocol itself and is exactly what ADR 0005 avoids. Fixed 25 W/min is also what keeps the ramp
  physiologically comparable.
- **Fixed ladder to a high ceiling** — rejected: unnecessary rungs when MAP is low, and it still
  fails if MAP outgrows the ceiling.

The headroom (two rungs) is the one tunable; it reproduces the shipped 490 W ceiling at MAP 415.
Supersedes the "never rescaled" wording in ADR 0005 only in that the ladder's top is generated.
