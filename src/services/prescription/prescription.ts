import {
  createWorkoutParser,
  DISTANCE_STEP_DISCARDED,
  resolveZoneTargets,
  type ParseAnchors,
} from "../workout-parser/index.js";
import type { WorkoutDoc } from "../../types.js";
import { flattenPlannedSteps } from "./planned.js";
import { stepRole } from "./roles.js";
import type {
  PowerTarget,
  Prescription,
  PrescriptionBasis,
  PrescriptionShape,
} from "./types.js";

const parser = createWorkoutParser();

/**
 * Read a prescription into resolved **Planned steps** — the one pipeline every
 * planned-side lens runs, so they cannot disagree about what was prescribed.
 *
 * A `WorkoutDoc` is the platform's own parse of a written event and wins over
 * any local reading of the same text (ADR 0007); a string is workout text that
 * may never have been written, parsed locally. Either way, zone targets resolve
 * to watt bands, repeats expand, percentages resolve against FTP, each step's
 * **Work step** role is read from its label, and its midpoint is taken once.
 *
 * A target the anchors cannot resolve is named on the step, never defaulted.
 */
export function readPrescription(
  source: WorkoutDoc | string | undefined,
  anchors: ParseAnchors = {}
): Prescription {
  const read = readSource(source, anchors);
  const doc = read.doc ? resolveZoneTargets(read.doc, anchors) : undefined;

  const steps = flattenPlannedSteps(doc, { ftp: anchors.ftp }).map((step) => {
    const midpointWatts = targetMidpoint(step.target);
    return {
      ...step,
      role: stepRole(step.label),
      ...(midpointWatts !== undefined ? { midpointWatts } : {}),
    };
  });

  return { steps, basis: read.basis, discarded: read.discarded };
}

function readSource(
  source: WorkoutDoc | string | undefined,
  anchors: ParseAnchors
): Pick<Prescription, "basis" | "discarded"> & { doc?: WorkoutDoc } {
  if (typeof source === "string") {
    const parsed = parser.parse(source, anchors);
    return {
      doc: parsed.doc,
      basis: parsed.basis,
      discarded: parsed.discarded,
    };
  }
  const basis: PrescriptionBasis = { source: "platform" };
  return { doc: source, basis, discarded: [] };
}

/**
 * The single wattage a target is taken at: a point target's watts, a band's or
 * ramp's midpoint. Unrounded — the load arithmetic reproduces the platform's
 * figure only with the half watt kept. Undefined when there is no resolved
 * target.
 */
export function targetMidpoint(
  target: PowerTarget | undefined
): number | undefined {
  if (!target) return undefined;
  if (typeof target.watts === "number") return target.watts;
  if (typeof target.low === "number" && typeof target.high === "number") {
    return (target.low + target.high) / 2;
  }
  return undefined;
}

/**
 * How many steps workout text prescribes and for how long, repeats expanded —
 * read through the same parse the platform's is checked against, so a step the
 * platform would drop is not counted.
 *
 * A step prescribed by distance alone is the exception: the parse cannot time
 * it, but it is a real step (a run's `- 2km Z2`), so it counts and is flagged
 * rather than vanishing.
 */
export function prescriptionShape(text: string): PrescriptionShape {
  const { steps, discarded } = readPrescription(text);
  const distanceSteps = discarded
    .filter((d) => d.reason === DISTANCE_STEP_DISCARDED)
    .reduce((sum, d) => sum + (d.reps ?? 1), 0);

  return {
    stepCount: steps.length + distanceSteps,
    totalSeconds: steps.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0),
    hasDistance: distanceSteps > 0,
  };
}
