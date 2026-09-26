import type { DiscardedLine, ParseBasis } from "../workout-parser/index.js";
import type { StepRole } from "./roles.js";

/** A prescribed cadence band, e.g. `85-95rpm`. Both ends inclusive. */
export interface CadenceRange {
  low: number;
  high: number;
}

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
  /** Point cadence target, rpm. */
  cadence?: number;
  /** Band cadence target, when the step prescribes a range. */
  cadenceRange?: CadenceRange;
  /** 1-based repetition number, when this step came from a repeat block. */
  repIndex?: number;
  /** Total repetitions in that block. */
  repCount?: number;
  /** 1-based position within one repetition. */
  stepInRep?: number;
  /** Set when the target could not be normalised (e.g. percent with no FTP). */
  targetUnresolved?: string;
}

/**
 * A **Planned step** as the Prescription module hands it out: flattened, its
 * target resolved to watts, its **Work step** role read from its label, and the
 * one midpoint every lens takes a band at.
 */
export interface PlannedStep extends FlatPlannedStep {
  role: StepRole;
  /**
   * A point target's watts, or a band's midpoint — unrounded, since a half watt
   * is what the load arithmetic reproduces the platform with. Absent when the
   * target is unresolved or there is none.
   */
  midpointWatts?: number;
}

/**
 * The **Parse basis** of a prescription: the platform's own parse of a written
 * event, or a local parse of text that may never have been written.
 */
export type PrescriptionBasis = { source: "platform" } | ParseBasis;

/** What a prescription reads as, once, for every lens that consumes it. */
export interface Prescription {
  steps: PlannedStep[];
  basis: PrescriptionBasis;
  /** Step lines a local parse dropped, with the reason. Empty for a platform doc. */
  discarded: DiscardedLine[];
}

/** Step count and prescribed time of workout text, repeats expanded. */
export interface PrescriptionShape {
  stepCount: number;
  /** Prescribed seconds across the counted steps. */
  totalSeconds: number;
  /** True when any step is prescribed by distance rather than time. */
  hasDistance: boolean;
}
