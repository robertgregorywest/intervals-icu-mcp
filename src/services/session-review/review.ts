import { alignSteps } from "./align.js";
import type {
  ActivityInterval,
  AlignedStep,
  DeliveredInterval,
  FlatPlannedStep,
  PlannedVsActualResult,
  PowerTarget,
  SessionRollup,
  StepVerdict,
  UnplannedInterval,
} from "./types.js";

export const DEFAULT_TOLERANCE = 0.05;

/**
 * A step delivering less than this fraction of its prescribed time is reported
 * as `not-attempted` rather than judged on power: the average wattage of 20
 * seconds of a prescribed 5-minute effort says nothing useful.
 *
 * Deliberately separate from `tolerance`. Loosening how strictly power is
 * judged must not change what counts as an abandoned step.
 */
export const NOT_ATTEMPTED_DURATION_FRACTION = 0.5;

/** Reduce raw intervals to the fields the comparison reads. */
export function toDeliveredIntervals(
  intervals: ActivityInterval[]
): DeliveredInterval[] {
  return (intervals ?? [])
    .map((iv, index) => ({
      index,
      type: typeof iv.type === "string" ? iv.type : undefined,
      label: typeof iv.label === "string" ? iv.label : undefined,
      startTime: numberOrUndefined(iv.start_time),
      durationSeconds: numberOrUndefined(iv.elapsed_time) ?? 0,
      averageWatts: positiveOrUndefined(iv.average_watts),
      averageCadence: positiveOrUndefined(iv.average_cadence),
      averageHeartrate: positiveOrUndefined(iv.average_heartrate),
    }))
    .filter((iv) => iv.durationSeconds > 0);
}

function numberOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function positiveOrUndefined(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/**
 * Judge one paired step. Duration is checked before power, so an abandoned step
 * is never dressed up as a power miss.
 */
export function judgeStep(
  planned: FlatPlannedStep,
  delivered: DeliveredInterval,
  tolerance: number
): {
  verdict: StepVerdict;
  watts?: number;
  wattsFraction?: number;
  note?: string;
} {
  const prescribed = planned.durationSeconds;
  if (
    prescribed &&
    delivered.durationSeconds < prescribed * NOT_ATTEMPTED_DURATION_FRACTION
  ) {
    return { verdict: "not-attempted" };
  }

  if (planned.targetUnresolved) {
    return { verdict: "unmatched", note: planned.targetUnresolved };
  }
  if (!planned.target) {
    return { verdict: "unmatched", note: "planned step has no power target" };
  }
  if (delivered.averageWatts === undefined) {
    return {
      verdict: "unmatched",
      note: "no power recorded for this interval",
    };
  }

  const actual = delivered.averageWatts;
  const { verdict, delta, reference } = compareToTarget(
    planned.target,
    actual,
    tolerance
  );

  return {
    verdict,
    watts: delta,
    wattsFraction: reference ? round(delta / reference, 4) : undefined,
  };
}

/**
 * A band target is satisfied anywhere inside the band — a deliberately wide Z2
 * range is not a near-miss against its own midpoint. Outside the band, the
 * delta is measured from the edge that was crossed.
 *
 * `tolerance` governs point targets only. A band already states the spread the
 * coach will accept, and widening it by a further 5% would dilute the athlete's
 * own intent: a 244 W rep against a prescribed 255-275 W block is a real
 * under-delivery, and reporting it on-target hides the rep-to-rep decay this
 * comparison exists to surface.
 */
function compareToTarget(
  target: PowerTarget,
  actual: number,
  tolerance: number
): { verdict: StepVerdict; delta: number; reference?: number } {
  if (target.low !== undefined && target.high !== undefined) {
    // A ramp's ends are not an acceptable range: riding the whole step at the
    // bottom of a 130->220 W ramp is "in range" but is not what was asked for.
    // Judge it against the midpoint, which is the average the ramp prescribes.
    if (target.ramp) {
      return comparePoint((target.low + target.high) / 2, actual, tolerance);
    }
    if (actual >= target.low && actual <= target.high) {
      return { verdict: "on-target", delta: 0, reference: target.high };
    }
    if (actual > target.high) {
      return {
        verdict: "over",
        delta: actual - target.high,
        reference: target.high,
      };
    }
    return {
      verdict: "under",
      delta: actual - target.low,
      reference: target.low,
    };
  }

  return comparePoint(target.watts ?? 0, actual, tolerance);
}

function comparePoint(
  point: number,
  actual: number,
  tolerance: number
): { verdict: StepVerdict; delta: number; reference?: number } {
  const delta = Math.round(actual - point);
  if (point <= 0) return { verdict: "unmatched", delta };
  const fraction = (actual - point) / point;
  if (Math.abs(fraction) <= tolerance) {
    return { verdict: "on-target", delta, reference: point };
  }
  return {
    verdict: fraction > 0 ? "over" : "under",
    delta,
    reference: point,
  };
}

export interface ReviewInputs {
  planned: FlatPlannedStep[];
  intervals: DeliveredInterval[];
  tolerance: number;
  plannedLoad?: number;
  actualLoad?: number;
  plannedDurationSeconds?: number;
  actualDurationSeconds?: number;
  platformCompliance?: number;
}

/**
 * The pure core: align, judge, and roll up. Takes no client and performs no I/O
 * so it can be exercised directly against fixture pairs.
 */
export function reviewSession(
  inputs: ReviewInputs
): Pick<
  PlannedVsActualResult,
  | "alignmentBasis"
  | "matchedFraction"
  | "steps"
  | "rollup"
  | "reason"
  | "message"
> {
  const { planned, intervals, tolerance } = inputs;
  const alignment = alignSteps(planned, intervals);

  const byPlanned = new Map(
    alignment.pairs.map((p) => [p.plannedIndex, p.intervalIndex])
  );
  const intervalByIndex = new Map(intervals.map((iv) => [iv.index, iv]));

  const steps: AlignedStep[] = planned.map((step) => {
    const base: AlignedStep = {
      index: step.index,
      label: step.label,
      repIndex: step.repIndex,
      repCount: step.repCount,
      stepInRep: step.stepInRep,
      planned: {
        durationSeconds: step.durationSeconds,
        target: step.target,
        cadence: step.cadence,
      },
      verdict: "unmatched",
    };

    const intervalIndex = byPlanned.get(step.index);
    const delivered =
      intervalIndex === undefined
        ? undefined
        : intervalByIndex.get(intervalIndex);

    if (!delivered) {
      return {
        ...base,
        note: alignment.ambiguous.includes(step.index)
          ? "more than one recorded interval fits this step equally well"
          : "no recorded interval could be matched to this step",
      };
    }

    const judged = judgeStep(step, delivered, tolerance);

    return {
      ...base,
      delivered: {
        intervalIndex: delivered.index,
        durationSeconds: delivered.durationSeconds,
        averageWatts: delivered.averageWatts,
        averageCadence: delivered.averageCadence,
        averageHeartrate: delivered.averageHeartrate,
      },
      deltas: {
        durationSeconds:
          step.durationSeconds === undefined
            ? undefined
            : delivered.durationSeconds - step.durationSeconds,
        watts: judged.watts,
        wattsFraction: judged.wattsFraction,
      },
      verdict: judged.verdict,
      note: judged.note,
    };
  });

  const matchedIntervals = new Set(alignment.pairs.map((p) => p.intervalIndex));
  const unplannedIntervals: UnplannedInterval[] = intervals
    .filter((iv) => !matchedIntervals.has(iv.index))
    .map((iv) => ({
      intervalIndex: iv.index,
      type: iv.type,
      durationSeconds: iv.durationSeconds,
      averageWatts: iv.averageWatts,
    }));

  const rollup: SessionRollup = {
    plannedLoad: inputs.plannedLoad,
    actualLoad: inputs.actualLoad,
    plannedDurationSeconds: inputs.plannedDurationSeconds,
    actualDurationSeconds: inputs.actualDurationSeconds,
    platformCompliance: inputs.platformCompliance,
    unplannedIntervals,
  };

  // On `none` the step list is empty rather than a wall of `unmatched` rows:
  // the roll-up still answers the coarse question, and the reason says why the
  // fine one could not be answered.
  if (alignment.basis === "none") {
    return {
      alignmentBasis: "none",
      matchedFraction: alignment.matchedFraction,
      steps: [],
      rollup,
      reason: "alignment-failed",
      message:
        `Could not align ${planned.length} planned step(s) to ` +
        `${intervals.length} recorded interval(s) with confidence. ` +
        "Reporting no step-level comparison rather than a pairing that may be wrong.",
    };
  }

  return {
    alignmentBasis: alignment.basis,
    matchedFraction: alignment.matchedFraction,
    steps,
    rollup,
  };
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
