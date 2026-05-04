import type { IWorkoutLibraryApi } from "./api.js";
import type { IWorkoutBuilder } from "../workout-builder/index.js";
import type {
  LibraryNode,
  LibraryWorkoutSummary,
  RationaleBasis,
} from "./types.js";
import { isFolderNode } from "./types.js";
import {
  extractRationale,
  regenerateWattsInDescription,
  stripRationale,
} from "./parser.js";
import { type SeedAnchors } from "./seed.js";

export interface RefreshOptions extends SeedAnchors {
  dryRun?: boolean;
}

export interface RefreshAction {
  workoutId: number;
  name: string;
  folder: string;
  seedId?: string;
  basis: RationaleBasis;
  oldAnchorWatts: number;
  newAnchorWatts: number;
}

export interface RefreshSkip {
  workoutId: number;
  name: string;
  reason: string;
}

export interface RefreshReport {
  updated: RefreshAction[];
  skipped: RefreshSkip[];
  warnings: string[];
  dryRun: boolean;
}

const REPEAT_LINE_RE = /^\d+x\s*$/;

/**
 * Returns the human-readable prose preceding the first step or repeat header.
 * Steps and the rationale block are excluded. Whitespace is trimmed.
 */
export function extractProse(description: string): string {
  const stripped = stripRationale(description);
  const lines = stripped.split(/\r?\n/);
  let proseEnd = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("- ") || REPEAT_LINE_RE.test(line)) {
      proseEnd = i;
      break;
    }
  }
  return lines.slice(0, proseEnd).join("\n").trim();
}

export async function runRefresh(
  api: IWorkoutLibraryApi,
  // builder kept for symmetry with seed/create signatures and future use; not currently needed
  _builder: IWorkoutBuilder,
  opts: RefreshOptions = {}
): Promise<RefreshReport> {
  const { dryRun = false } = opts;
  const folders = await api.listFolders();

  const report: RefreshReport = {
    updated: [],
    skipped: [],
    warnings: [],
    dryRun,
  };

  function collect(
    nodes: LibraryNode[],
    folderName: string,
    out: Array<{ workout: LibraryWorkoutSummary; folderName: string }>
  ): void {
    for (const node of nodes) {
      if (isFolderNode(node)) {
        collect(node.children ?? [], node.name, out);
      } else {
        out.push({
          workout: node as LibraryWorkoutSummary,
          folderName,
        });
      }
    }
  }
  const all: Array<{
    workout: LibraryWorkoutSummary;
    folderName: string;
  }> = [];
  for (const f of folders) {
    if (isFolderNode(f)) collect(f.children ?? [], f.name, all);
  }

  for (const { workout, folderName } of all) {
    const description = workout.description ?? "";
    const rationale = extractRationale(description);
    if (!rationale) continue;

    if (!rationale.intensities || rationale.intensities.length === 0) {
      report.skipped.push({
        workoutId: workout.id,
        name: workout.name,
        reason:
          "rationale has no intensities array — cannot regenerate watts. " +
          "Re-author this workout via create_workout_library_item with intensities to make it refreshable.",
      });
      continue;
    }

    const newAnchor = rationale.basis === "MAP" ? opts.mapWatts : opts.ftpWatts;
    if (newAnchor === undefined) {
      const which = rationale.basis === "MAP" ? "mapWatts" : "ftpWatts";
      report.skipped.push({
        workoutId: workout.id,
        name: workout.name,
        reason: `${which} not provided`,
      });
      continue;
    }

    if (newAnchor === rationale.anchorWatts) {
      report.skipped.push({
        workoutId: workout.id,
        name: workout.name,
        reason: `already at ${newAnchor}W (${rationale.basis})`,
      });
      continue;
    }

    const result = regenerateWattsInDescription(
      description,
      rationale,
      newAnchor
    );

    if (result.stepCount !== result.intensityCount) {
      report.warnings.push(
        `${workout.name}: step lines (${result.stepCount}) and intensities (${result.intensityCount}) don't agree. ` +
          "Watts updated only on lines that matched in source order — check the workout body afterwards."
      );
    }
    if (result.matched === 0) {
      report.skipped.push({
        workoutId: workout.id,
        name: workout.name,
        reason:
          "no step lines contained a watts target to regenerate. " +
          "Workout body may have been edited away from absolute-watt format.",
      });
      continue;
    }

    if (!dryRun) {
      await api.updateWorkout(workout.id, {
        description: result.description,
      });
    }

    report.updated.push({
      workoutId: workout.id,
      name: workout.name,
      folder: folderName,
      ...(rationale.seedId ? { seedId: rationale.seedId } : {}),
      basis: rationale.basis,
      oldAnchorWatts: rationale.anchorWatts,
      newAnchorWatts: newAnchor,
    });
  }

  if (!opts.mapWatts) {
    report.warnings.push(
      "mapWatts not provided — MAP-anchored workouts were skipped."
    );
  }
  if (!opts.ftpWatts) {
    report.warnings.push(
      "ftpWatts not provided — FTP-anchored workouts were skipped."
    );
  }

  return report;
}
