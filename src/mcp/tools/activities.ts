import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getActivitiesSchema = z.object({
  oldest: z.string().describe("Start date in YYYY-MM-DD format"),
  newest: z.string().describe("End date in YYYY-MM-DD format"),
});

export async function getActivities(
  client: IIntervalsClient,
  args: z.infer<typeof getActivitiesSchema>
): Promise<string> {
  const activities = await client.getActivities(args.oldest, args.newest);
  return JSON.stringify(activities, null, 2);
}

export const getActivitySchema = z.object({
  id: z.number().describe("Activity ID"),
  includeIntervals: z
    .boolean()
    .optional()
    .describe("Include detected interval analysis (default: false)"),
});

export async function getActivity(
  client: IIntervalsClient,
  args: z.infer<typeof getActivitySchema>
): Promise<string> {
  const activity = await client.getActivity(args.id, args.includeIntervals);
  return JSON.stringify(activity, null, 2);
}

export const getActivityStreamsSchema = z.object({
  id: z.number().describe("Activity ID"),
  types: z
    .array(z.string())
    .optional()
    .describe(
      'Stream types to fetch, e.g. ["watts", "heartrate", "cadence"]. Omit for all streams.'
    ),
});

export async function getActivityStreams(
  client: IIntervalsClient,
  args: z.infer<typeof getActivityStreamsSchema>
): Promise<string> {
  const streams = await client.getActivityStreams(args.id, args.types);
  return JSON.stringify(streams, null, 2);
}
