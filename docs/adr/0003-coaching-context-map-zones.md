# Coaching context surfaces MAP zones, not FTP zones

The coaching philosophy anchors all intensity in MAP, but Intervals.icu stores only FTP-anchored (Coggan) power zones — and MAP itself is not a stored field. So `get_coaching_context` now derives MAP (from the latest `MAP ramp test` activity) and computes **MAP-anchored zones** from it (`mapZones`, via the Ric Stern / cyclecoach model already used by `compute_power_profile`), pulling the best-5s power from the Intervals.icu power-curve endpoint only to cap the NMP zone. The native FTP `power_zones` field was **removed** from the coaching snapshot rather than carried alongside, so the coaching skills never have to choose between two competing power-zone sets; the raw FTP/Coggan zones remain available on `get_athlete`.

## Considered options

- **Carry both zone sets** with documentation steering the agent to MAP zones — rejected: every prescription would risk picking the wrong anchor, and the steering caveat was the only existing "use" of `power_zones`.
- **A curated local markdown file** of athlete context refreshed from `compute_power_profile` — rejected: MAP and its zones are already derivable live from Intervals.icu, so a file would only add staleness and a maintenance burden the architecture deliberately avoids ("athlete state is always fresh, no files to maintain").

## Consequences

- `get_coaching_context` now makes one additional API call (the power curve) per invocation; it degrades gracefully to a MAP-only NMP band if that call fails.
- When no qualifying ramp test exists, `map` and `mapZones` are both `null` and `mapWarning` explains why — the coaching skills already handle this path.
