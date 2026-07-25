import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

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
      hasTemplate: z.boolean(),
      purpose: z.string().optional(),
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

export const syncWorkoutLibrarySchema = z.object({
  mapWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's current MAP (Maximal Aerobic Power) in watts. Templates whose " +
        "basis is MAP are rendered against this value; omit and they are skipped."
    ),
  ftpWatts: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Athlete's current FTP in watts. Templates whose basis is FTP are rendered " +
        "against this value; omit and they are skipped."
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "If true, report what would be created and updated without writing anything."
    ),
});

const syncActionSchema = z.object({
  seedId: z.string(),
  name: z.string(),
  folder: z.string(),
  workoutId: z.number().optional(),
  changed: z.array(z.string()).optional(),
  adopted: z.boolean().optional(),
});

export const syncWorkoutLibraryOutputSchema = z.object({
  dryRun: z.boolean(),
  created: z.array(syncActionSchema),
  updated: z.array(syncActionSchema),
  unchanged: z.array(syncActionSchema),
  skipped: z.array(
    z.object({
      seedId: z.string(),
      name: z.string(),
      reason: z.string(),
    })
  ),
  orphans: z.array(
    z.object({
      workoutId: z.number(),
      name: z.string(),
      folder: z.string(),
      seedId: z.string(),
    })
  ),
  warnings: z.array(z.string()),
});

export async function syncWorkoutLibrary(
  client: IIntervalsClient,
  args: z.infer<typeof syncWorkoutLibrarySchema>
): Promise<z.infer<typeof syncWorkoutLibraryOutputSchema>> {
  return client.syncWorkoutLibrary(args);
}
