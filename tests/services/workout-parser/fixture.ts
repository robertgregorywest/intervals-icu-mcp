import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { PlannedDocStep, WorkoutDoc } from "../../../src/types.js";

export interface FixtureEntry {
  id: number;
  name: string;
  date: string;
  type: string;
  description: string;
  workout_doc: WorkoutDoc;
  normalized_power?: number;
  average_watts?: number;
  icu_training_load?: number;
  moving_time?: number;
  icu_intensity?: number;
  /**
   * The FTP the platform's own figures for this event were computed against,
   * recovered at harvest time from `icu_intensity`. Rounded to the nearest watt
   * — no event records the threshold it was resolved at.
   */
  ftpUsed?: number;
  loadBasis: "threshold-free" | "threshold-dependent" | "unpowered";
}

function read<T>(name: string): T {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../fixtures/workout-parser/${name}`, import.meta.url)
      ),
      "utf8"
    )
  ) as T;
}

export const EVENTS = read<{
  harvest: {
    athleteFtpAtHarvest: number;
    athletePowerZonesAtHarvest: number[];
  };
  entries: FixtureEntry[];
}>("events.json");

export const ZONE_TARGETS = read<{
  harvest: { ftp: number; powerZones: number[] };
  targets: Record<string, number>;
}>("zone-targets.json");

/** Expand repeat blocks the way `flattenPlannedSteps` does, for comparison. */
export function flattenDocSteps(
  steps: PlannedDocStep[] | undefined
): PlannedDocStep[] {
  return (steps ?? []).flatMap((s) =>
    Array.isArray(s.steps) && typeof s.reps === "number"
      ? Array.from({ length: s.reps }, () => flattenDocSteps(s.steps)).flat()
      : [s]
  );
}
