/**
 * Intervals.icu's FTP-anchored power zones, and the band a `Z` target in
 * workout text resolves to.
 *
 * The rule was measured against the live account rather than assumed: throwaway
 * events prescribing `- 60m Z1` … `- 60m Z7` were written, read back, and
 * deleted, and the platform's own `average_watts` for each is the resolved
 * target. At FTP 286 with zones `[55, 75, 90, 105, 120, 150, 999]` the platform
 * returned 141, 186, 236, 279, 322, 387, 1644 W. Those figures are committed as
 * `tests/fixtures/workout-parser/zone-targets.json`.
 *
 * Fitting them gives: each zone's ceiling is `floor(pct/100 × FTP)` and its
 * floor is the zone below's ceiling plus one watt. The target is the band's
 * midpoint, rounded half up. Note this is **not** the same as the equivalent
 * percentage band — `Z6` resolves to 387 W where `120-150%` resolves to 386,
 * because the zone path converts each bound to watts before averaging.
 */

/**
 * Zone 1 has no zone below it to take a floor from, and the platform does not
 * use zero: a `Z1` target came back at 141 W where the band `1–157 W` would put
 * it at 79 W. The measured floor sits at four fifths of the zone's ceiling.
 * Fitted to one athlete's account at one FTP — the committed zone fixture is
 * the tripwire if it is ever wrong at another.
 */
const ZONE_ONE_FLOOR_FRACTION = 0.8;

export interface ZoneBand {
  zone: number;
  lowW: number;
  highW: number;
}

/**
 * The watt band of one zone. `zones` are the upper bounds as percentages of
 * FTP, lowest first. Returns `undefined` for a zone the athlete has not defined.
 */
export function zoneBand(
  zone: number,
  ftp: number,
  zones: number[]
): ZoneBand | undefined {
  if (!Number.isInteger(zone) || zone < 1 || zone > zones.length) {
    return undefined;
  }
  if (!(ftp > 0)) return undefined;

  const highW = Math.floor((zones[zone - 1] / 100) * ftp);
  const lowW =
    zone === 1
      ? Math.floor(highW * ZONE_ONE_FLOOR_FRACTION)
      : Math.floor((zones[zone - 2] / 100) * ftp) + 1;

  return { zone, lowW, highW };
}
