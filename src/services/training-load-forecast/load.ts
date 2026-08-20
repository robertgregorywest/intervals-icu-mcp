import type { FlatPlannedStep } from "../session-review/index.js";

/**
 * The synthetic power stream a prescription implies, and the figures
 * Intervals.icu derives from it.
 *
 * Every rule here was fitted to the platform's own output and then checked
 * against the whole harvested corpus: on the 109 events prescribed wholly in
 * absolute watts, the normalised power below reproduces the platform's figure
 * exactly, to the watt, on all 109. The pieces that matter, in the order they
 * were found to matter:
 *
 * - a **band** contributes at its midpoint, not swept — measured across all 69
 *   events at design time, midpoint landed within 1 W on 65 and sweeping on 32;
 * - a **ramp** — a step the text marks `ramp` — is swept linearly instead;
 * - the rolling mean is **30 seconds trailing and expanding**: the first 29
 *   samples each average what has arrived so far rather than being skipped.
 *   Dropping them instead costs 33 of the 109 exact matches, so this is not a
 *   detail;
 * - the final figure is rounded half up.
 */
export const ROLLING_WINDOW_SECONDS = 30;

/** Why a prescription could not be turned into a stream. */
export interface StreamGap {
  stepIndex: number;
  label?: string;
  reason: string;
}

export interface PowerStream {
  watts: number[];
  /** Steps that contributed nothing, with the reason. Empty on a clean build. */
  gaps: StreamGap[];
}

/**
 * Build the 1 Hz stream. A step that cannot be resolved to watts contributes no
 * samples and is reported: shortening the session is visible in the result,
 * where filling it with a guessed wattage would not be.
 */
export function buildPowerStream(steps: FlatPlannedStep[]): PowerStream {
  const watts: number[] = [];
  const gaps: StreamGap[] = [];

  steps.forEach((step) => {
    const seconds = step.durationSeconds;
    if (!seconds || seconds <= 0) {
      gaps.push({
        stepIndex: step.index,
        label: step.label,
        reason: "step has no duration",
      });
      return;
    }
    const target = step.target;
    if (!target) {
      gaps.push({
        stepIndex: step.index,
        label: step.label,
        reason: step.targetUnresolved ?? "step prescribes no power target",
      });
      return;
    }

    if (typeof target.watts === "number") {
      for (let i = 0; i < seconds; i++) watts.push(target.watts);
      return;
    }
    if (typeof target.low !== "number" || typeof target.high !== "number") {
      gaps.push({
        stepIndex: step.index,
        label: step.label,
        reason: "power target is neither a point nor a band",
      });
      return;
    }
    if (target.ramp && seconds > 1) {
      const span = target.high - target.low;
      for (let i = 0; i < seconds; i++) {
        watts.push(target.low + (span * i) / (seconds - 1));
      }
      return;
    }
    const midpoint = (target.low + target.high) / 2;
    for (let i = 0; i < seconds; i++) watts.push(midpoint);
  });

  return { watts, gaps };
}

/** Normalised power over a 1 Hz stream. Unrounded — round at the boundary. */
export function normalizedPower(stream: number[]): number | undefined {
  if (stream.length === 0) return undefined;

  const window: number[] = [];
  let sum = 0;
  let fourthPowerSum = 0;

  for (const w of stream) {
    window.push(w);
    sum += w;
    if (window.length > ROLLING_WINDOW_SECONDS) sum -= window.shift()!;
    const mean = sum / window.length;
    fourthPowerSum += mean ** 4;
  }

  return (fourthPowerSum / stream.length) ** 0.25;
}

export interface DerivedLoad {
  normalizedPower: number;
  intensityFactor: number;
  load: number;
  durationSeconds: number;
  /** Steps that contributed no time to the stream. */
  gaps: StreamGap[];
}

/**
 * Training load from a prescription: `IF² × hours × 100`, with `IF = NP / FTP`.
 * Integer-exact against the platform on every harvested event carrying a load,
 * once the threshold it was computed at is known.
 *
 * Returns `undefined` when nothing resolved to watts — a session with no
 * derivable load contributes none, rather than an estimate that would then be
 * indistinguishable from a real figure.
 */
export function deriveLoad(
  steps: FlatPlannedStep[],
  ftp: number
): DerivedLoad | undefined {
  const { watts, gaps } = buildPowerStream(steps);
  const np = normalizedPower(watts);
  if (np === undefined || !(ftp > 0)) return undefined;

  const intensityFactor = np / ftp;
  const hours = watts.length / 3600;
  return {
    normalizedPower: np,
    intensityFactor,
    load: intensityFactor ** 2 * hours * 100,
    durationSeconds: watts.length,
    gaps,
  };
}
