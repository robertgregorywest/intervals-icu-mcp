import type { RationaleBasis } from "./types.js";
import type { SeedStep } from "./seed.js";

/**
 * A logical ramp: a single progression from `from`% to `to`% of `basis` over
 * `duration`. On head units a long/wide ramp step collapses to a single average
 * wattage, so `expandRamp` rewrites it as a series of short, narrow-range steps
 * that step upward through the effort — each step satisfies both granularity
 * caps (≤ `maxStepDurationSec` and ≤ `maxRangeWidthPct`).
 */
export interface RampSpec {
  from: number;
  to: number;
  duration: string; // workout-text duration, e.g. "20m"
  basis: RationaleBasis;
  label?: string;
  cadence?: string;
  maxStepDurationSec?: number;
  maxRangeWidthPct?: number;
}

export const DEFAULT_MAX_STEP_SEC = 120; // 2 minutes
export const DEFAULT_MAX_RANGE_PCT = 8; // ~25–30 W at typical MAP/FTP

const DURATION_RE = /(\d+)(h|m|s)(?![a-z])/gi;

function parseDurationSeconds(token: string): number | null {
  let seconds = 0;
  let matched = false;
  for (const m of token.matchAll(DURATION_RE)) {
    const value = Number(m[1]);
    matched = true;
    switch (m[2].toLowerCase()) {
      case "h":
        seconds += value * 3600;
        break;
      case "m":
        seconds += value * 60;
        break;
      case "s":
        seconds += value;
        break;
    }
  }
  return matched ? seconds : null;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  let out = "";
  if (h > 0) out += `${h}h`;
  if (m > 0) out += `${m}m`;
  if (s > 0) out += `${s}s`;
  return out || "0s";
}

// Round percentages to 1 decimal to keep the rationale JSON clean while
// preserving monotonicity and contiguity (rounding is order-preserving).
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Expand a logical ramp into short narrow-range `SeedStep`s.
 *
 * Step count = max(ceil(totalSec / maxStepDurationSec), ceil(span / maxRangeWidthPct)),
 * so both caps are always satisfied regardless of ramp shape. The duration is
 * split as evenly as possible (summing exactly to the original) and the
 * `[from, to]` span into N contiguous, monotonic sub-ranges. Emitted steps are
 * narrow-range (no `ramp` flag) — short range steps, not ramp steps.
 */
export function expandRamp(spec: RampSpec): SeedStep[] {
  const {
    from,
    to,
    duration,
    basis,
    label,
    cadence,
    maxStepDurationSec = DEFAULT_MAX_STEP_SEC,
    maxRangeWidthPct = DEFAULT_MAX_RANGE_PCT,
  } = spec;

  const totalSeconds = parseDurationSeconds(duration);
  if (totalSeconds === null || totalSeconds <= 0) {
    throw new Error(`expandRamp: unsupported duration "${duration}"`);
  }

  const span = Math.abs(to - from);
  const durationSteps = Math.ceil(totalSeconds / maxStepDurationSec);
  const rangeSteps = span === 0 ? 1 : Math.ceil(span / maxRangeWidthPct);
  const n = Math.max(durationSteps, rangeSteps, 1);

  // Distribute duration as evenly as possible; remainder seconds go to the
  // earliest steps so the summed durations equal the original exactly.
  const base = Math.floor(totalSeconds / n);
  let remainder = totalSeconds - base * n;

  const steps: SeedStep[] = [];
  for (let i = 0; i < n; i++) {
    const segSeconds = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    const lo = round1(from + ((to - from) * i) / n);
    const hi = round1(from + ((to - from) * (i + 1)) / n);
    steps.push({
      ...(label ? { label } : {}),
      duration: formatDuration(segSeconds),
      intensity: { basis, pct: [lo, hi] },
      ...(cadence ? { cadence } : {}),
    });
  }
  return steps;
}
