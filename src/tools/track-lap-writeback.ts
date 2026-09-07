import { z } from "zod";
import type { IIntervalsClient } from "../index.js";
import { resolveTrackInputs, trackInputFields } from "./track-inputs.js";

export const writeTrackRunsSchema = z.object({
  ...trackInputFields,
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
    ...resolveTrackInputs(client, args),
    preview: args.preview,
  });
}
