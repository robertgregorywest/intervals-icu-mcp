import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { workoutStepSchema, repeatBlockSchema } from "./workouts.js";

export const listWorkoutLibrarySchema = z.object({
  folder: z
    .string()
    .optional()
    .describe(
      "Optional folder name to filter (exact match). " +
        "Omit to list all folders."
    ),
});

export const listWorkoutLibraryOutputSchema = z.object({
  folders: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      num_workouts: z.number(),
    })
  ),
  workouts: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      type: z.string().optional(),
      folder_id: z.number().nullable().optional(),
      folder_name: z.string().optional(),
      stepCount: z.number(),
      totalSeconds: z.number(),
      hasRationale: z.boolean(),
      oneLine: z.string(),
    })
  ),
});

export async function listWorkoutLibrary(
  client: IIntervalsClient,
  args: z.infer<typeof listWorkoutLibrarySchema>
): Promise<z.infer<typeof listWorkoutLibraryOutputSchema>> {
  return client.listWorkoutLibrary(args.folder);
}

export const getWorkoutLibraryItemSchema = z.object({
  id: z.number().describe("Library workout ID (from list_workout_library)"),
});

export async function getWorkoutLibraryItem(
  client: IIntervalsClient,
  args: z.infer<typeof getWorkoutLibraryItemSchema>
): Promise<unknown> {
  return client.getWorkoutLibraryItem(args.id);
}

export const seedWorkoutLibrarySchema = z.object({
  mapWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's MAP (Maximal Aerobic Power) in watts. Required to seed " +
        "MAP-anchored templates (VO2 4x4, VO2 30/30, Z2, MIET, recovery, MAP test). " +
        "Omit to skip those templates."
    ),
  ftpWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's FTP in watts. Required to seed FTP-anchored templates " +
        "(FTP test, threshold 2x20, sweet spot 3x12). Omit to skip those templates."
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "If true, returns the planned seed report without creating folders or workouts."
    ),
});

export const seedWorkoutLibraryOutputSchema = z.object({
  dryRun: z.boolean(),
  created: z.array(
    z.object({
      seedId: z.string(),
      name: z.string(),
      folder: z.string(),
      basis: z.enum(["MAP", "FTP"]),
      anchorWatts: z.number(),
      description: z.string(),
      workoutId: z.number().optional(),
    })
  ),
  skipped: z.array(
    z.object({
      seedId: z.string(),
      name: z.string(),
      reason: z.string(),
    })
  ),
  warnings: z.array(z.string()),
});

export async function seedWorkoutLibrary(
  client: IIntervalsClient,
  args: z.infer<typeof seedWorkoutLibrarySchema>
): Promise<z.infer<typeof seedWorkoutLibraryOutputSchema>> {
  return client.seedWorkoutLibrary(args);
}

export const refreshWorkoutLibrarySchema = z.object({
  mapWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's current MAP in watts. Workouts whose rationale.basis is " +
        '"MAP" will be regenerated against this value. Omit to skip MAP-anchored workouts.'
    ),
  ftpWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's current FTP in watts. Workouts whose rationale.basis is " +
        '"FTP" will be regenerated against this value. Omit to skip FTP-anchored workouts.'
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "If true, returns the planned refresh report without writing any updates."
    ),
});

export const refreshWorkoutLibraryOutputSchema = z.object({
  dryRun: z.boolean(),
  updated: z.array(
    z.object({
      workoutId: z.number(),
      name: z.string(),
      folder: z.string(),
      seedId: z.string().optional(),
      basis: z.enum(["MAP", "FTP"]),
      oldAnchorWatts: z.number(),
      newAnchorWatts: z.number(),
    })
  ),
  skipped: z.array(
    z.object({
      workoutId: z.number(),
      name: z.string(),
      reason: z.string(),
    })
  ),
  warnings: z.array(z.string()),
});

export async function refreshWorkoutLibrary(
  client: IIntervalsClient,
  args: z.infer<typeof refreshWorkoutLibrarySchema>
): Promise<z.infer<typeof refreshWorkoutLibraryOutputSchema>> {
  return client.refreshWorkoutLibrary(args);
}

const rationaleIntensitySchema = z.object({
  stepRef: z
    .string()
    .describe("Step label or duration that this intensity refers to"),
  pct: z
    .union([z.number(), z.tuple([z.number(), z.number()])])
    .describe("Single percentage or [low, high] range"),
});

const rationaleSchema = z.object({
  basis: z
    .enum(["MAP", "FTP"])
    .describe("Anchor basis — must match the unit of anchorWatts"),
  anchorWatts: z
    .number()
    .int()
    .positive()
    .describe(
      "MAP or FTP value (in watts) used to compute the absolute watts in the steps"
    ),
  seedId: z
    .string()
    .optional()
    .describe(
      "Stable identifier for this template. Provide a unique slug if you want refresh_workout_library to recognize and regenerate this workout when the anchor changes."
    ),
  intensities: z
    .array(rationaleIntensitySchema)
    .optional()
    .describe("Per-step %MAP or %FTP intent, used by refresh_workout_library."),
});

export const createWorkoutLibraryItemSchema = z.object({
  name: z.string().min(1).describe("Workout name"),
  folder: z
    .string()
    .optional()
    .describe(
      'Folder to place the workout in (created if missing). Defaults to "Coach: Custom".'
    ),
  type: z
    .string()
    .optional()
    .describe('Sport type (e.g. "Ride", "VirtualRide"). Defaults to "Ride".'),
  description: z
    .string()
    .optional()
    .describe(
      "Free-form prose shown above the steps in the Intervals.icu UI " +
        "(rationale, intent, source citations)."
    ),
  steps: z
    .array(z.union([workoutStepSchema, repeatBlockSchema]))
    .min(1)
    .describe("Workout steps and repeat blocks. Same shape as create_workout."),
  rationale: rationaleSchema
    .optional()
    .describe(
      "Optional rationale block. Embedding it makes the workout refreshable " +
        "via refresh_workout_library when MAP or FTP changes. Required if you " +
        "want the coach to maintain this workout across anchor updates."
    ),
});

export const createWorkoutLibraryItemOutputSchema = z.object({
  workoutId: z.number(),
  name: z.string(),
  folder: z.string(),
  description: z.string(),
});

export async function createWorkoutLibraryItem(
  client: IIntervalsClient,
  args: z.infer<typeof createWorkoutLibraryItemSchema>
): Promise<z.infer<typeof createWorkoutLibraryItemOutputSchema>> {
  return client.createWorkoutLibraryItem(args);
}
