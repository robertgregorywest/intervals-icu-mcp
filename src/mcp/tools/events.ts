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

export async function getEvents(
  client: IIntervalsClient,
  args: z.infer<typeof getEventsSchema>
): Promise<string> {
  assertDateRange(args.oldest, args.newest);
  const all = await client.getEvents(args.oldest, args.newest);
  const limit = args.limit ?? 50;
  const { items, total, truncated } = applyLimit(all, limit);
  return JSON.stringify(
    {
      total,
      count: items.length,
      truncated,
      ...(truncated
        ? {
            message:
              "Result list truncated. Increase 'limit' or narrow the date range.",
          }
        : {}),
      events: items,
    },
    null,
    2
  );
}

export const getEventSchema = z.object({
  id: z.number().describe("Event ID"),
});

export async function getEvent(
  client: IIntervalsClient,
  args: z.infer<typeof getEventSchema>
): Promise<string> {
  const event = await client.getEvent(args.id);
  return JSON.stringify(event, null, 2);
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
): Promise<string> {
  const { id, date, ...fields } = args;
  const data: Record<string, unknown> = { ...fields };
  if (date) {
    data.start_date_local = `${date}T00:00:00`;
  }
  const event = await client.updateEvent(id, data);
  return JSON.stringify(event, null, 2);
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

export async function deleteEvents(
  client: IIntervalsClient,
  args: z.infer<typeof deleteEventsSchema>
): Promise<string> {
  await client.deleteEvents(args.ids);
  return JSON.stringify({ success: true, deleted: args.ids.length });
}
