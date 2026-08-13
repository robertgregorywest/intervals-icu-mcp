import { z } from "zod";
import type { IIntervalsClient } from "../index.js";

export const writeTrackRunsSchema = z.object({
  activityId: z
    .union([z.string(), z.number()])
    .describe(
      'Completed track activity ID (e.g. "i173732945" from get_activities, or a ' +
        "bare number). Must be the ride the lap splits were timed on."
    ),
  splits: z
    .string()
    .describe(
      "The lap-timer export, pasted as exported. One row per lap: run identifier, " +
        "cumulative distance (m), cumulative time (s), lap time (s). A header row " +
        "and extra trailing columns are fine. Rows are grouped into runs by the " +
        "first column, in the order they appear."
    ),
  lapDistanceMeters: z
    .number()
    .positive()
    .optional()
    .describe("Lap length in metres. Defaults to 250."),
  preview: z
    .boolean()
    .optional()
    .describe(
      "Compose the intervals and return them without writing anything. Use this " +
        "first: the write replaces every interval on the activity."
    ),
});

const reading = z.object({
  watts: z.number().optional(),
  wattsBand: z.number().optional(),
  cadence: z.number().optional(),
  cadenceBand: z.number().optional(),
  heartrate: z.number().optional(),
  heartrateBand: z.number().optional(),
});

export const writeTrackRunsOutputSchema = z.object({
  activityId: z.string(),
  mode: z.enum(["written", "preview"]),
  runs: z.array(
    z.object({
      run: z.string(),
      label: z.string(),
      verdict: z.enum(["strong", "marginal", "weak", "ambiguous"]),
      reason: z.string().optional(),
      startIndex: z.number(),
      endIndex: z.number(),
      fittedStartSeconds: z.number(),
      fittedEndSeconds: z.number(),
      startDriftSeconds: z.number(),
      endDriftSeconds: z.number(),
      fittedReading: reading,
      snappedReading: reading,
    })
  ),
  intervalsReplaced: z.number(),
  intervalsAfterWrite: z.number().optional(),
  notes: z.array(z.string()),
});

export async function writeTrackRuns(
  client: IIntervalsClient,
  args: z.infer<typeof writeTrackRunsSchema>
): Promise<z.infer<typeof writeTrackRunsOutputSchema>> {
  return client.writeTrackRuns({
    activityId: normalizeActivityId(args.activityId),
    splits: args.splits,
    lapDistanceMeters: args.lapDistanceMeters,
    preview: args.preview,
  });
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}
