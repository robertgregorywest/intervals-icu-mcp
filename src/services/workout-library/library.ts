import type { IWorkoutLibraryApi } from "./api.js";
import type {
  LibraryFolder,
  LibraryNode,
  LibraryWorkout,
  LibraryWorkoutSummary,
  WorkoutSummary,
} from "./types.js";
import { isFolderNode } from "./types.js";
import {
  extractPurpose,
  parseDescriptionSummary,
  stripMarkers,
} from "./parser.js";
import { extractSeedId } from "./render.js";
import { runSync } from "./sync.js";
import type { SyncOptions, SyncReport } from "./sync.js";

export interface LibraryListing {
  folders: Array<{ id: number; name: string; num_workouts: number }>;
  workouts: WorkoutSummary[];
}

export interface LibraryItem {
  workout: LibraryWorkout;
  description_text: string;
  /** The template this workout came from, or null if nothing manages it. */
  seedId: string | null;
  summary: ReturnType<typeof parseDescriptionSummary>;
}

export interface IWorkoutLibrary {
  list(folderName?: string): Promise<LibraryListing>;
  get(workoutId: number): Promise<LibraryItem>;
  sync(opts?: SyncOptions): Promise<SyncReport>;
}

export class WorkoutLibrary implements IWorkoutLibrary {
  private api: IWorkoutLibraryApi;

  constructor(api: IWorkoutLibraryApi) {
    this.api = api;
  }

  async sync(opts: SyncOptions = {}): Promise<SyncReport> {
    return runSync(this.api, opts);
  }

  async list(folderName?: string): Promise<LibraryListing> {
    const folders = await this.api.listFolders();
    const filtered = folderName
      ? folders.filter((f) => f.name === folderName)
      : folders;

    const workouts: WorkoutSummary[] = [];
    const folderEntries: LibraryListing["folders"] = [];

    for (const folder of filtered) {
      const collected: LibraryWorkoutSummary[] = [];
      collectWorkouts(folder, collected);
      folderEntries.push({
        id: folder.id,
        name: folder.name,
        num_workouts: collected.length,
      });
      for (const w of collected) {
        const description = w.description ?? "";
        const purpose = extractPurpose(description);
        workouts.push({
          id: w.id,
          name: w.name,
          type: w.type,
          folder_id: folder.id,
          folder_name: folder.name,
          ...parseDescriptionSummary(description),
          ...(purpose ? { purpose } : {}),
        });
      }
    }

    return { folders: folderEntries, workouts };
  }

  async get(workoutId: number): Promise<LibraryItem> {
    const workout = await this.api.getWorkout(workoutId);
    const description = workout.description ?? "";
    return {
      workout,
      description_text: stripMarkers(description),
      seedId: extractSeedId(description),
      summary: parseDescriptionSummary(description),
    };
  }
}

function collectWorkouts(
  node: LibraryNode,
  out: LibraryWorkoutSummary[]
): void {
  if (isFolderNode(node)) {
    for (const child of node.children ?? []) {
      collectWorkouts(child, out);
    }
  } else {
    out.push(node);
  }
}

export function createWorkoutLibrary(api: IWorkoutLibraryApi): WorkoutLibrary {
  return new WorkoutLibrary(api);
}

export type { LibraryFolder };
