import type { PlannedDocStep, PlannedPower, WorkoutDoc } from "../../types.js";
import type { FlatPlannedStep, PowerTarget } from "./types.js";

export interface FlattenContext {
  /** FTP to resolve percent-unit targets against; event FTP then activity FTP. */
  ftp?: number | null;
}

/**
 * Expand `workout_doc.steps` into the flat list of prescribed steps that the
 * comparison works on. Repeat blocks become one entry per repetition per step,
 * so a 3×(12min/4min) block yields six entries carrying rep 1..3.
 *
 * Recurses rather than assuming one level of nesting: probed data only ever
 * nests once, but a deeper block should produce more flattened steps rather
 * than silently dropping the inner ones.
 */
export function flattenPlannedSteps(
  doc: WorkoutDoc | undefined,
  ctx: FlattenContext = {}
): FlatPlannedStep[] {
  const out: FlatPlannedStep[] = [];
  const steps = doc?.steps;
  if (!Array.isArray(steps)) return out;

  steps.forEach((step, sourceIndex) => {
    emit(step, sourceIndex, out, ctx, undefined, undefined);
  });

  return out.map((s, i) => ({ ...s, index: i }));
}

function emit(
  step: PlannedDocStep,
  sourceIndex: number,
  out: FlatPlannedStep[],
  ctx: FlattenContext,
  rep: { index: number; count: number } | undefined,
  stepInRep: number | undefined
): void {
  const reps = step.reps;
  const inner = step.steps;

  if (typeof reps === "number" && reps > 0 && Array.isArray(inner)) {
    for (let r = 1; r <= reps; r++) {
      // On nested blocks the inner repetition wins: it is the one whose
      // rep-to-rep decay a coach reads.
      inner.forEach((child, childIndex) =>
        emit(
          child,
          sourceIndex,
          out,
          ctx,
          { index: r, count: reps },
          childIndex + 1
        )
      );
    }
    return;
  }

  const { target, unresolved } = normalisePowerTarget(
    step.power,
    ctx.ftp,
    step.ramp === true
  );

  out.push({
    index: out.length,
    sourceIndex,
    label: step.text?.trim() || undefined,
    durationSeconds:
      typeof step.duration === "number" ? step.duration : undefined,
    target,
    cadence: step.cadence?.value,
    repIndex: rep?.index,
    repCount: rep?.count,
    stepInRep,
    targetUnresolved: unresolved,
  });
}

/**
 * Normalise a planned power target to watts.
 *
 * A band (`start`/`end`) stays a band: a deliberately wide Z2 target must not be
 * scored as a near-miss against its own midpoint. Percent units are resolved
 * against FTP; with no FTP available the target is left unresolved and named,
 * rather than guessing a denominator.
 *
 * `ramp` marks the band as the ends of a progression rather than an acceptable
 * range — Intervals.icu distinguishes the two on the step, and they are judged
 * differently.
 */
export function normalisePowerTarget(
  power: PlannedPower | undefined,
  ftp: number | null | undefined,
  ramp = false
): { target?: PowerTarget; unresolved?: string } {
  if (!power) return {};

  const units = (power.units ?? "w").toLowerCase();
  const isWatts = units === "w" || units === "watts";
  const isPercent = units.includes("%") || units.startsWith("percent");

  let scale = 1;
  if (!isWatts) {
    if (!isPercent) {
      return { unresolved: `unsupported power units "${power.units}"` };
    }
    if (!ftp || ftp <= 0) {
      return {
        unresolved: "percent-of-FTP target but no FTP on the event or activity",
      };
    }
    scale = ftp / 100;
  }

  const conv = (n: number) => Math.round(n * scale);

  if (typeof power.start === "number" && typeof power.end === "number") {
    const low = Math.min(power.start, power.end);
    const high = Math.max(power.start, power.end);
    // A degenerate band is a point target; treating it as a band would make
    // every delivered value inside it score a zero delta.
    if (low === high) return { target: { watts: conv(low) } };
    return {
      target: { low: conv(low), high: conv(high), ...(ramp ? { ramp } : {}) },
    };
  }

  if (typeof power.value === "number") {
    return { target: { watts: conv(power.value) } };
  }

  return {};
}

/** Total prescribed time across the flattened steps. */
export function plannedDuration(steps: FlatPlannedStep[]): number {
  return steps.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
}
