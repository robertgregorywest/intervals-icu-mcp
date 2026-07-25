// Intervals.icu folders endpoint returns a tree: top-level FOLDER entries each
// have a `children` array containing nested folders and workouts, distinguished
// by `type` ("FOLDER" vs a sport type like "Ride"/"Run"/"Swim").
export interface LibraryFolder {
  id: number;
  name: string;
  type: "FOLDER";
  description?: string | null;
  children?: LibraryNode[];
  num_workouts?: number;
  athlete_id?: string;
  [key: string]: unknown;
}

export interface LibraryWorkoutSummary {
  id: number;
  name: string;
  type: string;
  description?: string;
  workout_doc?: WorkoutDoc | null;
  updated?: string;
  athlete_id?: string;
  [key: string]: unknown;
}

export interface LibraryWorkout extends LibraryWorkoutSummary {
  description: string;
}

export type LibraryNode = LibraryFolder | LibraryWorkoutSummary;

export interface WorkoutDoc {
  steps?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export function isFolderNode(node: LibraryNode): node is LibraryFolder {
  return (node as LibraryFolder).type === "FOLDER";
}

export interface LibraryWorkoutInput {
  name: string;
  description: string;
  folder_id?: number | null;
  type?: string;
}

/** The anchor a template's bare percentages are read against. */
export type AnchorBasis = "MAP" | "FTP";

export interface WorkoutSummary {
  id: number;
  name: string;
  type?: string;
  folder_id?: number | null;
  folder_name?: string;
  totalSeconds: number;
  stepCount: number;
  /** True when the workout carries a template marker, i.e. sync maintains it. */
  hasTemplate: boolean;
  /** What the workout is for — the template's purpose line. */
  purpose?: string;
  oneLine: string;
}
