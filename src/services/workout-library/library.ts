import type { IWorkoutLibraryApi } from "./api.js";
import type {
  LibraryFolder,
  LibraryNode,
  LibraryWorkout,
  LibraryWorkoutSummary,
  Rationale,
  WorkoutSummary,
} from "./types.js";
import { isFolderNode } from "./types.js";
import {
  extractRationale,
  parseDescriptionSummary,
  stripRationale,
} from "./parser.js";
import { runSeed } from "./seed.js";
import type { SeedOptions, SeedReport } from "./seed.js";
import { runRefresh } from "./refresh.js";
import type { RefreshOptions, RefreshReport } from "./refresh.js";
import { runCreate } from "./create.js";
import type {
  CreateLibraryItemInput,
  CreateLibraryItemResult,
} from "./create.js";
import type { IWorkoutBuilder } from "../workout-builder/index.js";

export interface LibraryListing {
  folders: Array<{ id: number; name: string; num_workouts: number }>;
  workouts: WorkoutSummary[];
}

export interface LibraryItem {
  workout: LibraryWorkout;
  description_text: string;
  rationale: Rationale | null;
  summary: ReturnType<typeof parseDescriptionSummary>;
}

export interface IWorkoutLibrary {
  list(folderName?: string): Promise<LibraryListing>;
  get(workoutId: number): Promise<LibraryItem>;
  seed(opts?: SeedOptions): Promise<SeedReport>;
  refresh(opts?: RefreshOptions): Promise<RefreshReport>;
  create(input: CreateLibraryItemInput): Promise<CreateLibraryItemResult>;
}

export class WorkoutLibrary implements IWorkoutLibrary {
  private api: IWorkoutLibraryApi;
  private builder: IWorkoutBuilder;

  constructor(api: IWorkoutLibraryApi, builder: IWorkoutBuilder) {
    this.api = api;
    this.builder = builder;
  }

  async seed(opts: SeedOptions = {}): Promise<SeedReport> {
    return runSeed(this.api, this.builder, opts);
  }

  async refresh(opts: RefreshOptions = {}): Promise<RefreshReport> {
    return runRefresh(this.api, this.builder, opts);
  }

  async create(
    input: CreateLibraryItemInput
  ): Promise<CreateLibraryItemResult> {
    return runCreate(this.api, this.builder, input);
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
        const summary = parseDescriptionSummary(w.description ?? "");
        workouts.push({
          id: w.id,
          name: w.name,
          type: w.type,
          folder_id: folder.id,
          folder_name: folder.name,
          ...summary,
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
      description_text: stripRationale(description),
      rationale: extractRationale(description),
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

export function createWorkoutLibrary(
  api: IWorkoutLibraryApi,
  builder: IWorkoutBuilder
): WorkoutLibrary {
  return new WorkoutLibrary(api, builder);
}

// re-export for callers that want them via library facade
export { extractRationale, stripRationale };

export type { LibraryFolder };
