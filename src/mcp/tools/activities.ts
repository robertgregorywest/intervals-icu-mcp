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
  id: z
    .union([z.string(), z.number()])
    .describe(
      "Activity ID — use the string form returned by get_activities / get_training_week_summary " +
        '(e.g. "i151827252"). Bare numbers are also accepted and will be prefixed automatically. ' +
        "Note: activities synced from Strava cannot be retrieved via the API."
    ),
  includeIntervals: z
    .boolean()
    .optional()
    .describe("Include detected interval analysis (default: false)"),
});

export async function getActivity(
  client: IIntervalsClient,
  args: z.infer<typeof getActivitySchema>
): Promise<unknown> {
  const id = normalizeActivityId(args.id);
  const activity = await client.getActivity(id, args.includeIntervals);
  const stub = detectStravaStub(activity as Record<string, unknown>);
  if (stub) return stub;
  return withCharacterLimit(
    activity,
    "Activity payload exceeds character limit. Try includeIntervals=false."
  );
}

export const getActivityStreamsSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .describe(
      "Activity ID — use the string form returned by get_activities / get_training_week_summary " +
        '(e.g. "i151827252"). Bare numbers are also accepted and will be prefixed automatically. ' +
        "Note: activities synced from Strava have no stream data available."
    ),
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
  const id = normalizeActivityId(args.id);
  const streams = await client.getActivityStreams(id, args.types);
  return withCharacterLimit(
    streams,
    "Stream data exceeds character limit. Request fewer stream types via the 'types' parameter."
  );
}

function normalizeActivityId(id: string | number): string {
  if (typeof id === "number") return `i${id}`;
  return id.startsWith("i") ? id : `i${id}`;
}

function detectStravaStub(
  activity: Record<string, unknown>
): Record<string, unknown> | null {
  const note = activity._note;
  if (typeof note === "string" && /strava/i.test(note)) {
    return {
      _strava_limitation: true,
      _note: note,
      id: activity.id,
      source: activity.source,
      start_date_local: activity.start_date_local,
      message:
        "This activity was synced from Strava and cannot be retrieved via the Intervals.icu API " +
        "(Strava API terms prohibit third-party access). " +
        "Only activities recorded directly by Intervals.icu-compatible devices are available.",
    };
  }
  return null;
}
