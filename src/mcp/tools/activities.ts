import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
} from "./common.js";

// Stream payloads scale with activity duration and are unbounded; this budget
// caps the model-facing size by downsampling resolution, not by dropping the tail.
const STREAMS_CHARACTER_BUDGET = 40_000;

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
  return activity;
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
  return packStreams(
    streams as unknown as Record<string, unknown>,
    STREAMS_CHARACTER_BUDGET
  );
}

type PackedStreams = {
  samples: number;
  original_samples: number;
  downsampled: boolean;
  stride: number;
  streams: Record<string, unknown>;
};

// Downsample by index stride so the full ride stays represented at lower
// resolution, rather than truncating the payload and losing the tail.
export function packStreams(
  streams: Record<string, unknown>,
  budget: number
): PackedStreams {
  const original = maxArrayLength(streams);
  const fits = (s: Record<string, unknown>) =>
    JSON.stringify({ streams: s }).length <= budget;

  let stride = 1;
  let out = streams;
  if (!fits(streams)) {
    stride = Math.max(
      2,
      Math.ceil(JSON.stringify({ streams }).length / budget)
    );
    out = downsample(streams, stride);
    while (!fits(out)) {
      stride += 1;
      out = downsample(streams, stride);
    }
  }

  return {
    samples: maxArrayLength(out),
    original_samples: original,
    downsampled: stride > 1,
    stride,
    streams: out,
  };
}

function downsample(
  streams: Record<string, unknown>,
  stride: number
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(streams)) {
    out[key] = Array.isArray(value)
      ? value.filter((_, i) => i % stride === 0)
      : value;
  }
  return out;
}

function maxArrayLength(streams: Record<string, unknown>): number {
  let max = 0;
  for (const value of Object.values(streams)) {
    if (Array.isArray(value)) max = Math.max(max, value.length);
  }
  return max;
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
