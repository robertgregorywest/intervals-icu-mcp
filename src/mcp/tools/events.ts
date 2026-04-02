import { z } from "zod";
import type { IIntervalsClient } from "../../index.js";

export const getEventsSchema = z.object({
  oldest: z.string().describe("Start date in YYYY-MM-DD format"),
  newest: z.string().describe("End date in YYYY-MM-DD format"),
});

export async function getEvents(
  client: IIntervalsClient,
  args: z.infer<typeof getEventsSchema>
): Promise<string> {
  const events = await client.getEvents(args.oldest, args.newest);
  return JSON.stringify(events, null, 2);
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
  date: z.string().optional().describe("Updated date in YYYY-MM-DD format"),
  category: z
    .string()
    .optional()
    .describe(
      "Updated category: WORKOUT, NOTE, RACE_A, RACE_B, RACE_C, HOLIDAY, SICK, INJURED"
    ),
  type: z
    .string()
    .optional()
    .describe("Updated sport type: Ride, Run, Swim, VirtualRide, etc."),
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
      z.object({
        id: z.number().optional().describe("Event ID"),
        external_id: z.string().optional().describe("External ID"),
      })
    )
    .describe("Array of event identifiers to delete (by id or external_id)"),
});

export async function deleteEvents(
  client: IIntervalsClient,
  args: z.infer<typeof deleteEventsSchema>
): Promise<string> {
  await client.deleteEvents(args.ids);
  return JSON.stringify({ success: true, deleted: args.ids.length });
}
