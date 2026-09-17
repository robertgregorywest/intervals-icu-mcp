import { createWorkoutParser } from "../workout-parser/index.js";
import { flattenPlannedSteps } from "../session-review/index.js";
import type { PowerTarget } from "../session-review/types.js";
import { isWorkLabel } from "./roles.js";

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
 */
export function unreviewableWorkSteps(
  description: string,
  floorWatts: number | undefined,
  ftp: number | null | undefined
): UnreviewableStep[] {
  if (!floorWatts) return [];

  const { doc } = createWorkoutParser().parse(description, {
    ftp: ftp ?? undefined,
  });

  return flattenPlannedSteps(doc, { ftp })
    .filter((step) => !isWorkLabel(step.label))
    .flatMap((step) => {
      const watts = midpoint(step.target);
      if (watts === undefined || watts < floorWatts) return [];
      return [{ index: step.index, label: step.label, watts }];
    });
}

function midpoint(target: PowerTarget | undefined): number | undefined {
  if (!target) return undefined;
  if (typeof target.watts === "number") return target.watts;
  if (typeof target.low === "number" && typeof target.high === "number") {
    return Math.round((target.low + target.high) / 2);
  }
  return undefined;
}
