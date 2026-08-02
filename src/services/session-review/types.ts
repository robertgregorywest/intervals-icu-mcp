import type { Activity, ActivityInterval } from "../activities/types.js";
import type { IntervalsEvent } from "../../types.js";

/**
 * How the planned steps were paired to the recorded intervals.
 *
 * - `sequential` — every planned step matched an interval in order, with no gaps
 *   on either side, and the durations corroborate that ordering.
 * - `duration`   — a partial pairing derived from durations and elapsed position;
 *   some steps and/or intervals are unmatched.
 * - `none`       — no pairing was made.
 */
export type AlignmentBasis = "sequential" | "duration" | "none";

/**
 * Why a comparison produced no step alignment. Machine-readable so callers can
 * distinguish "we could not align" from "there was nothing to align" — the tool
 * exists to stop silent gap-filling, so every empty result names its cause.
 */
export type ReviewReason =
  | "no-paired-event"
  | "no-paired-activity"
  | "no-structured-steps"
  | "no-intervals"
  | "alignment-failed";

export type StepVerdict =
  "on-target" | "over" | "under" | "not-attempted" | "unmatched";

/** A prescribed power target, normalised to watts. */
export interface PowerTarget {
  /** Point target, when the step prescribes a single wattage. */
  watts?: number;
  /** Band target, when the step prescribes a range. Both ends inclusive. */
  low?: number;
  high?: number;
  /**
   * True when `low`/`high` are the ends of a ramp rather than an acceptable
   * band. A ramp is judged against its midpoint: sitting at the bottom of a
   * 130→220 W ramp for the whole step is not on target, though it is "in range".
   */
  ramp?: boolean;
}

/**
 * One prescribed step after repeat blocks have been expanded — the unit of
 * comparison. A 3×(12min/4min) block yields six of these.
 */
export interface FlatPlannedStep {
  /** Position in the flattened list. */
  index: number;
  /** Index of the originating entry in `workout_doc.steps`. */
  sourceIndex: number;
  label?: string;
  durationSeconds?: number;
  target?: PowerTarget;
  cadence?: number;
  /** 1-based repetition number, when this step came from a repeat block. */
  repIndex?: number;
  /** Total repetitions in that block. */
  repCount?: number;
  /** 1-based position within one repetition. */
  stepInRep?: number;
  /** Set when the target could not be normalised (e.g. percent with no FTP). */
  targetUnresolved?: string;
}

/** A recorded interval reduced to the fields the comparison uses. */
export interface DeliveredInterval {
  index: number;
  type?: string;
  label?: string;
  startTime?: number;
  durationSeconds: number;
  averageWatts?: number;
  averageCadence?: number;
  averageHeartrate?: number;
}

/** One planned step next to what was delivered for it. */
export interface AlignedStep {
  index: number;
  label?: string;
  repIndex?: number;
  repCount?: number;
  stepInRep?: number;
  planned: {
    durationSeconds?: number;
    target?: PowerTarget;
    cadence?: number;
  };
  /** Absent when the step is `unmatched` — never zero-filled or estimated. */
  delivered?: {
    intervalIndex: number;
    durationSeconds: number;
    averageWatts?: number;
    averageCadence?: number;
    averageHeartrate?: number;
  };
  /** Absent when the step is `unmatched`. */
  deltas?: {
    /** Delivered minus prescribed, seconds. */
    durationSeconds?: number;
    /** Delivered minus prescribed, watts. Zero when inside a band target. */
    watts?: number;
    /** `watts` as a fraction of the prescribed target. */
    wattsFraction?: number;
  };
  verdict: StepVerdict;
  /** Why an `unmatched` step could not be compared. */
  note?: string;
}

/** Recorded work that paired to no planned step. */
export interface UnplannedInterval {
  intervalIndex: number;
  type?: string;
  durationSeconds: number;
  averageWatts?: number;
}

export interface SessionRollup {
  plannedLoad?: number;
  actualLoad?: number;
  plannedDurationSeconds?: number;
  actualDurationSeconds?: number;
  /** Intervals.icu's own compliance figure — not this tool's verdict. */
  platformCompliance?: number;
  unplannedIntervals: UnplannedInterval[];
}

export interface PlannedVsActualResult {
  activityId?: string;
  eventId?: number;
  activityName?: string;
  eventName?: string;
  date?: string;
  /** The tolerance actually applied, echoed back. */
  tolerance: number;
  alignmentBasis: AlignmentBasis;
  /** Fraction of planned steps that were matched, 0–1. */
  matchedFraction: number;
  steps: AlignedStep[];
  rollup: SessionRollup;
  /** Present whenever `steps` is empty or alignment degraded. */
  reason?: ReviewReason;
  /** Human-readable expansion of `reason`. */
  message?: string;
}

export interface ComparePlannedVsActualOptions {
  activityId?: string;
  eventId?: number;
  tolerance?: number;
}

export interface ISessionReview {
  comparePlannedVsActual(
    options: ComparePlannedVsActualOptions
  ): Promise<PlannedVsActualResult>;
}

/** The two halves of a comparison, once both have been resolved. */
export interface ResolvedPair {
  activity?: Activity;
  event?: IntervalsEvent;
  reason?: ReviewReason;
  message?: string;
}

export type { Activity, ActivityInterval };
