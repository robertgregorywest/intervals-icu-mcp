import type { IWorkoutLibraryApi } from "./api.js";
import type { IWorkoutBuilder } from "../workout-builder/index.js";
import type { WorkoutStep, RepeatBlock } from "../workout-builder/types.js";
import type { LibraryWorkout, Rationale } from "./types.js";
import { embedRationale } from "./parser.js";
import { ensureFolder, indexFolders } from "./seed.js";

export interface CreateLibraryItemInput {
  name: string;
  folder?: string;
  type?: string;
  description?: string;
  steps: Array<WorkoutStep | RepeatBlock>;
  rationale?: Rationale;
}

export interface CreateLibraryItemResult {
  workoutId: number;
  name: string;
  folder: string;
  description: string;
}

export const DEFAULT_CUSTOM_FOLDER = "Coach: Custom";

export async function runCreate(
  api: IWorkoutLibraryApi,
  builder: IWorkoutBuilder,
  input: CreateLibraryItemInput
): Promise<CreateLibraryItemResult> {
  const folderName = input.folder?.trim() || DEFAULT_CUSTOM_FOLDER;
  const folders = await api.listFolders();
  const index = indexFolders(folders);

  const folder = await ensureFolder(api, index, folderName);
  const existingNames =
    index.workoutNamesByFolderId.get(folder.id) ?? new Set<string>();
  if (existingNames.has(input.name)) {
    throw new Error(
      `Workout "${input.name}" already exists in folder "${folderName}". ` +
        "Pick a different name or delete the existing workout first."
    );
  }

  const body = builder.toDescription(input.steps);
  const proseAndBody = input.description?.trim()
    ? `${input.description.trim()}\n\n${body}`
    : body;
  const description = input.rationale
    ? embedRationale(proseAndBody, input.rationale)
    : proseAndBody;

  const created: LibraryWorkout = await api.createWorkout({
    name: input.name,
    description,
    folder_id: folder.id,
    type: input.type ?? "Ride",
  });

  return {
    workoutId: created.id,
    name: created.name,
    folder: folderName,
    description,
  };
}
