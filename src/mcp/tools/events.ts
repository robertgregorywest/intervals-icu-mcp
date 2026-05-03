import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";
import {
  applyLimit,
  assertDateRange,
  dateString,
  limitField,
} from "./common.js";

const eventCategoryEnum = z.enum([
  "WORKOUT",
  "NOTE",
  "RACE_A",
  "RACE_B",
  "RACE_C",
  "HOLIDAY",
  "SICK",
  "INJURED",
]);

const sportTypeEnum = z.enum([
  "Ride",
  "Run",
  "Swim",
  "VirtualRide",
  "MountainBikeRide",
  "GravelRide",
  "TrailRun",
  "WeightTraining",
  "Yoga",
  "Hike",
  "OpenWaterSwim",
]);

export const getEventsSchema = z.object({
  oldest: dateString.describe("Start date in YYYY-MM-DD format"),
  newest: dateString.describe("End date in YYYY-MM-DD format"),
  limit: limitField.optional(),
});

export const getEventsOutputSchema = z
  .object({
    total: z.number(),
    count: z.number(),
    truncated: z.boolean(),
    message: z.string().optional(),
    events: z.array(z.object({}).passthrough()),
  })
  .passthrough();

export async function getEvents(
  client: IIntervalsClient,
  args: z.infer<typeof getEventsSchema>
): Promise<z.infer<typeof getEventsOutputSchema>> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getEvents(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  return {
    total,
    count: items.length,
    truncated,
    ...(truncated
      ? {
          message:
            "Result list truncated. Increase 'limit' or narrow the date range.",
        }
      : {}),
    events: items as unknown as Array<Record<string, unknown>>,
  };
}

export const getEventSchema = z.object({
  id: z.number().describe("Event ID"),
});

export async function getEvent(
  client: IIntervalsClient,
  args: z.infer<typeof getEventSchema>
): Promise<Record<string, unknown>> {
  return (await client.getEvent(args.id)) as unknown as Record<string, unknown>;
}

export const updateEventSchema = z.object({
  id: z.number().describe("Event ID to update"),
  name: z.string().optional().describe("Updated event name"),
  description: z
    .string()
    .optional()
    .describe("Updated description/workout text"),
  date: dateString.optional().describe("Updated date in YYYY-MM-DD format"),
  category: eventCategoryEnum.optional().describe("Updated event category"),
  type: sportTypeEnum.optional().describe("Updated sport type"),
  color: z.string().optional().describe("Updated event color"),
});

export async function updateEvent(
  client: IIntervalsClient,
  args: z.infer<typeof updateEventSchema>
): Promise<Record<string, unknown>> {
  const { id, date, ...fields } = args;
  const data: Record<string, unknown> = { ...fields };
  if (date) {
    data.start_date_local = `${date}T00:00:00`;
  }
  return (await client.updateEvent(id, data)) as unknown as Record<
    string,
    unknown
  >;
}

export const deleteEventsSchema = z.object({
  ids: z
    .array(
      z.union([
        z.object({ id: z.number().describe("Event ID") }).strict(),
        z.object({ external_id: z.string().describe("External ID") }).strict(),
      ])
    )
    .min(1)
    .describe(
      "Array of identifiers to delete. Each item must be exactly one of " +
        "{ id: number } or { external_id: string }."
    ),
});

export const deleteEventsOutputSchema = z.object({
  success: z.literal(true),
  deleted: z.number().describe("Number of identifiers submitted for deletion"),
});

export async function deleteEvents(
  client: IIntervalsClient,
  args: z.infer<typeof deleteEventsSchema>
): Promise<z.infer<typeof deleteEventsOutputSchema>> {
  await client.deleteEvents(args.ids);
  return { success: true, deleted: args.ids.length };
}
