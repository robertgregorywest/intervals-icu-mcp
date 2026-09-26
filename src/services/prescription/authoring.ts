import type { ParseAnchors } from "../workout-parser/index.js";
import { readPrescription } from "./prescription.js";

/**
 * A step hard enough to be the session's intent whose label declares no work
 * role. The execution review will never judge it, which is the one way a real
 * miss goes unreported — so the workout's author hears about it at the write,
 * not three weeks later in a digest that is quietly missing a rep.
 */
export interface UnreviewableStep {
  index: number;
  label?: string;
  /** Prescribed watts — a point target, or the midpoint of a band. */
  watts: number;
}

/**
 * Steps prescribed at or above `floorWatts` whose label carries no work word.
 *
 * A warning, never a refusal: a ramp test's unlabelled steps and a warm-up's
 * build are both meant to go unjudged, and the author is the one who knows
 * which. Returns nothing at all when no FTP was available to set the floor.
 * Zone targets resolve only when `anchors` carries the power zones.
 */
export function unreviewableWorkSteps(
  description: string,
  floorWatts: number | undefined,
  anchors: ParseAnchors
): UnreviewableStep[] {
  if (!floorWatts) return [];

  return readPrescription(description, anchors).steps.flatMap((step) =>
    step.role === "unclassified" &&
    step.midpointWatts !== undefined &&
    step.midpointWatts >= floorWatts
      ? [{ index: step.index, label: step.label, watts: step.midpointWatts }]
      : []
  );
}
