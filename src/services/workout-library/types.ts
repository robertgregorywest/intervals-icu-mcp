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

export type RationaleBasis = "MAP" | "FTP";

export interface RationaleIntensity {
  stepRef: string;
  pct: number | [number, number];
}

export interface Rationale {
  basis: RationaleBasis;
  anchorWatts: number;
  anchorDate?: string;
  seedId?: string;
  intensities?: RationaleIntensity[];
}

export interface WorkoutSummary {
  id: number;
  name: string;
  type?: string;
  folder_id?: number | null;
  folder_name?: string;
  totalSeconds: number;
  stepCount: number;
  hasRationale: boolean;
  oneLine: string;
}
