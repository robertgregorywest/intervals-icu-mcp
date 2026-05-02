import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
  truncateForCharacterLimit,
} from "./common.js";

export const getActivitiesSchema = z.object({
  oldest: dateString.describe("Start date in YYYY-MM-DD format"),
  newest: dateString.describe("End date in YYYY-MM-DD format"),
  limit: limitField.optional(),
});

export async function getActivities(
  client: IIntervalsClient,
  args: z.infer<typeof getActivitiesSchema>
): Promise<string> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getActivities(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  const payload = {
    total,
    count: items.length,
    truncated,
    ...(truncated
      ? {
          message:
            "Result list truncated by limit. Increase 'limit' or narrow the date range.",
        }
      : {}),
    activities: items,
  };
  return truncateForCharacterLimit(
    payload,
    "Activity payload exceeds character limit. Narrow the date range or reduce limit."
  );
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
  return truncateForCharacterLimit(
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
): Promise<string> {
  const streams = await client.getActivityStreams(args.id, args.types);
  return truncateForCharacterLimit(
    streams,
    "Stream data exceeds character limit. Request fewer stream types via the 'types' parameter."
  );
}
