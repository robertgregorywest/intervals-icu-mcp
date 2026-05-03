import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
  withCharacterLimit,
} from "./common.js";

export const getActivitiesSchema = z.object({
  oldest: dateString.describe("Start date in YYYY-MM-DD format"),
  newest: dateString.describe("End date in YYYY-MM-DD format"),
  limit: limitField.optional(),
});

export const getActivitiesOutputSchema = z
  .object({
    total: z.number().describe("Activities matching the date range"),
    count: z.number().describe("Activities returned (after limit applied)"),
    truncated: z.boolean(),
    message: z.string().optional(),
    activities: z.array(z.object({}).passthrough()),
  })
  .passthrough();

export async function getActivities(
  client: IIntervalsClient,
  args: z.infer<typeof getActivitiesSchema>
): Promise<z.infer<typeof getActivitiesOutputSchema>> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getActivities(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  return {
    total,
    count: items.length,
    truncated,
    ...(truncated
      ? {
          message:
            "Result list truncated by limit. Increase 'limit' or narrow the date range.",
        }
      : {}),
    activities: items as Array<Record<string, unknown>>,
  };
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
): Promise<unknown> {
  const activity = await client.getActivity(args.id, args.includeIntervals);
  return withCharacterLimit(
    activity,
    "Activity payload exceeds character limit. Try includeIntervals=false."
  );
}

export const getActivityStreamsSchema = z.object({
  id: z.number().describe("Activity ID"),
  types: z
    .array(z.string())
    .optional()
    .describe(
      'Stream types to fetch, e.g. ["watts", "heartrate", "cadence"]. ' +
        "Strongly recommended — full streams can be very large for long activities."
    ),
});

export async function getActivityStreams(
  client: IIntervalsClient,
  args: z.infer<typeof getActivityStreamsSchema>
): Promise<unknown> {
  const streams = await client.getActivityStreams(args.id, args.types);
  return withCharacterLimit(
    streams,
    "Stream data exceeds character limit. Request fewer stream types via the 'types' parameter."
  );
}
